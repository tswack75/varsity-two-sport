# Varsity Fitness Tracker

Varsity is a local-first PWA for weight, steps, active calories, mindful food logging, workouts, and progress. Older Health Quest, schedule, game, athlete, experiment, and achievement records remain in backups.

## Use

- **Today:** Enter weight, steps, and active calories, select a workout, and rate five food checkpoints with one tap. No Snack is an explicit choice for either snack checkpoint. Extra snacks have individual timestamps and can be corrected or deleted. A workout selection counts after you confirm completion.
- **Workouts:** Blue and Maize complete the two-workout weekly goal. White is optional. Enter individual set weights and reps, request progression with `+`, then tap Complete. The LAST card shows the most recent completed sets, including a workout completed today. Exercise names, targets, and notes are editable.
- **Progression:** Review the seven-day weight trend, steps and active calories, workout consistency, and exercise weight, reps, volume, and PRs. Food Habits shows days with all five checkpoints logged, rating counts, and extra and night snacks. The weight comparison uses separate charts on the same date range. Choose 30D, 90D, 6M, or ALL.
- **Data & settings:** Export every record, preview a historical merge, or explicitly confirm a full restore. Keep a backup before changing devices or clearing browser data.

The app requires no backend. Install it from its served URL. To run locally, use Node 20+ and `npm start`, then open `http://localhost:4173`. Run `npm test` for the logic and persistence tests. The service worker caches the active app files for offline use.

The IndexedDB database remains `varsity-two-sport-db` with the same `snapshots/current` record. The localStorage journal and older fallback keys are unchanged. Backup schema version remains 1; new optional fields are added without dropping older fields. Imported Health Quest source files remain in the state and are included in full backups.

Use **My workouts** to create a template or adjust one workout date independently. Variants with distinct loading conventions have separate IDs. Forms show earlier sets as suggestions. Mark each set **Performed** before completing a custom workout. Deleting a template leaves completed sessions and exercise history in the app and in exports.

Open **Progression → Compare / Overlay** and turn on any metrics you want to
compare. Choose Both, Trend, or Data points next to each toggle. All active
metrics share a calendar axis. Each series uses index 100 for its first valid reading in the selected
range. Its original baseline and units appear in the legend, and tapping the
chart or using the date control shows its actual observations. A zero starting
value is labelled as incompatible for existing metrics. The Health Activity Score can use its first
positive reading, or the scale maximum for a range of all zeros. **How comparison works** documents the
smoothing windows and treatment of missing data. Selections and display modes
are saved locally.

The **Health Activity Score** updates as you log food, steps, active calories, and completed workouts.
Today shows the score, weighted coverage, and a seven-day calendar chart on the same date scale as
weight, steps, and active calories. Rules v1 assign weights of 35, 25, 20, and 20, respectively.
Food is the average of valid ratings for meals and snacks that occurred, including extra snacks.
Movement rewards progress up to the targets of 8,000 steps and 400 active calories.
A completed workout earns 100 for that component. Choosing None records an explicit zero.
Blank inputs are excluded and the remaining weights are rescaled. Coverage is the amount of
configured weight represented by the eligible inputs.

In **Progression**, the score has a 0–100 chart, normalized overlays, and a by-date breakdown below
Food Habits. **Calibrate scoring rules** previews editable weights and suggested movement targets
against earlier records. A movement target uses the 75th percentile of positive entries when
there are at least seven. Approving a preview saves a new rule version for future dates.
Older scores use the version effective on their date. Historical input corrections still update
the affected score under its original rules. All scoring and calibration run on the device.

See [exercise demonstration coverage](EXERCISE_GUIDES.md) and the [analysis and recommendations formats](FITNESS_ANALYSIS.md). The analysis export is a separate, locally generated file. Settings previews and applies only the recommendation changes you select.

Historical workout selections from older Varsity versions were saved as completed workout values. Their original meaning cannot be recovered more precisely, so they continue to appear as completed history. New selections are stored separately and count only after workout completion.

## Historical imports

Historical merge recognizes dated Health Quest JSON, including raw exports and known wrapper keys, and Varsity states with recognizable fields, including schema 1 backups from earlier and current releases. It can project known fields in a newer envelope. Full replacement requires a Varsity schema 1 backup. Automated tests use representative synthetic fixtures.

Varsity ratings use their existing 1–4 values, with 0 valid for snack checkpoints. Health Quest meal-behavior scores 1, 2, 3, 4, and 5 map to Great, Good, Drift, Off Track, and Off Track. A recorded Health Quest night-snack 0 maps to No Snack. Health Quest has also used 0 for skipped or not applicable, so other zero ratings stay out of charts. Older aggregate nutrition scores, free-form food logs, timed-only strength sets, and unknown fields stay in the original source inside the backup.

Local entries take priority. The earliest retained import supplies a missing metric on a date or a missing exercise performance for a recognized date and exercise. When performances conflict, the chart and LAST use the chosen record and each original stays available in its source file. Completed Varsity workouts use date and workout type, while compatible Health Quest sessions appear as Other. Extra snacks use their stable IDs. Repeating an import keeps a single source copy for equivalent JSON. Source conflicts remain reviewable in the preview and in exported originals.

Unrecognized files can be retained inside a backup with explicit consent, with no chart records added. Other apps, CSV exports, and unknown schema layouts require a verified mapping.
