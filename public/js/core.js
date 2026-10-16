// Constants, date helpers, derived data and HTML renderers.
// Ported from reference/tracker-reference.html. Renderers take the state as an argument
// and return HTML strings; every piece of user text goes through esc().

import { CSS } from './styles.js';

/* ---------------- constants ---------------- */
// The four fixed stages (SPEC.md section 4). Change them here only.
export const STAGES = [
  { id: '3A', name: 'Sub-system testing',                 color: '#731F60', ink: '#fff' },
  { id: '3B', name: 'High performance stack validation',  color: '#C6168D', ink: '#fff' },
  { id: '4',  name: 'Reliability testing',                color: '#FDB913', ink: '#231F20' },
  { id: '5',  name: 'Pack up and ship-out',               color: '#A36B37', ink: '#231F20' },
];
export const STATUS = { todo: 'Not started', doing: 'In progress', blocked: 'Blocked', done: 'Done' };
export const DEFAULT_SHIP = '2026-10-28';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOWFULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONFULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------------- date helpers (dates pinned to local noon to avoid DST errors) ---------------- */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m-1, d, 12, 0, 0); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const todayISO = () => isoOf(new Date());
export const fmtShort = s => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtDow = s => { const d = parse(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtLong = s => { const d = parse(s); return `${DOWFULL[d.getDay()]} ${d.getDate()} ${MONFULL[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtRange = (a, b) => a === b ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`;
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const stageIdx = id => Math.max(0, STAGES.findIndex(s => s.id === id));

/* ---------------- backup normalisation (mirrors the server, used for the import count) ---------------- */
export function normalize(d) {
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const out = { ship: isDate(d && d.ship) ? d.ship : DEFAULT_SHIP, tasks: [], notes: {} };
  if (d && d.notes && typeof d.notes === 'object') Object.keys(d.notes).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof d.notes[k] === 'string' && d.notes[k].trim()) out.notes[k] = d.notes[k].slice(0, 2000); });
  if (d && Array.isArray(d.tasks)) {
    out.tasks = d.tasks.filter(t => t && t.id && isDate(t.start) && isDate(t.end)).map(t => ({
      id: String(t.id), stage: STAGES.some(s => s.id === t.stage) ? t.stage : '3A', title: String(t.title || 'Untitled'),
      start: t.start, end: t.end < t.start ? t.start : t.end, owner: t.owner || '', status: STATUS[t.status] ? t.status : 'todo',
      daily: !!t.daily, notes: t.notes || '', doneAt: t.doneAt || ''
    }));
  }
  return out;
}

/* ---------------- derived data ---------------- */
export const isOverdue = (t, today) => t.status !== 'done' && t.end < today;
export const sortTasks = (a, b) => stageIdx(a.stage) - stageIdx(b.stage) || a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title);

export function metrics(S) {
  const T = S.tasks, today = todayISO();
  const done = T.filter(t => t.status === 'done').length;
  return {
    today, total: T.length, done,
    doing: T.filter(t => t.status === 'doing').length,
    blocked: T.filter(t => t.status === 'blocked').length,
    overdue: T.filter(t => isOverdue(t, today)).length,
    afterShip: T.filter(t => t.status !== 'done' && t.end > S.ship).length,
    toShip: diffDays(today, S.ship),
    pct: T.length ? Math.round(done / T.length * 100) : 0,
  };
}

export function dailyGoals(S, D) {
  const f = S.tasks.filter(t => t.daily);
  const today = f.filter(t => t.start <= D && D <= t.end && (t.status !== 'done' || t.doneAt === D)).sort(sortTasks);
  const carried = f.filter(t => t.end < D && t.status !== 'done').sort(sortTasks);
  const tomorrow = f.filter(t => t.start === addDays(D, 1) && t.status !== 'done').sort(sortTasks);
  const doneY = S.tasks.filter(t => t.status === 'done' && t.doneAt === addDays(D, -1)).sort(sortTasks);
  return { today, carried, tomorrow, doneY };
}

