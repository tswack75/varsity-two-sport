import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from './core.js';
import {dailyRecords} from './analytics.js';
import {exportBackup, restoreBackup} from './history-import.js';
import {previewCalibration, scoreHistory} from './health-score.js';
import {recentChart, recentDomain, todayScore} from './health-score-ui.js';
import {buildOverlays, overlayConfig} from './overlay-series.js';
import {plotSeries} from './overlay-chart.js';

test('score reweights the observed components and distinguishes zeros from missing inputs', () => {
  const state = initialState(), date = '2026-11-02';
  state.mealData[date] = {breakfast: 4, lunch: null, afternoonSnack: 0};
  state.workoutSelections[date] = 'blue';
  let [result] = scoreHistory(state);
  assert.equal(result.value, 100);
  assert.equal(result.coverage, .35);
  assert.equal(result.count, 1);
  state.healthData[date] = {steps: 0, activeCalories: null};
  [result] = scoreHistory(state);
  assert.equal(result.coverage, .6);
  assert.equal(result.value, 100 * 35 / 60);
  assert.equal(result.components.find(item => item.key === 'steps').score, 0);
  state.healthData[date].activeCalories = 800;
  state.extraSnacks[date] = [{id:'test',rating:2}];
  state.completedWorkoutSessions['session'] = {date, type:'blue', completed:true};
  [result] = scoreHistory(state);
  assert.deepEqual(result.input.ratings, [4,2]);
  assert.equal(result.coverage, 1);
  assert.equal(result.value, 66.25);
  assert.equal(result.components.reduce((sum, item) => sum + item.points, 0), result.value);
});

test('native and imported history contribute without changing the saved records', () => {
  const state = initialState(), date = '2026-11-02', rest = '2026-11-03', empty = '2026-11-04';
  state.importedHistory.example = {normalized:[{date, steps:4000, meals:{dinner:3}}],
    strengthSessions:[{date, type:'maize', completed:true}]};
  state.workouts[date] = 'maize';
  state.healthData[date] = {steps:8000};
  state.workoutSelections[rest] = 'none';
  state.healthData[empty] = {weight:180};
  const before = structuredClone(state);
  const [logged, noWorkout, weightOnly] = scoreHistory(state);
  assert.deepEqual(state,before);
  assert.equal(logged.input.steps,8000);
  assert.equal(logged.input.workout,1);
  assert.equal(logged.input.food,3);
  assert.equal(noWorkout.value,0);
  assert.equal(noWorkout.coverage,.2);
  assert.equal(weightOnly.value,null);
  assert.equal(weightOnly.coverage,0);
});

test('calibration previews history without mutation and saved versions apply prospectively after restore', () => {
  const state = initialState();
  for (let day = 1; day <= 8; day++) state.healthData[`2026-11-0${day}`] = {steps:day*1000};
  state.healthData['2026-11-09'] = {steps:20000,activeCalories:400};
  const original = structuredClone(state);
  const {proposal, samples, comparison} = previewCalibration(state,'2026-11-09');
  assert.deepEqual(state,original);
  assert.deepEqual(samples,{steps:8,activeCalories:0});
  assert.deepEqual(proposal.targets,{steps:6000,activeCalories:400});
  assert.equal(proposal.effective,'2026-11-10');
  const {proposed, ...first} = comparison[0];
  assert.deepEqual(first,{date:'2026-11-01',original:12.5,version:1});
  assert.ok(Math.abs(proposed - 100/6) < 1e-9);
  state.settings.healthScoreVersions = [proposal];
  state.healthData['2026-11-10'] = {steps:6000};
  const restored = restoreBackup(exportBackup(state));
  const scores = scoreHistory(restored);
  assert.deepEqual(scores.slice(0,-1),scoreHistory(original));
  assert.equal(scores.at(-1).rule.version,2);
  assert.equal(scores.at(-1).value,100);
  assert.equal(previewCalibration(restored,'2026-11-11').proposal.version,3);
});

test('Today sparklines align dates across metrics and plot observed zero scores', () => {
  const day = '2026-11-08', domain = recentDomain(day);
  assert.deepEqual(domain,{start:'2026-11-02',end:day});
  assert.match(recentChart([{date:'2026-11-05',value:0}],domain,'Steps'), /cx="150.0"/);
  const state = initialState();
  state.healthData['2026-11-05'] = {steps:0};
  state.healthData[day] = {steps:8000};
  const markup = todayScore(scoreHistory(state),day,domain);
  assert.match(markup, /cx="150.0"/);
  assert.match(markup, /cx="280.0"/);
  assert.match(markup, /M150\.0 63\.0 M280\.0/);
  assert.match(markup, /Coverage 25% · 1 of 4 inputs/);
});

test('score overlays preserve real zeros, shared dates, and all display modes', () => {
  const state = initialState(), start = '2026-11-01', end = '2026-11-05';
  state.healthData[start] = {weight:190, steps:0};
  state.healthData[end] = {weight:189, steps:8000};
  const rows = dailyRecords(state), scores = scoreHistory(state), domain = {start,end};
  for (const mode of ['Points','Trend','Both']) {
    const items = overlayConfig({items:[{metric:'healthScore',mode},{metric:'weight',mode:'Both'}]}).items;
    const series = buildOverlays(state, rows, domain, items, scores);
    assert.equal(series[0].mode,mode);
    assert.deepEqual(series[0].points.map(row => row.indexValue),[0,100]);
    assert.equal(plotSeries(series,domain).dates.get(start).length,2);
  }
  const [allZero] = buildOverlays(state, rows, {start,end:start}, [{metric:'healthScore',mode:'Both'}], scores);
  assert.equal(allZero.points[0].indexValue,0);
  assert.equal(allZero.issue,'');
});
