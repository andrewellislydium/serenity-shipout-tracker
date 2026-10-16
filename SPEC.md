# Ship-out readiness tracker: build spec

Status: v1.1 spec derived from a working prototype built in a sandbox. Target: a standalone web app hosted on **Azure App Service (Azure Web Apps)** behind password protection.
Owner: Andrew Ellis, Lydium Technical Services. Audience: Serenity Power project team (client-facing), maintained by Lydium.

## How to use this with Claude Code

1. Put this folder at the root of a new repo. Keep `reference/`, `assets/` and `data/` in it.
2. Tell Claude Code: "Read SPEC.md, then reference/tracker-reference.html. Build the app described in SPEC.md. The reference file is the working prototype for look, behaviour and wording. The target host is Azure App Service for Linux (section 2). Where the reference calls the sandbox runtime (`claude.use('db')`, `claude.use('user')`, `claude.use('downloads')`), replace it with the backend, storage and browser APIs in this spec. Ask before deviating from the spec."
3. Work through the milestones in section 12, running the acceptance checks in section 11 as you go.

Files in this bundle:

| Path | What it is |
|---|---|
| `SPEC.md` | This document |
| `reference/tracker-reference.html` | Single-file prototype. Authoritative for visual design, copy, and interaction details. It depends on a sandbox runtime for storage, so it will not persist data outside the sandbox. |
| `assets/lydium-logo-colour.png` | Full-colour horizontal Lydium logo, from the Lydium graphics guide. Do not recolour, stretch or add effects. |
| `data/tracker-state.json` | Current live data (tasks and settings), importable with the app's "Import backup". Use as the initial dataset. |

## 1. Purpose

A small shared tool for planning and tracking the activities that lead up to the unit shipping out of the Global Controls facility in Calgary, so the team can update it daily. It must:

- Let the user add tasks, give each a date range, and tick a box to put it on the daily summary.
- Produce an updated schedule dashboard.
- Produce a daily goals sheet the team can have at the start of each day until ship-out, on paper, on a phone, or as a downloaded file.

Context: the target ship date is **2026-10-28** and is still a push, pending the client's (Italgas) proposal acceptance. The UI must call it a target, not a commitment.

Scope: one project, four fixed stages, roughly 10 to 100 tasks, a handful of users. Not a general project management tool.

## 2. Hosting target: Azure App Service (Linux)

The app is a Node web app deployed to **Azure App Service for Linux** (Azure Web Apps). It is a normal server process, so it serves the pages **and owns the data**. Browsers never read or write a JSON file on the server. They call the JSON API in section 5, and the server reads and writes storage. (Passing a JSON file back and forth by hand is only needed for static hosting with no server code, which this is not.)

- Runtime: Node 20 LTS, TypeScript, Express. Static front end files are served by the same app. One App Service, one deployment.
- Front end: vanilla ES modules or a light framework (Preact or React). No heavy UI kit. The reference is vanilla JS; matching its markup and CSS is the fastest route to visual parity.
- Plan: Basic B1 or higher, with **Always On** enabled so the app does not sleep. The Free F1 tier works for a demo but sleeps and has quotas.
- Region: Canada Central.
- Transport: HTTPS only, minimum TLS 1.2. Call `app.set('trust proxy', 1)` because App Service terminates TLS in front of the app (needed for Secure cookies and correct client IPs for rate limiting).
- Realtime: poll `GET /api/state` every 10 s. No WebSockets needed. Do not replace UI content while the user is typing in the notes box or has the task dialog open.
- Configuration: App Service **Application settings** (environment variables): `PORT` (provided by App Service), `STORE`, `STORAGE_ACCOUNT`, `DATA_DIR`, `EDITOR_TOKEN`, `VIEWER_TOKEN`, `SESSION_SECRET`, `TZ`. Keep secrets out of the repo. Use Key Vault references for the three secrets if available.
- Deploy: `az webapp up` for a first deploy, then GitHub Actions through Deployment Center. Provide a `/healthz` endpoint that returns 200 without auth.

### 2.1 Where the data lives

The App Service container file system is **ephemeral**: anything written to the app's working directory is lost on restart, redeploy or scale out. Only `/home` persists (it is network storage shared by all instances). Do not rely on the working directory for data.

