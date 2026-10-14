import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,weeklyStrength} from './core.js';
import {setDailyHealth,selectWorkout,setOtherWorkout,weeklyTracker,completedTypes,dailyEntry} from './tracker.js';
import {ensureStrengthState,updateStrengthDraft,toggleProgressRequest,completeWorkout,lastExercise,formatSets,exerciseHistory,canonicalExercise} from './strength.js';
import {loadState,persistState} from './storage.js';
import {movementSeries,weeklyWorkoutSeries,exerciseProgressSeries,chartSvg} from './progression-simple.js';
import {weightProgressSeries,dateDomain} from './progression.js';
import {exerciseCard} from './strength-ui.js';

test('daily fields save independently; selecting a workout does not complete it',()=>{
  const state=initialState(),day='2026-10-14';ensureStrengthState(state);
  setDailyHealth(state,day,'weight','180.5');setDailyHealth(state,day,'steps','8000');setDailyHealth(state,day,'activeCalories','410');
  selectWorkout(state,day,'blue');assert.deepEqual(state.healthData[day],{weight:180.5,steps:8000,activeCalories:410});assert.equal(state.weightHistory[day],180.5);assert.deepEqual(completedTypes(state,day),[]);assert.equal(weeklyTracker(state,day).trainingPercent,0);
  selectWorkout(state,day,'none');assert.equal(state.workoutSelections[day],'none');assert.equal(state.workouts[day],undefined);
  selectWorkout(state,day,'other');setOtherWorkout(state,day,{description:'Walk and mobility',duration:'25'});assert.equal(state.workoutDetails[day].durationMinutes,25);
});

test('LAST regression: completed sets and + survive persistent reload and appear on the same date',async()=>{
  const previous=globalThis.localStorage,data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  try{
    const day='2026-10-14',state=initialState();ensureStrengthState(state);selectWorkout(state,day,'blue');
    updateStrengthDraft(state,day,'blue','Chest press',{sets:[{weight:70,reps:10},{weight:70,reps:9},{weight:65,reps:8}]});
    updateStrengthDraft(state,day,'blue','Seated cable row',{sets:[{weight:85,reps:12},{weight:85,reps:11},{weight:80,reps:10}]});
    toggleProgressRequest(state,day,'blue','Chest press');
    const result=completeWorkout(state,day,'blue');assert.equal(result.exercises,2);assert.equal(result.workingSets,6);
    await persistState(state);
    const restored=Object.assign(initialState(),await loadState());ensureStrengthState(restored);
    const press=lastExercise(restored,'Chest press',day),row=lastExercise(restored,'Seated cable row',day);
    assert.equal(press.date,day);assert.deepEqual(press.sets,[{weight:70,reps:10},{weight:70,reps:9},{weight:65,reps:8}]);
    assert.match(formatSets(press),/65 lb × 8/);assert.match(formatSets(row),/80 lb × 10/);assert.equal(press.progressRequested,true);
    const html=exerciseCard(restored,day,'blue','Chest press','3 × 6–10','machine or dumbbell',0,value=>String(value));
    assert.match(html,/LAST Oct 14/);assert.match(html,/70 lb × 10 · 70 lb × 9 · 65 lb × 8/);assert.match(html,/PROGRESSION REQUESTED \+/);
    assert.equal(restored.completedWorkoutSessions[`${day}:blue`].completed,true);assert.equal(weeklyStrength(restored,day).blue,true);
    toggleProgressRequest(restored,day,'blue','Chest press');assert.equal(lastExercise(restored,'Chest press',day).progressRequested,false);
    toggleProgressRequest(restored,day,'blue','Chest press');assert.equal(lastExercise(restored,'Chest press',day).progressRequested,true);
    const backup=JSON.parse(JSON.stringify({schemaVersion:1,state:restored})),fromBackup=Object.assign(initialState(),backup.state);ensureStrengthState(fromBackup);
    assert.deepEqual(lastExercise(fromBackup,'Chest press',day).sets,press.sets);
    updateStrengthDraft(fromBackup,day,'blue','Chest press',{sets:[{weight:70,reps:10},{weight:70,reps:10},{weight:65,reps:9}]});completeWorkout(fromBackup,day,'blue');
    assert.equal(fromBackup.strengthLogs.filter(log=>log.id===`${day}:blue:chest-press`).length,1);
    assert.equal(lastExercise(fromBackup,'Chest press',day).progressRequested,true);
  }finally{globalThis.localStorage=previous}
});

