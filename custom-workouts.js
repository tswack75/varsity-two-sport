import {EXERCISES, ambiguousLoading, exerciseGuide} from './exercise-library.js';

export const categories = {other:'Supplemental / Other',blue:'Blue equivalent',maize:'Maize equivalent'};
export const isCustomWorkout = type => typeof type === 'string'
  && /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(type);
export const workoutName = (state, type, date) =>
  state.completedWorkoutSessions?.[`${date}:${type}`]?.workoutName ?? state.customWorkouts?.[type]?.name ?? type;
export const customPlan = (state, date, type) =>
  state.customSessionPlans?.[`${date}:${type}`] ?? state.customWorkouts?.[type];

export function searchExercises({query = '', equipment = '', muscle = '', pattern = ''} = {}) {
  return EXERCISES.filter(item => !ambiguousLoading.has(item.id)
    && item.name.toLowerCase().includes(query.trim().toLowerCase())
    && (!equipment || item.equipment === equipment)
    && (!muscle || [...item.primary, ...item.secondary].includes(muscle))
    && (!pattern || item.movementPattern === pattern));
}

const integer = (value,min,max) => Number.isInteger(value) && value >= min && value <= max;
export function validateTemplate(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 60 ||
    typeof value.description !== 'string' || value.description.length > 240 ||
    !Object.hasOwn(categories, value.category) || !Array.isArray(value.exercises) || !value.exercises.length || value.exercises.length > 24) {
    throw Error('Enter a workout name, a category, and 1–24 exercises.');
  }
  const ids = new Set();
  const exercises = value.exercises.map(item => {
    const guide = EXERCISES.find(guide => guide.id === item?.exerciseId);
    if (!guide || ambiguousLoading.has(guide.id) || ids.has(guide.id) || !integer(item.sets,1,10)
      || !integer(item.min,1,120) || !integer(item.max,item.min,120)) {
      throw Error('Select distinct exercise variants and valid set and rep ranges.');
    }
    ids.add(guide.id);
    return {exerciseId: guide.id, sets: item.sets, min: item.min, max: item.max};
  });
  return {name:value.name.trim(),description:value.description.trim(),category:value.category,exercises};
}

export function saveTemplate(state, template, id = `custom-${crypto.randomUUID()}`) {
  if (!isCustomWorkout(id)) throw Error('Invalid workout identifier.');
  const valid = validateTemplate(template);
  (state.customWorkouts ??= {})[id] = valid;
  return id;
}

export function deleteTemplate(state, id) {
  if (isCustomWorkout(id) && state.customWorkouts) delete state.customWorkouts[id];
}

export function workoutProgram(state, date, type) {
  if (!isCustomWorkout(type)) return state.settings.program[type] ?? [];
  return (customPlan(state,date,type)?.exercises ?? []).flatMap(item => {
    const guide = exerciseGuide(item.exerciseId);
    return guide ? [[guide.name,`${item.sets} × ${item.min}–${item.max}${guide.movementPattern === 'Carry' ? ' seconds' : ''}`,guide.equipment]] : [];
  });
}

