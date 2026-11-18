import assert from 'node:assert/strict';
import test from 'node:test';
import {initialState} from './core.js';
import {dailyRecords} from './analytics.js';
import {alignDate,buildOverlays,comparisonDomain,overlayConfig} from './overlay-series.js';
import {bindOverlays,dateTooltip,overlaySvg,plotSeries} from './overlay-chart.js';
import {loadState,persistState} from './storage.js';

const day = '2026-11-20', exercise = 'Incline dumbbell press';
const period = {start:'2026-11-01',end:day};
const item = (metric,mode='Both',extra={}) => ({metric,mode,...extra});
const build = (state,domain,selections) =>
  buildOverlays(state,dailyRecords(state),domain,overlayConfig({items:selections}).items);
const exercises = () => [
  {date:'2026-11-02',exercise,weight:30,reps:[8,8]},
  {date:'2026-11-12',exercise,weight:30,reps:[9,9]},
  {date:'2026-11-14',exercise,weight:35,reps:[10,10]}
];

test('shared dates align across dense and sparse series with proportional irregular gaps',()=>{
  const state=initialState();
  for (let date=1;date<=20;date++) state.healthData[`2026-11-${String(date).padStart(2,'0')}`]={weight:180-date/10};
  state.strengthLogs=exercises();
  const plot=plotSeries(build(state,period,[item('weight'),item('exerciseReps','Both',{exercise})]),period);
  assert.equal(plot.dates.get('2026-11-12').length,2);
  assert.equal(plot.dates.get('2026-11-11').length,1);
  const wide=plot.x('2026-11-12')-plot.x('2026-11-02'), narrow=plot.x('2026-11-14')-plot.x('2026-11-12');
  assert.ok(Math.abs(wide/narrow-5)<1e-9);
  assert.equal(alignDate('2026-11-01',period),0);
  assert.equal(alignDate(day,period),1);
});

test('Points, Trend and Both are independent, hidden series do not affect the plot',()=>{
  const state=initialState();
  state.healthData['2026-11-02']={weight:180,steps:5000,activeCalories:300,bodyFat:18};
  state.healthData['2026-11-03']={weight:190,steps:5500,activeCalories:250,bodyFat:3};
  const series=build(state,period,[item('weight','Trend'),item('steps','Points'),item('activeCalories'),item('bodyFat','Both',{hidden:true})]);
  const plot=plotSeries(series,period), svg=overlaySvg(plot,period);
  assert.equal(plot.visible.length,3);
  assert.equal((svg.match(/data-marks="points"/g)??[]).length,2);
  assert.equal((svg.match(/data-marks="trend"/g)??[]).length,2);
  assert.match(svg,/data-marks="points"[^>]*opacity="0.55"/);
  assert.match(svg,/>100<\/text>/);
  assert.ok(plot.y(110)<plot.y(100));
  assert.ok(plot.y(80)>plot.y(100));
});

test('range changes rebase every selected metric on its own first in-range date',()=>{
  const state=initialState();
  state.healthData={
    '2026-07-10':{weight:205},
    '2026-07-12':{steps:4000},
    '2026-11-10':{weight:200},
    '2026-11-13':{steps:8000},
    '2026-11-14':{weight:210,steps:9000}
  };
  const rows=dailyRecords(state);
  const all=comparisonDomain('ALL',day,rows,state), month=comparisonDomain('30D',day,rows,state);
  assert.deepEqual(all,{start:'2026-07-10',end:day});
  assert.deepEqual(month,{start:'2026-10-22',end:day});
  const selections=[item('weight'),item('steps')];
  assert.deepEqual(build(state,all,selections).map(x=>x.baseline),[{date:'2026-07-10',value:205},{date:'2026-07-12',value:4000}]);
  const [weight,steps]=build(state,month,selections);
  assert.deepEqual(weight.baseline,{date:'2026-11-10',value:200});
  assert.deepEqual(steps.baseline,{date:'2026-11-13',value:8000});
  assert.equal(weight.points[1].indexValue,105);
  assert.equal(steps.points[1].indexValue,112.5);
  assert.ok(Math.abs(weight.points[1].trendIndex-102.5)<1e-9);
  assert.equal(steps.points[1].trendIndex,106.25);
});

