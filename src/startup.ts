// Startup that never crashes the process. If a setting is missing or storage cannot be
// reached, the server still listens, reports the problem on every page and in the log,
// and keeps retrying storage so a slow-to-activate role assignment recovers on its own.

import fs from 'node:fs';
import path from 'node:path';
import { checkAuthConfig } from './auth.js';
import { normalizeBackup } from './model.js';
import { createStore, type Store } from './store/index.js';

export const status = { ready: false, problem: 'Starting up and connecting to storage.' };

/** Turn a startup error into a plain-language hint for the site owner. No secrets in here. */
function explain(e: any): string {
  const msg = String(e?.message ?? e);
  if (e?.statusCode === 403 || /AuthorizationPermissionMismatch|AuthorizationFailure/.test(msg))
    return "Storage refused access. Give the web app's managed identity the Storage Table Data Contributor role on the storage account. New role assignments can take up to 10 minutes to apply.";
  if (/ENOTFOUND|getaddrinfo/.test(msg))
    return 'Storage account not found. Check the STORAGE_ACCOUNT setting matches the storage account name exactly.';
  if (e?.name === 'CredentialUnavailableError' || e?.name === 'AggregateAuthenticationError' || /ManagedIdentityCredential/.test(msg))
    return "No managed identity. Turn on the web app's system assigned identity (Settings, Identity).";
  if (/STORE=|STORAGE_ACCOUNT|_TOKEN|SESSION_SECRET/.test(msg)) return msg;
  return 'Storage error: ' + msg.split('\n')[0].slice(0, 300);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Check settings, then connect storage and seed it, retrying with backoff.
 * Resolves with the store once ready; never rejects.
 */
export async function startStore(root: string): Promise<Store | null> {
  try { checkAuthConfig(); }
  catch (e) { status.problem = explain(e); console.error(`Startup: ${status.problem}`); return null; }

  let store: Store;
  try { store = createStore(); }
  catch (e) { status.problem = explain(e); console.error(`Startup: ${status.problem}`); return null; }

  for (let attempt = 1; ; attempt++) {
    try {
      await store.init();
      if (await store.isEmpty()) {
        const seed = path.join(root, 'data', 'tracker-state.json');
        if (fs.existsSync(seed)) {
          const b = normalizeBackup(JSON.parse(fs.readFileSync(seed, 'utf8')));
          await store.importAll(b);
          console.log(`Empty store: imported ${b.tasks.length} tasks from data/tracker-state.json`);
        }
      }
      status.ready = true;
      status.problem = '';
      console.log(`Storage ready (STORE=${process.env.STORE || 'file'})`);
      return store;
    } catch (e) {
      status.problem = explain(e);
      const wait = Math.min(5000 * attempt, 60_000);
      console.error(`Startup attempt ${attempt}: ${status.problem} Retrying in ${wait / 1000} s.`);
      await sleep(wait);
    }
  }
}
