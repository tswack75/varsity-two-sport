import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, MEALS} from './core.js';
import {dailyRecords} from './analytics.js';
import {addSnack, foodStats, rateMeal, renderFood, updateSnack} from './food.js';
import {exportBackup, mergeImport, previewImport, restoreBackup} from './history-import.js';
import {loadState, persistState} from './storage.js';
import {lastExercise} from './strength.js';
import {weeklyWorkoutSeries} from './progression-simple.js';

const day = '2026-11-16', day2 = '2026-11-17';
const sets = [{weight: 30, reps: 10}, {weight: 30, reps: 9}];
const healthQuest = {entries: {[day]: {
  weight: 180, bodyFat: 20, steps: 8200, activeCalories: 350, foodModel: 'meal-v3',
  mealBehavior: {breakfast: {score: 1}, afternoonSnack: {score: 2}, dinner: {score: 4}, nightSnack: {score: 0}},
  foodStructure: {legacy: true}, scoringModelVersion: 'v4.18.0'
}}, strengthHistory: [{date: day, completed: true, workoutName: 'Gym'}],
strengthLogs: [{date: day, exercise: 'Incline Dumbbell Press', sets, increaseNextTime: true}], meta: {storyArchive: ['legacy']}};
const olderVarsity = {schemaVersion: 1, appVersion: '1.1.0', state: {
  healthData: {[day]: {weight: 184, activeCalories: 330}, [day2]: {weight: 181}},
  mealData: {[day]: {breakfast: 3}}, workouts: {[day]: 'blue', [day2]: 'maize'},
  strengthLogs: [{date: day, exercise: 'Incline DB Press', weight: 35, reps: [8, 7]}],
  simulatedGames: {legacy: {score: 56}}, athleteProfile: {name: 'Archive'},
  achievements: ['first'], experiments: {legacy: 'steps'}, unknownLegacyField: {untouched: true}
}};

function fakeStorage() {
  const previous = globalThis.localStorage, data = new Map();
  globalThis.localStorage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  return () => { globalThis.localStorage = previous; };
}

test('Today saves a one-tap rating, permits corrections, and distinguishes No Snack from an empty checkpoint', async () => {
  const reset = fakeStorage();
  const originalDocument = globalThis.document, originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    const state = initialState();
    state.settings.onboarded = true;
    await persistState(state);
    const app = {innerHTML: ''};
    const extra = {open: false, querySelectorAll: () => []};
    const buttons = [
      {dataset: {meal: 'breakfast', rating: '4'}},
      {dataset: {meal: 'breakfast', rating: '2'}},
      {dataset: {meal: 'nightSnack', rating: '0'}}
    ];
    const elements = new Map([['#app', app], ['.extra-snacks', extra]]);
    globalThis.document = {
      querySelector(selector) {
        if (['#open-workout', '#other-description', '#other-duration', '#complete-other'].includes(selector)) return null;
        if (!elements.has(selector)) elements.set(selector, {});
        return elements.get(selector);
      },
      querySelectorAll(selector) { return selector.includes('[data-meal]') ? buttons : []; }
    };
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {}});
    await import('./app-simple.js');
    const currentDate = app.innerHTML.match(/id="day" type="date" value="([^"]+)/)[1];
    const tap = button => { button.focus = () => {}; button.closest = () => null; button.onclick(); };
    tap(buttons[0]);
    assert.equal((await loadState()).mealData[currentDate].breakfast, 4);
    tap(buttons[1]);
    tap(buttons[2]);
    const meals = (await loadState()).mealData[currentDate];
    assert.deepEqual(meals, {breakfast: 2, nightSnack: 0});
    assert.match(app.innerHTML, /data-meal="nightSnack" data-rating="0" aria-pressed="true"/);
    assert.match(renderFood(meals, [], [], String), /Lunch<\/strong><small>Unlogged/);
    assert.throws(() => rateMeal(state, currentDate, 'lunch', 0), /Invalid meal rating/);
    await persistState(await loadState());
  } finally {
    globalThis.document = originalDocument;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    reset();
  }
});

test('extra snacks have stable IDs and timestamps, and corrections and deletion persist', async () => {
  const reset = fakeStorage();
  try {
    const state = initialState();
    const first = addSnack(state, day, 4), second = addSnack(state, day, 3);
    assert.notEqual(first.id, second.id);
    assert.ok(Number.isFinite(Date.parse(first.timestamp)));
    updateSnack(state, day, second.id, 1);
    updateSnack(state, day, first.id, null);
    await persistState(state);
    assert.deepEqual((await loadState()).extraSnacks[day], [{...second, rating: 1}]);
  } finally { reset(); }
});

