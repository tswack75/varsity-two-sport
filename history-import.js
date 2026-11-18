import {isCustomWorkout,validateTemplate,categories} from './custom-workouts.js';
import {APP_VERSION, dateKey, initialState, MEALS, normalizeHealthQuest} from './core.js';
import {dailyRecords} from './analytics.js';
import {canonicalExercise, ensureStrengthState, normalizeStrengthLog} from './strength.js';
import {isSnack, validRating} from './food.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const metrics = ['weight', 'bodyFat', 'steps', 'activeCalories', 'exerciseMinutes'];
const workouts = ['blue', 'maize', 'white', 'home', 'home-blue', 'home-maize', 'other'];
const datedMap = value => object(value) && Object.keys(value).every(validDate);
const varsityKeys = ['mealData', 'weightHistory', 'workouts', 'strengthLogs', 'completedWorkoutSessions', 'settings', 'athleteProfile'];
const has = (value, key) => Object.hasOwn(value, key);

function classify(raw) {
  const source = raw?.entries || raw?.healthData ? raw : raw?.state ?? raw?.healthQuest ?? raw?.data ?? raw?.payload ?? raw;
  if (!object(source)) return {format: 'Unsupported', source};
  if (object(source.healthData) && varsityKeys.some(key => has(source, key))) return {format: 'Varsity', source};
  const hasEntries = datedMap(source.entries) && Object.values(source.entries).every(object);
  const healthQuestFields = ['weight', 'weightLbs', 'scaleWeight', 'bodyFat', 'steps', 'activeCalories', 'mealBehavior', 'scoringModelVersion'];
  if (hasEntries && (Object.values(source.entries).some(row => healthQuestFields.some(key => has(row, key)))
      || ['strengthHistory', 'foodLogs', 'goals'].some(key => has(source, key)))) return {format: 'Health Quest', source};
  return {format: 'Unsupported', source};
}

function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function normalizeDay(row) {
  const normalized = {date: row.date, meals: {}};
  for (const key of metrics) {
    const value = number(row[key]);
    if (value !== null) normalized[key] = value;
  }
  for (const [key] of MEALS) {
    const rating = number(row.meals?.[key]);
    if (validRating(rating, isSnack(key))) normalized.meals[key] = rating;
  }
  if (Array.isArray(row.extraSnacks)) {
    normalized.extraSnacks = row.extraSnacks.filter(snack => object(snack) && typeof snack.id === 'string'
      && snack.id && typeof snack.timestamp === 'string' && Number.isFinite(Date.parse(snack.timestamp))
      && validRating(snack.rating)).map(({id, timestamp, rating}) => ({id, timestamp, rating}));
  }
  return normalized;
}

function varsityDays(source) {
  const fields = ['healthData', 'weightHistory', 'mealData', 'extraSnacks'];
  const dates = new Set(fields.flatMap(key => object(source[key]) ? Object.keys(source[key]) : []));
  return [...dates].filter(validDate).map(date => normalizeDay({
    ...(source.healthData[date] ?? {}), date,
    weight: number(source.weightHistory?.[date]) ?? source.healthData[date]?.weight,
    meals: source.mealData?.[date], extraSnacks: source.extraSnacks?.[date]
  }));
}

function sessions(source, format) {
  const records = [];
  const add = (date, type, item = {}) => {
    if (!validDate(date) || (!workouts.includes(type) && !isCustomWorkout(type))) return;
    const result = {date,type,completed:true};
    if (typeof item.workoutName === 'string') result.workoutName=item.workoutName;
    if (typeof item.completedAt === 'string') result.completedAt=item.completedAt;
    if (Object.hasOwn(categories,item.category)) result.category=item.category;
    if (number(item.durationMinutes) !== null) result.durationMinutes=number(item.durationMinutes);
    records.push(result);
  };
  if (format === 'Varsity') {
    for (const [date, type] of Object.entries(source.workouts ?? {})) add(date, type);
    for (const item of Object.values(source.completedWorkoutSessions ?? {})) {
      if (item?.completed === true) add(item.date, item.type, item);
    }
  } else if (Array.isArray(source.strengthHistory)) {
    for (const item of source.strengthHistory) if (item?.completed === true) add(item.date, 'other', item);
  }
  return [...new Map(records.map(item => [`${item.date}:${item.type}`, item])).values()];
}

