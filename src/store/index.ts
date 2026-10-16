import path from 'node:path';
import type { Store } from './types.js';
import { FileStore } from './file.js';

export type { Store } from './types.js';

/** Pick the storage adapter from the STORE setting. Table and blob adapters come with the Azure work. */
export function createStore(): Store {
  const kind = process.env.STORE || 'file';
  switch (kind) {
    case 'file':
      return new FileStore(path.resolve(process.env.DATA_DIR || './data'));
    default:
      throw new Error(`STORE=${kind} is not implemented yet. Use STORE=file.`);
  }
}
