import {APP_VERSION,dateKey} from './core.js';
import {backupFilename, exportBackup, mergeImport, previewImport, restoreBackup} from './history-import.js';
import {exportForAnalysis} from './analysis-export.js';
import {applyRecommendations,displayRecommendation,previewRecommendations,undoRecommendations} from './recommendations.js';

export function settingsMarkup() {
  return `<span class="eyebrow">DATA & SETTINGS</span><h1>Your data</h1>
    <section class="card">
      <h2>Data</h2>
      <p>Records stay in this browser. Export a backup before clearing browser data or switching devices.</p>
      <button id="export">Full Backup</button>
      <label class="file">Restore Backup<input id="restore-file" type="file" accept=".json,application/json"></label>
      <label class="file">Import Historical Data<input id="merge-file" type="file" accept=".json,application/json"></label>
      <button id="analysis-export">Export for ChatGPT Analysis</button>
    </section>
    <section class="card"><h2>Personalization</h2>
      <div id="settings-goals"></div>
      <button id="workout-preferences">Open workout preferences</button>
      <label class="file">Import Recommendations<input id="recommend-file" type="file" accept=".json,application/json"></label>
      <details><summary>Recommendation history</summary><div id="recommendation-history"></div></details>
    </section>
    <section class="card"><h2>Application</h2><p><small>App version ${APP_VERSION}</small></p>
      <p id="update-status" role="status">Checking offline status…</p>
    </section><dialog id="import-preview"></dialog>`;
}

