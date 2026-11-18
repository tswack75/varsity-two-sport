import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {APP_VERSION, initialState, PROGRAM, weeklyStrength} from './core.js';
import {exerciseGuide, guideMarkup} from './exercise-library.js';
import {customPlan, deleteTemplate, saveTemplate, searchExercises, validateTemplate, workoutProgram} from './custom-workouts.js';
import {completeWorkout, exerciseHistory, toggleProgressRequest, updateStrengthDraft} from './strength.js';
import {exerciseCard, renderTraining} from './strength-ui.js';
import {weeklyWorkoutSeries} from './progression-simple.js';
import {exportBackup, mergeImport, previewImport, restoreBackup} from './history-import.js';
import {exportForAnalysis} from './analysis-export.js';
import {applyRecommendations, previewRecommendations, undoRecommendations} from './recommendations.js';
import {loadState, persistState} from './storage.js';
import {selectWorkout} from './tracker.js';

const monday='2026-11-16', tuesday='2026-11-17', wednesday='2026-11-18';
const name='Incline dumbbell press', exerciseId='incline-dumbbell-press';
const sets=[{weight:30,reps:10},{weight:30,reps:10},{weight:30,reps:9}];
const template=(category='other')=>({name:'Hotel Gym',description:'Dumbbells and a bench',category,exercises:[{exerciseId,sets:3,min:6,max:10}]});
const file=changes=>({schemaVersion:1,appVersion:APP_VERSION,changes});
const completedSets=()=>sets.map(set=>({...set,confirmed:true}));

test('every existing exercise has offline instructions and a front/back guide',()=>{
  for(const [exercise] of Object.values(PROGRAM).flat()){
    const guide=exerciseGuide(exercise);
    assert.ok(guide,exercise);
    assert.ok(guide.setup && guide.movement && guide.mistakes && guide.primary.length && guide.secondary.length);
    assert.ok(guide.cues.length >= 3);
    assert.ok(guide.demonstration?.url.startsWith('https://'),exercise);
    assert.match(guideMarkup(exercise), /<details class="exercise-guide" name="exercise-guides"><summary>Form &amp; Muscles/);
    assert.match(guideMarkup(exercise), /Front and back muscle map/);
  }
  assert.match(guideMarkup('Incline dumbbell press'),/dumbbell-incline-bench-press/);
  assert.match(guideMarkup('Romanian deadlift'),/barbell-romanian-deadlift/);
  assert.match(guideMarkup('Pallof press'),/cable-pallof-press/);
  assert.match(guideMarkup('Unverified exercise'),/No guide is available/);
  assert.doesNotMatch(guideMarkup(name),/<video|<iframe|<script/);
});

test('the custom library searches by variation, muscle, equipment and movement',()=>{
  const result=searchExercises({query:'incline',equipment:'Dumbbells',muscle:'Chest',pattern:'Push'});
  assert.deepEqual(result.map(item=>item.id),[exerciseId]);
  assert.equal(exerciseGuide('Dumbbell lateral raise').equipment,'Dumbbells');
  assert.ok(!searchExercises().some(item=>item.id==='lateral-raise'));
  assert.throws(()=>validateTemplate({...template(),exercises:[{exerciseId:'lateral-raise',sets:3,min:8,max:12}]}),/distinct exercise variants/);
});

test('custom workout templates support creation, editing, duplication, order and a session-only plan',()=>{
  const state=initialState(), id=saveTemplate(state,template());
  assert.deepEqual(workoutProgram(state,monday,id)[0],[name,'3 × 6–10','Dumbbells']);
  const renamed={...template(),name:'Travel Workout',exercises:[{exerciseId:'glute-bridge',sets:2,min:8,max:12},...template().exercises]};
  saveTemplate(state,renamed,id);
  const copy=saveTemplate(state,renamed);
  assert.notEqual(copy,id);
  assert.equal(state.customWorkouts[id].name,'Travel Workout');
  assert.equal(workoutProgram(state,monday,id)[0][0],'Glute bridge');
  state.customSessionPlans[`${monday}:${id}`]=template('blue');
  assert.equal(customPlan(state,monday,id).category,'blue');
  assert.equal(customPlan(state,tuesday,id).category,'other');
  assert.equal(workoutProgram(state,monday,id)[0][0],name);
  assert.throws(()=>saveTemplate(state,{...template(),exercises:[...template().exercises,...template().exercises]}),/distinct exercise variants/);
});

