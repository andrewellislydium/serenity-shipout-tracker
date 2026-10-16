import path from 'node:path';
import type { Store } from './types.js';
import { FileStore } from './file.js';
import { TableStore } from './table.js';

export type { Store } from './types.js';

/** Pick the storage adapter from the STORE setting: file (local default) or table (Azure). */
export function createStore(): Store {
  const kind = process.env.STORE || 'file';
  switch (kind) {
    case 'file':
      return new FileStore(path.resolve(process.env.DATA_DIR || './data'));
    case 'table':
      return new TableStore();
    default:
      throw new Error(`STORE=${kind} is not implemented yet. Use STORE=file or STORE=table.`);
  }
}
