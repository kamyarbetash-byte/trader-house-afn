// Sessions, role checks, rate limiting and audit logging.
import { HttpError, now, randomToken, sha256, clientIp } from './util.js';

const CUSTOMER_COOKIE = 'rp_session';
const STAFF_COOKIE = 'rp_staff';
const CUSTOMER_TTL = 60 * 60 * 24 * 7; // 7 days
const STAFF_TTL = 60 * 60 * 8;          // 8 hours (one shift)
const STAFF_PRE2FA_TTL = 60 * 5;        // password ok, waiting for TOTP

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function cookie(name, value, maxAge, path) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export async function createSession(env, request, userId, kind) {
  const token = randomToken();
  const ttl = kind === 'customer' ? CUSTOMER_TTL : kind === 'staff' ? STAFF_TTL : STAFF_PRE2FA_TTL;
  const t = now();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at, ip, ua) VALUES (?,?,?,?,?,?,?)',
  ).bind(await sha256(token), userId, kind, t, t + ttl, clientIp(request), (request.headers.get('user-agent') || '').slice(0, 200)).run();
  const name = kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE;
  const path = kind === 'customer' ? '/' : '/api/admin';
  return cookie(name, token, ttl, path);
}

export async function destroySession(env, request, kind) {
  const name = kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE;
  const token = readCookie(request, name);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return cookie(name, '', 0, kind === 'customer' ? '/' : '/api/admin');
}

async function loadSession(env, request, cookieName, kinds) {
  const token = readCookie(request, cookieName);
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(
    `SELECT s.kind, s.expires_at, s.token_hash, u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), now()).first();
  if (!row || !kinds.includes(row.kind) || row.status !== 'active') return null;
  return row;
}

export async function currentCustomer(env, request) {
  return loadSession(env, request, CUSTOMER_COOKIE, ['customer']);
}

export async function requireCustomer(env, request) {
  const u = await currentCustomer(env, request);
  if (!u || u.role !== 'customer') throw new HttpError(401, 'unauthenticated');
  return u;
}

/** Staff session waiting for the TOTP step (password already checked). */
export async function pendingStaff(env, request) {
  return loadSession(env, request, STAFF_COOKIE, ['staff_2fa']);
}

/** Fully authenticated staff (password + TOTP). `roles` limits which staff roles may call. */
export async function requireStaff(env, request, roles = ['operator', 'admin']) {
  const u = await loadSession(env, request, STAFF_COOKIE, ['staff']);
  if (!u) throw new HttpError(401, 'unauthenticated');
  if (!roles.includes(u.role)) throw new HttpError(403, 'forbidden');
  return u;
}

// Fixed-window rate limit stored in D1. Throws 429 when exceeded.
export async function rateLimit(env, bucket, limit, windowSec) {
  const t = now();
  const row = await env.DB.prepare('SELECT count, reset_at FROM rate_limits WHERE bucket = ?').bind(bucket).first();
  if (!row || row.reset_at <= t) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (bucket, count, reset_at) VALUES (?, 1, ?)').bind(bucket, t + windowSec).run();
    return;
  }
  if (row.count >= limit) throw new HttpError(429, 'rate_limited', 'too many attempts, try again later', { retry_after: row.reset_at - t });
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?').bind(bucket).run();
}

export async function audit(env, request, actor, action, targetType, targetId, detail = {}) {
  await env.DB.prepare(
    'INSERT INTO audit_log (actor_id, actor_role, action, target_type, target_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?,?)',
  ).bind(
    actor?.id || null,
    actor?.role || 'system',
    action,
    targetType || null,
    targetId == null ? null : String(targetId),
    JSON.stringify(detail),
    request ? clientIp(request) : null,
    now(),
  ).run();
}

export function publicUser(u) {
  return {
    id: u.id,
    role: u.role,
    full_name: u.full_name,
    phone: u.phone,
    email: u.email,
    phone_verified: !!u.phone_verified,
    lang: u.lang,
    telegram_linked: !!u.telegram_chat,
    notify_telegram: !!u.notify_telegram,
    notify_email: !!u.notify_email,
    totp_enabled: !!u.totp_enabled,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}