function strength(source) {
  if (!Array.isArray(source.strengthLogs)) return [];
  return source.strengthLogs.filter(raw => object(raw) && validDate(raw.date)
    && typeof (raw.exerciseName || raw.exercise) === 'string'
    && (!Array.isArray(raw.sets) || raw.sets.every(object)))
    .map(raw => normalizeStrengthLog(raw))
    .filter(log => log?.sets.some(set => set.reps > 0));
}

function nestedBatches(source) {
  return [source.importedHealthQuestData, source.importedHistory].flatMap(group =>
    object(group) ? Object.values(group).filter(batch => Array.isArray(batch?.normalized)) : []);
}

function normalize(source, format) {
  if (format === 'Unsupported') return {normalized: [], strengthSessions: [], strengthLogs: []};
  const nested = format === 'Varsity' ? nestedBatches(source) : [];
  const days = format === 'Varsity' ? varsityDays(source) : normalizeHealthQuest(source).map(row => normalizeDay({
    ...row, weight: row.weight ?? source.entries[row.date].scaleWeight
  }));
  return {
    normalized: [...days, ...nested.flatMap(batch => batch.normalized.filter(row => validDate(row?.date)).map(normalizeDay))]
      .filter(row => Object.keys(row).some(key => metrics.includes(key)) || Object.keys(row.meals).length || row.extraSnacks?.length),
    strengthSessions: [...sessions(source, format), ...nested.flatMap(batch => (Array.isArray(batch.strengthSessions)
      ? batch.strengthSessions.filter(item => item?.completed === true && validDate(item.date)).map(item => ({
        date: item.date, type: workouts.includes(item.type)||isCustomWorkout(item.type) ? item.type : 'other', completed: true,
        workoutName: typeof item.workoutName==='string'?item.workoutName:null,
        category: Object.hasOwn(categories,item.category)?item.category:null,durationMinutes:number(item.durationMinutes),
        completedAt:typeof item.completedAt==='string'?item.completedAt:null
      })) : []))],
    strengthLogs: [...strength(source), ...nested.flatMap(strength)]
  };
}

function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function previewImport(state, text) {
  let raw;
  try { raw = JSON.parse(text); } catch { raw = null; }
  const {format, source} = classify(raw);
  const id = await hash(raw === null ? text : stableJSON(raw));
  const oldId = raw === null ? null : await hash(JSON.stringify(raw));
  const duplicate = Boolean(state.importedHistory?.[id] || state.importedHealthQuestData?.[oldId])
    || Object.values(state.importedHealthQuestData ?? {}).some(batch => batch.raw && stableJSON(batch.raw) === stableJSON(raw));
  const batch = normalize(source, format);
  const existing = new Map(dailyRecords(state).map(row => [row.date, {...row, meals: {...row.meals}}]));
  const existingSets = new Map();
  for (const log of [...strength(state), ...nestedBatches(state).flatMap(strength)]) {
    const key = `${log.date}:${canonicalExercise(log.exerciseName)}`;
    if (!existingSets.has(key)) existingSets.set(key, []);
    existingSets.get(key).push(stableJSON(log.sets));
  }
  const conflicts = [], duplicates = [];
  const existingSessions = new Set(Object.entries(state.workouts ?? {}).map(([date, type]) => `${date}:${type}`));
  for (const session of [...Object.values(state.completedWorkoutSessions ?? {}), ...nestedBatches(state).flatMap(batch => batch.strengthSessions ?? [])]) {
    if (session?.completed) existingSessions.add(`${session.date}:${session.type ?? 'other'}`);
  }
  for (const {date, type} of batch.strengthSessions) {
    const key = `${date}:${type}`;
    if (existingSessions.has(key)) duplicates.push(`${date} · ${type} workout`);
    existingSessions.add(key);
  }
  function compare(current, key, value, label) {
    if (current[key] == null) current[key] = value;
    else (current[key] === value ? duplicates : conflicts).push(label);
  }
  for (const row of batch.normalized) {
    const current = existing.get(row.date) ?? {meals: {}};
    existing.set(row.date, current);
    for (const key of metrics) if (row[key] != null) compare(current, key, row[key], `${row.date} · ${key}`);
    for (const [key, rating] of Object.entries(row.meals)) compare(current.meals, key, rating, `${row.date} · ${key}`);
  }
  for (const log of batch.strengthLogs) {
    const key = `${log.date}:${canonicalExercise(log.exerciseName)}`;
    const sets = stableJSON(log.sets), prior = existingSets.get(key);
    if (!prior) existingSets.set(key, [sets]);
    else (prior.includes(sets) ? duplicates : conflicts).push(`${log.date} · ${log.exerciseName}`);
  }
  const version = raw?.schemaVersion ?? source?.schemaVersion ?? raw?.formatVersion ?? raw?.version ?? raw?.appVersion;
  return {id, format, version: ['number', 'string'].includes(typeof version) ? String(version) : 'Unspecified',
    duplicate, text, raw, ...batch, conflicts: [...new Set(conflicts)], duplicates: [...new Set(duplicates)]};
}

