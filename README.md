# Ship-out readiness tracker

Serenity Power project tracker, maintained by Lydium Technical Services. Built from [SPEC.md](SPEC.md); the prototype in [reference/tracker-reference.html](reference/tracker-reference.html) is the authority for look, behaviour and wording.

## Run locally

Needs Node 20.12 or later.

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
| `src/store/` | `Store` interface and the `file` adapter (SPEC 2.2). Azure adapters go here. |
| `public/index.html` | Page shell |
| `public/js/core.js` | Stages, date helpers, derived data and HTML renderers (ported from the reference) |
| `public/js/app.js` | Page controller: sync, write queue, events, dialog, print, downloads |
| `public/js/styles.js` | CSS shared by the page and the downloaded HTML files |
| `public/login.html` | Sign-in page |

## How saving works

Each change is its own API call (tick, status, edit, delete, note, ship date), sent in order from a client-side queue. Network or server errors retry with backoff and the header shows "Not saved, retrying". Each task carries an `updatedAt` token: if two people edit the same task, the second save gets a 409, the page reloads that person's view from the server, and they are told to redo their change. Day notes save 500 ms after typing stops, last write wins per date. Pages poll `GET /api/state` every 10 s.

## Not done yet

- Azure: Table Storage adapter with managed identity, App Service config, deployment (SPEC 2, milestone 8).
- Entra ID sign-in (SPEC 3.2).