| Option | How it works | Good for | Cautions |
|---|---|---|---|
| **A. Azure Table Storage (default)** | Tables `tasks`, `daynotes`, `settings` in a Storage account. Per-row writes with ETag optimistic concurrency. Access with the web app's managed identity, so no connection string. Costs pennies per month. | This app: about 10 to 100 tasks, a few users | Limited query features, which do not matter here because the app loads all rows |
| B. Azure Blob Storage, one JSON blob | `state.json` in a private container. Server does read, modify, write with an `If-Match` ETag and retries on a 412 conflict. | Simplest to reason about. It is a JSON file, but stored and updated safely on the server. | Whole-document writes, so you need retry and merge logic |
| C. Azure Cosmos DB for NoSQL (free tier) | One JSON document per task | If this grows to multiple projects | More setup and cost to understand |
| D. Azure SQL Database or PostgreSQL | Relational tables | If Lydium already runs one | Overkill and costs more |
| E. JSON file or SQLite file on `/home` | File on the persistent mount, written by the server | Local development and quick demos | **Single instance only.** `/home` is network storage, so file locking is unreliable across instances. Serialize writes in process and write atomically. Easy to lose in a slot swap or redeploy that replaces `/home`. |

**Default: Option A in Azure, Option E locally** for development with no Azure account.

### 2.2 Storage interface

The API layer never touches storage directly. It calls this interface, with one adapter per option.

```ts
interface Store {
  getState(): Promise<{ ship: string; tasks: Task[]; notes: Record<string, string>; updated: string }>;
  createTask(t: NewTask): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>, ifMatch?: string): Promise<Task>; // throws ConflictError on stale etag
  deleteTask(id: string): Promise<void>;
  setNote(date: string, text: string): Promise<void>;   // empty text deletes
  setShip(date: string): Promise<void>;
  importAll(data: BackupFile): Promise<void>;
  exportAll(): Promise<BackupFile>;
}
```

Adapters, selected by `STORE`: `table` (default in Azure, `@azure/data-tables` with `DefaultAzureCredential`), `file` (JSON file at `DATA_DIR`, default `./data` locally and `/home/data/tracker.json` on Azure; write to a temp file and rename; guard with an in-process mutex), optional `blob`. Table layout: tasks use PartitionKey `shipout` and RowKey = task id; day notes use PartitionKey `notes` and RowKey = date; settings use PartitionKey `settings` and RowKey `ship`. On first start with an empty store, offer or perform an import of `data/tracker-state.json`.

Backups: the "Export backup" button and `GET /api/export` are the user-facing backup. Also enable soft delete on the Storage account.

### 2.3 Sample Azure setup (Azure CLI)

```bash
RG=rg-shipout; LOC=canadacentral; APP=shipout-tracker-<unique>; SA=shipouttracker<unique>
az group create -n $RG -l $LOC
az appservice plan create -g $RG -n plan-shipout --is-linux --sku B1
az webapp create -g $RG -p plan-shipout -n $APP --runtime "NODE:20-lts"
az webapp update -g $RG -n $APP --https-only true
az webapp config set -g $RG -n $APP --always-on true --min-tls-version 1.2
az storage account create -g $RG -n $SA -l $LOC --sku Standard_LRS --allow-blob-public-access false
az webapp identity assign -g $RG -n $APP            # note principalId in the output
az role assignment create --assignee <principalId> --role "Storage Table Data Contributor" \
   --scope $(az storage account show -g $RG -n $SA --query id -o tsv)
az webapp config appsettings set -g $RG -n $APP --settings \
   STORE=table STORAGE_ACCOUNT=$SA TZ=America/Edmonton \
   EDITOR_TOKEN=<long-random> VIEWER_TOKEN=<long-random> SESSION_SECRET=<long-random>
az webapp up -g $RG -n $APP --runtime "NODE:20-lts"   # from the repo root
```

Create the three tables once at startup if they do not exist.

## 3. Roles and password protection

| Role | Can do |
|---|---|
| Editor | Everything: add, edit, delete tasks, tick boxes, edit notes, change ship date, import backup |
| Viewer | Read everything, download HTML exports, print. Tick boxes disabled, notes read-only, add and edit hidden. Sync label reads "View only". |

Every API route except `/healthz` and the login routes requires a valid session. All write routes require the editor role, **enforced on the server**, not just by hiding buttons.

