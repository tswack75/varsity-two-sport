# Varsity Fitness Tracker

Varsity is a local-first PWA for weight, steps, active calories, workouts, and measurable progress. This update keeps the existing storage identity and full state. Older meal, Health Quest, schedule, game, athlete, experiment, and achievement records stay in backups but are retired from the everyday interface.

## Use

- **Today:** Enter weight, steps, and active calories; select a workout or None. Each field saves locally as you enter it. A workout selection is a plan until you complete the workout in Workouts. Other has an optional description and duration.
- **Workouts:** Blue and Maize complete the two-workout weekly goal. White is optional. Enter individual set weights and reps, request progression with `+`, then tap Complete. The LAST card shows the most recent completed sets, including a workout completed today. Exercise names, targets, and notes are editable.
- **Progression:** Review weight readings and seven-day trend, movement against the 8,000-step goal, weekly workout consistency, and exercise weight, reps, volume, and PRs. Choose 30D, 90D, 6M, or ALL.
- **Data & settings:** Export all stored data, restore older Varsity backups after confirmation, and import Health Quest exports without duplicate imports. Keep a backup before changing devices or clearing browser data.

The app requires no backend. Install it from its served URL. To run locally, use Node 20+ and `npm start`, then open `http://localhost:4173`. Run `npm test` for the logic and persistence tests. The service worker caches the active app files for offline use.

The IndexedDB database remains `varsity-two-sport-db` with the same `snapshots/current` record. The localStorage journal and older fallback keys are unchanged. Backup schema version remains 1; new optional fields are added without dropping older fields. Imported Health Quest source files remain in the state and are included in full backups.

Historical workout selections from older Varsity versions were saved as completed workout values. Their original meaning cannot be recovered more precisely, so they continue to appear as completed history. New selections are stored separately and count only after workout completion.
