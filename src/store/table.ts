// Azure Table Storage adapter (SPEC.md section 2.1, option A; layout in 2.2).
//
// Tables: tasks (PartitionKey "shipout", RowKey = task id), daynotes (PartitionKey "notes",
// RowKey = date), settings (PartitionKey "settings", RowKey "ship"). Every write is per row.
// A task's ETag is its updatedAt token: updates send it as If-Match and a stale one is a 409.
//
// Credentials: in Azure, the web app's managed identity via DefaultAzureCredential and
// STORAGE_ACCOUNT, so there is no connection string. For local testing against Azurite, set
// AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true instead.

import crypto from 'node:crypto';
import { TableClient, type TableEntity, type TransactionAction } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { ConflictError, DEFAULT_SHIP, NotFoundError, type BackupFile, type NewTask, type State, type Task } from '../model.js';
import type { Store } from './types.js';

const PK_TASK = 'shipout';
const PK_NOTE = 'notes';
const PK_SET = 'settings';
const RK_SHIP = 'ship';
const BATCH = 100; // Table Storage transaction limit

const TASK_FIELDS = ['stage', 'title', 'start', 'end', 'owner', 'status', 'daily', 'notes', 'doneAt'] as const;

const newId = () => 't' + crypto.randomBytes(6).toString('base64url');
const code = (e: any) => e?.statusCode as number | undefined;

function toRow(t: NewTask): NewTask {
  const r: any = {};
  for (const k of TASK_FIELDS) r[k] = t[k];
  return r;
}

function fromEntity(e: any): Task {
  return {
    id: e.rowKey,
    stage: e.stage,
    title: e.title ?? '',
    start: e.start,
    end: e.end,
    owner: e.owner ?? '',
    status: e.status,
    daily: !!e.daily,
    notes: e.notes ?? '',
    doneAt: e.doneAt ?? '',
    updatedAt: e.etag,
  };
}

async function listAll(client: TableClient, partitionKey: string) {
  const out: any[] = [];
  for await (const e of client.listEntities({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } })) out.push(e);
  return out;
}

async function inBatches(client: TableClient, actions: TransactionAction[]) {
  for (let i = 0; i < actions.length; i += BATCH) await client.submitTransaction(actions.slice(i, i + BATCH));
}

export class TableStore implements Store {
  private tasks: TableClient;
  private notes: TableClient;
  private settings: TableClient;

  constructor() {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const make = (table: string) => {
      if (conn) return TableClient.fromConnectionString(conn, table, { allowInsecureConnection: conn.includes('UseDevelopmentStorage') || conn.includes('http://') });
      const account = process.env.STORAGE_ACCOUNT;
      if (!account) throw new Error('STORE=table needs STORAGE_ACCOUNT (or AZURE_STORAGE_CONNECTION_STRING for local testing)');
      return new TableClient(`https://${account}.table.core.windows.net`, table, new DefaultAzureCredential());
    };
    this.tasks = make('tasks');
    this.notes = make('daynotes');
    this.settings = make('settings');
  }

  async init() {
    // Create the three tables once if they do not exist.
    for (const c of [this.tasks, this.notes, this.settings]) {
      try { await c.createTable(); } catch (e) { if (code(e) !== 409) throw e; }
    }
  }

  async isEmpty() {
    try { await this.settings.getEntity(PK_SET, RK_SHIP); return false; } catch (e) { if (code(e) !== 404) throw e; }
    for await (const _ of this.tasks.listEntities({ queryOptions: { filter: `PartitionKey eq '${PK_TASK}'`, select: ['RowKey'] } })) return false;
    return true;
  }

  async getState(): Promise<State> {
    const [tasks, notes, ship] = await Promise.all([
      listAll(this.tasks, PK_TASK),
      listAll(this.notes, PK_NOTE),
      this.settings.getEntity<{ value: string }>(PK_SET, RK_SHIP).then(e => e.value, e => { if (code(e) === 404) return DEFAULT_SHIP; throw e; }),
    ]);
    const state: State = {
      ship,
      tasks: tasks.map(fromEntity),
      notes: Object.fromEntries(notes.map(n => [n.rowKey, n.text as string])),
      updated: '',
    };
    // A fingerprint of the whole state; it changes on any create, edit or delete, so the page knows to re-render.
    state.updated = crypto.createHash('sha1')
      .update(JSON.stringify([ship, tasks.map(t => [t.rowKey, t.etag]).sort(), notes.map(n => [n.rowKey, n.etag]).sort()]))
      .digest('base64url');
    return state;
  }

  async createTask(t: NewTask): Promise<Task> {
    const id = newId();
    const res = await this.tasks.createEntity({ partitionKey: PK_TASK, rowKey: id, ...toRow(t) });
    return { ...t, id, updatedAt: res.etag! };
  }

  async updateTask(id: string, patch: NewTask, ifMatch?: string): Promise<Task> {
    try {
      const res = await this.tasks.updateEntity({ partitionKey: PK_TASK, rowKey: id, ...toRow(patch) }, 'Replace', { etag: ifMatch || '*' });
      return { ...patch, id, updatedAt: res.etag! };
    } catch (e) {
      if (code(e) === 412) throw new ConflictError('Task changed since you loaded it');
      if (code(e) === 404) throw new NotFoundError('Task not found');
      throw e;
    }
  }

  async deleteTask(id: string) {
    try { await this.tasks.deleteEntity(PK_TASK, id); }
    catch (e) { if (code(e) === 404) throw new NotFoundError('Task not found'); throw e; }
  }

  async setNote(date: string, text: string) {
    if (text.trim()) { await this.notes.upsertEntity({ partitionKey: PK_NOTE, rowKey: date, text }, 'Replace'); return; }
    try { await this.notes.deleteEntity(PK_NOTE, date); } catch (e) { if (code(e) !== 404) throw e; }
  }

  async setShip(date: string) {
    await this.settings.upsertEntity({ partitionKey: PK_SET, rowKey: RK_SHIP, value: date }, 'Replace');
  }

  /** Replace everything. Clears the old rows, then writes the backup in batches. */
  async importAll(b: BackupFile) {
    const [oldTasks, oldNotes] = await Promise.all([listAll(this.tasks, PK_TASK), listAll(this.notes, PK_NOTE)]);
    await inBatches(this.tasks, oldTasks.map(e => ['delete', { partitionKey: PK_TASK, rowKey: e.rowKey }] as TransactionAction));
    await inBatches(this.notes, oldNotes.map(e => ['delete', { partitionKey: PK_NOTE, rowKey: e.rowKey }] as TransactionAction));
    await inBatches(this.tasks, b.tasks.map(t => ['upsert', { partitionKey: PK_TASK, rowKey: t.id, ...toRow(t) } as TableEntity, 'Replace'] as TransactionAction));
    await inBatches(this.notes, Object.entries(b.notes).map(([date, text]) => ['upsert', { partitionKey: PK_NOTE, rowKey: date, text }, 'Replace'] as TransactionAction));
    await this.setShip(b.ship);
  }

  async exportAll(): Promise<BackupFile> {
    const s = await this.getState();
    return { ship: s.ship, tasks: s.tasks.map(({ updatedAt, ...t }) => t), notes: s.notes };
  }
}
