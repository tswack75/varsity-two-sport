import {dateKey} from './core.js';
import {previewCalibration, scoreLabels, scoreRules} from './health-score.js';
import {alignDate, calendarDay, dateAt} from './overlay-series.js';
import {filterSeries, smoothSeries} from './progression.js';

const percent = ratio => `${Math.round(ratio * 100)}%`;
const points = value => value == null ? '—' : value.toFixed(1);

export function recentDomain(day) {
  return {start: dateAt(calendarDay(day) - 6), end: day};
}

export function recentChart(rows, domain, label, color = '#f6c849', bounds) {
  const samples = filterSeries(smoothSeries(rows), domain);
  if (!samples.length) return '<p class="muted">No entries in the last 7 days.</p>';
  const values = samples.flatMap(row => [row.value, row.trend]);
  const [low, high] = bounds ?? [Math.min(...values), Math.max(...values)];
  const x = date => alignDate(date, domain, 20, 280).toFixed(1);
  const y = value => (63 - (value - low) / (high - low || 1) * 48).toFixed(1);
  return `<svg class="mini-chart" viewBox="0 0 300 90" role="img" aria-label="${label}, ${domain.start} through ${domain.end}">
    <path d="${samples.map((row, index) => {
      const adjacent = index && calendarDay(row.date) - calendarDay(samples[index - 1].date) === 1;
      return `${adjacent ? 'L' : 'M'}${x(row.date)} ${y(row.trend)}`;
    }).join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>
    ${samples.map(row => `<circle cx="${x(row.date)}" cy="${y(row.value)}" r="3" fill="${color}"><title>${row.date}: ${points(row.value)}</title></circle>`).join('')}
    <text x="20" y="84" fill="#b7c5dc" font-size="11">${domain.start}</text>
    <text x="280" y="84" text-anchor="end" fill="#b7c5dc" font-size="11">${domain.end}</text>
  </svg>`;
}

export function todayScore(history, day, domain) {
  const row = history.find(item => item.date === day);
  return `<div aria-live="polite"><h2>Health Activity Score</h2>
    <p><strong class="health-score-value">${row?.value == null ? '—' : Math.round(row.value)}</strong> / 100</p>
    <p class="muted">Coverage ${percent(row?.coverage ?? 0)} · ${row?.count ?? 0} of 4 inputs</p></div>
    ${recentChart(history.filter(item => item.value !== null), domain, 'Health Activity Score', '#f6c849', [0, 100])}`;
}

function observedInput({input, rule}, key) {
  if (key === 'food') return `Ratings ${input.ratings.join(', ')} · average ${points(input.food)} / 4`;
  if (key === 'workout') return input.workout ? 'Completed workout' : 'None recorded';
  return `${input[key].toLocaleString()} / ${rule.targets[key].toLocaleString()} target`;
}

function breakdown(row) {
  if (!row || row.value === null) return '<p class="muted">No eligible inputs for this date.</p>';
  return `<p><strong>${points(row.value)} / 100</strong> · ${percent(row.coverage)} coverage · Rules v${row.rule.version}</p>
    ${row.components.map(item => `<div class="statrow"><span>${scoreLabels[item.key]}<small>
      ${item.score === null ? 'No eligible input' : `${observedInput(row, item.key)} · ${points(item.score)} / 100 × ${percent(item.weight)} effective weight`}
      · ${percent(item.configuredWeight)} configured weight</small></span><b>${item.score === null ? '—' : `+${points(item.points)} pts`}</b></div>`).join('')}`;
}

export function scoreDetails(history, domain, day, state, chart) {
  const dates = history.filter(row => row.value !== null && row.date >= domain.start && row.date <= day).reverse();
  const current = scoreRules(state).at(-1);
  return `<section class="card"><h2>Health Activity Score</h2>${chart}
    <label>Breakdown date <select id="score-date"><option value="${day}">${day}</option>
      ${dates.filter(row => row.date !== day).map(row => `<option>${row.date}</option>`).join('')}</select></label>
    <div id="score-breakdown">${breakdown(dates.find(row => row.date === day))}</div>
    <p class="muted">Food averages rated meals and snacks that occurred. Movement earns up to 100 at the target. A completed workout earns 100, and choosing None records 0. Coverage measures the share of configured weight with an eligible entry.</p>
    <details><summary>Calibrate scoring rules</summary>
      <p>Preview new weights and movement targets against past logged days. Targets use the 75th percentile of positive entries when at least seven are available. Approval applies the rules from the effective date shown.</p>
      <p id="approved-score-rules">${ruleSummary(current)}</p>
      <form id="score-calibration"><div class="fields">${Object.entries(scoreLabels).map(([key, label]) =>
        `<label>${label} weight <input name="${key}" type="number" min="1" max="100" required value="${current.weights[key]}"></label>`).join('')}</div>
        <button type="submit">Preview with history</button>
      </form><div id="score-preview" aria-live="polite"></div>
    </details></section>`;
}

function ruleSummary(rule) {
  return `Latest approved rules v${rule.version} · ${rule.targets.steps.toLocaleString()} steps · ${rule.targets.activeCalories.toLocaleString()} active calories`;
}

export function bindScoreDetails(state, history, save) {
  document.querySelector('#score-date').onchange = event => {
    document.querySelector('#score-breakdown').innerHTML = breakdown(history.find(row => row.date === event.target.value));
  };
  const form = document.querySelector('#score-calibration');
  const preview = document.querySelector('#score-preview');
  form.oninput = () => { preview.replaceChildren(); };
  form.onsubmit = event => {
    event.preventDefault();
    const weights = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]));
    const date = dateKey();
    const {proposal, samples, comparison} = previewCalibration(state, date, weights);
    const difference = comparison.length
      ? (comparison.reduce((sum, row) => sum + row.proposed - row.original, 0) / comparison.length).toFixed(1)
      : '—';
    preview.innerHTML = `<p>Rules v${proposal.version} · Effective ${proposal.effective}</p>
      <p>${proposal.targets.steps.toLocaleString()} steps (${samples.steps} entries) · ${proposal.targets.activeCalories.toLocaleString()} active calories (${samples.activeCalories} entries)</p>
      <p>${comparison.length} scored days · Mean score change ${difference} points</p>
      ${comparison.length ? `<details><summary>Compare past scores by date</summary>
        <div class="week-chart">${comparison.slice().reverse().map(row =>
          `<div class="statrow"><span>${row.date} · v${row.version}</span><b>${points(row.original)} → ${points(row.proposed)}</b></div>`).join('')}</div></details>` : ''}
      <button id="approve-score-rules" type="button">Approve rules v${proposal.version}</button>`;
    preview.querySelector('button').onclick = async event => {
      if (dateKey() !== date) { form.requestSubmit(); return; }
      event.currentTarget.disabled = true;
      const approved = state.settings.healthScoreVersions ??= [];
      approved.push(proposal);
      try { await save(false); }
      catch {
        const index = approved.indexOf(proposal);
        if (index !== -1) approved.splice(index, 1);
        return;
      }
      const summary = document.querySelector('#approved-score-rules');
      if (summary) summary.textContent = ruleSummary(proposal);
      preview.innerHTML = `<p>Rules v${proposal.version} approved for ${proposal.effective}.</p>`;
    };
  };
}
