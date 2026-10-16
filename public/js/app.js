// Ship-out readiness tracker: page controller.
// State lives on the server. The page keeps a copy, applies edits optimistically,
// and sends each change as a per-record API call through a single ordered queue.

import { CSS } from './styles.js';
import {
  STAGES, DEFAULT_SHIP, addDays, todayISO, fmtLong, normalize, renderScheduleHTML, renderTasksHTML,
  sheetBody, notesPrinted, standalone, headerStatic, tickScript,
} from './core.js';

document.getElementById('app-css').textContent = CSS;

const $ = id => document.getElementById(id);
const LOGO_URL = '/assets/lydium-logo-colour.png';
const POLL_MS = 10_000;
const NOTE_DEBOUNCE_MS = 500;

/* ---------------- state ---------------- */
let state = { ship: DEFAULT_SHIP, tasks: [], notes: {}, updated: '' };
let role = null;
let canWrite = false;
let view = 'schedule';
let dailyDate = todayISO();
let logoData = LOGO_URL;          // replaced with a data URI for self-contained downloads
let stale = false;                // a server update arrived while a region was protected

const findTask = id => state.tasks.find(t => t.id === id);

/* ---------------- sync label ---------------- */
let syncText = '';
function setSync(text, cls) { syncText = text; const e = $('syncState'); e.textContent = text; e.className = 'sync ' + (cls || ''); }
function settledSync() { canWrite ? setSync('Saved', 'ok') : setSync('View only', 'warn'); }

/* ---------------- API ---------------- */
class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { location.href = '/login' + location.hash; throw new ApiError(401, 'Sign in required'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error || `Request failed (${r.status})`);
  return data;
}

/* ---------------- write queue ---------------- */
// Writes run one at a time, in order. Network and server errors retry with backoff
// ("Not saved, retrying"). A 409 means someone else changed that task first: their
// version wins and the page reloads from the server once the queue drains.
let queue = Promise.resolve();
let pending = 0;
let writeSeq = 0;               // bumps on every local change, so a poll that started earlier is discarded
let refreshAfterQueue = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function enqueue(run) {
  pending++; writeSeq++;
  setSync('Saving', '');
  queue = queue.then(async () => {
    for (let attempt = 1; ; attempt++) {
      try { await run(); break; }
      catch (e) {
        if (e.status === 401) return;
        if (e.status === 409) { refreshAfterQueue = true; conflictNotice(e); break; }
        if (e.status === 403) { becomeViewer(); refreshAfterQueue = true; break; }
        if (e.status === 400 || e.status === 404) { refreshAfterQueue = true; alert(e.message); break; }
        setSync('Not saved, retrying', 'warn');
        await sleep(Math.min(2000 * attempt, 15000));
      }
    }
    pending--;
    if (!pending) {
      if (refreshAfterQueue) { refreshAfterQueue = false; await refresh(true); }
      settledSync();
    }
  });
}

let conflictTitles = [];
function conflictNotice(e) {
  if (e.taskTitle) conflictTitles.push(e.taskTitle);
  queueMicrotask(() => {
    if (!conflictTitles.length) return;
    const list = conflictTitles.map(t => `"${t}"`).join(', ');
    conflictTitles = [];
    alert(`Someone else changed ${list} just before you. Their version is now shown. Make your change again if it is still needed.`);
  });
}

function saveTask(id) {
  enqueue(async () => {
    const t = findTask(id);
    if (!t) return;
    try {
      const r = await api('PUT', `/api/tasks/${encodeURIComponent(id)}`, t);
      const cur = findTask(id);
      if (cur) cur.updatedAt = r.updatedAt;
    } catch (e) { e.taskTitle = t.title; throw e; }
  });
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  enqueue(() => api('DELETE', `/api/tasks/${encodeURIComponent(id)}`));
  renderAll();
}

function saveShip(date) {
  state.ship = date;
  enqueue(() => api('PUT', '/api/settings', { ship: date }));
  renderAll();
}

// Day notes: debounced per date, last write wins.
const noteTimers = new Map();
function saveNoteSoon(date) {
  clearTimeout(noteTimers.get(date));
  writeSeq++;
  setSync('Saving', '');
  noteTimers.set(date, setTimeout(() => {
    noteTimers.delete(date);
    enqueue(() => api('PUT', `/api/notes/${date}`, { text: state.notes[date] || '' }));
  }, NOTE_DEBOUNCE_MS));
}

