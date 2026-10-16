// Mode 1: shared passcodes (SPEC.md section 3.1).
// getRole(req) is the single place that decides the role, so Mode 2 (App Service
// Authentication with Entra ID) can replace it later.

import crypto from 'node:crypto';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export type Role = 'editor' | 'viewer';

const TTL_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'sid';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to 32 or more random characters');
  return s;
}

const mac = (body: string) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');
const sign = (role: Role) => { const body = `${role}.${Date.now() + TTL_MS}`; return `${body}.${mac(body)}`; };

function verify(cookie?: string): Role | null {
  if (!cookie) return null;
  const [role, exp, sig] = cookie.split('.');
  if (!sig) return null;
  const expected = mac(`${role}.${exp}`);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return role === 'editor' || role === 'viewer' ? role : null;
}

const same = (a: string, b: string) => {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

export function checkAuthConfig() {
  secret();
  for (const k of ['EDITOR_TOKEN', 'VIEWER_TOKEN']) {
    const v = process.env[k] ?? '';
    if (v.length < 16) throw new Error(`${k} must be set to 16 or more random characters`);
  }
  if (process.env.EDITOR_TOKEN === process.env.VIEWER_TOKEN) throw new Error('EDITOR_TOKEN and VIEWER_TOKEN must differ');
}

export const getRole = (req: express.Request): Role | null => verify(req.cookies?.[COOKIE]);

export const requireRole = (min: Role): express.RequestHandler => (req, res, next) => {
  const r = getRole(req);
  if (!r) { res.status(401).json({ error: 'Sign in required' }); return; }
  if (min === 'editor' && r !== 'editor') { res.status(403).json({ error: 'Editor access required' }); return; }
  next();
};

/**
 * Client IP without a port. App Service's front end puts "ip:port" in X-Forwarded-For,
 * which would give every attempt a fresh rate-limit key.
 */
export function clientIp(req: express.Request) {
  const ip = req.ip || req.socket.remoteAddress || '';
  const v6 = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (v6) return v6[1];
  const v4 = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  return v4 ? v4[1] : ip;
}

export function authRoutes(app: express.Express) {
  // Five failed attempts per minute per client, then blocked until the window resets.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: req => ipKeyGenerator(clientIp(req)),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Wait a minute and try again.' },
  });

  app.post('/login', limiter, express.json({ limit: '2kb' }), (req, res) => {
    const p = String(req.body?.passcode ?? '');
    const role: Role | null = same(p, process.env.EDITOR_TOKEN ?? '') ? 'editor' : same(p, process.env.VIEWER_TOKEN ?? '') ? 'viewer' : null;
    if (!role) { res.status(401).json({ error: 'Incorrect passcode' }); return; }
    // Secure follows the request: true behind App Service HTTPS (trust proxy is set), false on http://localhost.
    res.cookie(COOKIE, sign(role), { httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: TTL_MS });
    res.json({ role });
  });

  app.post('/logout', (_req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });
}