test('Maize reload populates custom LAST and TODAY, requires performed sets and preserves shared progression',async()=>{
  const original=globalThis.localStorage, store=new Map();
  globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  try{
    let state=initialState();
    updateStrengthDraft(state,monday,'maize',name,{sets});
    toggleProgressRequest(state,monday,'maize',name);
    completeWorkout(state,monday,'maize');
    const type=saveTemplate(state,template('blue'));
    selectWorkout(state,tuesday,type);
    await persistState(state);
    state=await loadState();
    const html=exerciseCard(state,tuesday,type,name,'3 × 6–10','Dumbbells',0,String);
    assert.match(html,/LAST Nov 16/);
    assert.match(html,/30 lb × 10 · 30 lb × 10 · 30 lb × 9/);
    assert.match(html,/value="30" aria-label="Incline dumbbell press set 1 weight"/);
    assert.match(html,/value="9" aria-label="Incline dumbbell press set 3 reps"/);
    assert.match(html,/PROGRESSION REQUESTED \+/);
    assert.doesNotMatch(html,/data-set-confirmed checked/);
    assert.equal(state.completedWorkoutSessions[`${tuesday}:${type}`],undefined);
    assert.equal(completeWorkout(state,tuesday,type).empty,true);
    updateStrengthDraft(state,tuesday,type,name,{sets:[{...sets[0],confirmed:true},sets[1],sets[2]]});
    toggleProgressRequest(state,tuesday,type,name);
    assert.equal(completeWorkout(state,tuesday,type).workingSets,1);
    await persistState(state);
    state=await loadState();
    assert.equal(state.completedWorkoutSessions[`${tuesday}:${type}`].workoutName,'Hotel Gym');
    assert.equal(exerciseHistory(state,name)[0].progressRequested,true);
    assert.deepEqual(exerciseHistory(state,name).map(log=>log.workoutType),[type,'maize']);
    assert.equal(weeklyStrength(state,tuesday).complete,true);
    const week=weeklyWorkoutSeries(state,tuesday)[0];
    assert.equal(week.goal,true);
    assert.equal(week.count,2);
    deleteTemplate(state,type);
    assert.equal(state.customWorkouts[type],undefined);
    assert.equal(exerciseHistory(state,name).length,2);
    assert.equal(state.completedWorkoutSessions[`${tuesday}:${type}`].workoutName,'Hotel Gym');
    assert.equal(weeklyWorkoutSeries(state,tuesday)[0].count,2);
  }finally{globalThis.localStorage=original;}
});

test('distinct equipment variants do not reuse broad legacy loads',()=>{
  const state=initialState(), type=saveTemplate(state,{...template(),exercises:[{exerciseId:'dumbbell-lateral-raise',sets:2,min:10,max:15}]});
  state.strengthLogs.push({date:monday,exercise:'Cable Lateral Raise',sets:[{weight:60,reps:12}]});
  const html=exerciseCard(state,tuesday,type,'Dumbbell lateral raise','2 × 10–15','Dumbbells',0,String);
  assert.match(html,/No previous performance/);
  assert.doesNotMatch(html,/value="60"/);
});

test('Workouts shows custom controls and places guides after logging controls',()=>{
  const original=globalThis.document;
  globalThis.document={querySelector:()=>({}),querySelectorAll:()=>[]};
  try{
    const state=initialState(),type=saveTemplate(state,template());
    state.settings.activeWorkoutTab=type;
    let html='';
    renderTraining({state,day:monday,shell:value=>{html=value;},save(){},esc:String});
    assert.match(html,/CORE WORKOUTS/);
    assert.match(html,/My workouts/);
    assert.match(html,/Hotel Gym/);
    assert.match(html,/Edit this session/);
    assert.ok(html.indexOf('data-set-field')<html.indexOf('Form &amp; Muscles'));
  }finally{globalThis.document=original;}
});

test('analysis export preserves zero, missing data, original sourced history and immutable configuration',async()=>{
  let state=initialState();
  state.healthData[tuesday]={steps:0,bodyFat:19.5};
  state.mealData[tuesday]={nightSnack:0};
  state.analyticsResults.archive={gameReadiness:71};
  const hq=JSON.stringify({entries:{[monday]:{weight:180,steps:8400,bodyFat:20,mealBehavior:{dinner:{score:4}}}},strengthHistory:[]});
  state=mergeImport(state,await previewImport(state,hq));
  const type=saveTemplate(state,template());
  updateStrengthDraft(state,tuesday,type,name,{sets:completedSets()});
  completeWorkout(state,tuesday,type);
  const data=exportForAnalysis(state);
  assert.equal(data.metadata.schemaVersion,1);
  assert.deepEqual(data.metadata.dateRange,{start:monday,end:tuesday});
  assert.equal(data.dailyRecords[0].ratings.dinner,1);
  assert.equal(data.dailyRecords[1].ratings.nightSnack,0);
  assert.equal(data.dailyRecords[1].ratings.breakfast,null);
  assert.equal(data.dailyRecords[1].steps,0);
  assert.equal(data.dailyRecords[1].weight,null);
  assert.equal(data.historicalData.imports[0].original,hq);
  assert.equal(data.historicalData.legacy.analyticsResults.archive.gameReadiness,71);
  assert.equal(data.workoutSessions[0].name,'Hotel Gym');
  assert.equal(data.workoutSessions[0].exerciseLogIds[0],data.exerciseHistory[0].id);
  assert.equal(data.exerciseHistory[0].sets[2].reps,9);
  assert.ok(data.dataDictionary.exerciseHistory);
  data.configuration.customWorkouts[type].name='Mutation';
  assert.equal(state.customWorkouts[type].name,'Hotel Gym');
});

