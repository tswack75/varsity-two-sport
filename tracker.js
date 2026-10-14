import {dateKey,weekKey,weeklyStrength} from './core.js';
import {dailyRecords} from './analytics.js';

export const STEP_GOAL=8000;
export function setDailyHealth(state,date,field,value){
  if(!['weight','steps','activeCalories'].includes(field))throw Error('Unknown daily field');
  state.healthData??={};state.healthData[date]??={};
  const number=value===''||value===null?null:Number(value);
  if(number!==null&&(!Number.isFinite(number)||number<0))throw Error('Enter a nonnegative number');
  state.healthData[date][field]=number;
  if(field==='weight'){state.weightHistory??={};state.weightHistory[date]=number}
  return number;
}
export function selectWorkout(state,date,type){
  if(!['none','blue','maize','white','other'].includes(type))throw Error('Unknown workout');
  state.workoutSelections??={};state.workoutSelections[date]=type;
  return type;
}
export function setOtherWorkout(state,date,{description='',duration=''}={}){
  state.workoutDetails??={};
  const minutes=duration===''?null:Number(duration);
  if(minutes!==null&&(!Number.isFinite(minutes)||minutes<0))throw Error('Enter a valid duration');
  state.workoutDetails[date]={description:String(description).trim(),durationMinutes:minutes};
}
export function completedTypes(state,date){
  const types=new Set();
  const legacy=state.workouts?.[date];if(legacy&&legacy!=='none'&&legacy!=='rest')types.add(legacy);
  for(const session of Object.values(state.completedWorkoutSessions||{}))if(session?.date===date&&session.completed)types.add(session.type);
  return [...types];
}
export function weeklyTracker(state,date){
  const week=weekKey(date),rows=dailyRecords(state).filter(row=>weekKey(row.date)===week&&row.date<=date);
  const stepDays=rows.filter(row=>row.steps>=STEP_GOAL).length;
  const strength=weeklyStrength(state,date);
  return {stepDays,strength,trainingPercent:(Number(strength.blue)+Number(strength.maize))*50};
}
export function previousWeight(state,date){return dailyRecords(state).filter(row=>row.date<date&&row.weight!==null).at(-1)||null}
export function dailyEntry(state,date){return dailyRecords(state).find(row=>row.date===date)||state.healthData?.[date]||{}}
export function activityTrend(state,date,days=7){const start=dateKey(new Date(new Date(`${date}T12:00:00`).getTime()-(days-1)*86400000));return dailyRecords(state).filter(row=>row.date>=start&&row.date<=date&&row.activeCalories!==null).map(row=>({date:row.date,value:row.activeCalories}))}
