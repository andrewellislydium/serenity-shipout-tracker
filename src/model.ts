// Data model, shared validation and backup normalisation (SPEC.md section 4).

export const STAGE_IDS = ['3A', '3B', '4', '5'] as const;
export const STATUS_IDS = ['todo', 'doing', 'blocked', 'done'] as const;
export type StageId = (typeof STAGE_IDS)[number];
export type Status = (typeof STATUS_IDS)[number];

export interface Task {
  id: string;
  stage: StageId;
  title: string;
  start: string;
  end: string;
  owner: string;
  status: Status;
  daily: boolean;
  notes: string;
  doneAt: string;
  updatedAt: string; // concurrency token; a stale value on update returns 409
}
export type NewTask = Omit<Task, 'id' | 'updatedAt'>;
export type BackupTask = Omit<Task, 'updatedAt'>;

export interface BackupFile {
  ship: string;
  tasks: BackupTask[];
  notes: Record<string, string>;
}

export interface State {
  ship: string;
  tasks: Task[];
  notes: Record<string, string>;
  updated: string;
}

export const DEFAULT_SHIP = '2026-10-28';
export const NOTE_MAX = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}

/** Validate a task body from the API. Throws ValidationError with a user-facing message. */
export function validateTask(b: any): NewTask {
  if (!b || typeof b !== 'object') throw new ValidationError('Invalid task.');
  const title = String(b.title ?? '').trim();
  if (!title) throw new ValidationError('Give the task a name.');
  if (title.length > 200) throw new ValidationError('The task name is longer than 200 characters.');
  if (!isDate(b.start) || !isDate(b.end)) throw new ValidationError('Set a start and an end date.');
  if (b.end < b.start) throw new ValidationError('The end date is before the start date.');
  const owner = String(b.owner ?? '').trim();
  if (owner.length > 80) throw new ValidationError('The owner is longer than 80 characters.');
  const notes = String(b.notes ?? '').trim();
  if (notes.length > 600) throw new ValidationError('The notes are longer than 600 characters.');
  if (!STAGE_IDS.includes(b.stage)) throw new ValidationError('Unknown stage.');
  const status: Status = b.status === undefined ? 'todo' : b.status;
  if (!STATUS_IDS.includes(status)) throw new ValidationError('Unknown status.');
  let doneAt = '';
  if (status === 'done') {
    if (b.doneAt && !isDate(b.doneAt)) throw new ValidationError('Invalid completion date.');
    doneAt = b.doneAt || new Date().toISOString().slice(0, 10);
  }
  return { stage: b.stage, title, start: b.start, end: b.end, owner, status, daily: b.daily === undefined ? true : !!b.daily, notes, doneAt };
}

/** Normalise an imported backup as section 4 describes. Never throws on bad rows; drops or coerces them. */
export function normalizeBackup(d: any): BackupFile {
  const out: BackupFile = { ship: isDate(d?.ship) ? d.ship : DEFAULT_SHIP, tasks: [], notes: {} };
  if (d?.notes && typeof d.notes === 'object') {
    for (const [k, v] of Object.entries(d.notes)) {
      if (DATE_RE.test(k) && typeof v === 'string' && v.trim()) out.notes[k] = v.slice(0, NOTE_MAX);
    }
  }
  if (Array.isArray(d?.tasks)) {
    const seen = new Set<string>();
    for (const t of d.tasks) {
      if (!t || !t.id || !isDate(t.start) || !isDate(t.end)) continue;
      const id = String(t.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const status: Status = STATUS_IDS.includes(t.status) ? t.status : 'todo';
      out.tasks.push({
        id,
        stage: STAGE_IDS.includes(t.stage) ? t.stage : '3A',
        title: String(t.title || 'Untitled').slice(0, 200),
        start: t.start,
        end: t.end < t.start ? t.start : t.end,
        owner: String(t.owner || '').slice(0, 80),
        status,
        daily: !!t.daily,
        notes: String(t.notes || '').slice(0, 600),
        doneAt: status === 'done' && isDate(t.doneAt) ? t.doneAt : '',
      });
    }
  }
  return out;
}
