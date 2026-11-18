import {APP_VERSION, MEALS, historyBatches} from './core.js';
import {dailyRecords} from './analytics.js';
import {normalizeStrengthLog, maxWeight, totalReps, trainingVolume} from './strength.js';
import {completedTypes, stepGoal} from './tracker.js';
import {workoutName} from './custom-workouts.js';
import {RATINGS, isSnack, validRating} from './food.js';
import {exerciseGuide} from './exercise-library.js';

const asNumber = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) &&
  Number.isFinite(Number(value)) ? Number(value) : null;
const dataDictionary = {
  'metadata': 'schemaVersion is the format revision. appVersion is the exporter. exportedAt is UTC. dateRange is inclusive; endpoints are null for empty data. units, sources and completeness describe the projections.',
  'dailyRecords': 'One row per known local calendar day (YYYY-MM-DD). Weight in lb, bodyFat in percent, steps as count, activeCalories in kcal, exerciseMinutes in minutes. plannedWorkout and completedWorkouts store workout types; ratings are keyed by checkpoint. extraSnacks contain ID, UTC timestamp and rating. source is the selected row-level source; historicalData contains original sources and alternate values.',
  'dailyRecords.ratings': '4 Great, 3 Good, 2 Drift, 1 Off Track; 0 means No Snack and is valid only for snack checkpoints. null means missing. Missing numeric data is null; a measured zero is 0.',
  'workoutSessions': 'id, local date, type, name, completed, UTC completedAt, durationMinutes, category and source. exerciseLogIds reference exerciseHistory. Sessions from different templates remain distinct.',
  'exerciseHistory': 'id, exerciseId, variation, equipment, date, source, workoutType, workoutName, sessionId, sets, setsUnit, progressRequested, isPR, maxWeight, totalReps and trainingVolume. Weights use the source convention: dumbbells are typically lb per hand, legacy sources may be unspecified. Timed sets use seconds; volume and total reps are null for timed sets. Historical logs lacking usable sets stay in their originals.',
  'historicalData': 'Original imported content and source metadata plus per-source normalized readings, sessions and logs. legacy contains preserved scoring and archival fields. Source copies may include conflicts omitted from the daily projection.',
  'configuration': 'Current goals, programs, custom workouts, rating definitions and preferences at export. These settings do not retroactively label historical records.'
};