test('zero baselines, explicit later zeros, missing readings and invalid values stay distinct',()=>{
  const state=initialState();
  state.healthData['2026-11-02']={steps:0,weight:-1,activeCalories:400,bodyFat:'junk'};
  state.healthData['2026-11-03']={steps:8000,weight:200};
  state.healthData['2026-11-06']={steps:10000,weight:195,activeCalories:0};
  const [steps,weight,calories,bodyFat]=build(state,period,['steps','weight','activeCalories','bodyFat'].map(metric=>item(metric)));
  assert.equal(steps.baseline.value,0);
  assert.match(steps.issue,/first observation is zero/);
  assert.deepEqual(steps.points,[]);
  assert.equal(weight.baseline.date,'2026-11-03');
  assert.equal(calories.points.length,2);
  assert.equal(calories.points[1].indexValue,0);
  assert.equal(calories.points[1].trend,200);
  assert.equal(calories.points[1].segment,1);
  assert.match(bodyFat.issue,/No observations/);
});

test('daily and sparse trend paths break without manufacturing missing observations',()=>{
  const state=initialState();
  state.healthData={'2026-10-01':{weight:190},'2026-10-02':{weight:185},'2026-10-05':{weight:180}};
  state.strengthLogs=[
    {date:'2026-10-01',exercise,weight:30,reps:[10]},
    {date:'2026-10-08',exercise,weight:35,reps:[10]},
    {date:'2026-11-08',exercise,weight:40,reps:[10]}
  ];
  const domain={start:'2026-10-01',end:day};
  const series=build(state,domain,[item('weight','Trend'),item('exerciseWeight','Trend',{exercise})]);
  assert.deepEqual(series[0].points.map(p=>p.segment),[0,0,1]);
  assert.deepEqual(series[1].points.map(p=>p.segment),[0,0,1]);
  assert.equal(series[1].points[1].trend,32.5);
  assert.equal(series[1].points[2].trend,40);
  const svg=overlaySvg(plotSeries(series,domain),domain);
  for (const path of svg.matchAll(/data-marks="trend" d="([^"]+)"/g)) assert.equal(path[1].match(/M/g).length,2);
});

test('date inspection shows the original measurement and units alongside the index',()=>{
  const state=initialState();
  state.healthData['2026-11-03']={weight:200,steps:8000};
  state.healthData['2026-11-04']={weight:210,steps:9000};
  state.healthData['2026-11-05']={weight:209};
  const plot=plotSeries(build(state,period,[item('weight','Trend'),item('steps','Points')]),period);
  const tooltip=dateTooltip('2026-11-04',plot,String);
  assert.match(tooltip,/105\.0 \(210 lb\)/);
  assert.match(tooltip,/112\.5 \(9,000 steps\)/);
  assert.match(tooltip,/Trend/);
  assert.doesNotMatch(dateTooltip('2026-11-05',plot,String),/steps/i);
  assert.match(dateTooltip('2026-11-06',plot,String),/No observations/);
});

test('existing Health Quest and Varsity imports contribute with native precedence and deduplicated workout dates',()=>{
  const state=initialState();
  state.importedHealthQuestData.old={normalized:[{date:'2026-11-02',weight:182,bodyFat:19.5,meals:{dinner:3,nightSnack:4}}],
    strengthSessions:[{date:'2026-11-03',completed:true}],strengthLogs:[{date:'2026-11-02',exercise,weight:25,reps:[10,8]}]};
  state.importedHistory.new={format:'Varsity',normalized:[{date:'2026-11-04',steps:8000,bodyFat:19.2,meals:{breakfast:4,nightSnack:0}}],
    strengthSessions:[{date:'2026-11-03',type:'other',completed:true},{date:'2026-11-04',type:'blue',completed:true}]};
  state.healthData['2026-11-02']={weight:180};
  state.workouts['2026-11-04']='blue';
  state.workoutSelections['2026-11-05']='white';
  state.completedWorkoutSessions['2026-11-04:blue']={date:'2026-11-04',type:'blue',completed:true,durationMinutes:35};
  const selections=['weight','bodyFat','workouts','workoutDuration','foodLogging','nightEating','foodRating'].map(key=>item(key));
  const [weight,bodyFat,workouts,duration,logging,night,food,volume]=build(state,period,[...selections,item('exerciseVolume','Both',{exercise})]);
  assert.equal(weight.baseline.value,180);
  assert.deepEqual(bodyFat.points.map(p=>p.value),[19.5,19.2]);
  assert.deepEqual(workouts.points.map(p=>p.value),[1,2]);
  assert.equal(duration.baseline.value,35);
  assert.equal(logging.baseline.value,40);
  assert.deepEqual(night.points.map(p=>p.value),[1,0]);
  assert.deepEqual(food.points.map(p=>p.value),[3.5,4]);
  assert.equal(volume.baseline.value,450);
});

