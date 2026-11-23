import {dailyRecords} from './analytics.js';
import {MEALS, historyBatches} from './core.js';
import {validRating} from './food.js';

export const scoreLabels = {
  food: 'Food ratings', steps: 'Steps', activeCalories: 'Active calories', workout: 'Workout'
};
const v1 = {
  version: 1, effective: '0000-01-01',
  weights: {food: 35, steps: 25, activeCalories: 20, workout: 20},
  targets: {steps: 8000, activeCalories: 400}
};
const positive = value => Number.isFinite(value) && value > 0;
const movement = value => Number.isFinite(value) && value >= 0 ? value : null;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function scoreRules(state) {
  const saved = state.settings?.healthScoreVersions;
  return [v1, ...(Array.isArray(saved) ? saved : []).filter(rule =>
    Number.isSafeInteger(rule?.version) && rule.version > 1 && isDate(rule.effective)
    && Object.keys(scoreLabels).every(key => positive(rule.weights?.[key]) && rule.weights[key] <= 100)
    && ['steps', 'activeCalories'].every(key => positive(rule.targets?.[key]))
  ).sort((a, b) => a.effective.localeCompare(b.effective) || a.version - b.version)];
}

export function scoreInputs(state, rows = dailyRecords(state)) {
  const completed = new Set();
  const add = ({date, type = 'other', completed: done}) => {
    if (done && isDate(date) && typeof type === 'string' && type && !['none', 'rest'].includes(type)) completed.add(date);
  };
  for (const [date, type] of Object.entries(state.workouts ?? {})) add({date, type, completed: true});
  for (const session of Object.values(state.completedWorkoutSessions ?? {})) if (session) add(session);
  for (const batch of historyBatches(state)) for (const session of batch.strengthSessions ?? []) add(session);
  const byDate = new Map(rows.map(row => [row.date, row]));
  const rests = Object.entries(state.workoutSelections ?? {}).filter(([, type]) => type === 'none').map(([date]) => date);
  const dates = new Set([...byDate.keys(), ...completed, ...rests]);
  return [...dates].filter(isDate).sort().map(date => {
    const row = byDate.get(date);
    const ratings = [
      ...MEALS.map(([key]) => row?.meals?.[key]),
      ...(row?.extraSnacks ?? []).map(snack => snack?.rating)
    ].filter(value => typeof value === 'number' || typeof value === 'string')
      .map(Number).filter(value => validRating(value));
    const rest = state.workoutSelections?.[date] === 'none';
    return {
      date, ratings, food: ratings.length ? mean(ratings) : null,
      steps: movement(row?.steps), activeCalories: movement(row?.activeCalories),
      workout: completed.has(date) ? 1 : rest ? 0 : null
    };
  });
}

export function calculateScore(input, rule) {
  const values = {
    food: input.food == null ? null : input.food * 25,
    steps: input.steps == null ? null : Math.min(100, input.steps / rule.targets.steps * 100),
    activeCalories: input.activeCalories == null ? null : Math.min(100, input.activeCalories / rule.targets.activeCalories * 100),
    workout: input.workout == null ? null : input.workout * 100
  };
  const keys = Object.keys(scoreLabels);
  const total = keys.reduce((sum, key) => sum + rule.weights[key], 0);
  const observed = keys.filter(key => values[key] !== null);
  const used = observed.reduce((sum, key) => sum + rule.weights[key], 0);
  const components = keys.map(key => {
    const weight = values[key] === null ? 0 : rule.weights[key] / used;
    return {key, score: values[key], configuredWeight: rule.weights[key] / total, weight, points: (values[key] ?? 0) * weight};
  });
  return {date: input.date, input, rule, components, count: observed.length, coverage: used / total,
    value: used ? Math.min(100, components.reduce((sum, item) => sum + item.points, 0)) : null};
}

export function scoreHistory(state, inputs = scoreInputs(state)) {
  const rules = scoreRules(state);
  return inputs.map(input => calculateScore(input, rules.findLast(rule => rule.effective <= input.date)));
}

export function previewCalibration(state, today, weights) {
  const history = scoreInputs(state).filter(input => input.date < today);
  const rules = scoreRules(state);
  const current = rules.at(-1);
  const chosen = weights ?? current.weights;
  if (!Object.keys(scoreLabels).every(key => Number.isInteger(chosen[key]) && chosen[key] >= 1 && chosen[key] <= 100)) {
    throw Error('Enter a weight from 1 to 100 for each component.');
  }
  const samples = {};
  const targets = {};
  for (const key of ['steps', 'activeCalories']) {
    const values = history.map(row => row[key]).filter(positive).sort((a, b) => a - b);
    samples[key] = values.length;
    targets[key] = values.length >= 7 ? Math.max(1, Math.round(values[Math.ceil(values.length * .75) - 1])) : current.targets[key];
  }
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const proposal = {
    version: Math.max(...rules.map(rule => rule.version)) + 1,
    effective: [tomorrow.toISOString().slice(0, 10), current.effective].sort().at(-1),
    targets, weights: {...chosen}
  };
  const comparison = scoreHistory(state, history).filter(row => row.value !== null).map(row => ({
    date: row.date, original: row.value, version: row.rule.version,
    proposed: calculateScore(row.input, proposal).value
  }));
  return {proposal, comparison, samples};
}