export function exportForAnalysis(state) {
  const sources = historyBatches(state);
  const sessions = new Map();
  const rows = new Map(dailyRecords(state).map(row => [row.date,row]));
  const dates = new Set(rows.keys());
  const addSession = (key, record, source) => {
    dates.add(record.date);
    const type = record.type ?? 'other', slot = `${record.date}:${type}`;
    sessions.set(slot, {id:key, date:record.date, type, name:record.workoutName ?? workoutName(state,type,record.date),
      completed:record.completed === true, completedAt:record.completedAt ?? null,
      durationMinutes:asNumber(record.durationMinutes), category:record.category ?? null, source, exerciseLogIds:[]});
  };
  for (const batch of sources) for (const record of batch.strengthSessions ?? []) {
    const slot = `${record.date}:${record.type ?? 'other'}`;
    if (!sessions.has(slot)) addSession(slot,record,batch.format);
  }
  for (const [date,type] of Object.entries(state.workouts ?? {})) {
    if (type && type !== 'none' && type !== 'rest') addSession(`${date}:${type}`,{date,type,completed:true},'Varsity');
  }
  for (const [key,record] of Object.entries(state.completedWorkoutSessions ?? {})) addSession(key,record,'Varsity');
  for (const date of Object.keys(state.workoutSelections ?? {})) dates.add(date);
  for (const date of Object.keys(state.workoutDetails ?? {})) dates.add(date);
  const logs = new Map();
  const addLog = (raw,source) => {
    const log = normalizeStrengthLog(raw,source);
    if (!log?.sets.length) return;
    const id = log.id ?? `${log.date}:${log.exerciseId}:${JSON.stringify(log.sets)}`;
    if (logs.has(id) && source !== 'Varsity') return;
    dates.add(log.date);
    const guide = exerciseGuide(log.exerciseName);
    const session = sessions.get(`${log.date}:${log.workoutType}`);
    const timed = log.setsUnit === 'seconds' || guide?.movementPattern === 'Carry';
    logs.set(id, {id, exerciseId:log.exerciseId, variation:log.exerciseName, equipment:guide?.equipment ?? null,
      date:log.date, source, workoutType:log.workoutType, workoutName:raw.workoutName ?? session?.name ?? null,
      sessionId:session?.id ?? null, sets:log.sets.map(set => timed ? {weight:set.weight,seconds:set.reps} : set),
      setsUnit:timed?'seconds':'reps',progressRequested:log.progressRequested,isPR:log.isPR,
      maxWeight:log.sets.some(set => set.weight !== null) ? maxWeight(log) : null,
      totalReps:timed || !log.sets.some(set => set.reps !== null) ? null : totalReps(log),
      trainingVolume:!timed && log.sets.some(set => set.weight !== null && set.reps !== null) ? trainingVolume(log) : null});
  };
  for (const batch of sources) for (const raw of batch.strengthLogs ?? []) addLog(raw,batch.format);
  for (const raw of state.strengthLogs ?? []) addLog(raw,'Varsity');
  const byId = new Map([...sessions.values()].map(session => [session.id,session]));
  for (const log of logs.values()) byId.get(log.sessionId)?.exerciseLogIds.push(log.id);
  const sorted = [...dates].sort();
  const daily = sorted.map(date => {
    const row = rows.get(date);
    const ratings = Object.fromEntries(MEALS.map(([key]) => {
      const value = row?.meals?.[key];
      return [key,validRating(value,isSnack(key))?value:null];
    }));
    return {date,weight:asNumber(row?.weight),bodyFat:asNumber(row?.bodyFat),steps:asNumber(row?.steps),
      activeCalories:asNumber(row?.activeCalories),exerciseMinutes:asNumber(row?.exerciseMinutes),
      plannedWorkout:state.workoutSelections?.[date] ?? null, completedWorkouts:completedTypes(state,date),
      ratings,extraSnacks:row?.extraSnacks ?? [],source:row?.source ?? null};
  });
  const completeness = Object.fromEntries(['weight','bodyFat','steps','activeCalories','exerciseMinutes'].map(key =>
    [key,daily.filter(row => row[key] !== null).length]));
  completeness.completeFoodDays = daily.filter(row => Object.values(row.ratings).every(value => value !== null)).length;
  const legacy = Object.fromEntries(['healthData','mealData','weightHistory','workoutDetails','personalRecords','analyticsResults',
    'experiments','achievements','xpHistory','athleteProfile','scheduleData','simulatedGames'].map(key => [key,state[key] ?? null]));
  return structuredClone({
    metadata:{schemaVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),
      dateRange:{start:sorted[0]??null,end:sorted.at(-1)??null},
      units:{weight:'lb',bodyFat:'percent',steps:'count',energy:'kcal',duration:'minutes'},
      sources:[...new Set(['Varsity',...sources.map(batch => batch.format)])],completeness},
    dataDictionary,dailyRecords:daily,workoutSessions:[...sessions.values()],exerciseHistory:[...logs.values()],
    historicalData:{imports:sources,legacy,originalExerciseLogs:state.strengthLogs ?? []},
    configuration:{goals:{steps:stepGoal(state),activeCalories:state.settings?.activeCalorieGoal??null,coreWeekly:['blue','maize']},
      workoutPrograms:state.settings?.program ?? {},customWorkouts:state.customWorkouts ?? {},ratingDefinitions:RATINGS,
      preferences:state.settings ?? {}}
  });
}
