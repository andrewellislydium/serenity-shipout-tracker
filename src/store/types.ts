import type { BackupFile, NewTask, State, Task } from '../model.js';

// Storage interface (SPEC.md section 2.2). The API layer only talks to this.
// One adapter per storage option, selected by the STORE setting.
export interface Store {
  init(): Promise<void>;
  isEmpty(): Promise<boolean>;
  getState(): Promise<State>;
  createTask(t: NewTask): Promise<Task>;
  /** Replace a task's fields. Throws ConflictError when ifMatch is given and stale, NotFoundError when missing. */
  updateTask(id: string, patch: NewTask, ifMatch?: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  /** Empty or whitespace text deletes the note. Last write wins per date. */
  setNote(date: string, text: string): Promise<void>;
  setShip(date: string): Promise<void>;
  importAll(data: BackupFile): Promise<void>;
  exportAll(): Promise<BackupFile>;
}
