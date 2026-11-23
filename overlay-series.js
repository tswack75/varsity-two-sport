import {historyBatches, MEALS} from './core.js';
import {isSnack, validRating} from './food.js';
import {canonicalExercise, exerciseHistory} from './strength.js';

const DAY = 86400000;
export const calendarDay = date => Date.parse(`${date}T00:00:00Z`) / DAY;
export const dateAt = day => new Date(day * DAY).toISOString().slice(0,10);
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(calendarDay(date)) && dateAt(calendarDay(date)) === date;
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim())
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export const metrics = {
  healthScore: ['Health Activity Score','points / 100'],
  weight: ['Body weight','lb'],
  bodyFat: ['Body fat','%'],
  steps: ['Steps','steps'],
  activeCalories: ['Active calories','kcal'],
  exerciseMinutes: ['Exercise minutes','min'],
  workouts: ['Workout frequency','sessions / 7 days'],
  workoutDuration: ['Recorded workout duration','min'],
  exerciseWeight: ['Working weight','lb','exercise'],
  exerciseBestReps: ['Best set reps','reps','exercise'],
  exerciseReps: ['Total reps','reps','exercise'],
  exerciseVolume: ['Training volume','lb × reps','exercise'],
  exerciseSeconds: ['Total hold / carry time','sec','exercise'],
  foodRating: ['Mean food rating','rating / 4'],
  ...Object.fromEntries(MEALS.map(([key,label])=>[`food-${key}`,[`${label} rating`,'rating / 4']])),
  foodLogging: ['Food logging consistency','% of checkpoints'],
  extraSnacks: ['Extra snack frequency','logged snacks'],
  nightEating: ['Nighttime eating','snack indicator (0 or 1)']
};

export const displayModes = ['Points','Trend','Both'];
const defaultSelections = [{metric:'weight',mode:'Trend',color:0},{metric:'steps',mode:'Both',color:1}];
export const overlayKey = item => item.exercise ? `${item.metric}:${canonicalExercise(item.exercise)}` : item.metric;
export function overlayConfig(value) {
  const items = Array.isArray(value?.items) ? value.items : defaultSelections;
  const seen = new Set(), colors = new Set();
  const next = [];
  for (const item of items) {
    if (!Object.hasOwn(metrics,item?.metric) || !displayModes.includes(item.mode)) continue;
    const isExercise = metrics[item.metric][2] === 'exercise';
    if (isExercise && (typeof item.exercise !== 'string' || !item.exercise.trim())) continue;
    const row = {metric:item.metric,mode:item.mode,hidden:item.hidden===true};
    if (isExercise) row.exercise = item.exercise;
    const key = overlayKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    let color = item.color;
    if (!Number.isSafeInteger(color) || color < 0 || colors.has(color)) {
      color = 0;
      while (colors.has(color)) color++;
    }
    row.color = color;
    colors.add(color);
    next.push(row);
  }
  return {open:value?.open===true,items:next,exercise:typeof value?.exercise==='string'?value.exercise:''};
}