export function mergeImport(state, preview, {retainUnsupported = false} = {}) {
  if (preview.format === 'Unsupported' && !retainUnsupported) throw Error('Choose to retain the original file first');
  if (preview.duplicate || state.importedHistory?.[preview.id]) return state;
  const {id, format, version, text, normalized, strengthSessions, strengthLogs} = preview;
  return {...state, importedHistory: {...state.importedHistory, [id]: {
    id, format, version, original: text, importedAt: new Date().toISOString(),
    normalized: structuredClone(normalized), strengthSessions: structuredClone(strengthSessions),
    strengthLogs: structuredClone(strengthLogs)
  }}};
}

const mapFields = ['healthData', 'mealData', 'weightHistory', 'extraSnacks', 'deletedSnackIds', 'workouts', 'workoutDetails',
  'workoutSelections', 'customWorkouts', 'customSessionPlans', 'completedWorkoutSessions', 'strengthDrafts', 'importedHealthQuestData', 'importedHistory', 'settings'];
const arrayFields = ['strengthLogs', 'personalRecords', 'recommendationHistory'];

export function restoreBackup(raw) {
  if (raw?.schemaVersion !== 1 || !object(raw.state) || classify(raw).format !== 'Varsity') {
    throw Error('Full restore requires a Varsity schema 1 backup');
  }
  const source = raw.state;
  for (const key of mapFields) if (has(source, key) && !object(source[key])) throw Error(`Invalid backup field: ${key}`);
  for (const key of arrayFields) {
    if (has(source, key) && (!Array.isArray(source[key]) || !source[key].every(object))) throw Error(`Invalid backup field: ${key}`);
  }
  for (const key of ['healthData', 'mealData']) {
    if (source[key] && (!datedMap(source[key]) || !Object.values(source[key]).every(object))) throw Error(`Invalid backup field: ${key}`);
  }
  if (source.extraSnacks && (!datedMap(source.extraSnacks) || !Object.values(source.extraSnacks).every(items =>
    Array.isArray(items) && items.every(item => object(item) && typeof item.id === 'string' && validRating(item.rating))))) {
    throw Error('Invalid extra snacks');
  }
  if (source.strengthLogs?.some(log => Array.isArray(log.sets) && !log.sets.every(object))) throw Error('Invalid workout sets');
  if (has(source.settings ?? {}, 'program')) {
    const program = source.settings.program;
    if (!object(program) || Object.values(program).some(list => !Array.isArray(list)
        || !list.every(item => Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'string'))) {
      throw Error('Invalid workout program');
    }
  }
  for (const [key,value] of Object.entries(source.customWorkouts ?? {})) {
    if (!isCustomWorkout(key)) throw Error('Invalid custom workout identifier');
    validateTemplate(value);
  }
  for (const value of Object.values(source.customSessionPlans ?? {})) validateTemplate(value);
  return ensureStrengthState({...initialState(), ...structuredClone(source)});
}

export function exportBackup(state) {
  return {schemaVersion: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), state: structuredClone(state)};
}

export function backupFilename() {
  return `varsity-backup-${dateKey()}.json`;
}
