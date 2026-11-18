import {isCustomWorkout,customPlan,workoutProgram} from './custom-workouts.js';
import {PROGRAM,weekKey,historyBatches} from './core.js';

const ALIASES={'cable lateral raise':'lateral raise','cable curl':'curls','incline db press':'incline dumbbell press','rdl':'romanian deadlift','dead bugs':'dead bug'};
export const canonicalExercise=name=>ALIASES[String(name||'').trim().toLowerCase()]||String(name||'').trim().toLowerCase();
export const exerciseId=name=>canonicalExercise(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const draftKey=(date,type,id)=>`${date}|${type}|${id}`;
export function ensureStrengthState(state){state.settings??={};state.settings.program??=structuredClone(PROGRAM);for(const type of ['blue','maize','home'])state.settings.program[type]??=structuredClone(PROGRAM[type]);state.settings.program.white??=structuredClone(PROGRAM.white);for(const item of state.settings.program.blue){if(item[0]==='Cable lateral raise'||item[0]==='Cable Lateral Raise'){item[0]='Lateral Raise';item[2]='dumbbells default; cable or machine okay'}if(item[0]==='Cable curl'||item[0]==='Cable Curl'){item[0]='Curls';item[2]='dumbbells, cable, EZ bar, or machine'}}state.strengthDrafts??={};state.personalRecords??=[];state.strengthLogs??=[];state.workoutSelections??={};state.workoutDetails??={};state.completedWorkoutSessions??={};return state}
export function parseTarget(text){const match=String(text).match(/(\d+)\s*×\s*(\d+)(?:\s*[–-]\s*(\d+))?/);return {sets:match?Number(match[1]):3,min:match?Number(match[2]):8,max:match?Number(match[3]||match[2]):12,timed:/seconds|sec/i.test(text)}}
function numeric(value){return value===''||value==null?null:Number.isFinite(Number(value))?Number(value):null}
export function normalizeStrengthLog(raw,source='native') {
  const name = raw?.exerciseName || raw?.exercise;
  if (typeof raw?.date !== 'string' || typeof name !== 'string' || !name) return null;
  const timed = raw.setsUnit === 'seconds' || (Array.isArray(raw.sets)
    && raw.sets.some(set => numeric(set?.seconds) > 0) && !raw.sets.some(set => numeric(set?.reps) > 0));
  const sets = Array.isArray(raw.sets) ? raw.sets.filter(Boolean).map(set => ({
    weight:numeric(set.weight),reps:numeric(timed ? set.seconds ?? set.reps : set.reps)
  })) : Array.isArray(raw.reps) ? raw.reps.map(reps => ({weight:numeric(raw.weight),reps:numeric(reps)})) : [];
  return {
    id:raw.id||null,date:raw.date,exerciseId:raw.exerciseId||exerciseId(name),exerciseName:name,
    workoutType:raw.workoutType||null,workoutName:raw.workoutName??null,completedAt:raw.completedAt??null,
    sets:sets.filter(set=>set.reps!==null||set.weight!==null),setsUnit:timed?'seconds':null,
    progressRequested:raw.progressRequested??raw.increaseNextTime??null,isPR:Boolean(raw.isPR),prType:raw.prType||null,
    prTypes:Array.isArray(raw.prTypes)?raw.prTypes:raw.prType?[raw.prType]:[],source,note:raw.note||raw.notes||''
  };
}
export function exerciseHistory(state, name, {beforeDate = null} = {}) {
  const target = canonicalExercise(name), byDate = new Map();
  const matches = log => log?.sets.length && canonicalExercise(log.exerciseName) === target && (!beforeDate || log.date < beforeDate);
  for (const batch of historyBatches(state)) {
    for (const raw of batch.strengthLogs ?? []) {
      const log = normalizeStrengthLog(raw, batch.format);
      if (matches(log) && !byDate.has(log.date)) byDate.set(log.date, [log]);
    }
  }
  const native = new Map();
  for (const raw of state.strengthLogs ?? []) {
    const log = normalizeStrengthLog(raw);
    if (!matches(log)) continue;
    if (!native.has(log.date)) native.set(log.date, new Map());
    native.get(log.date).set(log.id || JSON.stringify(log.sets), log);
  }
  for (const [date, logs] of native) byDate.set(date, [...logs.values()]);
  return [...byDate.values()].flat().reverse().sort((a, b) => b.date.localeCompare(a.date)
    || String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? '')));
}
export function lastExercise(state,name,day){return exerciseHistory(state,name).find(log=>log.date<=day)||null}
export const totalReps=log=>(log?.sets||[]).reduce((sum,set)=>sum+(Number(set.reps)||0),0);
export const trainingVolume=log=>(log?.sets||[]).reduce((sum,set)=>sum+(Number(set.reps)||0)*(Number(set.weight)||0),0);
export const maxWeight=log=>Math.max(0,...(log?.sets||[]).map(set=>Number(set.weight)||0));
export function formatSets(log){if(!log?.sets?.length)return 'No previous performance recorded.';const sets=log.sets.filter(set=>set.reps!==null);if(!sets.length)return 'No previous performance recorded.';return sets.map(set=>`${set.weight??0} lb × ${set.reps}`).join(' · ')}
export function recommendProgression(last, targetText, {increment = 5} = {}) {
  const target = parseTarget(targetText);
  if (!last?.sets?.length) return {kind:'start', weight:null, text:'Choose a manageable starting weight.'};
  const working = last.sets.slice(0, target.sets);
  const weights = working.map(set => Number(set.weight) || 0), weight = Math.max(...weights);
  const reps = working.map(set => Number(set.reps) || 0);
  const allAtTop = reps.length === target.sets && reps.every(rep => rep >= target.max);
  const sameLoad = weights.every(value => value === weights[0]);
  const load = sameLoad && weight ? `${weight} lb` : 'the previous set weights';
  if (reps.some(rep => rep < Math.max(1, target.min - 2))) {
    return {kind:'caution', weight, text:'Consider staying here or reducing slightly. Keep clean form.'};
  }
  if (last.progressRequested !== true) return {kind:'repeat', weight, text:`Repeat ${load}; progress when ready.`};
  if (allAtTop && sameLoad && weight > 0) {
    return {kind:'weight', weight:weight + increment, text:`Try ${weight + increment} lb for ${target.min}–${target.max} ${target.timed ? 'seconds' : 'reps'}.`};
  }
  const goals = Array.from({length: target.sets}, (_, index) =>
    index < reps.length ? Math.min(target.max, reps[index] + 1) : target.min);
  return {kind:'reps', weight, text:`Aim for ${goals.join('/')} at ${load} with clean form.`};
}
export function toggleProgressRequest(state,date,type,name){ensureStrengthState(state);const id=exerciseId(name),key=draftKey(date,type,id),draft=state.strengthDrafts[key]||{},existing=state.strengthLogs.find(log=>log.id===`${date}:${type}:${id}`),current=draft.progressRequested??existing?.progressRequested??false;draft.progressRequested=!current;state.strengthDrafts[key]=draft;if(existing){existing.progressRequested=draft.progressRequested;const target=workoutProgram(state,date,type).find(item=>exerciseId(item[0])===id)?.[1]||'';existing.progressRecommendation=recommendProgression(existing,target)}return draft.progressRequested}
export function updateStrengthDraft(state,date,type,name,patch){ensureStrengthState(state);const key=draftKey(date,type,exerciseId(name));state.strengthDrafts[key]={...(state.strengthDrafts[key]||{}),...patch};return state.strengthDrafts[key]}
export function detectPR(current,history){if(!history.length||!current.sets.length)return [];const priorWeight=Math.max(...history.map(maxWeight)),currentWeight=maxWeight(current),priorVolume=Math.max(...history.map(trainingVolume)),volume=trainingVolume(current),sameWeightHistory=history.filter(log=>maxWeight(log)===currentWeight),bestReps=sameWeightHistory.length?Math.max(...sameWeightHistory.map(totalReps)):null,types=[];if(currentWeight>priorWeight)types.push('weight');if(bestReps!==null&&totalReps(current)>bestReps)types.push('reps');if(volume>priorVolume&&volume>0)types.push('volume');return types}
export function completeWorkout(state, date, type) {
  ensureStrengthState(state);
  const program = workoutProgram(state,date,type);
  const custom = isCustomWorkout(type), plan = customPlan(state,date,type);
  const sessionKey = `${date}:${type}`, prior = state.completedWorkoutSessions[sessionKey];
  const name = prior?.workoutName ?? plan?.name ?? type;
  const completedAt = prior?.completedAt ?? new Date().toISOString();
  const saved = [];
  let workingSets = 0;
  for (const [exercise,targetText] of program) {
    const id = exerciseId(exercise), key = draftKey(date,type,id), draft = state.strengthDrafts[key];
    if (!draft) continue;
    const target = parseTarget(targetText);
    const sets = (draft.sets ?? []).filter(set => !custom || set.confirmed === true)
      .map(set => ({weight:numeric(set.weight),reps:numeric(set.reps)}))
      .filter(set => set.reps !== null && set.reps > 0);
    if (!sets.length) continue;
    const logId = `${sessionKey}:${id}`;
    const index = state.strengthLogs.findIndex(item => item.id === logId);
    const existing = state.strengthLogs[index];
    const history = exerciseHistory(state,exercise,{beforeDate:date});
    const last = history[0] ?? null, prTypes = detectPR({sets},history);
    const progressRequested = draft.progressRequested ?? existing?.progressRequested ?? null;
    const increment = state.settings.weightIncrements?.[id];
    const log = {
      ...existing,id:logId,date,exerciseId:id,exerciseName:exercise,exercise,workoutType:type,
      workoutName:name,completedAt,setsUnit:target.timed?'seconds':'reps',sets,
      targetSets:target.sets,targetRepMin:target.min,targetRepMax:target.max,progressRequested,
      progressRecommendation:recommendProgression({sets,progressRequested},targetText,{increment}),
      previousPerformance:last ? {date:last.date,sets:last.sets} : null,
      isPR:prTypes.length > 0,prType:prTypes[0] ?? null,prTypes,note:draft.note ?? existing?.note ?? ''
    };
    if (index >= 0) state.strengthLogs[index] = log;
    else state.strengthLogs.push(log);
    workingSets += sets.length;
    saved.push(log);
    delete state.strengthDrafts[key];
  }
  if ((custom || ['blue','maize','white','home'].includes(type)) && !saved.length && !prior) {
    return {type,exercises:0,workingSets:0,progressRequested:0,prs:[],logs:[],empty:true};
  }
  state.completedWorkoutSessions[sessionKey] = {...prior,date,type,completed:true,completedAt,
    ...(plan ? {workoutName:name,category:prior?.category ?? plan.category} : {})};
  state.workouts[date] = type;
  state.workoutSelections[date] = type;
  const logIds = new Set(saved.map(log => log.id));
  state.personalRecords = state.personalRecords.filter(record => !logIds.has(record.logId));
  for (const log of saved) {
    for (const prType of log.prTypes) {
      state.personalRecords.push({logId:log.id,date,exerciseId:log.exerciseId,exerciseName:log.exerciseName,prType});
    }
  }
  return {type,workoutName:name,exercises:saved.length,workingSets,
    progressRequested:saved.filter(log => log.progressRequested).length,prs:saved.filter(log => log.isPR),logs:saved};
}
export function weeklyProgressionCount(state,day){const week=weekKey(day);return (state.strengthLogs||[]).filter(log=>weekKey(log.date)===week&&log.progressRequested===true).length}
