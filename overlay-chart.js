import {alignDate, buildOverlays, calendarDay, comparisonDomain, dateAt, displayModes, metrics, overlayConfig, overlayKey} from './overlay-series.js';

const palette = ['#fac849','#71e3c9','#8fc5ff','#ff92a5','#cea3ff','#f5a86e','#a8e574','#f39ede'];
const color = index => palette[index] ?? `hsl(${index * 137.508 % 360} 80% 72%)`;
const bounds = {left:54,right:352,top:23,bottom:208,width:366,height:246};
const num = new Intl.NumberFormat(undefined,{maximumFractionDigits:2});
const indexFormat = new Intl.NumberFormat(undefined,{minimumFractionDigits:1,maximumFractionDigits:1});
const tickFormat = new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
const fullDate = new Intl.DateTimeFormat(undefined,{dateStyle:'long',timeZone:'UTC'});
const shortDate = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
const yearDate = new Intl.DateTimeFormat(undefined,{month:'short',year:'2-digit',timeZone:'UTC'});
const dateObject = date => new Date(`${date}T00:00:00Z`);
const original = (value,unit) => `${num.format(value)}${unit==='%'?'':' '}${unit}`;

export function plotSeries(series,domain) {
  const visible = series.filter(item=>!item.hidden && item.points.length);
  const dates = new Map();
  let low = 100, high = 100;
  for (const item of visible) for (const point of item.points) {
    if (item.mode !== 'Trend') { low=Math.min(low,point.indexValue); high=Math.max(high,point.indexValue); }
    if (item.mode !== 'Points') { low=Math.min(low,point.trendIndex); high=Math.max(high,point.trendIndex); }
    if (!dates.has(point.date)) dates.set(point.date,[]);
    dates.get(point.date).push({title:item.title,unit:item.unit,color:item.color,mode:item.mode,...point});
  }
  const margin = Math.max(2,(high-low)*0.07);
  const min = low-margin, max = Math.min(Number.MAX_VALUE,high+margin);
  const x = date=>alignDate(date,domain,bounds.left,bounds.right);
  const y = value=>bounds.bottom-(value-min)/(max-min)*(bounds.bottom-bounds.top);
  return {visible,dates,sortedDates:[...dates.keys()].sort(),x,y,min,max};
}

function drawPaths(item,x,y) {
  const fill = color(item.color);
  const circles = item.mode === 'Trend' ? '' : item.points.map(point =>
    `M${x(point.date).toFixed(2)} ${y(point.indexValue).toFixed(2)}h.01`).join('');
  let lastSegment = -1;
  const trend = item.mode === 'Points' ? '' : item.points.map(point => {
    const start = lastSegment !== point.segment;
    lastSegment = point.segment;
    return `${start?'M':'L'}${x(point.date).toFixed(2)} ${y(point.trendIndex).toFixed(2)}${start?'h.01':''}`;
  }).join('');
  return `${circles?`<path data-marks="points" d="${circles}" stroke="${fill}" stroke-width="4.5" opacity="${item.mode==='Both'?.55:1}"/>`:''}
    ${trend?`<path data-marks="trend" d="${trend}" stroke="${fill}" stroke-width="2.5"/>`:''}`;
}

export function overlaySvg(plot,domain) {
  const {left,right,top,bottom,width,height} = bounds;
  const {x,y,min,max,visible} = plot;
  const start = calendarDay(domain.start), end = calendarDay(domain.end);
  const ticks = [domain.start];
  if (end-start >= 14) ticks.push(dateAt(Math.round((start+end)/2)));
  if (end > start) ticks.push(domain.end);
  const labels = end-start > 180 ? yearDate : shortDate;
  const yTicks = [min+(max-min)*.1,min+(max-min)*.9].filter(value => Math.abs(y(value)-y(100))>20);
  return `<svg class="overlay-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Normalized comparison. Use the date control below to inspect values.">
    <g stroke="#405474" stroke-width="1"><path d="M${left} ${top}V${bottom}H${right}" fill="none"/>
      ${ticks.map(date=>`<line x1="${x(date)}" x2="${x(date)}" y1="${top}" y2="${bottom}" opacity=".5"/>`).join('')}
      <line x1="${left}" x2="${right}" y1="${y(100)}" y2="${y(100)}" stroke="#a8b6d0" stroke-dasharray="4 4"/></g>
    <g fill="#c2cfe3" font-size="12">
      ${yTicks.map(value=>`<text x="${left-6}" y="${y(value)+4}" text-anchor="end">${tickFormat.format(value)}</text>`).join('')}
      <text x="${left-6}" y="${y(100)+4}" text-anchor="end">100</text>
      ${ticks.map((date,i)=>`<text x="${x(date)}" y="${bottom+22}" text-anchor="${ticks.length===1?'middle':i===0?'start':i===ticks.length-1?'end':'middle'}">${labels.format(dateObject(date))}</text>`).join('')}
    </g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">${visible.map(item=>drawPaths(item,x,y)).join('')}</g>
    <line data-overlay-cursor visibility="hidden" y1="${top}" y2="${bottom}" stroke="#edf4ff" stroke-opacity=".72" pointer-events="none"/>
  </svg>`;
}

