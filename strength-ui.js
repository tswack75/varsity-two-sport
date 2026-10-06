import {weeklyStrength} from './core.js';
import {ensureStrengthState,exerciseId,draftKey,lastExercise,exerciseHistory,formatSets,parseTarget,recommendProgression,updateStrengthDraft,toggleProgressRequest,completeWorkout} from './strength.js';
import {persistDraft} from './storage.js';

const status=week=>week.bonus?'Bonus training week':week.complete?'Core training complete':week.gym===1?'One more core session':'Training opportunity';
const dateLabel=date=>date?new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
export function renderTraining({state,day,shell,save,esc}){
  ensureStrengthState(state);
  const week=weeklyStrength(state,day),program=state.settings.program;
  const cards=['blue','maize','white'].map(type=>{
    const optional=type==='white';
    return `<section class="card workout-panel" id="workout-${type}"><div class="section-title"><div><span class="eyebrow">${optional?'OPTIONAL · BONUS SESSION':'CORE SESSION · ABOUT 30 MINUTES'}</span><h2>Workout ${type.toUpperCase()}</h2></div><strong>${week[type]?'✓ DONE':optional?'BONUS':'TO DO'}</strong></div>${optional?'<p class="muted">Blue + Maize already make a complete week. White is available if you want another session.</p>':''}${program[type].map(([name,target,note],index)=>exerciseCard(state,day,type,name,target,note,index,esc)).join('')}<button class="complete-workout" data-complete="${type}">Complete ${type.toUpperCase()}</button></section>`
  }).join('');
  shell(`<div class="eyebrow">TRAINING ROOM · BLOCK ${state.settings.trainingBlock||1}</div><h1>Blue + Maize = complete week.</h1><p class="lead">White is bonus work. Each session is designed for about 30 minutes.</p><section class="card weekly-strength"><span class="eyebrow">STRENGTH THIS WEEK</span><h2>${status(week)}</h2><div class="strength-stripes"><span>BLUE ${week.blue?'✓':'○'}</span><span>MAIZE ${week.maize?'✓':'○'}</span><span>WHITE ${week.white?'✓':'BONUS'}</span></div><p>${week.complete?'Core training is covered. White is available if you want another session.':week.blue?'Maize is the next core session.':'Blue is the next core session.'}</p></section><div class="training-grid">${cards}</div><section class="card"><span class="eyebrow">15-MINUTE HOME BACKUP</span><h2>Keep the week moving</h2><p>Home Blue and Home Maize support consistency when the gym is missed. They do not replace gym progression. White never needs a makeup.</p><div class="pills"><button data-complete="home-blue">Complete Home Blue</button><button data-complete="home-maize">Complete Home Maize</button></div><details><summary>Home workout moves</summary>${program.home.map(([name,target,note])=>`<p>${esc(name)} · ${esc(target)} ${esc(note)}</p>`).join('')}</details></section><section class="card"><h2>Training block</h2><p>Keep movements stable for 6–8 weeks, then change a few exercises if you want variety.</p><button id="new-block">Start a new block</button></section><dialog id="exercise-history"></dialog><dialog id="workout-summary"></dialog><dialog id="exercise-edit"></dialog>`);
  document.querySelectorAll('.strength-exercise').forEach(card=>{
    const type=card.dataset.type,name=card.dataset.name;
    card.querySelectorAll('[data-set-field]').forEach(input=>input.addEventListener('input',()=>{
      if(input.validity.badInput)return;
      const sets=[...card.querySelectorAll('.set-row')].map(row=>({weight:row.querySelector('[data-set-field="weight"]').value,reps:row.querySelector('[data-set-field="reps"]').value}));
      updateStrengthDraft(state,day,type,name,{sets});
      try{persistDraft(state);card.querySelector('.exercise-save-status').textContent='Saved locally'}catch{card.querySelector('.exercise-save-status').textContent='Save failed. Export a backup in Settings.'}
    }));
    card.querySelector('[data-progress]').onclick=()=>{toggleProgressRequest(state,day,type,name);save()};
    card.querySelector('[data-history]').onclick=()=>showExerciseHistory(state,name,esc);
    card.querySelector('[data-edit-exercise]').onclick=()=>showEditExercise(state,type,Number(card.dataset.index),save,esc);
  });
  document.querySelectorAll('[data-complete]').forEach(button=>button.onclick=()=>{
    const result=completeWorkout(state,day,button.dataset.complete);
    save();
    showWorkoutSummary(result,esc);
  });
  document.querySelector('#new-block').onclick=()=>{state.settings.trainingBlock=(state.settings.trainingBlock||1)+1;save()};
}
function exerciseCard(state,day,type,name,target,note,index,esc){
  const id=exerciseId(name),draft=state.strengthDrafts[draftKey(day,type,id)]||{},last=lastExercise(state,name,day),parsed=parseTarget(target),recommendation=recommendProgression(last,target,{increment:/dumbbell|curl|lateral|fly/i.test(name)?2.5:5}),sets=Array.from({length:parsed.sets},(_,setIndex)=>{
    const previous=last?.sets?.[setIndex];
    const weight=draft.sets?.[setIndex]?.weight??(recommendation.kind==='weight'?recommendation.weight:previous?.weight??recommendation.weight??'');
    const reps=draft.sets?.[setIndex]?.reps??'';
    return `<div class="set-row"><b>SET ${setIndex+1}</b><label>Weight <input data-set-field="weight" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(weight)}" aria-label="${esc(name)} set ${setIndex+1} weight"></label><label>${parsed.timed?'Seconds':'Reps'} <input data-set-field="reps" type="number" inputmode="numeric" min="0" step="1" value="${esc(reps)}" aria-label="${esc(name)} set ${setIndex+1} ${parsed.timed?'seconds':'reps'}"></label></div>`
  }).join('');
  return `<article class="strength-exercise" data-type="${type}" data-name="${esc(name)}" data-index="${index}"><div class="section-title"><div><button class="exercise-name" data-history type="button">${esc(name)} ↗</button><small>${esc(note)}</small></div><button class="quiet-button" data-edit-exercise type="button">Edit</button></div><div class="exercise-facts"><div><span class="eyebrow">TARGET</span><strong>${esc(target)}</strong></div><div><span class="eyebrow">LAST</span><strong>${last?esc(formatSets(last)):'No history yet'}</strong><small>${last?dateLabel(last.date):''}</small></div></div>${last?.progressRequested===true?'<p class="progress-requested">PROGRESSION REQUESTED +</p>':''}<div class="next-call"><span class="eyebrow">TODAY'S RECOMMENDATION</span><b>${esc(recommendation.text)}</b></div><div class="today-sets"><span class="eyebrow">TODAY</span>${sets}</div><div class="exercise-footer"><button class="progress-button ${draft.progressRequested===true?'selected':''}" data-progress type="button" aria-pressed="${draft.progressRequested===true}">${draft.progressRequested===true?'PROGRESS NEXT TIME ✓':'+ PROGRESS NEXT TIME'}</button><small class="exercise-save-status">Entries save as you type</small></div></article>`
}
function historySparkline(history){
  const points=history.map(log=>({date:log.date,weight:Math.max(0,...(log.sets||[]).map(set=>Number(set.weight)||0))})).filter(point=>point.weight>0).reverse();
  if(points.length<2)return '';
  const values=points.map(point=>point.weight),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
  const coords=points.map((point,index)=>`${(index/(points.length-1)*300).toFixed(1)},${(72-(point.weight-low)/span*56).toFixed(1)}`).join(' ');
  return `<div class="history-spark"><span class="eyebrow">TOP WEIGHT TREND</span><svg viewBox="0 0 300 88" role="img" aria-label="Top weight trend for ${points.length} workouts"><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}
function showExerciseHistory(state,name,esc){const history=exerciseHistory(state,name);const dialog=document.querySelector('#exercise-history');if(!dialog)return;dialog.innerHTML=`<button class="dialog-close" aria-label="Close">×</button><span class="eyebrow">EXERCISE HISTORY</span><h2>${esc(name)}</h2>${historySparkline(history)}${history.length?history.map(log=>`<div class="statrow"><span>${esc(dateLabel(log.date))}<small>${esc(formatSets(log))}</small></span><b>${log.progressRequested===true?'+':''}${log.isPR?' PR':''}</b></div>`).join(''):'<p>No history yet.</p>'}<p class="muted">Open Progression for the full graph.</p>`;dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close()}
function showEditExercise(state,type,index,save,esc){const dialog=document.querySelector('#exercise-edit'),item=state.settings.program[type][index];dialog.innerHTML=`<h2>Edit or substitute exercise</h2><label>Name <input id="edit-exercise-name" value="${esc(item[0])}"></label><label>Target <input id="edit-exercise-target" value="${esc(item[1])}"></label><label>Equipment / note <input id="edit-exercise-note" value="${esc(item[2])}"></label><div class="pills"><button id="save-exercise-edit">Save</button><button id="cancel-exercise-edit">Cancel</button></div>`;dialog.showModal();dialog.querySelector('#cancel-exercise-edit').onclick=()=>dialog.close();dialog.querySelector('#save-exercise-edit').onclick=()=>{item[0]=dialog.querySelector('#edit-exercise-name').value.trim()||item[0];item[1]=dialog.querySelector('#edit-exercise-target').value.trim()||item[1];item[2]=dialog.querySelector('#edit-exercise-note').value.trim();dialog.close();save()}}
function showWorkoutSummary(result,esc){const dialog=document.querySelector('#workout-summary');if(!dialog)return;dialog.innerHTML=`<button class="dialog-close" aria-label="Close">×</button><span class="eyebrow">WORKOUT COMPLETE</span><h2>${esc(result.type.toUpperCase())} COMPLETE</h2><div class="big">+${result.xp} XP</div><p>${result.exercises} exercises · ${result.workingSets} working sets · ${result.progressRequested} marked to progress</p>${result.logs.filter(log=>log.progressRequested).map(log=>`<div class="statrow"><span>${esc(log.exerciseName)}</span><b>${esc(log.progressRecommendation.text)}</b></div>`).join('')}${result.prs.length?`<p class="progress-requested">NEW PR · Training staff reports measurable progress.</p>${result.prs.map(log=>`<p>${esc(log.exerciseName)} · ${esc(log.prTypes.join(', '))}</p>`).join('')}`:'<p>Film room noticed the work.</p>'}<p class="muted">Blue + Maize complete the weekly strength target. White stays optional.</p>`;dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close()}