### 3.1 Mode 1: shared passcodes (sample, default)

A login page asks for a passcode. The `EDITOR_TOKEN` passcode gives the editor role and the `VIEWER_TOKEN` passcode gives the viewer role. On success the server sets a signed, HTTP-only session cookie. Sample implementation:

```ts
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';

type Role = 'editor' | 'viewer';
const SECRET = process.env.SESSION_SECRET!;          // set in App Service settings, 32+ random bytes
const TTL_MS = 12 * 60 * 60 * 1000;

const mac = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
const sign = (role: Role) => { const body = `${role}.${Date.now() + TTL_MS}`; return `${body}.${mac(body)}`; };
function verify(cookie?: string): Role | null {
  if (!cookie) return null;
  const [role, exp, sig] = cookie.split('.');
  if (!sig || sig.length !== mac(`${role}.${exp}`).length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac(`${role}.${exp}`)))) return null;
  if (Number(exp) < Date.now()) return null;
  return role === 'editor' || role === 'viewer' ? role : null;
}
const same = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && crypto.timingSafeEqual(A, B); };

app.set('trust proxy', 1);
app.post('/login', rateLimit({ windowMs: 60_000, max: 5 }), express.json(), (req, res) => {
  const p = String(req.body?.passcode ?? '');
  const role: Role | null = same(p, process.env.EDITOR_TOKEN ?? '') ? 'editor' : same(p, process.env.VIEWER_TOKEN ?? '') ? 'viewer' : null;
  if (!role) return res.status(401).json({ error: 'Incorrect passcode' });
  res.cookie('sid', sign(role), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: TTL_MS });
  res.json({ role });
});
app.post('/logout', (_req, res) => { res.clearCookie('sid'); res.json({ ok: true }); });

const getRole = (req: express.Request) => verify(req.cookies?.sid);   // needs cookie-parser
const requireRole = (min: Role): express.RequestHandler => (req, res, next) => {
  const r = getRole(req);
  if (!r) return res.status(401).json({ error: 'Sign in required' });
  if (min === 'editor' && r !== 'editor') return res.status(403).json({ error: 'Editor access required' });
  next();
};
```

Rules: passcodes are at least 16 random characters and live only in App Service settings; compare in constant time; rate limit login; cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, 12 hour lifetime; never put a passcode in a URL; the login page is plain HTML in the same Lydium style, with a single passcode field and an error line. Rotate by changing the app setting. `GET /api/state` returns the caller's `role` so the UI can switch to view-only.

### 3.2 Mode 2: App Service Authentication (recommended once you have named users)

Turn on **Authentication** for the web app with Microsoft Entra ID and "Require authentication". Then the platform handles sign-in, and the app reads the signed-in user from the `X-MS-CLIENT-PRINCIPAL` header (base64 JSON). Map users to roles with Entra app roles (`Editor`, `Viewer`) or an allow-list setting (`EDITOR_EMAILS`). Only trust those headers when Easy Auth is enabled, because otherwise they can be forged. Serenity or Italgas staff outside the Lydium tenant must be invited as Entra guest users. Keep `getRole(req)` as the single place that decides the role so Mode 1 and Mode 2 can be swapped.

## 4. Data model

All dates are `YYYY-MM-DD` local calendar dates with no time zone. Date ranges are inclusive of both ends.

### Task

| Field | Type | Rules |
|---|---|---|
| `id` | string | Server generated, opaque. Existing ids in the seed (`s01`, `tmvabmgm4tg7`) must be preserved on import. |
| `stage` | `"3A"` \| `"3B"` \| `"4"` \| `"5"` | Fixed list, see below |
| `title` | string | Required, max 200 |
| `start` | date | Required |
| `end` | date | Required, must be on or after `start`. On import, if `end < start`, set `end = start`. |
| `owner` | string | Optional, max 80 |
| `status` | `"todo"` \| `"doing"` \| `"blocked"` \| `"done"` | Default `todo`. Labels: Not started, In progress, Blocked, Done. |
| `daily` | boolean | True means "include on the daily summary". Default true for new tasks. |
| `notes` | string | Optional, max 600 |
| `doneAt` | date or empty | Set to today's date when status becomes `done`; cleared (empty) when status changes away from `done`. |

### Day notes