export function dateTooltip(date,plot,esc) {
  const entries = plot.dates.get(date) ?? [];
  return `<strong>${fullDate.format(dateObject(date))}</strong>
    ${entries.map(item=>`<div class="overlay-reading"><span><i style="--overlay-color:${color(item.color)}"></i>${esc(item.title)}</span>
      <span>${indexFormat.format(item.indexValue)} (${esc(original(item.value,item.unit))})
        ${item.mode==='Points'?'':`<small>Trend ${indexFormat.format(item.trendIndex)} (${esc(original(item.trend,item.unit))})</small>`}</span></div>`).join('') ||
      '<p>No observations on this date.</p>'}`;
}

function nearestDateIndex(dates,day) {
  let lo=0, hi=dates.length-1;
  while (lo<hi) {
    const middle=Math.floor((lo+hi)/2);
    if (calendarDay(dates[middle]) < day) lo=middle+1;
    else hi=middle;
  }
  return lo>0 && Math.abs(calendarDay(dates[lo-1])-day)<=Math.abs(calendarDay(dates[lo])-day) ? lo-1 : lo;
}

const info = `<details class="overlay-info"><summary>How comparison works</summary>
  <p>100 is each metric’s first valid reading within this range. An index of 105 means 5% above that metric’s baseline. Baselines can fall on different dates. A zero starting value cannot be indexed. Missing readings remain gaps.</p>
  <p>Daily trends average observed values in the trailing seven calendar days and break at missing dates. Workout, exercise and extra-snack trends average up to three observations within 28 calendar days and break after more than 14 days without a reading. Both points and trends use the same baseline.</p>
  <p>Workout frequency counts distinct completions in the seven days ending on a workout date. Exercise overlays use the latest valid completed performance per date. Weight is the heaviest recorded set, volume sums sets with both weight and reps, and timed sets use seconds.</p>
  <p>Food logging shows the share of checkpoints recorded on days with at least one rating. Mean food ratings exclude No Snack. Nighttime eating is 1 for a rated snack and 0 for a recorded No Snack. Extra snacks are shown on dates with logged events.</p>
</details>`;

