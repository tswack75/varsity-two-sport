import {isCustomWorkout,workoutName} from './custom-workouts.js';
import {APP_VERSION,initialState,dateKey} from './core.js';
import {addSnack, rateMeal, renderFood, updateSnack} from './food.js';
import {bindSettings, settingsMarkup} from './data-settings.js';
import {loadState,persistState} from './storage.js';
import {ensureStrengthState} from './strength.js';
import {renderTraining} from './strength-ui.js';
import {dailyRecords} from './analytics.js';
import {scoreHistory, scoreInputs} from './health-score.js';
import {recentChart, recentDomain, todayScore} from './health-score-ui.js';
import {renderProgression} from './progression-simple.js';
import {stepGoal,setDailyHealth,selectWorkout,setOtherWorkout,completedTypes,weeklyTracker,previousWeight,dailyEntry} from './tracker.js';

const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=Object.assign(initialState(),await loadState()||{});ensureStrengthState(state);
let page='today',day=dateKey(),notice='',focusType=null;
function save(renderNow=true){state.appVersion=APP_VERSION;let pending;try{pending=persistState(state)}catch{notice='Save failed. Export a backup in Data & settings.';if(renderNow)render();return Promise.reject(Error(notice))}pending.catch(()=>{notice='Save failed. Export a backup in Data & settings.';render()});if(renderNow)render();return pending}
function shell(body){$('#app').innerHTML=`<header><div class="brand"><span class="mark">V</span><span>VARSITY<small>FITNESS TRACKER</small></span></div><span class="local">● LOCAL FIRST</span></header><nav aria-label="Primary">${['today','workouts','progression'].map(tab=>`<button data-page="${tab}" class="${page===tab?'active':''}">${tab.toUpperCase()}</button>`).join('')}</nav><main>${notice?`<div class="notice" role="status">${esc(notice)}</div>`:''}${body}</main><footer><button id="settings-link" class="footer-settings">Data & settings</button><span>Saved on this device unless exported.</span></footer>`;document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page;notice='';render()});$('#settings-link').onclick=()=>{page='settings';render()}}
function today({extraOpen = false, snackOpen = null} = {}) {
  const h=dailyEntry(state,day),chosen=state.workoutSelections[day]||'',completed=completedTypes(state,day),week=weeklyTracker(state,day),prior=previousWeight(state,day),pct=Math.min(100,Math.round((Number(h.steps)||0)/stepGoal(state)*100)),details=state.workoutDetails[day]||{};
  const rows = dailyRecords(state), domain = recentDomain(day);
  const chart = (key, label, color) => recentChart(rows.filter(row => row[key] !== null).map(row => ({date:row.date,value:row[key]})), domain, label, color);
  const score = (records = dailyRecords(state)) => todayScore(scoreHistory(state, scoreInputs(state, records)), day, domain);
  shell(`<div class="section-title"><div><span class="eyebrow">TODAY</span><h1>Log your day</h1></div><label>Date <input id="day" type="date" value="${day}" aria-label="Log date"></label></div><section id="today-health-score" class="card health-score-card">${score(rows)}</section><section class="card daily-inputs"><div class="daily-field"><label>WEIGHT <input data-health="weight" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(h.weight??'')}" aria-label="Weight in pounds" placeholder="lb"></label><small>${prior?`Previous: ${prior.weight} lb · ${prior.date}`:'No earlier weight recorded'}</small>${chart('weight','Weight')}</div><div class="daily-field"><label>STEPS <input data-health="steps" type="number" min="0" step="1" inputmode="numeric" value="${esc(h.steps??'')}" aria-label="Steps"></label><small>${pct}% of ${stepGoal(state).toLocaleString()} steps</small><div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>${chart('steps','Steps','#75d7c0')}</div><div class="daily-field"><label>ACTIVE CALORIES <input data-health="activeCalories" type="number" min="0" step="1" inputmode="numeric" value="${esc(h.activeCalories??'')}" aria-label="Active calories"></label><small>${state.settings.activeCalorieGoal?`Goal: ${esc(state.settings.activeCalorieGoal)} active calories`:'Recent activity'}</small>${chart('activeCalories','Active calories','#75d7c0')}</div><div class="daily-field"><label>WORKOUT <select id="workout-selection" aria-label="Workout selection"><option value="" ${chosen===''?'selected':''} disabled>Select one</option>${[['none','None'],['blue','Blue'],['maize','Maize'],['white','White'],['other','Other'],...Object.entries(state.customWorkouts??{}).filter(([id])=>isCustomWorkout(id)).map(([id,template])=>[id,template.name])].map(([value,text])=>`<option value="${value}" ${chosen===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>${(['blue','maize','white'].includes(chosen)||Boolean(state.customWorkouts?.[chosen]))?`<button id="open-workout">Open ${esc(workoutName(state,chosen,day))} workout →</button>`:''}${chosen==='other'?`<label>Description <input id="other-description" value="${esc(details.description||'')}" maxlength="120"></label><label>Minutes <input id="other-duration" type="number" min="0" step="1" value="${esc(details.durationMinutes??'')}"></label><button id="complete-other">Mark Other complete</button>`:''}<small>${completed.length?`Completed: ${completed.map(x=>esc(workoutName(state,x,day))).join(', ')}`:chosen&&chosen!=='none'?'Selected, not completed':chosen==='none'?'No workout performed':'No workout selected'}</small></div><p class="save-indicator" role="status">Changes save on this device as you enter them.</p></section>${renderFood(h.meals, h.extraSnacks ?? [], state.extraSnacks?.[day] ?? [], esc)}<div class="dashboard-grid"><section class="card"><span class="eyebrow">THIS WEEK</span><div class="statrow"><span>Step goal days</span><b>${week.stepDays}</b></div><div class="statrow"><span>Blue</span><b>${week.strength.blue?'Done':'—'}</b></div><div class="statrow"><span>Maize</span><b>${week.strength.maize?'Done':'—'}</b></div><div class="statrow"><span>White · optional</span><b>${week.strength.white?'Done':'—'}</b></div><div class="progress" aria-label="Weekly training goal ${week.trainingPercent}%"><span style="width:${week.trainingPercent}%"></span></div><small>${week.trainingPercent}% of core training goal</small></section><section class="card"><span class="eyebrow">RECENT PROGRESS</span><h2>Keep a steady record</h2><p>${week.strength.gym} of 2 core workouts this week.</p><button id="view-progress">View progress →</button></section></div>`);
  $('#day').onchange=e=>{day=e.target.value||dateKey();render()};
  document.querySelectorAll('[data-health]').forEach(input=>{input.oninput=()=>{try{setDailyHealth(state,day,input.dataset.health,input.value);save(false);if(input.dataset.health!=='weight')$('#today-health-score').innerHTML=score();$('.save-indicator').textContent='Saved locally'}catch{$('.save-indicator').textContent='Enter a valid value'}};input.onchange=()=>render()});
  $('#workout-selection').onchange=e=>{selectWorkout(state,day,e.target.value);save()};
  $('#open-workout')?.addEventListener('click',()=>{focusType=chosen;page='workouts';render()});
  const saveOther=()=>{try{setOtherWorkout(state,day,{description:$('#other-description').value,duration:$('#other-duration').value});save(false);$('.save-indicator').textContent='Saved locally';return true}catch{$('.save-indicator').textContent='Enter a valid duration';return false}};
  $('#other-description')?.addEventListener('input',saveOther);$('#other-duration')?.addEventListener('input',saveOther);
  $('#complete-other')?.addEventListener('click',()=>{if(!saveOther())return;state.workouts[day]='other';state.completedWorkoutSessions[`${day}:other`]={date:day,type:'other',completed:true,completedAt:new Date().toISOString(),...state.workoutDetails[day]};save()});
  const extra = $('.extra-snacks');
  if (state.settings.showFoodGuide) $('.food-log details').open = true;
  extra.open = extraOpen;
  const saveFood = (button, change, openSnack = null) => {
    change();
    const controls = Array.from(document.querySelectorAll('[data-meal], [data-add-snack], [data-edit-snack], [data-delete-snack]'));
    const index = controls.indexOf(button);
    const open = extra.open;
    save(false);
    today({extraOpen: open, snackOpen: openSnack});
    const newControls = document.querySelectorAll('[data-meal], [data-add-snack], [data-edit-snack], [data-delete-snack]');
    const target = newControls[index];
    (target?.closest('details:not([open])') ? $('.extra-snacks summary') : target)?.focus({preventScroll: true});
  };
  if (snackOpen !== null) extra.querySelectorAll('details')[snackOpen]?.setAttribute('open', '');
  document.querySelectorAll('[data-meal]').forEach(button => button.onclick = () =>
    saveFood(button, () => rateMeal(state, day, button.dataset.meal, Number(button.dataset.rating))));
  document.querySelectorAll('[data-add-snack]').forEach(button => button.onclick = () =>
    saveFood(button, () => addSnack(state, day, Number(button.dataset.rating))));
  document.querySelectorAll('[data-edit-snack], [data-delete-snack]').forEach(button => button.onclick = () => {
    const {editSnack, deleteSnack, rating} = button.dataset;
    const index = Array.from(extra.querySelectorAll('details')).indexOf(button.closest('details'));
    saveFood(button, () => updateSnack(state, day, editSnack ?? deleteSnack, editSnack ? Number(rating) : null),
      editSnack ? index : null);
  });
  $('#view-progress').onclick=()=>{page='progression';render()};
}
function settings() {
  shell(settingsMarkup());
  bindSettings({state, esc, commit: async (next, message) => {
    next.appVersion = APP_VERSION;
    next.updatedAt = Math.max(Number(next.updatedAt) || 0, Number(state.updatedAt) || 0);
    await persistState(next, {durable: true});
    state = next;
    notice = message;
    settings();
  }});
}
function render(){if(!state.settings.onboarded){$('#app').innerHTML=`<main class="welcome"><span class="mark">V</span><span class="eyebrow">VARSITY</span><h1>A simpler way to track your progress.</h1><p>Log weight, steps, activity, and workouts. Your records stay on this device.</p><div class="pills"><button id="start">Get started</button><button id="welcome-import">Import or restore data</button></div></main>`;$('#start').onclick=()=>{state.settings.onboarded=true;save()};$('#welcome-import').onclick=()=>{page='settings';settings()};return}if(page==='today')today();else if(page==='workouts'){renderTraining({state,day,shell,save,esc,focusType});focusType=null}else if(page==='progression')renderProgression({state,day,shell,save,esc});else settings()}
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