`notes[date] = string`, max 2000 characters, one per calendar date, for the "Notes and blockers" box on that day's sheet. Delete the entry when the text is empty or whitespace.

### Settings

`ship`: the target ship date, default `2026-10-28`.

### Stages (fixed, not user editable)

| id | Name | Colour | Text on colour |
|---|---|---|---|
| 3A | Sub-system testing | `#731F60` | white |
| 3B | High performance stack validation | `#C6168D` | white |
| 4 | Reliability testing | `#FDB913` | `#231F20` |
| 5 | Pack up and ship-out | `#A36B37` | `#231F20` |

Stage order is the order above. Stage 5 was previously "FAT testing in Calgary"; it is now pack up and ship-out. Keep the stage list in one config object so it is easy to change.

### Backup file format (export and import)

```json
{ "ship": "2026-10-28", "tasks": [ { "id": "...", "stage": "3A", "title": "...", "start": "2026-10-16", "end": "2026-10-17", "owner": "", "status": "todo", "daily": true, "notes": "", "doneAt": "" } ], "notes": { "2026-10-20": "free text" } }
```

Import must validate and normalise: drop tasks missing `id`, `start` or `end`; coerce unknown `stage` to `3A`; coerce unknown `status` to `todo`; keep only notes whose key matches `^\d{4}-\d{2}-\d{2}$` and whose value is a non-empty string (truncate to 2000). Importing replaces all data after a confirm prompt ("Replace the current tasks with N tasks from this backup?").

## 5. API

JSON over HTTPS, cookie auth. All writes are editor only. Return the updated record.

| Method and path | Purpose |
|---|---|
| `GET /api/state` | `{ ship, tasks, notes, updated }` for the whole project, plus `role` |
| `POST /api/tasks` | Create task |
| `PUT /api/tasks/:id` | Replace task fields (also used for status, daily and done changes) |
| `DELETE /api/tasks/:id` | Delete task |
| `PUT /api/notes/:date` | Set day notes. Body `{ text }`. Empty text deletes. |
| `PUT /api/settings` | `{ ship }` |
| `GET /api/export` | Backup JSON, same format as above |
| `POST /api/import` | Replace everything from a backup JSON |
| `GET /api/events` (optional) | SSE stream that emits when state changes |

Concurrency: write per record, not whole-document, unless you choose the single-blob option B, in which case use `If-Match` and retry. The prototype rewrote one document and could lose a concurrent edit; do not copy that. Add an `updatedAt` per task and return 409 if a client sends a stale `updatedAt`, or accept last-write-wins per task and say so. Notes saves are debounced client side (about 500 ms) and last-write-wins per date.

Persistence goes through the `Store` interface in section 2.2, so the API code is the same for Table Storage, Blob Storage or a file. With Table Storage, each task row carries an ETag, which is the `updatedAt` used for the 409 check.

## 6. Screens

One page, three tabs, plus a task dialog. Tabs: **Schedule dashboard**, **Tasks**, **Daily goals**. The URL hash selects the tab (`#schedule`, `#tasks`, `#daily`) and updates when the tab changes.

### 6.1 Header (all tabs)

- Left: eyebrow "Serenity Power · Global Controls, Calgary", title "Ship-out readiness tracker", subtitle "Stages 3A, 3B, 4 and 5, through to unit ship-out".
- Right: "Target ship date" date input (editors can change it; viewers see it read-only), with the note "Target, pending Italgas proposal acceptance". Sync status label. Lydium logo.
- Sync status values: `Saved`, `Saving`, `Not saved, retrying`, `Disconnected`, `View only`.

### 6.2 Schedule dashboard

Toolbar: "Print schedule", "Download schedule (HTML)".

