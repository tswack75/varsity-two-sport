const DB='varsity-two-sport-db';
const STORE='snapshots';
const KEY='current';
const LEGACY='varsity-two-sport-v1';
const JOURNAL='varsity-two-sport-journal-v1';
const SMALL_KEYS=['healthData','mealData','extraSnacks','deletedSnackIds','workouts','workoutSelections','customWorkouts','customSessionPlans','recommendationHistory','workoutDetails','completedWorkoutSessions','strengthLogs','strengthDrafts','personalRecords','weightHistory','scheduleData','simulatedGames','athleteProfile','xpHistory','achievements','experiments','analyticsResults','settings'];

function open(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function read(){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(KEY);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{db.close()}}
function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export async function loadState() {
  let stored = null;
  try { stored = await read(); } catch {}
  const fallback = readLocal(LEGACY);
  const updated = value => Number(value?.updatedAt ?? 0);
  if (!stored || updated(fallback) > updated(stored)) stored = fallback;
  const journal = readLocal(JOURNAL);
  if (journal && (!stored || updated(journal) > updated(stored))) stored = {...(stored ?? {}), ...journal};
  return stored;
}
export function persistDraft(value){value.updatedAt=Math.max(Date.now(),Number(value.updatedAt||0)+1);const journal={updatedAt:value.updatedAt,schemaVersion:value.schemaVersion,appVersion:value.appVersion};for(const key of SMALL_KEYS)journal[key]=value[key];localStorage.setItem(JOURNAL,JSON.stringify(journal));return value.updatedAt}
let pending=Promise.resolve();
export function persistState(value, {durable = false} = {}) {
  if (durable) {
    const stamp = Math.max(Number(value.updatedAt) || 0, Number(readLocal(JOURNAL)?.updatedAt) || 0);
    value.updatedAt = Math.max(Date.now(), stamp + 1);
  } else {
    try { persistDraft(value); } catch {}
  }
  const snapshot = structuredClone(value);
  pending = pending.catch(() => {}).then(async () => {
    try {
      const db = await open();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(snapshot, KEY);
          tx.oncomplete = resolve;
          tx.onerror = tx.onabort = () => reject(tx.error);
        });
      } finally { db.close(); }
    } catch { localStorage.setItem(LEGACY, JSON.stringify(snapshot)); }
  });
  return pending;
}
