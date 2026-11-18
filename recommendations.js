import {APP_VERSION} from './core.js';
import {EXERCISES} from './exercise-library.js';
import {validateTemplate, isCustomWorkout} from './custom-workouts.js';

const builtIns = ['blue','maize','white','home'];
const integer = (min,max) => value => Number.isInteger(value) && value >= min && value <= max;
const oneOf = (...values) => value => values.includes(value);
const settingRules = {
  stepGoal: ['Daily step goal',integer(100,50000),8000],
  activeCalorieGoal: ['Daily active calorie goal',value => value === null || integer(1,5000)(value),null],
  progressionRange: ['Default chart range',oneOf('30D','90D','6M','ALL'),'30D'],
  movementMetric: ['Activity chart metric',oneOf('steps','activeCalories'),'steps'],
  exerciseMetric: ['Strength chart metric',oneOf('weight','topReps','totalReps','volume'),'weight'],
  showFoodGuide: ['Expand the food rating guide',value => typeof value === 'boolean',false]
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const shortText = (value,max) => typeof value === 'string' && value.length <= max;
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);

function validateWorkout(value) {
  if (!only(value,['name','description','category','exercises']) || !Array.isArray(value.exercises)
    || !value.exercises.every(item => only(item,['exerciseId','sets','min','max']))) throw Error('Invalid workout configuration.');
  return validateTemplate(value);
}

function describe(change) {
  const {op,target,value} = change;
  if (op === 'setting' && typeof target === 'string' && Object.hasOwn(settingRules,target) && settingRules[target][1](value)) {
    return {op,target,value,label:settingRules[target][0]};
  }
  if (op === 'weightIncrement' && EXERCISES.some(item => item.id === target)
    && (value === null || typeof value === 'number' && value >= 0.5 && value <= 25)) {
    return {op,target,value,label:`${EXERCISES.find(item => item.id === target).name} weight increment (lb)`};
  }
  if (op === 'program' && builtIns.includes(target)) {
    const template = validateWorkout({name:target,description:'',category:'other',exercises:value});
    return {op,target,value:template.exercises.map(item => {
      const guide = EXERCISES.find(g => g.id === item.exerciseId);
      return [guide.name,`${item.sets} × ${item.min}–${item.max}${guide.movementPattern === 'Carry'?' seconds':''}`,guide.equipment];
    }),label:`${target.toUpperCase()} exercise order and targets`};
  }
  if (op === 'newWorkout' && target === undefined) {
    const template = validateWorkout(value);
    return {op,target:`custom-${crypto.randomUUID()}`,value:template,label:`New workout · ${template.name}`};
  }
  throw Error('Unsupported recommendation or invalid value.');
}

function read(state,{op,target}) {
  if (op === 'setting') return state.settings?.[target] ?? null;
  if (op === 'weightIncrement') return state.settings?.weightIncrements?.[target] ?? null;
  if (op === 'program') return state.settings?.program?.[target] ?? null;
  return state.customWorkouts?.[target] ?? null;
}

function configCopy(state) {
  return {...state,settings:structuredClone(state.settings ?? {}),
    customWorkouts:structuredClone(state.customWorkouts ?? {})};
}

function write(state,{op,target},value) {
  if (op === 'setting' && Object.hasOwn(settingRules,target)) {
    if (value === null) delete state.settings[target];
    else state.settings[target] = value;
  } else if (op === 'weightIncrement' && EXERCISES.some(item => item.id === target)) {
    const increments = state.settings.weightIncrements ??= {};
    if (value === null) delete increments[target]; else increments[target] = value;
  } else if (op === 'program' && builtIns.includes(target)) {
    const program = state.settings.program ??= {};
    if (value === null) delete program[target]; else program[target] = structuredClone(value);
  } else if (op === 'newWorkout' && isCustomWorkout(target)) {
    if (value === null) delete state.customWorkouts[target]; else state.customWorkouts[target] = structuredClone(value);
  } else throw Error('Invalid recommendation history.');
}

export function previewRecommendations(state, file) {
  if (!only(file,['schemaVersion','appVersion','changes','notes']) || file.schemaVersion !== 1
    || file.appVersion !== APP_VERSION || !Array.isArray(file.changes) || !file.changes.length || file.changes.length > 30
    || (file.notes !== undefined && !shortText(file.notes,4000))) {
    throw Error(`Use recommendations schema 1 for Varsity ${APP_VERSION}.`);
  }
  const targets = new Set();
  const changes = file.changes.map((change,index) => {
    if (!only(change,['op','target','value','reason']) || !Object.hasOwn(change,'value')
      || (change.reason !== undefined && !shortText(change.reason,1000))) throw Error('Invalid recommendation fields.');
    const item = describe(change);
    const key = `${item.op}:${item.target}`;
    if (targets.has(key)) throw Error('A setting can only be proposed once per file.');
    targets.add(key);
    const previous = structuredClone(read(state,item));
    return {...item,index,previous,current:previous ?? (item.op==='setting'?settingRules[item.target][2]:null),reason:change.reason??''};
  });
  return {changes,notes:file.notes??''};
}

export function applyRecommendations(state, preview, selected) {
  const changes = preview.changes.filter(item => selected.includes(item.index));
  if (!changes.length) throw Error('Select at least one change.');
  const next = configCopy(state);
  for (const item of changes) {
    if (!equal(read(next,item),item.previous)) throw Error('A setting changed since preview. Open the file again.');
    write(next,item,item.value);
  }
  next.recommendationHistory = [...(state.recommendationHistory ?? []),{
    appliedAt:new Date().toISOString(),changes:structuredClone(changes)
  }];
  return next;
}

export function undoRecommendations(state) {
  const history = state.recommendationHistory ?? [];
  const index = history.findLastIndex(batch => !batch.undoneAt);
  if (index < 0) throw Error('There are no changes to undo.');
  const next = configCopy(state), batch = history[index];
  for (const item of batch.changes) {
    if (!equal(read(next,item),item.value)) throw Error('A setting changed since this batch. Undo would replace the newer setting.');
    write(next,item,item.previous);
  }
  next.recommendationHistory = history.map((entry,i) => i===index ? {...entry,undoneAt:new Date().toISOString()} : entry);
  return next;
}

export function displayRecommendation(value) {
  if (value === null) return 'Not set';
  if (Array.isArray(value)) return value.map(([name,target]) => `${name} · ${target}`).join('\n');
  if (object(value)) return `${value.name ?? 'Workout'} · ${value.exercises?.length ?? 0} exercises`;
  return typeof value === 'boolean' ? (value?'On':'Off') : String(value);
}