/* ---------------- shared pieces ---------------- */
function progBar(list, cls = 'bar-prog') {
  const n = list.length || 1, c = k => list.filter(t => t.status === k).length;
  return `<div class="${cls}" title="${c('done')} done, ${c('doing')} in progress, ${c('blocked')} blocked, ${c('todo')} not started">
    <i style="width:${c('done')/n*100}%;background:#731F60"></i><i style="width:${c('doing')/n*100}%;background:#C6168D"></i><i style="width:${c('blocked')/n*100}%;background:#A36B37"></i></div>`;
}
export function chip(stageId) { const s = stageOf(stageId); return `<span class="chip" style="background:${s.color};color:${s.ink}">${esc(s.id)}</span>`; }

/* ---------------- schedule dashboard ---------------- */
export function renderScheduleHTML(S, interactive) {
  const m = metrics(S), T = S.tasks.slice().sort(sortTasks), today = m.today;
  let h = '';
  const toShipTxt = m.toShip > 0 ? m.toShip : (m.toShip === 0 ? 'Today' : 'Passed');
  h += `<div class="kpis">
    <div class="kpi gold"><div class="n">${toShipTxt}</div><div class="l">${m.toShip > 0 ? 'Days to ship (' + fmtShort(S.ship) + ')' : 'Ship date ' + fmtShort(S.ship)}</div></div>
    <div class="kpi"><div class="n">${m.done}/${m.total}</div><div class="l">Tasks done (${m.pct}%)</div></div>
    <div class="kpi"><div class="n">${m.doing}</div><div class="l">In progress</div></div>
    <div class="kpi ${m.overdue ? 'warn' : ''}"><div class="n">${m.overdue}</div><div class="l">Overdue</div></div>
    <div class="kpi ${m.blocked ? 'warn' : ''}"><div class="n">${m.blocked}</div><div class="l">Blocked</div></div>
    <div class="kpi ${m.afterShip ? 'warn' : ''}"><div class="n">${m.afterShip}</div><div class="l">Scheduled after ship date</div></div>
  </div>`;

  h += `<div class="sec-t">Progress by stage</div>`;
  STAGES.forEach(s => {
    const L = T.filter(t => t.stage === s.id), d = L.filter(t => t.status === 'done').length;
    const span = L.length ? fmtRange(L.reduce((a, t) => t.start < a ? t.start : a, L[0].start), L.reduce((a, t) => t.end > a ? t.end : a, L[0].end)) : 'No tasks';
    h += `<div class="stg"><div>${chip(s.id)} <span class="stg-n">${esc(s.name)}</span></div>${progBar(L)}<div class="stg-c">${d}/${L.length} done · ${span}</div></div>`;
  });

  // needs attention
  const att = [];
  T.forEach(t => {
    if (t.status === 'done') return;
    if (isOverdue(t, today)) att.push(['over', 'Overdue', t, `was due ${fmtShort(t.end)}`]);
    else if (t.status === 'blocked') att.push(['blk', 'Blocked', t, fmtRange(t.start, t.end)]);
    else if (t.end === today) att.push(['due', 'Due today', t, fmtRange(t.start, t.end)]);
    else if (t.status === 'todo' && t.start < today) att.push(['ns', 'Not started', t, `should have started ${fmtShort(t.start)}`]);
    if (t.end > S.ship) att.push(['ship', 'After ship date', t, `ends ${fmtShort(t.end)}`]);
  });
  h += `<div class="sec-t">Needs attention</div>`;
  if (!att.length) h += `<div class="empty">Nothing overdue, blocked or due today.</div>`;
  else h += '<ul class="att">' + att.map(a => `<li><span class="tag ${a[0]}">${a[1]}</span>${chip(a[2].stage)} ${interactive ? `<button class="lnk" data-open="${esc(a[2].id)}">${esc(a[2].title)}</button>` : `<span>${esc(a[2].title)}</span>`}<span class="dt">${a[3]}</span></li>`).join('') + '</ul>';

  // gantt
  h += `<div class="sec-t">Schedule</div>`;
  if (!T.length) { h += `<div class="empty">No tasks yet. Add the first one on the Tasks tab.</div>`; return h; }
  let start = T.reduce((a, t) => t.start < a ? t.start : a, T[0].start);
  let end = T.reduce((a, t) => t.end > a ? t.end : a, S.ship);
  if (today < start && diffDays(today, start) <= 3) start = today;
  end = addDays(end, 1);
  const N = diffDays(start, end) + 1, dw = 100 / N, days = [];
  for (let i = 0; i < N; i++) days.push(addDays(start, i));
  h += `<div class="g-wrap"><div class="g" style="min-width:calc(var(--lw) + ${N * 20}px)">`;
  // month band
  h += '<div class="g-head">'; let cur = null, cnt = 0; const parts = [];
  days.forEach(d => { const k = d.slice(0, 7); if (k !== cur) { if (cur) parts.push([cur, cnt]); cur = k; cnt = 1; } else cnt++; });
  parts.push([cur, cnt]);
  parts.forEach(p => { const mo = Number(p[0].slice(5, 7)) - 1; h += `<div class="g-mo" style="flex:${p[1]}">${MONFULL[mo]} ${p[0].slice(0, 4)}</div>`; });
  h += '</div><div class="g-days">';
  days.forEach(d => { const dt = parse(d), we = dt.getDay() === 0 || dt.getDay() === 6; h += `<div class="g-d${we ? ' we' : ''}${d === today ? ' td' : ''}">${DOW[dt.getDay()][0]}<b>${dt.getDate()}</b></div>`; });
  h += '</div><div class="g-body"><div class="g-over">';
  days.forEach((d, i) => { const dt = parse(d), we = dt.getDay() === 0 || dt.getDay() === 6;
    if (we) h += `<i class="we" style="left:${i * dw}%;width:${dw}%"></i>`;
    if (d === today) h += `<i class="td" style="left:${i * dw}%;width:${dw}%"></i>`;
    if (d === S.ship) h += `<i class="shp" style="left:${i * dw}%;width:${dw}%"></i>`; });
  h += '</div>';
  const si = diffDays(start, S.ship);
  if (si >= 0 && si < N) h += `<div class="g-ship-lab" style="left:calc(var(--lw) + (100% - var(--lw)) * ${(si + 1) / N})">Ship out</div>`;
  STAGES.forEach(s => {
    const L = T.filter(t => t.stage === s.id); if (!L.length) return;
    h += `<div class="g-grp">${chip(s.id)} ${esc(s.name)} <small>${L.filter(t => t.status === 'done').length}/${L.length} done</small></div>`;
    L.forEach(t => {
      const i0 = diffDays(start, t.start), i1 = diffDays(start, t.end), span = i1 - i0 + 1;
      const lab = interactive ? `<button data-open="${esc(t.id)}">${esc(t.title)}</button>` : `<span style="font-weight:600">${esc(t.title)}</span>`;
      const txt = span >= 2 ? STATUS[t.status] : '';
      const tag = interactive ? 'button' : 'div';
      h += `<div class="g-row"><div class="g-lab">${lab}<small>${esc(t.owner || 'Unassigned')} · ${fmtRange(t.start, t.end)}</small></div>
        <div class="g-track"><${tag} class="g-bar ${t.status}${isOverdue(t, today) || t.end > S.ship ? ' late' : ''}" ${interactive ? `data-open="${esc(t.id)}" tabindex="-1"` : ''} style="left:calc(${i0 * dw}% + 1px);width:calc(${span * dw}% - 2px)" title="${esc(t.title)}: ${fmtRange(t.start, t.end)}, ${STATUS[t.status]}">${txt}</${tag}></div></div>`;
    });
  });
  h += `</div></div></div>
  <div class="leg"><span><i style="background:#731F60"></i>Done</span><span><i style="background:#C6168D"></i>In progress</span><span><i style="background:#F0D3E6;border-color:#C6168D"></i>Not started</span><span><i style="background:#A36B37"></i>Blocked</span><span><i style="background:#fff;box-shadow:0 0 0 2px #FDB913"></i>Gold outline: overdue or after ship date</span><span><i style="background:rgba(253,185,19,.4)"></i>Today</span><span><i style="border-right:2px dashed #731F60;background:#fff"></i>Ship date</span></div>`;
  return h;
}

