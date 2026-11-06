// Shared helpers: responses, validation, crypto primitives.

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const now = () => Math.floor(Date.now() / 1000);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export async function readJson(request, maxBytes = 32_768) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'unsupported_media_type');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'payload_too_large');
  try {
    const body = JSON.parse(text || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

// ── validation ──────────────────────────────────────────────────────────
export function str(v, { min = 0, max = 200, pattern, field = 'field', optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return '';
    throw new HttpError(422, 'validation', `${field} is required`, { field });
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(422, 'validation', `${field} is invalid`, { field });
  const s = String(v).trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (s.length < min || s.length > max) throw new HttpError(422, 'validation', `${field} length is invalid`, { field });
  if (pattern && !new RegExp(pattern).test(s)) throw new HttpError(422, 'validation', `${field} format is invalid`, { field });
  return s;
}

export function oneOf(v, list, field = 'field') {
  if (!list.includes(v)) throw new HttpError(422, 'validation', `${field} is invalid`, { field });
  return v;
}

export function normPhone(v) {
  // Accepts 07XXXXXXXX, 937XXXXXXXX, +937XXXXXXXX and international +XXXXXXXXXXX; returns E.164.
  let s = String(v || '').replace(/[\s()-]/g, '');
  s = toLatinDigits(s);
  if (/^07\d{8}$/.test(s)) s = '+93' + s.slice(1);
  else if (/^937\d{8}$/.test(s)) s = '+' + s;
  else if (/^00\d{8,15}$/.test(s)) s = '+' + s.slice(2);
  if (!/^\+\d{9,15}$/.test(s)) throw new HttpError(422, 'validation', 'phone format is invalid', { field: 'phone' });
  return s;
}

export function toLatinDigits(s) {
  return String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

export function password(v) {
  const s = typeof v === 'string' ? v : '';
  if (s.length < 10 || s.length > 128) throw new HttpError(422, 'weak_password', 'password must be 10–128 characters', { field: 'password' });
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new HttpError(422, 'weak_password', 'password needs letters and numbers', { field: 'password' });
  return s;
}

// Money: "1,250.50" → 125050 (minor units)
export function amountToMinor(v, field = 'amount') {
  const s = toLatinDigits(String(v ?? '')).replace(/[,\s]/g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) throw new HttpError(422, 'validation', `${field} is invalid`, { field });
  const [i, f = ''] = s.split('.');
  return Number(i) * 100 + Number((f + '00').slice(0, 2));
}

export const normRef = (s) => toLatinDigits(String(s || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── ids & randomness ────────────────────────────────────────────────────
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function randomCode(len, alphabet = ALNUM) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
export const randomDigits = (len) => randomCode(len, '0123456789');
export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}
export function trackingNo() {
  const d = new Date();
  const yymm = String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, '0');
  return `RP-${yymm}-${randomCode(6)}`;
}

// ── crypto ──────────────────────────────────────────────────────────────
const enc = new TextEncoder();
export function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256(input) {
  const data = typeof input === 'string' ? enc.encode(input) : input;
  return hex(await crypto.subtle.digest('SHA-256', data));
}
export async function hashPassword(pw, saltHex) {
  const salt = saltHex || hex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    key,
    256,
  );
  return { hash: hex(bits), salt };
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ── TOTP (RFC 6238, SHA-1, 30 s, 6 digits) for staff two-factor authentication ──
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}
export async function verifyTotp(secret, code, window = 1) {
  const c = toLatinDigits(String(code || '')).replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(Date.now() / 30_000);
  for (let w = -window; w <= window; w++) if (safeEqual(await hotp(secret, step + w), c)) return true;
  return false;
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
}

export function parseJsonSafe(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}