test('historical aliases merge known defaults but keep incomparable variants separate',()=>{
  assert.equal(canonicalExercise('Cable Lateral Raise'),canonicalExercise('Lateral Raise'));
  assert.equal(canonicalExercise('Cable Curl'),canonicalExercise('Curls'));
  assert.notEqual(canonicalExercise('Dumbbell Chest Press'),canonicalExercise('Machine Chest Press'));
  assert.notEqual(canonicalExercise('Dumbbell Lateral Raise'),canonicalExercise('Cable Lateral Raise'));
  const state=initialState();state.importedHealthQuestData.hash={strengthLogs:[{date:'2026-09-20',exercise:'Incline Dumbbell Press',increaseNextTime:true,sets:[{weight:30,reps:8},{weight:30,reps:7}]}]};
  const imported=lastExercise(state,'Incline dumbbell press','2026-10-14');assert.equal(imported.source,'Health Quest');assert.equal(imported.progressRequested,true);assert.deepEqual(imported.sets,[{weight:30,reps:8},{weight:30,reps:7}]);
});

test('movement, consistency, weight, and exercise charts use completed records',()=>{
  const state=initialState();ensureStrengthState(state);
  for(const [date,steps,calories,weight] of [['2026-10-12',8000,300,182],['2026-10-13',9000,340,181],['2026-10-14',7000,350,180]]){setDailyHealth(state,date,'steps',steps);setDailyHealth(state,date,'activeCalories',calories);setDailyHealth(state,date,'weight',weight)}
  selectWorkout(state,'2026-10-12','white');
  updateStrengthDraft(state,'2026-10-12','blue','Chest press',{sets:[{weight:70,reps:8}]});completeWorkout(state,'2026-10-12','blue');
  updateStrengthDraft(state,'2026-10-14','maize','Incline dumbbell press',{sets:[{weight:30,reps:8},{weight:30,reps:8}]});completeWorkout(state,'2026-10-14','maize');
  const week=weeklyWorkoutSeries(state,'2026-10-14')[0];assert.equal(week.goal,true);assert.equal(week.white,false);assert.equal(week.count,2);
  assert.deepEqual(movementSeries(state,'steps').map(point=>point.value),[8000,9000,7000]);assert.equal(movementSeries(state,'activeCalories').at(-1).value,350);
  assert.equal(weightProgressSeries(state).at(-1).value,180);assert.equal(exerciseProgressSeries(state,'Chest press','totalReps')[0].value,8);
  const svg=chartSvg(weightProgressSeries(state),{domain:dateDomain('30D','2026-10-14'),label:'Body weight'});assert.match(svg,/circle/);assert.match(svg,/polyline/);
});

test('old backup data and offline asset list remain intact',()=>{
  const old=initialState();old.mealData['2026-09-01']={dinner:4};old.simulatedGames.old={score:{us:3,them:2}};old.importedHealthQuestData.hash={raw:{entries:{'2026-09-01':{weight:190}}},normalized:[{date:'2026-09-01',weight:190}]};
  const restored=Object.assign(initialState(),JSON.parse(JSON.stringify(old)));ensureStrengthState(restored);
  assert.deepEqual(restored.mealData,old.mealData);assert.deepEqual(restored.simulatedGames,old.simulatedGames);assert.deepEqual(restored.importedHealthQuestData,old.importedHealthQuestData);
  assert.equal(dailyEntry(restored,'2026-09-01').weight,190);
  const sw=readFileSync(new URL('./sw.js',import.meta.url),'utf8');for(const asset of ['app-simple.js','tracker.js','progression-simple.js','strength-ui.js'])assert.ok(sw.includes(asset));
});
