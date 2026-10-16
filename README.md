# Ship-out readiness tracker

Serenity Power project tracker, maintained by Lydium Technical Services. Built from [SPEC.md](SPEC.md); the prototype in [reference/tracker-reference.html](reference/tracker-reference.html) is the authority for look, behaviour and wording.

## Run locally

Needs Node 20.12 or later (Node 24 LTS recommended).

```bash
npm install
cp .env.example .env     # then set the two passcodes (16+ characters each) and SESSION_SECRET (32+)
npm run dev              # http://localhost:5190, restarts on server changes
```

Sign in with `EDITOR_TOKEN` (can change things) or `VIEWER_TOKEN` (read only).

On first start with no data, the server loads `data/tracker-state.json` (19 tasks, ship date 28 Oct 2026). Live data is written to `data/tracker.json`, which git ignores. To start again from the seed, stop the server and delete `data/tracker.json`.

Production-style run: `npm run build && npm start`.

## Layout

| Path | What it is |
|---|---|
| `src/server.ts` | Express app: login, JSON API (SPEC section 5), static files, `/healthz` |
| `src/auth.ts` | Passcode login, signed session cookie, `getRole` and `requireRole` (SPEC 3.1) |
| `src/model.ts` | Task validation and backup normalisation (SPEC 4) |
| `src/store/` | `Store` interface (SPEC 2.2), the `file` adapter for local use and the `table` adapter for Azure Table Storage |
| `public/index.html` | Page shell |
| `public/js/core.js` | Stages, date helpers, derived data and HTML renderers (ported from the reference) |
| `public/js/app.js` | Page controller: sync, write queue, events, dialog, print, downloads |
| `public/js/styles.js` | CSS shared by the page and the downloaded HTML files |
| `public/login.html` | Sign-in page |

## How saving works

Each change is its own API call (tick, status, edit, delete, note, ship date), sent in order from a client-side queue. Network or server errors retry with backoff and the header shows "Not saved, retrying". Each task carries an `updatedAt` token: if two people edit the same task, the second save gets a 409, the page reloads that person's view from the server, and they are told to redo their change. Day notes save 500 ms after typing stops, last write wins per date. Pages poll `GET /api/state` every 10 s.

## Storage

| `STORE` | Where data lives | Use for |
|---|---|---|
| `file` (default) | `DATA_DIR/tracker.json` | Local development |
| `table` | Azure Table Storage: tables `tasks`, `daynotes`, `settings` | Azure |

With `STORE=table` the app creates the three tables on first start and, if they are empty, loads `data/tracker-state.json`. In Azure it signs in with the web app's managed identity (`STORAGE_ACCOUNT` names the account; the identity needs the **Storage Table Data Contributor** role). Each task's ETag is its concurrency token.

To try the table adapter locally, run the [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) emulator (`npx azurite-table`) and start the app with `STORE=table AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true`.

## Hosting on Azure App Service

Live (beta): https://serenity-tracker-994ac2-fvghc6gscjexfqav.canadacentral-01.azurewebsites.net

| Resource | Name |
|---|---|
| Resource group | `rg-serenity-tracker` (Canada Central) |
| Web app | `serenity-tracker-994ac2` (Linux, Node 24 LTS) |
| Storage account | `serenitytracker994ac2` (Table Storage) |

Linux web app, Node 24 LTS, Canada Central. Use Basic B1 or higher with Always On for real use; Free F1 works but sleeps when idle. HTTPS only, minimum TLS 1.2. Health check path: `/healthz`.

App settings: `STORE=table`, `STORAGE_ACCOUNT`, `EDITOR_TOKEN`, `VIEWER_TOKEN`, `SESSION_SECRET`, `TZ=America/Edmonton`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. The web app's system assigned identity needs **Storage Table Data Contributor** on the storage account.

Deploys: every push to `main` runs `.github/workflows/main_serenity-tracker-994ac2.yml`, which builds on GitHub, prunes dev dependencies and deploys a zip of the runtime files. App Service then runs `npm start`. Work on `dev` and merge to `main` to release.

If the site shows "The tracker is not available yet", the message gives the reason (missing setting, storage access, and so on). The app keeps retrying storage, so fixing a permission recovers it without a restart.

Note: SPEC.md says Node 20 LTS, which reached end of life in April 2026, so the app targets Node 24 LTS. It still runs on 20.12+.

## Not done yet

- Entra ID sign-in (SPEC 3.2).