/* ---------------- daily goals sheet ---------------- */
const LINES = '<div class="sh-lines"><i></i><i></i><i></i><i></i></div>';
export function notesPrinted(txt) { return txt && txt.trim() ? `<div class="notes-text">${esc(txt)}</div>` : LINES; }

function notesHTML(S, D, interactive, canWrite) {
  const txt = (S.notes && S.notes[D]) || '';
  if (!interactive) return `<div class="sh-h">Notes and blockers</div>${notesPrinted(txt)}`;
  return `<div class="sh-h">Notes and blockers</div><textarea id="notesBox" class="notes-box noprint" data-notes="${D}" rows="5" maxlength="2000" aria-label="Notes and blockers" placeholder="Type notes and blockers for ${fmtShort(D)}. They save with the sheet and appear in the downloaded file." ${canWrite ? '' : 'readonly'}>${esc(txt)}</textarea><div id="notesPrint" class="notes-print">${notesPrinted(txt)}</div>`;
}

/**
 * The daily sheet for date D.
 * interactive: live page (tappable boxes, notes textarea). Otherwise the printable/downloadable form.
 */
export function sheetBody(S, D, { interactive, canWrite, logo }) {
  const g = dailyGoals(S, D);
  const toShip = diffDays(D, S.ship);
  const bigTxt = toShip > 0 ? `${toShip}` : (toShip === 0 ? 'Ship day' : 'Shipped');
  const smTxt = toShip > 0 ? `day${toShip === 1 ? '' : 's'} to ship-out` : `Ship out ${fmtDow(S.ship)}`;
  let h = `<div class="sheet"><div class="sh-top"><div><div class="sh-eyebrow">Serenity Power · Ship-out readiness · Global Controls, Calgary</div><div class="sh-title">Daily goals</div><div class="sh-date">${fmtLong(D)}</div></div>
    <div class="sh-ship"><div class="big">${bigTxt}</div><div class="sm">${smTxt}</div>${toShip > 0 ? `<div class="sm">Target ${fmtDow(S.ship)}</div>` : ''}</div></div>`;
  h += '<div class="sh-prog">' + STAGES.map(s => { const L = S.tasks.filter(t => t.stage === s.id); const d = L.filter(t => t.status === 'done').length; return `<div>${chip(s.id)} <b>${esc(s.name)}</b>${d}/${L.length} done${progBar(L, 'bar-prog bp')}</div>`; }).join('') + '</div>';

  const live = interactive && canWrite;
  const row = t => {
    const done = t.status === 'done';
    const cbAttrs = interactive
      ? `role="checkbox" aria-checked="${done}" aria-label="${esc(t.title)}" ${live ? `data-toggle="${esc(t.id)}" tabindex="0"` : 'aria-disabled="true"'}`
      : '';
    return `<tr><td class="cbc"><span class="cb${done ? ' on' : ''}" data-id="${esc(t.id)}" ${cbAttrs}></span></td>
      <td><div class="g-t${done ? ' dn' : ''}">${chip(t.stage)} ${esc(t.title)}</div>${t.notes ? `<div class="g-n">${esc(t.notes)}</div>` : ''}</td>
      <td class="g-m">${esc(t.owner || '')}${t.owner ? '<br>' : ''}${t.status === 'blocked' ? '<b>Blocked</b> · ' : ''}${fmtRange(t.start, t.end)}</td></tr>`;
  };
  const section = (title, list, emptyTxt) => `<div class="sh-h">${title}</div>` + (list.length ? `<table class="gl">${list.map(row).join('')}</table>` : `<div class="sh-none">${emptyTxt}</div>`);

  if (g.carried.length) h += section('Carried over, not yet done', g.carried, '');
  h += section('Goals for today', g.today, 'No tasks are flagged for today. Tick "Include on the daily summary" on a task to add it.');
  if (g.tomorrow.length) h += section('Starting tomorrow', g.tomorrow, '');
  if (g.doneY.length) h += section('Completed yesterday', g.doneY, '');
  h += notesHTML(S, D, interactive, canWrite);
  h += `<div class="sh-foot"><span>Serenity Power / Ship-out readiness / ${fmtShort(D)}</span><span class="by"><span>Prepared by</span><img alt="Lydium" src="${logo}"></span></div></div>`;
  return h;
}