export function bindSettings({state, commit, esc}) {
  const $ = id => document.getElementById(id);
  const dialog = $('import-preview');
  const download = (data,filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('export').onclick = () => download(exportBackup(state),backupFilename());
  $('analysis-export').onclick = () => download(exportForAnalysis(state),`varsity-analysis-${dateKey()}.json`);
  $('workout-preferences').onclick = () => document.querySelector('[data-page="workouts"]')?.click();
  const update = $('update-status');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      update.textContent = reg?.waiting ? 'Update ready. Reopen Varsity to load it.'
        : reg?.installing ? 'Preparing offline files.' : reg?.active ? 'Offline files are ready.' : 'Offline files are not ready yet.';
    }).catch(() => { update.textContent = 'Offline status unavailable.'; });
  } else update.textContent = 'Offline status unavailable.';
  function show(title, body, action, apply) {
    dialog.innerHTML = `<h2>${title}</h2>${body}<div class="pills">
      ${action ? `<button id="apply-import">${action}</button>` : ''}<button id="close-import">${action ? 'Cancel' : 'Close'}</button></div>`;
    if (!dialog.open) dialog.showModal();
    $('close-import').onclick = () => dialog.close();
    if (!action) return;
    $('apply-import').onclick = async () => {
      const button = $('apply-import'), close = $('close-import');
      button.disabled = close.disabled = true;
      dialog.oncancel = event => event.preventDefault();
      try { await apply(); }
      catch (error) { show('Could not apply changes', `<p>${esc(error.message || 'The changes could not be saved on this device.')}</p>`); }
      finally { dialog.oncancel = null; }
    };
  }
  const settings = state.settings ?? {};
  $('settings-goals').innerHTML = `<form class="fields" id="goal-form">
    <label>Daily step goal <input name="steps" type="number" min="100" max="50000" required value="${esc(settings.stepGoal??8000)}"></label>
    <label>Optional active calorie goal <input name="calories" type="number" min="1" max="5000" value="${esc(settings.activeCalorieGoal??'')}"></label>
    <button>Save goals</button></form><p><small>Weekly strength goal · Blue and Maize or their equivalents</small></p>`;
  $('goal-form').onsubmit = event => {
    event.preventDefault();
    const form = event.target.elements;
    const next = {...settings,stepGoal:form.steps.valueAsNumber, activeCalorieGoal:form.calories.value===''?null:form.calories.valueAsNumber};
    commit({...state,settings:next},'Goals saved.').catch(error => show('Could not save goals',`<p>${esc(error.message)}</p>`));
  };
  const history = state.recommendationHistory ?? [];
  $('recommendation-history').innerHTML = history.length ? history.slice().reverse().map(batch => `<p>
    <time>${esc(batch.appliedAt?.slice(0,10))}</time> · ${batch.undoneAt?'Undone':'Applied'}</p><ul>
    ${(batch.changes??[]).map(item=>`<li>${esc(item.label)} · ${esc(displayRecommendation(item.current))} → ${esc(displayRecommendation(item.value))}</li>`).join('')}</ul>`).join('')
    + (history.some(batch=>!batch.undoneAt)?'<button id="undo-recommendations">Undo latest batch</button>':'') : '<p>No changes applied.</p>';
  if ($('undo-recommendations')) $('undo-recommendations').onclick = () => show('Undo latest batch?',
    '<p>Restore the settings that were in place before the most recent applied batch.</p>', 'Undo batch',
    () => commit(undoRecommendations(state),'Recommendation batch undone.'));
  $('recommend-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 250000) throw Error('Recommendation files must be under 250 KB.');
      const preview = previewRecommendations(state,JSON.parse(await file.text()));
      const changes = preview.changes.map(item => `<fieldset class="recommend-change"><legend>${esc(item.label)}</legend>
        <p>Current<br>${esc(displayRecommendation(item.current))}</p><p>Proposed<br>${esc(displayRecommendation(item.value))}</p>
        ${item.reason?`<p>${esc(item.reason)}</p>`:''}<label><input type="checkbox" data-accept="${item.index}"> Accept change</label></fieldset>`).join('');
      show('Review recommendations', changes + (preview.notes?`<h3>Analysis notes</h3><p>${esc(preview.notes)}</p>`:''),
        'Apply selected changes', () => {
          const selected = Array.from(dialog.querySelectorAll('[data-accept]:checked'), input => Number(input.dataset.accept));
          return commit(applyRecommendations(state,preview,selected),'Selected recommendations applied.');
        });
    } catch (error) { show('Recommendations could not be opened',`<p>${esc(error.message)}</p>`); }
  };
  $('merge-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const preview = await previewImport(state, await file.text());
      if (preview.duplicate) return show('Already imported', '<p>This source file is already retained.</p>');
      if (preview.format === 'Unsupported') {
        return show('Unsupported format', '<p>No records can be added to charts. You can keep the original file inside future Varsity backups.</p>',
          'Retain original file', () => commit(mergeImport(state, preview, {retainUnsupported: true}), 'Original file retained.'));
      }
      const dayCount = new Set(preview.normalized.map(row => row.date)).size;
      const list = (label, values) => values.length ? `<details><summary>${label} (${values.length})</summary><ul>
        ${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul></details>` : '';
      show('Review historical import', `<p>${esc(preview.format)} · Schema ${esc(preview.version)}</p>
        <p>${dayCount} daily records · ${preview.strengthSessions.length} workouts · ${preview.strengthLogs.length} exercise logs</p>
        ${list('Matching records', preview.duplicates)}${list('Conflicting records', preview.conflicts)}
        <p>Existing entries take priority. The original file is kept in your backup.</p>`, 'Import history',
        () => commit(mergeImport(state, preview), 'Historical file imported.'));
    } catch { show('Could not preview the file', '<p>Varsity could not read this file. Your data is still available.</p>'); }
  };
  $('restore-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const restored = restoreBackup(JSON.parse(await file.text()));
      show('Replace all data?', `<p>This backup has ${Object.keys(restored.healthData).length} daily health records and
        ${restored.strengthLogs.length} exercise logs. Restoring it replaces all Varsity data in this browser.
        Export your current data first if you want to keep it.</p>`, 'Replace all data', () => commit(restored, 'Backup restored.'));
    } catch (error) { show('Could not read backup', `<p>${esc(error.message)}</p>`); }
  };
}
