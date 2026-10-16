import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes, checkAuthConfig, getRole, requireRole } from './auth.js';
import { createStore } from './store/index.js';
import { ConflictError, NOTE_MAX, NotFoundError, ValidationError, isDate, normalizeBackup, validateTask } from './model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

checkAuthConfig();
const store = createStore();
await store.init();

// First start with an empty store: load the seed dataset.
if (await store.isEmpty()) {
  const seed = path.join(ROOT, 'data', 'tracker-state.json');
  if (fs.existsSync(seed)) {
    const b = normalizeBackup(JSON.parse(fs.readFileSync(seed, 'utf8')));
    await store.importAll(b);
    console.log(`Empty store: imported ${b.tasks.length} tasks from data/tracker-state.json`);
  }
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cookieParser());
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join('; '),
  });
  next();
});

app.get('/healthz', (_req, res) => { res.status(200).send('ok'); });

// Public: login page and brand assets.
const PUBLIC = path.join(ROOT, 'public');
app.get('/login', (req, res) => {
  if (getRole(req)) { res.redirect('/'); return; }
  res.sendFile(path.join(PUBLIC, 'login.html'));
});
app.get('/login.js', (_req, res) => { res.sendFile(path.join(PUBLIC, 'login.js')); });
app.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '1d' }));
authRoutes(app);

// Everything below needs a session.
const api = express.Router();
api.use(express.json({ limit: '1mb' }));
api.use(requireRole('viewer'));
const editor = requireRole('editor');

const wrap = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

api.get('/state', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ...(await store.getState()), role: getRole(req) });
}));

api.post('/tasks', editor, wrap(async (req, res) => {
  res.status(201).json(await store.createTask(validateTask(req.body)));
}));

api.put('/tasks/:id', editor, wrap(async (req, res) => {
  const ifMatch = typeof req.body?.updatedAt === 'string' ? req.body.updatedAt : undefined;
  res.json(await store.updateTask(String(req.params.id), validateTask(req.body), ifMatch));
}));

api.delete('/tasks/:id', editor, wrap(async (req, res) => {
  await store.deleteTask(String(req.params.id));
  res.json({ ok: true });
}));

api.put('/notes/:date', editor, wrap(async (req, res) => {
  const date = String(req.params.date);
  if (!isDate(date)) throw new ValidationError('Invalid date.');
  const text = String(req.body?.text ?? '');
  if (text.length > NOTE_MAX) throw new ValidationError(`Notes are limited to ${NOTE_MAX} characters.`);
  await store.setNote(date, text);
  res.json({ date, text: text.trim() ? text : '' });
}));

api.put('/settings', editor, wrap(async (req, res) => {
  if (!isDate(req.body?.ship)) throw new ValidationError('Invalid ship date.');
  await store.setShip(req.body.ship);
  res.json({ ship: req.body.ship });
}));

api.get('/export', wrap(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await store.exportAll());
}));

api.post('/import', editor, wrap(async (req, res) => {
  const b = normalizeBackup(req.body);
  await store.importAll(b);
  res.json({ ok: true, tasks: b.tasks.length });
}));

app.use('/api', api);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });

// The app shell: signed-in users only, otherwise send them to the login page.
app.use((req, res, next) => {
  if (getRole(req)) { next(); return; }
  if (req.method === 'GET' && req.accepts('html')) { res.redirect('/login'); return; }
  res.status(401).json({ error: 'Sign in required' });
});
app.use(express.static(PUBLIC, { index: 'index.html' }));

app.use(((err, _req, res, _next) => {
  if (err instanceof ValidationError) { res.status(400).json({ error: err.message }); return; }
  if (err instanceof ConflictError) { res.status(409).json({ error: err.message }); return; }
  if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON' }); return; }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
}) as express.ErrorRequestHandler);

const port = Number(process.env.PORT) || 5190;
app.listen(port, err => {
  if (err) { console.error(`Could not listen on port ${port}: ${err.message}`); process.exit(1); }
  console.log(`Ship-out tracker on http://localhost:${port} (STORE=${process.env.STORE || 'file'})`);
});
