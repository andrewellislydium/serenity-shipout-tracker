// File adapter: one JSON file, written by this process only (SPEC.md section 2.1, option E).
// For local development and single-instance demos. Writes are serialised with an
// in-process mutex and made atomic with write-to-temp then rename.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ConflictError, DEFAULT_SHIP, NotFoundError, type BackupFile, type NewTask, type State, type Task } from '../model.js';
import type { Store } from './types.js';

interface FileData {
  ship: string;
  tasks: Task[];
  notes: Record<string, string>;
  updated: string;
}

const newId = () => 't' + crypto.randomBytes(6).toString('base64url');
const stamp = () => new Date().toISOString() + '-' + crypto.randomBytes(3).toString('hex');

export class FileStore implements Store {
  private file: string;
  private data: FileData | null = null;
  private lock: Promise<unknown> = Promise.resolve();

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'tracker.json');
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.data = JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
      this.data = { ship: DEFAULT_SHIP, tasks: [], notes: {}, updated: new Date().toISOString() };
    }
  }

  async isEmpty() {
    try { await fs.access(this.file); return false; } catch { return true; }
  }

  private d(): FileData {
    if (!this.data) throw new Error('FileStore not initialised');
    return this.data;
  }

  /** Run a mutation under the mutex, then persist atomically. */
  private write<T>(fn: (d: FileData) => T): Promise<T> {
    const run = this.lock.then(async () => {
      const result = fn(this.d());
      this.d().updated = new Date().toISOString();
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.d(), null, 2));
      await fs.rename(tmp, this.file);
      return result;
    });
    this.lock = run.catch(() => {});
    return run;
  }

  async getState(): Promise<State> {
    const d = this.d();
    return structuredClone({ ship: d.ship, tasks: d.tasks, notes: d.notes, updated: d.updated });
  }

  createTask(t: NewTask) {
    return this.write(d => {
      const task: Task = { ...t, id: newId(), updatedAt: stamp() };
      d.tasks.push(task);
      return { ...task };
    });
  }

  updateTask(id: string, patch: NewTask, ifMatch?: string) {
    return this.write(d => {
      const i = d.tasks.findIndex(t => t.id === id);
      if (i < 0) throw new NotFoundError('Task not found');
      if (ifMatch && d.tasks[i].updatedAt !== ifMatch) throw new ConflictError('Task changed since you loaded it');
      d.tasks[i] = { ...patch, id, updatedAt: stamp() };
      return { ...d.tasks[i] };
    });
  }

  deleteTask(id: string) {
    return this.write(d => {
      const n = d.tasks.length;
      d.tasks = d.tasks.filter(t => t.id !== id);
      if (d.tasks.length === n) throw new NotFoundError('Task not found');
    });
  }

  setNote(date: string, text: string) {
    return this.write(d => {
      if (text.trim()) d.notes[date] = text;
      else delete d.notes[date];
    });
  }

  setShip(date: string) {
    return this.write(d => { d.ship = date; });
  }

  importAll(b: BackupFile) {
    return this.write(d => {
      d.ship = b.ship;
      d.tasks = b.tasks.map(t => ({ ...t, updatedAt: stamp() }));
      d.notes = { ...b.notes };
    });
  }

  async exportAll(): Promise<BackupFile> {
    const d = this.d();
    return structuredClone({ ship: d.ship, tasks: d.tasks.map(({ updatedAt, ...t }) => t), notes: d.notes });
  }
}