export function editCustomWorkout({state,day,type,mode,save,esc}) {
  const dialog = document.querySelector('#custom-workout-editor');
  const original = mode === 'session' ? customPlan(state,day,type) : state.customWorkouts?.[type];
  const draft = structuredClone(original ?? {name:'',description:'',category:'other',exercises:[]});
  if (mode === 'duplicate') draft.name = `${draft.name.slice(0,53)} copy`;
  const filters = searchExercises();
  const options = values => [...new Set(values)].sort().map(value => `<option>${esc(value)}</option>`).join('');
  dialog.innerHTML = `<h2>${mode === 'session' ? 'Edit this session' : mode === 'edit' ? 'Edit workout' : 'Create workout'}</h2>
    <form><label>Name <input name="workoutName" required maxlength="60" value="${esc(draft.name)}"></label>
    <label>Description <input name="description" maxlength="240" value="${esc(draft.description)}"></label>
    <label>Weekly goal category <select name="category">${Object.entries(categories).map(([key,label]) =>
      `<option value="${key}" ${key===draft.category?'selected':''}>${label}</option>`).join('')}</select></label>
    <p><small>Choose a Blue or Maize equivalent when the session covers the same training purpose. Each category counts once per week.</small></p>
    <div id="custom-exercises"></div><details><summary>Add exercises</summary>
    <label>Search <input name="query" type="search" placeholder="Exercise name"></label>
    <div class="fields"><label>Equipment <select name="equipment"><option value="">Any</option>${options(filters.map(g=>g.equipment))}</select></label>
    <label>Muscle <select name="muscle"><option value="">Any</option>${options(filters.flatMap(g=>[...g.primary,...g.secondary]))}</select></label>
    <label>Movement <select name="pattern"><option value="">Any</option>${options(filters.map(g=>g.movementPattern))}</select></label></div>
    <div id="library-matches" class="pills"></div></details>
    ${mode==='session'?'<label><input type="checkbox" name="saveTemplate"> Also update the saved template</label>':''}
    <p role="status" id="custom-error"></p><div class="pills"><button type="submit">Save ${mode==='session'?'session':'workout'}</button><button type="button" id="cancel-custom">Cancel</button></div></form>`;
  const form = dialog.querySelector('form'), field = name => form.elements.namedItem(name);
  const list = dialog.querySelector('#custom-exercises'), matches = dialog.querySelector('#library-matches');
  const redraw = () => {
    list.innerHTML = draft.exercises.map((item,index) => {
      const name = exerciseGuide(item.exerciseId)?.name ?? item.exerciseId;
      const unit = exerciseGuide(item.exerciseId)?.movementPattern === 'Carry' ? 'seconds' : 'reps';
      return `<fieldset class="custom-exercise"><legend>${esc(name)} · ${unit}</legend><div class="fields">
        ${[['sets','Sets'],['min','Minimum'],['max','Maximum']].map(([key,label]) => `<label>${label}<input type="number" min="1" max="${key==='sets'?10:120}" required data-index="${index}" data-field="${key}" value="${esc(item[key])}"></label>`).join('')}</div>
        <div class="pills"><button type="button" data-move="-1" data-index="${index}" ${index===0?'disabled':''}>Move up</button>
        <button type="button" data-move="1" data-index="${index}" ${index===draft.exercises.length-1?'disabled':''}>Move down</button>
        <button type="button" data-remove="${index}">Remove</button></div></fieldset>`;
    }).join('');
    const values = Object.fromEntries(['query','equipment','muscle','pattern'].map(key => [key,field(key).value]));
    matches.innerHTML = searchExercises(values).filter(guide => !draft.exercises.some(item => item.exerciseId===guide.id))
      .map(guide => `<button type="button" data-add="${guide.id}">+ ${esc(guide.name)}</button>`).join('') || '<small>No matching exercises</small>';
  };
  form.oninput = event => {
    const {index,field:key} = event.target.dataset;
    if (key) draft.exercises[index][key] = event.target.valueAsNumber;
    else if (['query','equipment','muscle','pattern'].includes(event.target.name)) redraw();
  };
  form.onclick = event => {
    const {add,remove,move,index} = event.target.dataset;
    if (add) draft.exercises.push({exerciseId:add,sets:3,min:8,max:12});
    else if (remove !== undefined) draft.exercises.splice(Number(remove),1);
    else if (move) {
      const from=Number(index), to=from+Number(move);
      [draft.exercises[from],draft.exercises[to]]=[draft.exercises[to],draft.exercises[from]];
    } else return;
    redraw();
  };
  form.onsubmit = event => {
    event.preventDefault();
    try {
      for (const key of ['name','description','category']) draft[key] = field(key==='name'?'workoutName':key).value;
      const valid = validateTemplate(draft);
      if (mode==='session') {
        (state.customSessionPlans ??= {})[`${day}:${type}`] = valid;
        if (field('saveTemplate').checked) saveTemplate(state,valid,type);
      } else state.settings.activeWorkoutTab = saveTemplate(state,valid,mode==='edit'?type:undefined);
      dialog.close();
      save();
    } catch (error) { dialog.querySelector('#custom-error').textContent=error.message; }
  };
  dialog.querySelector('#cancel-custom').onclick = () => dialog.close();
  redraw();
  dialog.showModal();
}