/* ---------------- loading and polling ---------------- */
function applyServerState(s) {
  state = { ship: s.ship, tasks: s.tasks, notes: s.notes || {}, updated: s.updated };
  if (s.role !== role) { role = s.role; canWrite = role === 'editor'; applyRole(); }
}

let online = true;
async function refresh(force) {
  const seq = writeSeq;
  let s;
  try { s = await api('GET', '/api/state'); }
  catch (e) { if (!e.status) { online = false; setSync('Disconnected', 'warn'); } return; }
  if (!online) { online = true; if (!pending) settledSync(); }
  if (!force && (pending || noteTimers.size || seq !== writeSeq)) return;   // local edits in flight win
  if (!force && s.updated === state.updated && s.role === role) return;
  applyServerState(s);
  renderAll();
}

function becomeViewer() { role = 'viewer'; canWrite = false; applyRole(); }

function applyRole() {
  $('app').classList.toggle('ro', !canWrite);
  $('shipDate').disabled = !canWrite;
  $('dHint').textContent = canWrite
    ? 'Tap a box to tick a goal off. Changes save automatically.'
    : 'View only. You can read this sheet but not tick goals off.';
  if (!pending) settledSync();
}

/* ---------------- rendering ---------------- */
const filters = () => ({ stage: $('fStage').value, status: $('fStatus').value, daily: $('fDaily').checked, hideDone: $('fHideDone').checked });

function lockInputs() {
  if (!canWrite) document.querySelectorAll('[data-done],[data-status],[data-daily]').forEach(e => { e.disabled = true; });
}

function renderTasks() { $('tasks').innerHTML = renderTasksHTML(state, filters()); lockInputs(); }

function renderSheet() {
  $('dDate').value = dailyDate;
  $('sheet').innerHTML = sheetBody(state, dailyDate, { interactive: true, canWrite, logo: LOGO_URL });
}

const notesFocused = () => document.activeElement && document.activeElement.id === 'notesBox';

/** Re-render all three views, keeping keyboard focus on the same control where possible. */
function renderAll() {
  if ($('dlg').open) { stale = true; return; }
  const a = document.activeElement;
  const key = a && ['toggle', 'done', 'status', 'daily', 'open'].map(k => a.dataset && a.dataset[k] !== undefined ? `[data-${k}="${window.CSS.escape(a.dataset[k])}"]` : '').find(Boolean);
  const where = a && a.closest && (a.closest('#schedule') ? '#schedule' : a.closest('#tasks') ? '#tasks' : a.closest('#sheet') ? '#sheet' : '');

  if (document.activeElement !== $('shipDate')) $('shipDate').value = state.ship;
  $('schedule').innerHTML = renderScheduleHTML(state, true);
  renderTasks();
  if (notesFocused()) stale = true; else renderSheet();

  if (key && where) { const el = document.querySelector(`${where} ${key}`); if (el) el.focus(); }
}

function flushStale() { if (stale && !$('dlg').open && !notesFocused()) { stale = false; renderAll(); } }

/* ---------------- views ---------------- */
function setView(v) {
  view = v;
  try { history.replaceState(null, '', '#' + v); } catch {}
  document.querySelectorAll('.view').forEach(e => { e.hidden = e.id !== 'view-' + v; });
  document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('on', b.dataset.view === v); b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'); });
}
function initialView() {
  const h = (location.hash || '').replace('#', '');
  if (['schedule', 'tasks', 'daily'].includes(h)) return h;
  try { if (window.matchMedia('(max-width: 760px)').matches) return 'daily'; } catch {}
  return 'schedule';
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => { const v = initialView(); if (v !== view) setView(v); });

/* ---------------- task edits ---------------- */
function setStatus(t, st) { t.status = st; t.doneAt = st === 'done' ? todayISO() : ''; }
function editTask(id, fn) {
  if (!canWrite) return;
  const t = findTask(id); if (!t) return;
  fn(t);
  saveTask(id);
  renderAll();
}

