import {APP_VERSION} from './core.js';
import {backupFilename, exportBackup, mergeImport, previewImport, restoreBackup} from './history-import.js';

export function settingsMarkup() {
  return `<span class="eyebrow">DATA & SETTINGS</span><h1>Your data</h1>
    <section class="card">
      <p>Records stay in this browser. Export a backup before clearing browser data or switching devices.</p>
      <button id="export">Export all data</button>
      <label class="file">Import historical file<input id="merge-file" type="file" accept=".json,application/json"></label>
      <label class="file">Restore full backup<input id="restore-file" type="file" accept=".json,application/json"></label>
    </section><p><small>App version ${APP_VERSION}</small></p><dialog id="import-preview"></dialog>`;
}

export function bindSettings({state, commit, esc}) {
  const $ = id => document.getElementById(id);
  const dialog = $('import-preview');
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(exportBackup(state), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
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
      catch { show('Could not save', '<p>The import could not be saved on this device. Try freeing space and retrying.</p>'); }
      finally { dialog.oncancel = null; }
    };
  }
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