**KPI tiles** (computed with today as the browser's local date):

| Tile | Value |
|---|---|
| Days to ship | Days from today to the ship date. Shows "Today" on the day and "Passed" after. Label includes the ship date, e.g. "Days to ship (28 Oct)". |
| Tasks done | `done/total` and a rounded percent |
| In progress | Count with status `doing` |
| Overdue | Status not `done` and `end < today`. Warning style when above zero. |
| Blocked | Count with status `blocked`. Warning style when above zero. |
| Scheduled after ship date | Status not `done` and `end > ship`. Warning style when above zero. |

**Progress by stage:** one row per stage with the stage chip, name, a stacked bar (done in purple `#731F60`, in progress in violet `#C6168D`, blocked in bronze `#A36B37`, remainder grey), and "d/n done · first start to last end". Show "No tasks" for empty stages.

**Needs attention:** for each task that is not done, in stage order:
- Overdue: tag "Overdue", detail "was due {end}".
- Else Blocked: tag "Blocked", detail is the date range.
- Else due today (`end == today`): tag "Due today".
- Else status `todo` and `start < today`: tag "Not started", detail "should have started {start}".
- Additionally, any not-done task with `end > ship`: tag "After ship date", detail "ends {end}".
If none: "Nothing overdue, blocked or due today."

**Gantt chart:**
- Window: first column is the earliest task start (or today if today is before that and within 3 days). Last column is the later of the latest task end and the ship date, plus one day.
- One column per day. Header has a month band and weekday initial plus date number. Weekends shaded. Today's column highlighted in gold. The ship date column has a dashed purple right edge and a "Ship out" flag.
- Rows grouped by stage with a group header (chip, name, "x/y done"). One row per task: title (opens the edit dialog) with a subline "owner or Unassigned · date range", and a bar from start to end inclusive.
- Bar colour by status: done purple, in progress violet, not started light pink with violet border, blocked bronze with dark text. A gold outline marks bars that are overdue or end after the ship date. Show the status text inside the bar when it spans 2+ days.
- Legend below the chart. Empty state: "No tasks yet. Add the first one on the Tasks tab."

### 6.3 Tasks tab

- Toolbar: "Add task" (primary), Stage filter, Status filter, checkboxes "On daily summary only" and "Hide done".
- Table grouped by stage, sorted by stage order, then start, end, title. Columns: Done (checkbox), Task (title and notes), Dates (range, plus an "Overdue" pill when overdue), Owner, Status (select), Daily (checkbox), Edit button.
- Checking Done sets status `done` and `doneAt = today`. Unchecking sets status `doing` and clears `doneAt`. Changing the status select applies the same `doneAt` rule.
- Empty states: "No tasks yet. Use "Add task" to create the first one." and "No tasks match these filters."

### 6.4 Task dialog (add and edit)

Fields: Task (text), Stage, Status, Start, End, Owner, Notes (textarea), checkbox "Include on the daily summary". Buttons: Delete (edit mode only, asks "Delete this task?"), Cancel, Save.

Defaults for a new task: start and end are today, stage is the active stage filter or 3A, status Not started, daily checked.

Validation messages, shown inline: "Give the task a name.", "Set a start and an end date.", "The end date is before the start date." Viewers get the dialog read-only with no Save or Delete.

### 6.5 Daily goals tab

Toolbar: Previous, date input, Next, Today, then "Print daily sheet" and "Download sheet (HTML)". A line under the toolbar reads "Tap a box to tick a goal off. Changes save automatically." (viewers: "View only. You can read this sheet but not tick goals off.")

The sheet for date **D**:

1. Header: eyebrow "Serenity Power · Ship-out readiness · Global Controls, Calgary", title "Daily goals", long date (e.g. "Tuesday 20 October 2026"). Right side: big number of days from D to the ship date with the caption "days to ship-out" and "Target Wed 28 Oct". On the ship date show "Ship day", after it "Shipped".
2. Four stage tiles: chip, name, "d/n done", mini progress bar (overall, not specific to D).
3. Sections, only the first two content sections are always considered:
   - **Carried over, not yet done:** tasks with `daily` true, `end < D`, status not `done`. Hidden when empty.
   - **Goals for today:** tasks with `daily` true and `start <= D <= end`, and either status not `done` or `doneAt == D` (so something ticked today stays visible with a check). Empty message: "No tasks are flagged for today. Tick "Include on the daily summary" on a task to add it."
   - **Starting tomorrow:** `daily` true, `start == D + 1`, not done. Hidden when empty.
   - **Completed yesterday:** any task with status `done` and `doneAt == D - 1`. Hidden when empty.
   - Sort within sections by stage order, start, end, title.
4. Each goal row: checkbox, stage chip, title, notes line, and on the right the owner (if any), "Blocked" label (if blocked) and date range. Done rows show a filled box with a gold check and a struck-through title.
5. **Notes and blockers:** a text box for date D, 5 rows, max 2000 characters, placeholder "Type notes and blockers for {d mon}. They save with the sheet and appear in the downloaded file." Saves as the user types (debounced). In print and in the downloaded file the notes appear as plain text in a left gold-bordered block. If empty, print and the download show four blank ruled lines for handwriting.
6. Footer: left "Serenity Power / Ship-out readiness / {d mon}". Right "Prepared by" and the Lydium logo.

Tapping a checkbox on the live sheet toggles the task between done and in progress, with the same `doneAt` rules, and saves immediately. Space or Enter on a focused box does the same.

## 7. Printing and downloads

**Print** uses `window.print()` with a body class that hides everything except the target view, plus an injected `@page` rule:
- Daily sheet: Letter, portrait, 12 mm margins. A normal day must fit on one page. Browser print colours must be preserved (`print-color-adjust: exact`). The notes textarea is hidden in print and replaced by the notes text block.
- Schedule: Letter, landscape, 10 mm margins. Show the header, KPIs, stage progress, attention list and gantt. Hide tabs and buttons.

**Download sheet (HTML)** produces one self-contained `.html` file named `Serenity_daily_goals_{date}.html`:
- All CSS inline, logo embedded as a base64 data URI, no external requests except optional web fonts (fall back to Arial).
- Responsive and readable on a phone.
- Checkboxes in the file are tappable. A tick toggles the box, strikes the title, and is remembered in that browser using `localStorage` under the key `lydium-sheet-{date}` (a map of task id to boolean). The file starts with the state at download time and overlays any stored ticks. Ticks in a downloaded file stay on that device and do not sync to the app. The file carries a line "Tap a box to tick a goal off. Ticks are remembered in this browser on this device." that is hidden when printing.
- Notes render as plain text (no text box). No other scripts.
- Keyboard accessible: `role="checkbox"`, `tabindex="0"`, `aria-checked`, Space and Enter toggle.

**Download schedule (HTML)** produces `Serenity_shipout_schedule_{date}.html`: static, no scripts, with the header (including a read-only target ship date), KPIs, stage progress, needs-attention list and gantt as of today.

**Backups:** "Export backup" downloads `Serenity_shipout_tracker_backup_{date}.json`. "Import backup" opens a file picker, validates as in section 4, confirms, then replaces data.

Use normal browser downloads (Blob plus an anchor with `download`). The prototype used a sandbox download API; do not carry that over.

## 8. Mobile (screens 760 px wide and below)

- Open on the **Daily goals** tab unless the URL hash says otherwise.
- Compact header: hide the subtitle, the ship date box and the header logo. Show only the eyebrow, title and sync label.
- Tabs fill the width with short labels: Schedule, Tasks, Daily. Hide the top Export and Import buttons and show them in a bar at the very bottom of the page instead.
- Hide "Print daily sheet" (keep Download sheet, date controls, Previous, Next, Today).
- Goal rows become a two-column grid: a 44 px column holding a 28 px checkbox (with at least 44 by 44 px touch target), then the title at 16 px, the notes line, and the date range under it.
- Stage tiles become a compact four-across row showing chip and "d/n done".
- The gantt uses a 150 px label column and scrolls horizontally if needed. The task dialog is a single column.
- No horizontal scroll on the Daily tab at 390 px wide.

## 9. Visual design and brand

Lydium brand, used on a client-facing page. Follow the Lydium graphics guide.

**Colours (use only these and tints of them):** Purple `#731F60`, Violet `#C6168D`, Gold `#FDB913`, Bronze `#A36B37`. Greys: `#4D4D4A`, `#74736E`, `#9B9892`, `#C0BDBA`. Text on purple: white or gold. Text on gold: black or purple. Text on bronze: black. Text on violet: white. Normal text must meet WCAG AA (4.5:1).

**Type:** Source Sans Pro (Google Fonts "Source Sans 3" is acceptable), fallback Arial. Sentence case in the UI, small caps eyebrows for section labels. Dates written like "16 Oct" and ranges with an en dash ("16 – 17 Oct"). Do not use em dashes anywhere in UI copy.

**Layout:** white page on a light grey background, max width 1240 px, purple header band, flat style, no gradients or shadows on controls. Status styling as in section 6.2.

**Logo:** use `assets/lydium-logo-colour.png`. Guide minimum for the horizontal logo is **108 px wide** on screen. Keep clear space of at least the logo's letter height on all sides. Do not recolour, stretch, outline or add effects. On the purple header it sits on a small white plate. Note: the prototype shows it at 96 px in the header and 90 px on the sheet footer, which is below the guide minimum. Use 108 px or larger in the real build.

Reference for exact CSS values: the `CSS` constant in `reference/tracker-reference.html`.

## 10. Behaviours and edge cases

- Today is the browser's local date. Compute day differences with date-only arithmetic to avoid DST errors (the prototype pins dates to local noon).
- Moving the ship date earlier than some task end dates flags those tasks under "After ship date".
- Deleting or editing a task updates the dashboard, tasks table and sheet immediately.
- A task ticked done on a past date's sheet gets `doneAt` of the real today, so it disappears from that past sheet. This matches the prototype.
- If a sync update arrives while the notes box is focused or the dialog is open, do not re-render that region.
- Escape all user text when rendering (task titles, notes, owners). Never use `innerHTML` with unescaped input.
- Long titles wrap; never truncate on the daily sheet.
- Keyboard: all controls reachable, visible gold focus ring, dialog traps focus and closes on Escape.

## 11. Acceptance checks

1. Fresh start with `data/tracker-state.json` imported shows 19 tasks, ship date 28 Oct 2026, 0 done, KPIs consistent with the data.
2. Add a task in Stage 4 from 22 to 24 Oct with "daily" checked. It appears in the Tasks table, the gantt, and on the 22, 23 and 24 Oct sheets.
3. Untick "daily" on that task. It disappears from the sheets but stays on the gantt.
4. Tick a task on today's sheet. The box fills with a check, the title is struck through, the KPI "Tasks done" increments, and after a reload from another device the tick is still there.
5. Set a task's end date before its start date. Save is blocked with the message in 6.4.
6. Set one task's end date after the ship date. The tile "Scheduled after ship date" shows 1, the task has a gold outline, and it is listed under Needs attention.
7. A viewer login cannot change anything: write requests return 403, boxes and inputs are disabled, notes are read-only.
8. Type a note on a day's sheet, switch to another day and back. The note is still there. Reload. Still there.
9. Download the daily sheet. Open the file on a phone browser with no network access: the logo and styling show, notes appear as text, tapping a box toggles it, and the tick is still there after closing and reopening the file.
10. Print the daily sheet in Chrome to PDF at Letter: one page for a day with up to about 12 goals; notes appear as text; blank ruled lines appear when notes are empty. No buttons, tabs or text box borders in the PDF.
11. Phone at 390 px wide opens on Daily goals, no horizontal scroll, boxes are comfortably tappable, Export and Import are at the bottom.
12. Export a backup, delete all tasks, import the backup. Everything returns, including day notes.
13. Two editors tick different tasks at the same time. Neither tick is lost.
14. On Azure: run `az webapp restart`, then reload. All tasks, notes and the ship date are still there.
15. Unauthenticated requests to `/api/state` return 401; the login page rejects a wrong passcode with a clear message; after 5 failed attempts in a minute further attempts are blocked; the session cookie is `HttpOnly` and `Secure`.
16. Requesting the site over plain HTTP redirects to HTTPS. `/healthz` returns 200 without signing in.
17. The app works with `STORE=file` locally with no Azure account, and with `STORE=table` in Azure, with no code changes outside the adapter.

## 12. Milestones for the build

1. Repo scaffold, `Store` interface with the file adapter for local dev, passcode login (section 3.1), `GET /api/state`, seed import from `data/tracker-state.json`.
2. Task CRUD API and the Tasks tab with the dialog and validation.
3. Schedule dashboard: KPIs, stage progress, attention list, gantt.
4. Daily goals sheet and day notes with save-as-you-type.
5. Print styles for the daily sheet and the schedule.
6. HTML downloads (tickable daily sheet, static schedule) and JSON backup and import.
7. Mobile layout pass at 390 px, then accessibility pass (focus, contrast, ARIA on custom checkboxes).
8. Table Storage adapter with managed identity, polling sync, per-record concurrency, deploy to Azure App Service (section 2.3), then run section 11 end to end against the deployed site.

## 13. Out of scope for v1

Multiple projects, individual user accounts beyond Mode 2, per-user audit trail, email or SMS reminders, task dependencies, file attachments, editing the four stages in the UI.