STAGES.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.id} · ${s.name}`; $('fStage').appendChild(o); $('fStageSel').appendChild(o.cloneNode(true)); });
['fStage', 'fStatus', 'fDaily', 'fHideDone'].forEach(id => $(id).addEventListener('change', renderTasks));

$('shipDate').addEventListener('change', e => { if (canWrite && e.target.value && e.target.value !== state.ship) saveShip(e.target.value); });

$('app').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { openDlg(o.dataset.open); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg && canWrite) editTask(tg.dataset.toggle, t => setStatus(t, t.status === 'done' ? 'doing' : 'done'));
});
$('app').addEventListener('keydown', e => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('[data-toggle]')) { e.preventDefault(); e.target.click(); }
});
$('app').addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.done) editTask(el.dataset.done, t => setStatus(t, el.checked ? 'done' : 'doing'));
  else if (el.dataset.status) editTask(el.dataset.status, t => setStatus(t, el.value));
  else if (el.dataset.daily) editTask(el.dataset.daily, t => { t.daily = el.checked; });
});

/* ---------------- notes: save as you type ---------------- */
$('app').addEventListener('input', e => {
  if (e.target.id !== 'notesBox' || !canWrite) return;
  const D = e.target.dataset.notes, v = e.target.value;
  if (v.trim()) state.notes[D] = v; else delete state.notes[D];
  saveNoteSoon(D);
  const np = $('notesPrint'); if (np) np.innerHTML = notesPrinted(v);
});
$('app').addEventListener('focusout', e => { if (e.target.id === 'notesBox') setTimeout(flushStale, 250); });

/* ---------------- daily controls ---------------- */
function setDailyDate(d) { dailyDate = d; renderSheet(); }
$('dDate').addEventListener('change', () => { if ($('dDate').value) setDailyDate($('dDate').value); });
$('dPrev').onclick = () => setDailyDate(addDays(dailyDate, -1));
$('dNext').onclick = () => setDailyDate(addDays(dailyDate, 1));
$('dToday').onclick = () => setDailyDate(todayISO());

/* ---------------- task dialog ---------------- */
const dlg = $('dlg');
let editingId = null;
let saving = false;

function openDlg(id) {
  const t = id ? findTask(id) : null;
  if (id && !t) return;
  editingId = t ? t.id : null;
  const today = todayISO();
  $('dlgTitle').textContent = !canWrite ? 'Task' : t ? 'Edit task' : 'Add task';
  $('fTitle').value = t ? t.title : '';
  $('fStageSel').value = t ? t.stage : ($('fStage').value || '3A');
  $('fStatusSel').value = t ? t.status : 'todo';
  $('fStart').value = t ? t.start : today;
  $('fEnd').value = t ? t.end : today;
  $('fOwner').value = t ? t.owner : '';
  $('fNotes').value = t ? t.notes : '';
  $('fOnDaily').checked = t ? t.daily : true;
  $('dlgErr').textContent = '';
  $('dlgDelete').style.display = t && canWrite ? '' : 'none';
  $('dlgSave').style.display = canWrite ? '' : 'none';
  $('dlgCancel').textContent = canWrite ? 'Cancel' : 'Close';
  dlg.querySelectorAll('input,select,textarea').forEach(e => { e.disabled = !canWrite; });
  if (!dlg.open) dlg.showModal();
  (canWrite ? $('fTitle') : $('dlgCancel')).focus();
}

$('btnAdd').onclick = () => openDlg(null);
$('dlgCancel').onclick = () => dlg.close();
dlg.addEventListener('close', () => { editingId = null; flushStale(); });

$('dlgForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  if (!canWrite || saving) return;
  const title = $('fTitle').value.trim(), s = $('fStart').value, e = $('fEnd').value, err = $('dlgErr');
  if (!title) { err.textContent = 'Give the task a name.'; $('fTitle').focus(); return; }
  if (!s || !e) { err.textContent = 'Set a start and an end date.'; (s ? $('fEnd') : $('fStart')).focus(); return; }
  if (e < s) { err.textContent = 'The end date is before the start date.'; $('fEnd').focus(); return; }
  const fields = {
    title, stage: $('fStageSel').value, start: s, end: e,
    owner: $('fOwner').value.trim(), notes: $('fNotes').value.trim(), daily: $('fOnDaily').checked,
  };
  const st = $('fStatusSel').value;

  if (editingId) {
    const id = editingId;
    dlg.close();
    editTask(id, t => { Object.assign(t, fields); if (st !== t.status) setStatus(t, st); });
    return;
  }

  // New tasks wait for the server, which assigns the id.
  saving = true; $('dlgSave').disabled = true; setSync('Saving', '');
  try {
    const created = await api('POST', '/api/tasks', { ...fields, status: st, doneAt: st === 'done' ? todayISO() : '' });
    state.tasks.push(created);
    writeSeq++;
    dlg.close();
    renderAll();
    settledSync();
  } catch (x) {
    err.textContent = x.status ? x.message : 'Could not reach the server. Check your connection and try again.';
    if (!pending) x.status ? settledSync() : setSync('Disconnected', 'warn');
  } finally {
    saving = false; $('dlgSave').disabled = false;
  }
});

$('dlgDelete').onclick = () => {
  if (!editingId || !canWrite || !confirm('Delete this task?')) return;
  const id = editingId;
  dlg.close();
  deleteTask(id);
};

/* ---------------- downloads and backups ---------------- */
function saveFile(name, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

$('btnDlSched').onclick = () => saveFile(
  `Serenity_shipout_schedule_${todayISO()}.html`, 'text/html',
  standalone('Ship-out schedule', headerStatic(state, `Schedule status as of ${fmtLong(todayISO())}`, logoData) + `<div class="view">${renderScheduleHTML(state, false)}</div>`, '', true),
);

$('btnDlDaily').onclick = () => saveFile(
  `Serenity_daily_goals_${dailyDate}.html`, 'text/html',
  standalone('Daily goals ' + dailyDate,
    `<div style="padding:14px 12px 0"><p class="sh-note noprint">Tap a box to tick a goal off. Ticks are remembered in this browser on this device.</p>${sheetBody(state, dailyDate, { interactive: false, canWrite: false, logo: logoData })}</div>`,
    tickScript(dailyDate), false),
);

$('btnExport').onclick = async () => {
  try {
    const b = await api('GET', '/api/export');
    saveFile(`Serenity_shipout_tracker_backup_${todayISO()}.json`, 'application/json', JSON.stringify(b, null, 2));
  } catch (e) { if (e.status !== 401) alert('The backup could not be downloaded. ' + (e.status ? e.message : 'Check your connection and try again.')); }
};
$('btnImport').onclick = () => $('fileImport').click();
$('btnExportM').onclick = () => $('btnExport').click();
$('btnImportM').onclick = () => $('btnImport').click();
$('fileImport').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = async () => {
    let d;
    try { d = normalize(JSON.parse(r.result)); } catch { alert('That file could not be read as a tracker backup.'); return; }
    if (!confirm(`Replace the current tasks with ${d.tasks.length} tasks from this backup?`)) return;
    // Let queued edits land first so they do not overwrite the imported data.
    await queue;
    setSync('Saving', '');
    try { await api('POST', '/api/import', d); await refresh(true); settledSync(); }
    catch (x) { if (x.status !== 401) { alert('The backup could not be imported. ' + (x.status ? x.message : 'Check your connection and try again.')); settledSync(); } }
  };
  r.readAsText(f);
});

/* ---------------- printing ---------------- */
function doPrint(kind, orient) {
  const st = document.createElement('style'); st.id = 'pg';
  st.textContent = `@page{size:letter ${orient};margin:${kind === 'daily' ? '12mm' : '10mm'}}`;
  document.head.appendChild(st); document.body.classList.add('print-' + kind);
  const done = () => { document.body.classList.remove('print-' + kind); st.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch { done(); alert('Printing is blocked here. Use "Download" and print the downloaded file.'); }
}
$('btnPrintDaily').onclick = () => doPrint('daily', 'portrait');
$('btnPrintSched').onclick = () => doPrint('schedule', 'landscape');

/* ---------------- sign out ---------------- */
$('btnSignOut').onclick = async () => {
  await queue;
  try { await fetch('/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
  location.href = '/login';
};
window.addEventListener('beforeunload', e => { if (pending || noteTimers.size) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- start ---------------- */
async function loadLogoData() {
  try {
    const b = await (await fetch(LOGO_URL)).blob();
    logoData = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  } catch { /* downloads fall back to the URL */ }
}

setView(initialView());
renderAll();
loadLogoData();
refresh(true).then(() => { if (role) settledSync(); });
setInterval(() => refresh(false), POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