test('food statistics separate complete days, meal choices, night snacks and extra snacks', () => {
  const state = initialState();
  for (const [key] of MEALS) rateMeal(state, day, key, key.endsWith('Snack') ? 0 : 4);
  rateMeal(state, day2, 'dinner', 2);
  addSnack(state, day2, 3);
  const stats = foodStats(dailyRecords(state), {start: day, end: day2});
  assert.deepEqual(stats.complete, [{date: day, value: 1}]);
  assert.equal(stats.days, 2);
  assert.deepEqual(stats.distribution, {1: 0, 2: 1, 3: 1, 4: 3});
  assert.deepEqual(stats.extra, [{date: day2, value: 1}]);
  assert.equal(stats.nights[0], 1);
});

test('Health Quest raw and wrapped JSON preserve the original and project recognized data', async () => {
  const text = JSON.stringify(healthQuest, null, 2), original = initialState();
  const preview = await previewImport(original, text);
  assert.equal(preview.format, 'Health Quest');
  assert.deepEqual(original.importedHistory, {});
  const merged = mergeImport(original, preview);
  assert.equal(merged.importedHistory[preview.id].original, text);
  assert.equal((await previewImport(merged, JSON.stringify({meta: healthQuest.meta, ...healthQuest}))).duplicate, true);
  assert.equal(mergeImport(merged, preview), merged);
  for (const key of ['state', 'data', 'healthQuest', 'payload']) {
    const wrapped = await previewImport(original, JSON.stringify({[key]: healthQuest}));
    assert.deepEqual(wrapped.normalized, preview.normalized);
  }
  const row = dailyRecords(merged)[0];
  assert.equal(row.weight, 180);
  assert.equal(row.bodyFat, 20);
  assert.deepEqual(row.meals, {breakfast: 4, afternoonSnack: 3, dinner: 1, nightSnack: 0});
  assert.deepEqual(lastExercise(merged, 'Incline dumbbell press', day2).sets, sets);
  assert.equal(lastExercise(merged, 'Incline dumbbell press', day2).progressRequested, true);
});

test('earlier Varsity merge identifies conflicts and keeps existing values, workouts and unknown fields', async () => {
  let state = initialState();
  state.healthData[day] = {weight: 179, steps: 8300};
  state = mergeImport(state, await previewImport(state, JSON.stringify(healthQuest)));
  const preview = await previewImport(state, JSON.stringify(olderVarsity));
  assert.equal(preview.version, '1');
  assert.ok(preview.conflicts.includes(`${day} · weight`));
  assert.ok(preview.conflicts.includes(`${day} · Incline DB Press`));
  state = mergeImport(state, preview);
  const [first, second] = dailyRecords(state);
  assert.deepEqual([first.weight, first.steps, first.activeCalories, second.weight], [179, 8300, 350, 181]);
  assert.equal(first.meals.breakfast, 4);
  assert.equal(weeklyWorkoutSeries(state, day2)[0].goal, true);
  assert.equal(state.workouts[day], undefined);
  assert.deepEqual(JSON.parse(state.importedHistory[preview.id].original).state.unknownLegacyField, {untouched: true});
  const future = await previewImport(state, JSON.stringify({...olderVarsity, schemaVersion: 5}));
  assert.equal(future.format, 'Varsity');
  assert.equal(future.version, '5');
});

test('unknown formats require explicit retention and have no chart records', async () => {
  const state = initialState();
  const preview = await previewImport(state, '{"unknown":[1,2,3]}');
  assert.equal(preview.format, 'Unsupported');
  assert.throws(() => mergeImport(state, preview), /retain the original/);
  const retained = mergeImport(state, preview, {retainUnsupported: true});
  assert.equal(retained.importedHistory[preview.id].original, preview.text);
  assert.deepEqual(dailyRecords(retained), []);
  assert.throws(() => restoreBackup({schemaVersion: 1, state: {healthData: null}}), /Varsity/);
});

test('current backups merge on a clean install and full restore brings forward local and imported history', async () => {
  const reset = fakeStorage();
  try {
    let state = restoreBackup(olderVarsity);
    state.settings.onboarded = true;
    state.strengthLogs[0].progressRequested = true;
    addSnack(state, day, 3);
    state = mergeImport(state, await previewImport(state, JSON.stringify(healthQuest)));
    const serialized = JSON.stringify(exportBackup(state));
    const clean = initialState();
    const preview = await previewImport(clean, serialized);
    const merged = mergeImport(clean, preview);
    assert.equal(dailyRecords(merged)[0].extraSnacks.length, 1);
    const restored = restoreBackup(JSON.parse(serialized));
    await persistState(restored, {durable: true});
    const loaded = await loadState();
    assert.deepEqual(loaded.importedHistory, state.importedHistory);
    assert.deepEqual(loaded.extraSnacks, state.extraSnacks);
    assert.deepEqual(loaded.unknownLegacyField, state.unknownLegacyField);
    assert.deepEqual(loaded.simulatedGames, state.simulatedGames);
    assert.deepEqual(loaded.experiments, state.experiments);
    assert.deepEqual(loaded.achievements, state.achievements);
    assert.equal(lastExercise(loaded, 'Incline dumbbell press', day2).progressRequested, true);
  } finally { reset(); }
});