test('recommendation preview is read-only, acceptance is selective, and undo preserves recorded history',()=>{
  const state=initialState();
  state.healthData[monday]={weight:180};
  const changes=[{op:'setting',target:'stepGoal',value:9000,reason:'An example'}, {op:'newWorkout',value:template()},
    {op:'weightIncrement',target:exerciseId,value:2.5}];
  const preview=previewRecommendations(state,{...file(changes),notes:'Hypothesis to review'});
  assert.equal(state.settings.stepGoal,undefined);
  assert.deepEqual(preview.changes.map(item=>item.current),[8000,null,null]);
  assert.equal(preview.notes,'Hypothesis to review');
  assert.throws(()=>applyRecommendations(state,preview,[]),/at least one/);
  const next=applyRecommendations(state,preview,[0,2]);
  assert.equal(next.settings.stepGoal,9000);
  assert.equal(next.settings.weightIncrements[exerciseId],2.5);
  assert.deepEqual(next.customWorkouts,{});
  assert.equal(next.healthData,state.healthData);
  assert.equal(next.recommendationHistory[0].changes.length,2);
  assert.throws(()=>undoRecommendations({...next,settings:{...next.settings,stepGoal:8500}}),/newer setting/);
  const undone=undoRecommendations(next);
  assert.equal(undone.settings.stepGoal,undefined);
  assert.equal(undone.settings.weightIncrements[exerciseId],undefined);
  assert.ok(undone.recommendationHistory[0].undoneAt);
  assert.deepEqual(undone.healthData,state.healthData);
});

test('recommendation schema rejects incompatible versions, history mutations, code and invalid values',()=>{
  const state=initialState();
  for(const bad of [
    {...file([]),schemaVersion:2},
    {...file([{op:'setting',target:'stepGoal',value:9000}]),appVersion:'2.1.0'},
    file([{op:'delete',target:'healthData',value:monday}]),
    file([{op:'setting',target:'constructor',value:1}]),
    file([{op:'setting',target:'stepGoal',value:'9000'}]),
    file([{op:'setting',target:'stepGoal',value:0}]),
    file([{op:'setting',target:'stepGoal',value:9000,script:'some code'}]),
    file([{op:'program',target:'maize',value:[{exerciseId:'unknown',sets:3,min:8,max:12}]}])
  ])assert.throws(()=>previewRecommendations(state,bad));
});

test('the documented example validates and accepting a template adds no session',()=>{
  const state=initialState(), example=JSON.parse(readFileSync(new URL('./recommendations.example.json',import.meta.url)));
  const result=applyRecommendations(state,previewRecommendations(state,example),[2]);
  assert.equal(Object.values(result.customWorkouts)[0].name,'Hotel Gym');
  assert.deepEqual(result.completedWorkoutSessions,{});
});

test('full backup and historical merge preserve custom sessions, templates and recommendation audit',async()=>{
  let state=initialState();
  const type=saveTemplate(state,template('blue'));
  updateStrengthDraft(state,monday,type,name,{sets:completedSets()});
  completeWorkout(state,monday,type);
  state=applyRecommendations(state,previewRecommendations(state,file([{op:'setting',target:'stepGoal',value:9000}])),[0]);
  const backup=exportBackup(state), restored=restoreBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(restored.customWorkouts,state.customWorkouts);
  assert.deepEqual(restored.completedWorkoutSessions,state.completedWorkoutSessions);
  assert.deepEqual(restored.recommendationHistory,state.recommendationHistory);
  const fresh=initialState(), preview=await previewImport(fresh,JSON.stringify(backup));
  assert.equal(preview.strengthSessions[0].category,'blue');
  const merged=mergeImport(fresh,preview);
  assert.equal(weeklyStrength(merged,wednesday).blue,true);
  assert.equal(exerciseHistory(merged,name)[0].workoutType,type);
});