/* ---------------- tasks table ---------------- */
export function renderTasksHTML(S, f) {
  const today = todayISO();
  if (!S.tasks.length) return `<div class="empty">No tasks yet. Use "Add task" to create the first one.</div>`;
  const T = S.tasks.slice().sort(sortTasks).filter(t => (!f.stage || t.stage === f.stage) && (!f.status || t.status === f.status) && (!f.daily || t.daily) && (!f.hideDone || t.status !== 'done'));
  if (!T.length) return `<div class="empty">No tasks match these filters.</div>`;
  let h = `<table class="tt"><thead><tr><th>Done</th><th>Task</th><th>Dates</th><th>Owner</th><th>Status</th><th>Daily</th><th><span class="sr">Edit</span></th></tr></thead><tbody>`;
  let last = '';
  T.forEach(t => {
    if (t.stage !== last) { last = t.stage; const s = stageOf(t.stage); h += `<tr class="grp"><td colspan="7">${chip(s.id)} ${esc(s.name)}</td></tr>`; }
    const od = isOverdue(t, today);
    h += `<tr class="${t.status === 'done' ? 'isdone' : ''}"><td><input type="checkbox" data-done="${esc(t.id)}" ${t.status === 'done' ? 'checked' : ''} aria-label="Done: ${esc(t.title)}"></td>
      <td><div class="ttl">${esc(t.title)}</div>${t.notes ? `<div class="note">${esc(t.notes)}</div>` : ''}</td>
      <td class="dts">${fmtRange(t.start, t.end)}${od ? ' <span class="pill blocked">Overdue</span>' : ''}</td><td>${esc(t.owner)}</td>
      <td><select data-status="${esc(t.id)}" aria-label="Status: ${esc(t.title)}">${Object.keys(STATUS).map(k => `<option value="${k}"${k === t.status ? ' selected' : ''}>${STATUS[k]}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-daily="${esc(t.id)}" ${t.daily ? 'checked' : ''} aria-label="On daily summary: ${esc(t.title)}"></td>
      <td class="dts"><button class="btn sm" data-open="${esc(t.id)}">Edit</button></td></tr>`;
  });
  return h + '</tbody></table>';
}

/* ---------------- standalone downloads ---------------- */
export function standalone(title, inner, extra, isStatic) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${CSS}.doc.static .cb{cursor:default}.doc.static .cb::before{display:none}</style></head><body><div class="doc${isStatic ? ' static' : ''}">${inner}</div>${extra || ''}</body></html>`;
}
export function headerStatic(S, sub, logo) {
  return `<header class="hdr"><div class="hdr-l"><div class="hdr-eyebrow">Serenity Power · Global Controls, Calgary</div><div class="hdr-title">Ship-out readiness tracker</div><div class="hdr-sub">${sub}</div></div>
  <div class="hdr-r"><div class="ship-box"><label>Target ship date</label><div class="ship-fixed">${fmtDow(S.ship)}</div><div class="ship-note">Target, pending Italgas proposal acceptance</div></div><div class="hdr-meta"><img class="hdr-logo" alt="Lydium" src="${logo}"></div></div></header>`;
}

/** The only script in a downloaded daily sheet: tappable boxes remembered in localStorage on that device. */
export function tickScript(date) {
  return `<script>(function(){var K='lydium-sheet-${date}',s={};try{s=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('.cb[data-id]').forEach(function(c){var id=c.getAttribute('data-id');
function paint(){var on=c.classList.contains('on');c.setAttribute('aria-checked',on);var t=c.closest('tr').querySelector('.g-t');if(t)t.classList.toggle('dn',on);}
if(s[id]!==undefined)c.classList.toggle('on',!!s[id]);
c.setAttribute('role','checkbox');c.tabIndex=0;var lt=c.closest('tr').querySelector('.g-t');if(lt)c.setAttribute('aria-label',lt.textContent.trim());paint();
function tog(){c.classList.toggle('on');s[id]=c.classList.contains('on');try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}paint();}
c.addEventListener('click',tog);c.addEventListener('keydown',function(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();tog();}});});})();<\/script>`;
}