function completedWorkouts(state) {
  const sessions = new Map();
  const add = (session,replace = false) => {
    const type = session?.type ?? 'other';
    if (!session?.completed || !validDate(session.date) || typeof type!=='string' || ['none','rest',''].includes(type)) return;
    const key = `${session.date}:${type}`, current = sessions.get(key), minutes = number(session.durationMinutes);
    if (!current || replace) sessions.set(key,{date:session.date, minutes:minutes ?? current?.minutes ?? null});
  };
  for (const batch of historyBatches(state)) for (const session of batch.strengthSessions ?? []) add(session);
  for (const [date,type] of Object.entries(state.workouts ?? {})) add({date,type,completed:true});
  for (const session of Object.values(state.completedWorkoutSessions ?? {})) add(session,true);
  const byDate = new Map();
  for (const {date,minutes} of sessions.values()) {
    const row = byDate.get(date) ?? {date,count:0,minutes:null};
    row.count++;
    if (minutes !== null) row.minutes = (row.minutes ?? 0) + minutes;
    byDate.set(date,row);
  }
  const days = [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  let first = 0, count = 0;
  for (const [index,row] of days.entries()) {
    count += row.count;
    while (calendarDay(row.date) - calendarDay(days[first].date) >= 7) count -= days[first++].count;
    days[index].frequency = count;
  }
  return days;
}

function dailyValue(row, metric) {
  if (metric === 'foodLogging' || metric === 'foodRating') {
    const logged = MEALS.flatMap(([key]) => {
      const rating = number(row.meals?.[key]);
      return validRating(rating,isSnack(key)) ? [rating] : [];
    });
    if (metric === 'foodLogging') return logged.length ? logged.length / MEALS.length * 100 : null;
    const ratings = logged.filter(value => value > 0);
    return ratings.length ? ratings.reduce((sum,value)=>sum+value,0)/ratings.length : null;
  }
  if (metric === 'extraSnacks') return row.extraSnacks?.length || null;
  if (metric === 'nightEating') {
    const night = number(row.meals?.nightSnack);
    return validRating(night,true) ? Number(night > 0) : null;
  }
  if (metric.startsWith('food-')) {
    const key = metric.slice(5), rating = number(row.meals?.[key]);
    return validRating(rating,isSnack(key)) ? rating : null;
  }
  return number(row[metric]);
}

function exerciseValue(log, metric) {
  const timed = log.setsUnit === 'seconds' || /^(dumbbell )?farmer carry$/i.test(log.exerciseName);
  if (metric === 'exerciseSeconds' && !timed) return null;
  if (timed && !['exerciseWeight','exerciseSeconds'].includes(metric)) return null;
  const values = log.sets.flatMap(set => {
    const reps = number(set.reps), weight = number(set.weight);
    if (metric === 'exerciseWeight') return weight === null ? [] : [weight];
    if (metric === 'exerciseVolume') return weight === null || reps === null ? [] : [weight * reps];
    return reps === null ? [] : [reps];
  });
  if (!values.length) return null;
  if (metric === 'exerciseWeight' || metric === 'exerciseBestReps') return Math.max(...values);
  return values.reduce((sum,value)=>sum+value,0);
}

export function comparisonDomain(range, today, rows, state) {
  const end = calendarDay(today);
  if (range !== 'ALL') return {start:dateAt(end-({'30D':29,'90D':89,'6M':182}[range]??29)),end:today};
  let first = today;
  const consider = date => { if (validDate(date) && date < first) first = date; };
  for (const row of rows) consider(row.date);
  for (const date of Object.keys(state.workouts ?? {})) consider(date);
  for (const session of Object.values(state.completedWorkoutSessions ?? {})) if (session?.completed) consider(session.date);
  for (const log of state.strengthLogs ?? []) consider(log?.date);
  for (const batch of historyBatches(state)) {
    for (const session of batch.strengthSessions ?? []) if (session?.completed) consider(session.date);
    for (const log of batch.strengthLogs ?? []) consider(log?.date);
  }
  return {start:first,end:today};
}

export function alignDate(date, domain, left = 0, right = 1) {
  const start = calendarDay(domain.start), end = calendarDay(domain.end);
  return start === end ? (left + right) / 2 : left + (calendarDay(date)-start)/(end-start)*(right-left);
}

function indexedPoints(points, baseline, sparse) {
  let first = 0, sum = 0, segment = 0;
  const normalized = [];
  for (const [index,point] of points.entries()) {
    const day = calendarDay(point.date);
    if (index && day - calendarDay(points[index-1].date) > (sparse ? 14 : 1)) segment++;
    if (sparse && index && day - calendarDay(points[index-1].date) > 14) { first=index; sum=0; }
    sum += point.value;
    while (first < index && (day-calendarDay(points[first].date) >= (sparse ? 28 : 7) || sparse && index-first >= 3)) {
      sum -= points[first++].value;
    }
    const trend = sum / (index-first+1);
    const indexValue = point.value / baseline * 100, trendIndex = trend / baseline * 100;
    if (!Number.isFinite(indexValue) || !Number.isFinite(trendIndex)) return [];
    normalized.push({...point,indexValue,trend,trendIndex,segment});
  }
  return normalized;
}

export function buildOverlays(state, rows, domain, selections, scores = []) {
  const workouts = selections.some(item=>['workouts','workoutDuration'].includes(item.metric)) ? completedWorkouts(state) : [];
  const history = new Map();
  return selections.map(item => {
    const [title,unit,kind] = metrics[item.metric];
    const sparse = kind === 'exercise' || ['workouts','workoutDuration','extraSnacks'].includes(item.metric);
    const observed = new Map();
    const record = (date,value) => {
      if (validDate(date) && date >= domain.start && date <= domain.end && number(value) !== null
        && !observed.has(date)) observed.set(date,Number(value));
    };
    if (item.metric === 'healthScore') {
      for (const score of scores) record(score.date,score.value);
    } else if (kind === 'exercise') {
      const key = canonicalExercise(item.exercise);
      if (!history.has(key)) history.set(key,exerciseHistory(state,item.exercise));
      for (const log of history.get(key)) record(log.date,exerciseValue(log,item.metric));
    } else if (item.metric === 'workouts' || item.metric === 'workoutDuration') {
      for (const workout of workouts) record(workout.date,item.metric==='workouts'?workout.frequency:workout.minutes);
    } else {
      for (const row of rows) record(row.date,dailyValue(row,item.metric));
    }
    const points = [...observed].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}));
    const baseline = item.metric === 'healthScore' && points[0]?.value === 0
      ? points.find(point => point.value > 0) ?? {value:100, date:null}
      : points[0] ?? null;
    const indexed = baseline?.value > 0 ? indexedPoints(points,baseline.value,sparse) : [];
    const issue = !baseline ? 'No observations in this range.'
      : baseline.value === 0 ? 'The first observation is zero and cannot be indexed.'
      : !indexed.length ? 'The indexed values exceed the chart’s numeric range.' : '';
    return {...item,title:item.exercise?`${item.exercise} · ${title}`:title,unit,baseline,points:indexed,issue};
  });
}
