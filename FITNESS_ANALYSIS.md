# Varsity analysis export and recommendations

Open **Data & settings → Data → Export for ChatGPT Analysis**. Your browser creates
`varsity-analysis-YYYY-MM-DD.json`. You decide where to share it. It contains
health data and original imports, which may include personal notes. Use **Full
Backup** to restore the application.

## Analysis schema 1

| Field | Meaning |
| --- | --- |
| `metadata` | Schema and app versions, UTC export timestamp, inclusive local date range, units, source apps and observation counts by metric. Date endpoints are null for empty history. |
| `dailyRecords` | One row per known date, with pounds, body-fat percent, steps, active kcal, exercise minutes, planned and completed workout types, food ratings, extra snacks and a row-level source label. A row may combine multiple sources. |
| `dailyRecords[].ratings` | One key per checkpoint. Great is 4, Good 3, Drift 2, Off Track 1. No Snack is 0 at snack checkpoints. |
| `dailyRecords[].extraSnacks` | Separate events with stable ID, UTC timestamp and rating from 1–4. |
| `workoutSessions` | Session ID, local date, template/type, name, completion, UTC completion timestamp, duration in minutes, weekly goal classification, source and references to exercise logs. Older records may lack a timestamp, duration or exercise references. |
| `exerciseHistory` | Log ID, exercise ID, variation, equipment, local date, workout source and session ID when known, sets, progression flag and recorded PR. Summaries include maximum weight, total reps and weight × reps when available. |
| `exerciseHistory[].sets` | Weight and reps or seconds by set. Loading follows the original convention, typically pounds per hand for dumbbells. Legacy equipment and loading can be ambiguous. |
| `historicalData` | Original import files or preserved original JSON, source metadata and normalized values, local exercise originals and archived scores, Varsity career fields and other historical records. |
| `configuration` | Current goals, workout templates, programs, food rating definitions and preferences. |
| `dataDictionary` | In-file descriptions of keys, units and missing data. |

Dates use local YYYY-MM-DD. Missing observations are null. A genuine zero
stays zero. The daily projection prioritizes native values. Original sources
preserve alternate values and source-specific scores. Older sessions lacking
distinct IDs can share one projected date/type record. Originals retain any
additional detail. Some older logs lack enough information for a unit-safe
comparison.

When reviewing the file, use the dictionary and show the window and sample
size for each conclusion. Compare strength at comparable loads and equipment.
Distinguish logging adherence from ratings, and observations from hypotheses.
Discuss uncertainty and avoid causal claims based on associations.

## Recommendations schema 1

See [the example file](recommendations.example.json). The root uses
`schemaVersion: 1`, `appVersion: "2.2.0"`, an array of 1–30 `changes`, and
optional plain-text `notes` of up to 4,000 characters. Each change uses `op`,
`value`, `target` except for `newWorkout`, and optional `reason` of up to
1,000 characters. Extra fields and unlisted operations are rejected.

| Operation | Target | Value |
| --- | --- | --- |
| `setting` | `stepGoal` | Integer 100–50,000 steps |
| `setting` | `activeCalorieGoal` | Integer 1–5,000 active kcal, or null to clear |
| `setting` | `progressionRange` | `30D`, `90D`, `6M`, or `ALL` |
| `setting` | `movementMetric` | `steps` or `activeCalories` |
| `setting` | `exerciseMetric` | `weight`, `topReps`, `totalReps`, or `volume` |
| `setting` | `showFoodGuide` | Boolean |
| `weightIncrement` | Catalog exercise ID | Number 0.5–25 lb, or null to clear |
| `program` | `blue`, `maize`, `white`, or `home` | Complete ordered list of exercise prescriptions |
| `newWorkout` | Omit | Object with `name`, `description`, `category` (`other`, `blue`, or `maize`), and ordered `exercises` |

A prescription has an `exerciseId`, integer `sets` from 1–10 and integer
`min` and `max` from 1–120, with min at most max. Carries use seconds. Lists
accept 1–24 distinct exercise variants. The picker and
[exercise catalog](exercise-library.js) use the same IDs. A specific equipment
variant keeps a separate history from an ambiguous legacy track.

The review screen shows current and proposed values. Changes start unchecked.
Accepted changes update configuration and are logged with previous values.
**Undo latest batch** restores those values when the affected settings still
match the applied batch. The weekly Blue + Maize rule and existing food rating
scale are fixed in this schema. Analysis findings and hypotheses go in notes
and display as text.
