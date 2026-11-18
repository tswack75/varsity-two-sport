import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from './core.js';
import {completeWorkout, updateStrengthDraft, toggleProgressRequest} from './strength.js';
import {exerciseCard} from './strength-ui.js';
import {loadState, persistState} from './storage.js';

test('IndexedDB snapshot survives reload and supplies next workout LAST and progression flag', async () => {
  const originalDB = globalThis.indexedDB, originalLocal = globalThis.localStorage;
  const snapshots = new Map(), journal = new Map();
  globalThis.localStorage = {getItem: key => journal.get(key) ?? null, setItem: (key, value) => journal.set(key, value)};
  globalThis.indexedDB = {open(name, version) {
    assert.equal(name, 'varsity-two-sport-db');
    assert.equal(version, 1);
    const request = {result: {close() {}, transaction(store) {
      assert.equal(store, 'snapshots');
      const tx = {objectStore: () => ({
        get(key) {
          const read = {result: structuredClone(snapshots.get(key))};
          queueMicrotask(() => read.onsuccess());
          return read;
        },
        put(value, key) {
          assert.equal(key, 'current');
          snapshots.set(key, structuredClone(value));
          queueMicrotask(() => tx.oncomplete());
        }
      })};
      return tx;
    }}};
    queueMicrotask(() => request.onsuccess());
    return request;
  }};
  try {
    const state = initialState(), today = '2026-11-16', name = 'Incline dumbbell press';
    updateStrengthDraft(state, today, 'maize', name, {sets: [{weight: 30, reps: 10}, {weight: 30, reps: 10}, {weight: 30, reps: 9}]});
    toggleProgressRequest(state, today, 'maize', name);
    completeWorkout(state, today, 'maize');
    await persistState(state);
    journal.clear();
    const loaded = await loadState();
    const card = exerciseCard(loaded, '2026-11-23', 'maize', name, '3 × 6–10', '', 0, String);
    assert.match(card, /LAST Nov 16/);
    assert.match(card, /30 lb × 10 · 30 lb × 10 · 30 lb × 9/);
    assert.match(card, /PROGRESSION REQUESTED \+/);
    assert.match(card, /10\/10\/10/);
  } finally {
    globalThis.indexedDB = originalDB;
    globalThis.localStorage = originalLocal;
  }
});

test('failed durable replacement does not leave a destructive journal entry', async () => {
  const originalLocal = globalThis.localStorage, data = new Map();
  let fail = false;
  globalThis.localStorage = {getItem: key => data.get(key) ?? null, setItem(key, value) {
    if (fail) throw Error('Storage quota');
    data.set(key, value);
  }};
  try {
    const state = initialState();
    state.healthData['2026-11-16'] = {weight: 180};
    await persistState(state, {durable: true});
    fail = true;
    await assert.rejects(persistState(initialState(), {durable: true}), /Storage quota/);
    assert.deepEqual((await loadState()).healthData, state.healthData);
  } finally { globalThis.localStorage = originalLocal; }
});
