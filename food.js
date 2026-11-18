import {MEALS} from './core.js';

export const RATINGS = {
  4: ['Great', 'Nutritious, intentional choice with appropriate quantity'],
  3: ['Good', 'Reasonable, controlled choice, even if nutritionally imperfect'],
  2: ['Drift', 'Meaningful departure from intended quality, quantity, or eating habits'],
  1: ['Off Track', 'Significant overeating, repeated unplanned eating, or substantial loss of control'],
  0: ['No Snack', 'No snack occurred']
};
export const isSnack = key => key === 'afternoonSnack' || key === 'nightSnack';
export const validRating = (value, snack = false) =>
  Number.isInteger(value) && value >= (snack ? 0 : 1) && value <= 4;

export function rateMeal(state, date, key, rating) {
  if (!MEALS.some(([name]) => name === key) || !validRating(rating, isSnack(key))) throw Error('Invalid meal rating');
  (state.mealData[date] ??= {})[key] = rating;
}

export function addSnack(state, date, rating) {
  if (!validRating(rating)) throw Error('Invalid snack rating');
  state.extraSnacks ??= {};
  const snack = {id: crypto.randomUUID(), timestamp: new Date().toISOString(), rating};
  (state.extraSnacks[date] ??= []).push(snack);
  return snack;
}

export function updateSnack(state, date, id, rating) {
  if (rating !== null && !validRating(rating)) throw Error('Invalid snack rating');
  const snacks = state.extraSnacks?.[date] ?? [];
  const index = snacks.findIndex(snack => snack.id === id);
  if (index < 0) return;
  if (rating === null) {
    snacks.splice(index, 1);
    (state.deletedSnackIds ??= {})[id] = true;
  }
  else snacks[index].rating = rating;
}

export function foodStats(rows, domain) {
  const distribution = {1: 0, 2: 0, 3: 0, 4: 0};
  const nights = {0: 0, ...distribution};
  const complete = [], extra = [];
  for (const row of rows) {
    if (row.date < domain.start || row.date > domain.end) continue;
    const logged = MEALS.filter(([key]) => validRating(row.meals?.[key], isSnack(key)));
    if (logged.length === MEALS.length) complete.push({date: row.date, value: 1});
    for (const [key] of logged) {
      const rating = row.meals[key];
      if (rating > 0) distribution[rating]++;
      if (key === 'nightSnack') nights[rating]++;
    }
    const snacks = (row.extraSnacks ?? []).filter(snack => validRating(snack.rating));
    for (const snack of snacks) distribution[snack.rating]++;
    if (snacks.length) extra.push({date: row.date, value: snacks.length});
  }
  const days = Math.round((Date.parse(domain.end) - Date.parse(domain.start)) / 86400000) + 1;
  return {distribution, nights, complete, extra, days};
}

export function renderFood(meals, snacks, ownSnacks, esc) {
  const buttons = (attributes, current, snack = false) => (snack ? [4, 3, 2, 1, 0] : [4, 3, 2, 1]).map(rating =>
    `<button ${attributes} data-rating="${rating}" aria-pressed="${current === rating}" class="${current === rating ? 'selected' : ''}">${RATINGS[rating][0]}</button>`
  ).join('');
  return `<section class="card food-log"><h2>Food log</h2><details><summary>Rating guide</summary>
    <dl>${[4, 3, 2, 1, 0].map(value => `<dt>${value} · ${RATINGS[value][0]}</dt><dd>${RATINGS[value][1]}</dd>`).join('')}</dl></details>
    ${MEALS.map(([key, label]) => {
      const value = meals?.[key], rating = validRating(value, isSnack(key)) ? value : null;
      return `<div class="food-checkpoint"><div class="statrow"><strong id="food-${key}">${label}</strong><small>${RATINGS[rating]?.[0] ?? 'Unlogged'}</small></div><div class="pills" role="group" aria-labelledby="food-${key}">${buttons(`data-meal="${key}"`, rating, isSnack(key))}</div></div>`;
    }).join('')}
    <details class="extra-snacks"><summary>+ Extra Snack <small>· ${snacks.length} logged</small></summary>
      <div class="pills" role="group" aria-label="Add extra snack">${buttons('data-add-snack', null)}</div>
      ${snacks.map((snack, i) => `<details><summary>Snack ${i + 1} · ${RATINGS[snack.rating]?.[0] ?? 'Unrated'}</summary>
      ${ownSnacks.some(item => item.id === snack.id) ? `<div class="pills" role="group" aria-label="Correct snack ${i + 1}">${buttons(`data-edit-snack="${esc(snack.id)}"`, snack.rating)}<button data-delete-snack="${esc(snack.id)}">Delete snack</button></div>` : '<small>Imported history</small>'}</details>`).join('')}
    </details></section>`;
}