export function bindOverlays({state,day,rows,names,range,save,esc}) {
  const toggle=document.querySelector('#overlay-toggle'), panel=document.querySelector('#overlay-panel');
  if (!toggle || !panel) return;
  let config=overlayConfig(state.settings.progressionOverlay), addMetric='weight', addExercise=names[0]??'', inspectedDate=null;
  const domain=comparisonDomain(range,day,rows,state);
  const persist=()=>{
    state.settings.progressionOverlay=config;
    save(false);
  };
  function draw(focus=null) {
    toggle.setAttribute('aria-expanded',String(config.open));
    panel.hidden=!config.open;
    if (!config.open) { panel.innerHTML=''; return; }
    const series=buildOverlays(state,rows,domain,config.items), plot=plotSeries(series,domain);
    const draft={metric:addMetric,...(metrics[addMetric][2]==='exercise'?{exercise:addExercise}:{})};
    const unavailable=metrics[addMetric][2]==='exercise'&&!addExercise;
    const duplicate=config.items.some(item=>overlayKey(item)===overlayKey(draft));
    panel.innerHTML=`<h2>Normalized Comparison</h2>
      <div class="overlay-layout"><div class="overlay-picker">
        <div class="fields"><label>Metric <select data-overlay-control="metric">
          ${Object.entries(metrics).map(([key,[title]])=>`<option value="${key}" ${key===addMetric?'selected':''}>${title}</option>`).join('')}
        </select></label>${metrics[addMetric][2]==='exercise'?`<label>Exercise <select data-overlay-control="exercise">
          ${names.length?names.map(name=>`<option value="${esc(name)}" ${name===addExercise?'selected':''}>${esc(name)}</option>`).join(''):'<option value="">No exercises available</option>'}
        </select></label>`:''}<button data-overlay-action="add" ${unavailable||duplicate?'disabled':''}>Add metric</button></div>
        <div class="pills"><button data-overlay-action="clear" ${series.length?'':'disabled'}>Clear all</button><button data-overlay-action="reset">Reset defaults</button></div>
      </div>
      ${plot.visible.length?`<figure class="overlay-figure">${overlaySvg(plot,domain)}
        <figcaption><small>Dashed line · 100 baseline</small><label>Inspect observation date
          <input type="range" min="0" max="${plot.sortedDates.length-1}" step="1" data-overlay-date>
        </label><div class="overlay-tooltip" data-overlay-tooltip></div></figcaption></figure>`:
        `<p class="chart-empty">${series.length?'No visible metrics can be indexed in this range.':'Add a metric to compare readings over the selected dates.'}</p>`}
      <div class="overlay-legend" aria-label="Comparison legend and display modes">${series.map((item,index)=>
        `<section class="overlay-legend-item"><strong><i style="--overlay-color:${color(item.color)}"></i>${esc(item.title)}</strong>
          ${item.baseline?`<small>Baseline ${fullDate.format(dateObject(item.baseline.date))} · ${esc(original(item.baseline.value,item.unit))}</small>`:''}
          ${item.issue?`<p class="muted">${item.issue}</p>`:''}
          <div class="pills"><label>Display <select data-overlay-mode="${index}" aria-label="Display ${esc(item.title)}">
            ${displayModes.map(mode=>`<option ${mode===item.mode?'selected':''}>${mode}</option>`).join('')}
          </select></label><button data-overlay-action="hide" data-index="${index}" aria-label="${item.hidden?'Show':'Hide'} ${esc(item.title)}">${item.hidden?'Show':'Hide'}</button>
          <button data-overlay-action="remove" data-index="${index}" aria-label="Remove ${esc(item.title)}">Remove</button></div>
        </section>`).join('')}</div>
      ${info}</div>`;
    bindChart(panel,plot,domain,esc,inspectedDate,date=>{inspectedDate=date;});
    if (focus) panel.querySelector(focus)?.focus({preventScroll:true});
  }

  toggle.onclick=()=>{
    config.open=!config.open;
    persist();
    draw();
  };
  panel.onchange=event=>{
    const {overlayControl,overlayMode}=event.target.dataset, value=event.target.value;
    if (overlayControl==='metric') addMetric=value;
    else if (overlayControl==='exercise') addExercise=value;
    else if (overlayMode!==undefined) {
      config.items[Number(overlayMode)].mode=value;
      persist();
      draw(`[data-overlay-mode="${Number(overlayMode)}"]`);
      return;
    } else return;
    draw(`[data-overlay-control="${overlayControl}"]`);
  };
  panel.onclick=event=>{
    const {overlayAction:action,index}=event.target.dataset;
    let focus='[data-overlay-control="metric"]';
    if (action==='add') {
      const item={metric:addMetric,mode:'Both'};
      if (metrics[addMetric][2]==='exercise') item.exercise=addExercise;
      config=overlayConfig({...config,items:[...config.items,item]});
    } else if (action==='hide') {
      config.items[index].hidden=!config.items[index].hidden;
      focus=`[data-overlay-action="hide"][data-index="${Number(index)}"]`;
    } else if (action==='remove') config.items.splice(Number(index),1);
    else if (action==='clear') config.items=[];
    else if (action==='reset') config=overlayConfig({open:true});
    else return;
    persist();
    draw(focus);
  };
  draw();
}

function bindChart(panel,plot,domain,esc,previous,onDate) {
  const svg=panel.querySelector('.overlay-svg');
  if (!svg) return;
  const slider=panel.querySelector('[data-overlay-date]'), tip=panel.querySelector('[data-overlay-tooltip]');
  const cursor=svg.querySelector('[data-overlay-cursor]');
  const {sortedDates}=plot;
  function inspect(index,announce=false) {
    const date=sortedDates[index], x=plot.x(date);
    cursor.setAttribute('x1',x);
    cursor.setAttribute('x2',x);
    cursor.setAttribute('visibility','visible');
    const title=fullDate.format(dateObject(date));
    slider.value=index;
    slider.setAttribute('aria-valuetext',title);
    tip.setAttribute('aria-live',announce?'polite':'off');
    tip.innerHTML=dateTooltip(date,plot,esc);
    onDate(date);
  }
  slider.oninput=()=>inspect(Number(slider.value),true);
  function inspectPointer(event) {
    const rect=svg.getBoundingClientRect(), position=(event.clientX-rect.left)/rect.width*bounds.width;
    const fraction=Math.max(0,Math.min(1,(position-bounds.left)/(bounds.right-bounds.left)));
    const start=calendarDay(domain.start), end=calendarDay(domain.end);
    const index=nearestDateIndex(sortedDates,start+fraction*(end-start));
    if (Number(slider.value)!==index) inspect(index);
  }
  svg.onpointermove=event=>{if(event.pointerType==='mouse')inspectPointer(event);};
  svg.onclick=inspectPointer;
  const initial=previous?sortedDates.indexOf(previous):-1;
  inspect(initial>=0?initial:sortedDates.length-1);
}