test('same-day exercise history uses actual sets and keeps timed results separate from repetitions',()=>{
  const state=initialState();
  state.strengthLogs=[
    {id:'a',date:'2026-11-02',completedAt:'2026-11-02T08:00:00Z',exercise,weight:30,reps:[6],targetRepMax:12},
    {id:'b',date:'2026-11-02',completedAt:'2026-11-02T14:00:00Z',exercise,weight:35,reps:[8],targetRepMax:12},
    {date:'2026-11-06',exercise:'Farmer carry',setsUnit:'seconds',sets:[{weight:20,reps:30},{weight:20,reps:20}]}
  ];
  const [weight,reps,seconds,carryReps] = build(state,period,[
    item('exerciseWeight','Both',{exercise}),item('exerciseBestReps','Both',{exercise}),
    item('exerciseSeconds','Both',{exercise:'Farmer carry'}),item('exerciseReps','Both',{exercise:'Farmer carry'})
  ]);
  assert.deepEqual(weight.points.map(x=>x.value),[35]);
  assert.deepEqual(reps.points.map(x=>x.value),[8]);
  assert.equal(seconds.baseline.value,50);
  assert.match(carryReps.issue,/No observations/);
});

test('compare controls persist display, visibility, removal, reset and cleared state across reopens',async()=>{
  const oldDocument=globalThis.document, oldStorage=globalThis.localStorage;
  const local=new Map(), attributes=new Map(), toggle={setAttribute:(key,value)=>attributes.set(key,value)};
  const panel={querySelector:()=>null};
  globalThis.document={querySelector:selector=>selector==='#overlay-toggle'?toggle:panel};
  globalThis.localStorage={getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)};
  try {
    let state=initialState(), pending;
    const bind=()=>bindOverlays({state,day,rows:[],names:[exercise],range:'30D',save(render){
      assert.equal(render,false);
      pending=persistState(state);
    },esc:String});
    const change=(dataset,value)=>panel.onchange({target:{dataset,value}});
    const click=(overlayAction,index)=>panel.onclick({target:{dataset:{overlayAction,index}}});
    bind();
    assert.equal(panel.hidden,true);
    toggle.onclick();
    assert.equal(attributes.get('aria-expanded'),'true');
    assert.match(panel.innerHTML,/Normalized Comparison/);
    change({overlayControl:'metric'},'exerciseWeight');
    click('add');
    change({overlayMode:'2'},'Points');
    click('hide','1');
    await pending;
    state=await loadState();
    bind();
    assert.match(panel.innerHTML,/Incline dumbbell press · Working weight/);
    assert.deepEqual(state.settings.progressionOverlay.items.map(x=>[x.metric,x.mode,x.hidden]),[
      ['weight','Trend',false],['steps','Both',true],['exerciseWeight','Points',false]
    ]);
    click('remove','0');
    assert.equal(state.settings.progressionOverlay.items.length,2);
    click('clear');
    await pending;
    state=await loadState();
    bind();
    assert.match(panel.innerHTML,/Add a metric to compare/);
    click('reset');
    assert.deepEqual(state.settings.progressionOverlay.items.map(x=>x.metric),['weight','steps']);
    toggle.onclick();
    await pending;
    assert.equal((await loadState()).settings.progressionOverlay.open,false);
  }finally{globalThis.document=oldDocument;globalThis.localStorage=oldStorage;}
});
