import {historyBatches,MEALS,mealScore,weekKey,trend} from './core.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function dailyRecords(state) {
  const rows = new Map();
  const get = date => {
    if (!rows.has(date)) rows.set(date, {date, meals: {}, extraSnacks: []});
    return rows.get(date);
  };
  const metrics = ['weight', 'bodyFat', 'steps', 'activeCalories', 'exerciseMinutes'];
  const snackIds = new Set(Object.keys(state.deletedSnackIds ?? {}));
  for (const [date, snacks] of Object.entries(state.extraSnacks ?? {})) {
    if (!Array.isArray(snacks)) continue;
    for (const snack of snacks) {
      if (!snack?.id || snackIds.has(snack.id)) continue;
      get(date).extraSnacks.push(snack);
      snackIds.add(snack.id);
    }
  }
  for (const batch of historyBatches(state)) {
    for (const item of batch.normalized ?? []) {
      const row = get(item.date);
      row.source ??= batch.format;
      for (const key of metrics) if (item[key] != null) row[key] ??= item[key];
      for (const [key, value] of Object.entries(item.meals ?? {})) if (value != null) row.meals[key] ??= value;
      for (const snack of item.extraSnacks ?? []) {
        if (snackIds.has(snack.id)) continue;
        row.extraSnacks.push(snack);
        snackIds.add(snack.id);
      }
    }
    for (const session of batch.strengthSessions ?? []) if (session.completed) get(session.date).strength = true;
  }
  for (const [date, health] of Object.entries(state.healthData ?? {})) {
    const row = get(date);
    for (const key of metrics) if (Object.hasOwn(health, key)) row[key] = health[key];
    row.source = 'Varsity';
  }
  for (const [date, meals] of Object.entries(state.mealData ?? {})) Object.assign(get(date).meals, meals);
  for (const [date, weight] of Object.entries(state.weightHistory ?? {})) {
    if (!Object.hasOwn(state.healthData?.[date] ?? {}, 'weight')) get(date).weight = weight;
  }
  for (const [date, type] of Object.entries(state.workouts ?? {})) {
    if (['blue', 'maize', 'home'].includes(type)) get(date).strength = true;
  }
  const strengthByWeek = new Map();
  for (const row of rows.values()) {
    if (row.strength) strengthByWeek.set(weekKey(row.date), (strengthByWeek.get(weekKey(row.date)) ?? 0) + 1);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({
    ...row, weight: finite(row.weight), steps: finite(row.steps), activeCalories: finite(row.activeCalories),
    nutrition: mealScore(row.meals), weeklyStrength: (strengthByWeek.get(weekKey(row.date)) ?? 0) >= 2
  }));
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function weightSeries(state){const rows=dailyRecords(state).filter(x=>x.weight!==null).map(x=>({date:x.date,value:x.weight}));return trend(rows,7)}
function datePlus(date,n){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function followupChanges(rows){const weights=new Map(rows.filter(x=>x.weight!==null).map(x=>[x.date,x.weight]));return rows.map(row=>{const before=[-2,-1,0].map(n=>weights.get(datePlus(row.date,n))).filter(Number.isFinite);const after=[2,3,4].map(n=>weights.get(datePlus(row.date,n))).filter(Number.isFinite);return {...row,followup:before.length>=2&&after.length>=2?mean(after)-mean(before):null}})}
const PREDICTORS=[
  ['breakfast','Great/Good breakfast',r=>r.meals?.breakfast==null?null:Number(r.meals.breakfast)>=3,'breakfast'],
  ['lunch','Great/Good lunch',r=>r.meals?.lunch==null?null:Number(r.meals.lunch)>=3,'dinner'],
  ['afternoon','Great/Good afternoon snack',r=>r.meals?.afternoonSnack==null?null:Number(r.meals.afternoonSnack)>=3,'dinner'],
  ['dinner','Great/Good dinner',r=>r.meals?.dinner==null?null:Number(r.meals.dinner)>=3,'dinner'],
  ['nightSnack','No night snack',r=>r.meals?.nightSnack==null?null:Number(r.meals.nightSnack)===0,'close'],
  ['nightQuality','Great/Good night snack',r=>r.meals?.nightSnack==null||r.meals.nightSnack===0?null:Number(r.meals.nightSnack)>=3,'close'],
  ['noDrift','No Drift meals',r=>Object.keys(r.meals||{}).length<3?null:!Object.values(r.meals).some(x=>Number(x)===2),'dinner'],
  ['noOffTrack','No Off Track meals',r=>Object.keys(r.meals||{}).length<3?null:!Object.values(r.meals).some(x=>Number(x)===1),'dinner'],
  ['steps','8K-step day',r=>r.steps===null?null:r.steps>=8000,'steps'],
  ['strength','Strength session',r=>r.strength===true,'strength'],
  ['weeklyStrength','Two strength sessions in a week',r=>r.weeklyStrength,'strength'],
  ['nutrition','Good nutrition day',r=>r.nutrition===null?null:r.nutrition>=75,'dinner']
];
export function scoutingReport(state){const rows=followupChanges(dailyRecords(state));const findings=PREDICTORS.map(([id,label,fn,experiment])=>{const observed=rows.map(r=>({row:r,group:fn(r)})).filter(x=>x.group!==null);const paired=observed.filter(x=>x.row.followup!==null);const yes=paired.filter(x=>x.group).map(x=>x.row.followup),no=paired.filter(x=>!x.group).map(x=>x.row.followup);const sample=paired.length,delta=yes.length&&no.length?mean(yes)-mean(no):null;const eligible=sample>=14&&yes.length>=5&&no.length>=5;const effect=delta===null?0:Math.abs(delta);const confidence=!eligible?'Insufficient':sample>=60&&Math.min(yes.length,no.length)>=20&&effect>=.15?'High':sample>=30&&Math.min(yes.length,no.length)>=10&&effect>=.1?'Moderate':'Low';const positive=delta!==null&&delta<0;return {id,label,experiment,sample,yesCount:yes.length,noCount:no.length,yesAverage:yes.length?mean(yes):null,noAverage:no.length?mean(no):null,delta,confidence,eligible,positive,adherence:observed.length?observed.filter(x=>x.group).length/observed.length:null,dateFrom:paired[0]?.row.date||null,dateTo:paired.at(-1)?.row.date||null,points:paired.map(x=>({date:x.row.date,group:x.group,change:x.row.followup}))}});const pairedDays=rows.filter(x=>x.followup!==null).length;return {pairedDays,tier:pairedDays<14?'Building scouting report':pairedDays<30?'Early signal':pairedDays<60?'Developing signal':'Established pattern',findings}}
export function detailedScoutingReport(state){const report=scoutingReport(state);return {...report,findings:report.findings.map(f=>{const points=f.points||[],x=points.map(p=>p.group?1:0),y=points.map(p=>p.change),xm=x.length?mean(x):0,ym=y.length?mean(y):0,cov=x.reduce((sum,v,i)=>sum+(v-xm)*(y[i]-ym),0),sx=Math.sqrt(x.reduce((sum,v)=>sum+(v-xm)**2,0)),sy=Math.sqrt(y.reduce((sum,v)=>sum+(v-ym)**2,0)),correlation=sx&&sy?cov/(sx*sy):null;const mid=Math.floor(points.length/2),halves=[points.slice(0,mid),points.slice(mid)],halfDeltas=halves.map(part=>{const yes=part.filter(p=>p.group).map(p=>p.change),no=part.filter(p=>!p.group).map(p=>p.change);return yes.length>=3&&no.length>=3?mean(yes)-mean(no):null});const consistent=halfDeltas.every(d=>d!==null&&Math.sign(d)===Math.sign(f.delta));const ageDays=f.dateTo?Math.max(0,(Date.now()-new Date(`${f.dateTo}T12:00:00Z`).getTime())/86400000):Infinity;const coverage=f.sample?f.sample/dailyRecords(state).filter(r=>r.date>=f.dateFrom&&r.date<=f.dateTo).length:0;let confidence=f.confidence;if(confidence==='High'&&(!consistent||ageDays>120||coverage<.5))confidence='Moderate';if(confidence==='Moderate'&&(ageDays>365||coverage<.3))confidence='Low';return {...f,correlation,consistent,ageDays,coverage,confidence}})}}
export function suggestedExperiment(state){const report=detailedScoutingReport(state);const candidate=report.findings.filter(x=>x.eligible&&x.positive&&x.delta<=-.1&&x.confidence!=='Low'&&x.adherence!==null&&x.adherence<.8).sort((a,b)=>a.delta-b.delta)[0];if(candidate)return {choice:candidate.experiment,reason:`Your recent data has an association worth testing: ${candidate.label.toLowerCase()}.`};const rows=dailyRecords(state).slice(-14);const stepDays=rows.filter(x=>x.steps!==null);if(stepDays.length>=7&&stepDays.filter(x=>x.steps>=8000).length<stepDays.length*.65)return {choice:'steps',reason:'A steady movement baseline is a useful next focus.'};const dinners=rows.filter(x=>x.meals?.dinner!=null);if(dinners.length>=7&&dinners.filter(x=>Number(x.meals.dinner)>=3).length<dinners.length*.65)return {choice:'dinner',reason:'Dinner structure is a simple experiment for this week.'};return {choice:'strength',reason:'Two manageable strength sessions build consistency.'}}
