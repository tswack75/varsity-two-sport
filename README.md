# Varsity: Two-Sport Career

A new local-first PWA combining quick fitness logging with a fictional Michigan football and men's basketball career. It has its own storage key (`varsity-two-sport-v1`) and does not modify Health Quest.

## Run and install

Requires Node 20+. From this folder run `npm start`, then open `http://localhost:4173`. The browser's install control can install the PWA. Run `npm test` for logic tests. Opening `index.html` directly is unsupported because service workers require a local server.

## Model and privacy

The app stores health data, meals, workouts, strength logs, weights, schedules, simulations, athlete profile, XP, achievements, experiments, analytics, imported Health Quest exports, and settings in a versioned local state in IndexedDB. It migrates the first build's `varsity-two-sport-v1` localStorage state automatically. A small localStorage journal records native entries synchronously as they are typed or tapped, then full IndexedDB snapshots follow. The journal does not include the imported Health Quest file. localStorage is also a fallback if IndexedDB is unavailable. Core features need no backend. The service worker caches the app shell for offline use. Export All Data produces a full JSON backup with schema, version, and timestamp. Import App Backup restores it. Clearing browser storage removes local data, so keep a backup.

The food scale is Great (intentional quality and quantity), Good (controlled with one imperfect area), Drift (meaningful quality or quantity slip), and Off Track (multiple issues or loss of control). Night Snack also permits No Snack. A deliberate snack when hungry scores well. Meal weights start at 12%, 23%, 15%, 35%, 15%. These are fixed defaults; small samples never rewrite them.

8,000 steps earn the full movement reward. Blue and Maize are the two core gym sessions and complete the weekly strength target. White is an optional third session with a modest bonus; skipping it has no penalty. Home Blue and Home Maize are 15-minute continuity options. All gym plans remain editable.

Training shows each exercise's target, last completed sets, and today's recommendation. Enter weight and reps for each set; entries save locally as you type, even before completing a workout. Tap **+ Progress next time** to request an increase. The next session recommends more weight only when all recorded sets reach the top of the target range; otherwise it recommends building reps. Completing a workout records the sets, personal records, and earned XP. The Progression tab shows weight and readiness trends, strength history, and PRs. The game attributes are fictional and cannot be interpreted as medical assessments. Daily logging, target adherence, training, and a weekly experiment yield XP; excess exercise and rapid weight loss give no extra XP.

## Health Quest and analytics

Import a Health Quest JSON export in onboarding or Settings. The original export is retained untouched under its SHA-256 hash and normalized dated records support weight history, meals, steps, activity, and strength history. Health Quest meal ratings run from 1 (best) to 5 (worst), so import maps them to Varsity's opposite 4-to-1 scale. Health Quest 0 means not applicable for daytime meals and is omitted; an explicitly recorded night-snack 0 means no snack. Older nights without an explicit rating remain unknown. Reimporting the identical export does nothing. Overlapping dated records are deduplicated in analytics, with native Varsity values taking priority. The scouting report compares nearby weights with readings 2–4 days later. It waits for at least 14 paired observations and five days in each comparison group before displaying an association. It labels confidence conservatively and never treats association as causation. Weight charts show daily points under a seven-day rolling trend. The weekly experiment uses a supported opportunity when one exists, then stays fixed for the week unless you change it.

## Schedules and career

The remote schedule provider tries ESPN public JSON and falls back to saved manual or cached games. Schedule import accepts an array or `{ "games": [...] }`, with date, opponent, sport, venue, and optional strength. Manual entry works offline. Refresh requires internet and records its update time. Actual Michigan schedules may be used. **ALL game results, player statistics, awards, career outcomes, readiness effects, and team outcomes generated here are fictional.** Simulations use a deterministic seed and persist their first result. The optional detail view reveals inputs and modifiers.
