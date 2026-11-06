// Public + customer API: auth, catalog, requests, payments, notifications, profile, support.
import {
  HttpError, json, readJson, str, oneOf, normPhone, password, amountToMinor, normRef, now,
  randomCode, randomDigits, trackingNo, sha256, hashPassword, safeEqual, clientIp, parseJsonSafe,
} from '../lib/util.js';
import {
  createSession, destroySession, currentCustomer, requireCustomer, rateLimit, audit, publicUser,
} from '../lib/auth.js';
import { notifyUser, notifyStatus, alertOperators } from '../lib/notify.js';

const OTP_TTL = 10 * 60;
const MAX_FILE = 5 * 1024 * 1024;
const MAX_FILE_D1 = 2 * 1024 * 1024;
const FILE_TYPES = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'application/pdf': [0x25, 0x50] };

export async function settingsMap(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

// ── OTP (phone verification / password reset) ───────────────────────────
async function issueOtp(env, phone, purpose) {
  const code = randomDigits(6);
  await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE phone = ? AND purpose = ? AND used = 0').bind(phone, purpose).run();
  await env.DB.prepare('INSERT INTO otp_codes (phone, purpose, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)')
    .bind(phone, purpose, await sha256(`${phone}:${code}`), now() + OTP_TTL, now()).run();
  // Production: send `code` through an SMS provider here. In demo mode it is returned to the screen.
  return env.DEMO_MODE === 'true' ? { demo_code: code } : {};
}

async function checkOtp(env, phone, purpose, code) {
  const row = await env.DB.prepare(
    'SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1',
  ).bind(phone, purpose, now()).first();
  if (!row || row.attempts >= 5) throw new HttpError(400, 'otp_invalid');
  const ok = safeEqual(row.code_hash, await sha256(`${phone}:${String(code || '').trim()}`));
  if (!ok) {
    await env.DB.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    throw new HttpError(400, 'otp_invalid');
  }
  await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(row.id).run();
}

// ── helpers ─────────────────────────────────────────────────────────────
function serviceOut(s) {
  return { ...s, fields: parseJsonSafe(s.fields, []), currencies: s.currencies.split(','), requires_receipt: !!s.requires_receipt, requires_payment: !!s.requires_payment };
}
function methodOut(m) {
  const { ref_pattern, ...rest } = m;
  return { ...rest, ref_pattern, currencies: m.currencies.split(',') };
}
export function requestOut(r) {
  return {
    tracking_no: r.tracking_no,
    service_id: r.service_id,
    service_en: r.service_en,
    service_fa: r.service_fa,
    amount: r.amount,
    currency: r.currency,
    details: parseJsonSafe(r.details, {}),
    payment_method_id: r.payment_method_id,
    method_en: r.method_en,
    method_fa: r.method_fa,
    payment_ref: r.payment_ref,
    has_receipt: !!r.receipt_file_id,
    receipt_file_id: r.receipt_file_id,
    customer_note: r.customer_note,
    status: r.status,
    reject_reason: r.reject_reason,
    is_demo: !!r.is_demo,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
const REQ_SELECT = `SELECT r.*, s.name_en AS service_en, s.name_fa AS service_fa, m.name_en AS method_en, m.name_fa AS method_fa
  FROM requests r JOIN services s ON s.id = r.service_id LEFT JOIN payment_methods m ON m.id = r.payment_method_id`;

async function newCustomerId(env) {
  for (let i = 0; i < 5; i++) {
    const id = `C-${randomCode(6)}`;
    if (!(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first())) return id;
  }
  throw new HttpError(500, 'id_generation_failed');
}

// ── router ──────────────────────────────────────────────────────────────
export async function handleCustomer(request, env, ctx, path) {
  const m = request.method;
  const ip = clientIp(request);

  // Public configuration (no auth)
  if (path === '/api/config' && m === 'GET') {
    const s = await settingsMap(env);
    return json({
      demo_mode: env.DEMO_MODE === 'true',
      support_hours_en: s.support_hours_en, support_hours_fa: s.support_hours_fa,
      support_email: s.support_email, telegram_bot: s.telegram_bot_username || null,
      maintenance: s.maintenance === '1', submissions_open: s.submissions_open !== '0',
    });
  }

  if (path === '/api/catalog' && m === 'GET') {
    const cats = (await env.DB.prepare('SELECT * FROM service_categories ORDER BY sort').all()).results;
    const services = (await env.DB.prepare("SELECT * FROM services WHERE status != 'disabled' ORDER BY sort").all()).results.map(serviceOut);
    const methods = (await env.DB.prepare('SELECT * FROM payment_methods ORDER BY sort').all()).results.map(methodOut);
    return json({ categories: cats, services, payment_methods: methods });
  }

  // ── registration & login ──
  if (path === '/api/auth/register' && m === 'POST') {
    await rateLimit(env, `reg:${ip}`, 5, 3600);
    const b = await readJson(request);
    const full_name = str(b.full_name, { min: 3, max: 80, field: 'full_name' });
    const phone = normPhone(b.phone);
    const pw = password(b.password);
    const lang = b.lang === 'fa' ? 'fa' : 'en';
    if (b.accept_terms !== true) throw new HttpError(422, 'validation', 'terms must be accepted', { field: 'accept_terms' });
    const existing = await env.DB.prepare('SELECT id, phone_verified FROM users WHERE phone = ?').bind(phone).first();
    if (existing?.phone_verified) throw new HttpError(409, 'phone_taken');
    const { hash, salt } = await hashPassword(pw);
    const t = now();
    if (existing) {
      // unverified registration: allow re-registering the same number
      await env.DB.prepare('UPDATE users SET full_name = ?, pass_hash = ?, pass_salt = ?, lang = ? WHERE id = ?').bind(full_name, hash, salt, lang, existing.id).run();
    } else {
      const id = await newCustomerId(env);
      await env.DB.prepare('INSERT INTO users (id, role, full_name, phone, pass_hash, pass_salt, lang, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, 'customer', full_name, phone, hash, salt, lang, t).run();
    }
    await rateLimit(env, `otp:${phone}`, 5, 3600);
    return json({ ok: true, phone, ...(await issueOtp(env, phone, 'verify')) });
  }

  if (path === '/api/auth/resend' && m === 'POST') {
    const b = await readJson(request);
    const phone = normPhone(b.phone);
    const purpose = oneOf(b.purpose || 'verify', ['verify', 'reset'], 'purpose');
    await rateLimit(env, `otp:${phone}`, 5, 3600);
    const user = await env.DB.prepare("SELECT id FROM users WHERE phone = ? AND role = 'customer'").bind(phone).first();
    // Same answer whether or not the number exists (no account enumeration).
    if (!user) return json({ ok: true });
    return json({ ok: true, ...(await issueOtp(env, phone, purpose)) });
  }

  if (path === '/api/auth/verify-phone' && m === 'POST') {
    await rateLimit(env, `verify:${ip}`, 20, 3600);
    const b = await readJson(request);
    const phone = normPhone(b.phone);
    await checkOtp(env, phone, 'verify', b.code);
    const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ? AND role = 'customer'").bind(phone).first();
    if (!user) throw new HttpError(400, 'otp_invalid');
    await env.DB.prepare('UPDATE users SET phone_verified = 1, last_login_at = ? WHERE id = ?').bind(now(), user.id).run();
    await audit(env, request, user, 'customer.registered', 'user', user.id);
    await notifyUser(env, ctx, user, {
      kind: 'welcome', title_en: 'Welcome to Rahbar Pay', title_fa: 'به رهبر پی خوش آمدید',
      body_en: `Your customer ID is ${user.id}. Keep it for support requests.`,
      body_fa: `شناسه مشتری شما ${user.id} است. آن را برای درخواست‌های پشتیبانی نگه دارید.`,
    });
    const setCookie = await createSession(env, request, user.id, 'customer');
    return json({ ok: true, user: publicUser({ ...user, phone_verified: 1 }) }, 200, { 'set-cookie': setCookie });
  }

  if (path === '/api/auth/login' && m === 'POST') {
    await rateLimit(env, `login:${ip}`, 20, 900);
    const b = await readJson(request);
    const phone = normPhone(b.phone);
    const pw = typeof b.password === 'string' ? b.password : '';
    const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ? AND role = 'customer'").bind(phone).first();
    if (user && user.locked_until > now()) throw new HttpError(423, 'locked', 'account temporarily locked', { retry_after: user.locked_until - now() });
    const { hash } = await hashPassword(pw, user?.pass_salt || '00000000000000000000000000000000');
    if (!user || !safeEqual(hash, user.pass_hash)) {
      if (user) {
        const fails = user.failed_logins + 1;
        await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
          .bind(fails >= 5 ? 0 : fails, fails >= 5 ? now() + 900 : 0, user.id).run();
      }
      throw new HttpError(401, 'bad_credentials');
    }
    if (user.status !== 'active') throw new HttpError(403, 'suspended');
    if (!user.phone_verified) {
      await rateLimit(env, `otp:${phone}`, 5, 3600);
      return json({ ok: false, needs_verification: true, phone, ...(await issueOtp(env, phone, 'verify')) });
    }
    await env.DB.prepare('UPDATE users SET failed_logins = 0, last_login_at = ? WHERE id = ?').bind(now(), user.id).run();
    const setCookie = await createSession(env, request, user.id, 'customer');
    return json({ ok: true, user: publicUser(user) }, 200, { 'set-cookie': setCookie });
  }

  if (path === '/api/auth/logout' && m === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': await destroySession(env, request, 'customer') });
  }

  if (path === '/api/auth/forgot' && m === 'POST') {
    await rateLimit(env, `forgot:${ip}`, 5, 3600);
    const b = await readJson(request);
    const phone = normPhone(b.phone);
    const user = await env.DB.prepare("SELECT id FROM users WHERE phone = ? AND role = 'customer'").bind(phone).first();
    if (!user) return json({ ok: true });
    await rateLimit(env, `otp:${phone}`, 5, 3600);
    return json({ ok: true, ...(await issueOtp(env, phone, 'reset')) });
  }

  if (path === '/api/auth/reset' && m === 'POST') {
    await rateLimit(env, `reset:${ip}`, 10, 3600);
    const b = await readJson(request);
    const phone = normPhone(b.phone);
    const pw = password(b.password);
    await checkOtp(env, phone, 'reset', b.code);
    const user = await env.DB.prepare("SELECT * FROM users WHERE phone = ? AND role = 'customer'").bind(phone).first();
    if (!user) throw new HttpError(400, 'otp_invalid');
    const { hash, salt } = await hashPassword(pw);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, failed_logins = 0, locked_until = 0, phone_verified = 1 WHERE id = ?').bind(hash, salt, user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    ]);
    await audit(env, request, user, 'customer.password_reset', 'user', user.id);
    return json({ ok: true });
  }

  if (path === '/api/me' && m === 'GET') {
    const u = await currentCustomer(env, request);
    if (!u || u.role !== 'customer') return json({ user: null });
    return json({ user: publicUser(u) });
  }

  // ── everything below requires a signed-in customer ──
  const user = await requireCustomer(env, request);

  if (path === '/api/me' && m === 'PATCH') {
    const b = await readJson(request);
    const full_name = b.full_name !== undefined ? str(b.full_name, { min: 3, max: 80, field: 'full_name' }) : user.full_name;
    const lang = b.lang === 'fa' || b.lang === 'en' ? b.lang : user.lang;
    const nt = b.notify_telegram !== undefined ? (b.notify_telegram ? 1 : 0) : user.notify_telegram;
    const ne = b.notify_email !== undefined ? (b.notify_email ? 1 : 0) : user.notify_email;
    await env.DB.prepare('UPDATE users SET full_name = ?, lang = ?, notify_telegram = ?, notify_email = ? WHERE id = ?').bind(full_name, lang, nt, ne, user.id).run();
    return json({ ok: true, user: publicUser({ ...user, full_name, lang, notify_telegram: nt, notify_email: ne }) });
  }

  if (path === '/api/me/password' && m === 'POST') {
    await rateLimit(env, `pw:${user.id}`, 5, 3600);
    const b = await readJson(request);
    const { hash } = await hashPassword(String(b.current || ''), user.pass_salt);
    if (!safeEqual(hash, user.pass_hash)) throw new HttpError(401, 'bad_credentials');
    const next = await hashPassword(password(b.password));
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(next.hash, next.salt, user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, user.token_hash),
    ]);
    await audit(env, request, user, 'customer.password_changed', 'user', user.id);
    return json({ ok: true });
  }

  if (path === '/api/me/sessions' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT token_hash, created_at, expires_at, ip, ua FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 20')
      .bind(user.id, now()).all();
    return json({ sessions: results.map((s) => ({ id: s.token_hash.slice(0, 12), current: s.token_hash === user.token_hash, created_at: s.created_at, ip: s.ip, ua: s.ua })) });
  }

  if (path === '/api/me/sessions/revoke-others' && m === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, user.token_hash).run();
    await audit(env, request, user, 'customer.sessions_revoked', 'user', user.id);
    return json({ ok: true });
  }

  if (path === '/api/me/telegram-link' && m === 'POST') {
    const code = randomCode(8);
    await env.DB.prepare('UPDATE users SET telegram_link_code = ? WHERE id = ?').bind(code, user.id).run();
    const s = await settingsMap(env);
    return json({ code, bot: s.telegram_bot_username || null });
  }
  if (path === '/api/me/telegram-unlink' && m === 'POST') {
    await env.DB.prepare('UPDATE users SET telegram_chat = NULL, telegram_link_code = NULL WHERE id = ?').bind(user.id).run();
    return json({ ok: true });
  }

  // ── dashboard summary ──
  if (path === '/api/dashboard' && m === 'GET') {
    const counts = (await env.DB.prepare('SELECT status, COUNT(*) AS n FROM requests WHERE user_id = ? GROUP BY status').bind(user.id).all()).results;
    const recent = (await env.DB.prepare(`${REQ_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 5`).bind(user.id).all()).results.map(requestOut);
    const unread = await unreadCount(env, user);
    return json({ counts: Object.fromEntries(counts.map((c) => [c.status, c.n])), recent, unread });
  }

  // ── requests ──
  if (path === '/api/requests' && m === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').trim().toUpperCase();
    let sql = `${REQ_SELECT} WHERE r.user_id = ?`;
    const args = [user.id];
    if (status) { sql += ' AND r.status = ?'; args.push(status); }
    if (q) { sql += ' AND r.tracking_no LIKE ?'; args.push(`%${q}%`); }
    sql += ' ORDER BY r.created_at DESC LIMIT 200';
    return json({ requests: (await env.DB.prepare(sql).bind(...args).all()).results.map(requestOut) });
  }

  if (path === '/api/requests' && m === 'POST') {
    await rateLimit(env, `submit:${user.id}`, 20, 3600);
    const s = await settingsMap(env);
    if (s.submissions_open === '0' || s.maintenance === '1') throw new HttpError(503, 'submissions_closed');
    const b = await readJson(request);
    const service = await env.DB.prepare('SELECT * FROM services WHERE id = ?').bind(str(b.service_id, { max: 40, field: 'service_id' })).first();
    if (!service || service.status === 'disabled') throw new HttpError(422, 'validation', 'service is invalid', { field: 'service_id' });
    if (service.status === 'legal_pending') throw new HttpError(403, 'service_not_authorized');

    // service-specific details
    const details = {};
    for (const f of parseJsonSafe(service.fields, [])) {
      const v = b.details?.[f.key];
      if (f.type === 'select') {
        if (!v && !f.required) continue;
        details[f.key] = oneOf(v, f.options, f.key);
      } else {
        details[f.key] = str(v, { max: f.type === 'textarea' ? 1000 : 120, pattern: f.pattern, field: f.key, optional: !f.required });
      }
    }

    let amount = 0, currency = 'AFN', methodId = null, ref = '', refNorm = '', receiptId = null, duplicateOf = null;
    if (service.requires_payment) {
      currency = oneOf(b.currency, service.currencies.split(','), 'currency');
      amount = amountToMinor(b.amount);
      if (amount < service.min_amount || amount > service.max_amount) throw new HttpError(422, 'amount_out_of_range', 'amount is out of range', { field: 'amount', min: service.min_amount, max: service.max_amount });
      const method = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?').bind(str(b.payment_method_id, { max: 40, field: 'payment_method_id' })).first();
      if (!method || method.status === 'disabled' || !method.currencies.split(',').includes(currency)) throw new HttpError(422, 'validation', 'payment method is unavailable', { field: 'payment_method_id' });
      methodId = method.id;
      ref = str(b.payment_ref, { min: 6, max: 40, pattern: method.ref_pattern, field: 'payment_ref' });
      refNorm = normRef(ref);
      // Duplicate transaction detection: same provider + same reference on another request.
      const dup = await env.DB.prepare("SELECT tracking_no, user_id FROM requests WHERE payment_method_id = ? AND payment_ref_norm = ? AND status != 'rejected' ORDER BY (user_id = ?) DESC, id LIMIT 1")
        .bind(methodId, refNorm, user.id).first();
      if (dup) {
        if (dup.user_id === user.id) throw new HttpError(409, 'duplicate_reference', 'this payment reference is already used', { field: 'payment_ref', tracking_no: dup.tracking_no });
        duplicateOf = dup.tracking_no; // other customer: accept but flag for operators, don't reveal
      }
      if (b.receipt_file_id) {
        const f = await env.DB.prepare('SELECT id FROM files WHERE id = ? AND owner_id = ?').bind(String(b.receipt_file_id), user.id).first();
        if (!f) throw new HttpError(422, 'validation', 'receipt is invalid', { field: 'receipt' });
        receiptId = f.id;
      } else if (service.requires_receipt) {
        throw new HttpError(422, 'validation', 'receipt is required', { field: 'receipt' });
      }
    }
    const note = str(b.customer_note, { max: 500, optional: true, field: 'customer_note' });

    const t = now();
    let tracking;
    for (let i = 0; i < 5; i++) {
      tracking = trackingNo();
      if (!(await env.DB.prepare('SELECT 1 FROM requests WHERE tracking_no = ?').bind(tracking).first())) break;
    }
    const res = await env.DB.prepare(
      `INSERT INTO requests (tracking_no, user_id, service_id, amount, currency, details, payment_method_id, payment_ref, payment_ref_norm,
        receipt_file_id, customer_note, status, duplicate_of, is_demo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(tracking, user.id, service.id, amount, currency, JSON.stringify(details), methodId, ref, refNorm, receiptId, note, 'pending', duplicateOf,
      env.DEMO_MODE === 'true' ? 1 : 0, t, t).run();
    const reqId = res.meta.last_row_id;
    await env.DB.prepare('INSERT INTO request_events (request_id, status, note, actor_id, created_at) VALUES (?,?,?,?,?)').bind(reqId, 'pending', '', user.id, t).run();
    await audit(env, request, user, 'request.submitted', 'request', tracking, { service: service.id, duplicate_of: duplicateOf });
    await notifyStatus(env, ctx, user, { tracking_no: tracking }, 'pending', null);
    const pendingCount = (await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'pending'").first()).n;
    await alertOperators(env, ctx, `new request received. Pending queue: ${pendingCount}.`);
    return json({ ok: true, tracking_no: tracking }, 201);
  }

  const reqMatch = path.match(/^\/api\/requests\/(RP-\d{4}-[A-Z0-9]{6})$/);
  if (reqMatch && m === 'GET') {
    const r = await env.DB.prepare(`${REQ_SELECT} WHERE r.tracking_no = ? AND r.user_id = ?`).bind(reqMatch[1], user.id).first();
    if (!r) throw new HttpError(404, 'not_found');
    const events = (await env.DB.prepare('SELECT status, note, created_at FROM request_events WHERE request_id = ? ORDER BY id').bind(r.id).all()).results;
    return json({ request: requestOut(r), events });
  }

  // ── uploads (receipts) ──
  if (path === '/api/uploads' && m === 'POST') {
    await rateLimit(env, `upload:${user.id}`, 30, 3600);
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') throw new HttpError(422, 'validation', 'file is required', { field: 'receipt' });
    const limit = env.FILES ? MAX_FILE : MAX_FILE_D1;
    if (file.size > limit) throw new HttpError(413, 'file_too_large', 'file is too large', { field: 'receipt', max: limit });
    const buf = new Uint8Array(await file.arrayBuffer());
    const magic = FILE_TYPES[file.type];
    if (!magic || buf[0] !== magic[0] || buf[1] !== magic[1]) throw new HttpError(415, 'file_type', 'only JPG, PNG or PDF', { field: 'receipt' });
    const id = `F-${randomCode(16)}`;
    const digest = await sha256(buf);
    const name = String(file.name || 'receipt').replace(/[^\w.\- ]/g, '_').slice(0, 80);
    if (env.FILES) {
      await env.FILES.put(`receipts/${user.id}/${id}`, buf, { httpMetadata: { contentType: file.type } });
      await env.DB.prepare('INSERT INTO files (id, owner_id, name, mime, size, sha256, storage, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, user.id, name, file.type, file.size, digest, 'r2', now()).run();
    } else {
      await env.DB.prepare('INSERT INTO files (id, owner_id, name, mime, size, sha256, storage, data, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, user.id, name, file.type, file.size, digest, 'd1', buf, now()).run();
    }
    return json({ ok: true, file: { id, name, size: file.size, mime: file.type } }, 201);
  }

  const fileMatch = path.match(/^\/api\/files\/(F-[A-Z0-9]{16})$/);
  if (fileMatch && m === 'GET') {
    const f = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND owner_id = ?').bind(fileMatch[1], user.id).first();
    if (!f) throw new HttpError(404, 'not_found');
    return serveFile(env, f);
  }

  // ── payment history ──
  if (path === '/api/payments' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `${REQ_SELECT} WHERE r.user_id = ? AND r.payment_method_id IS NOT NULL ORDER BY r.created_at DESC LIMIT 200`,
    ).bind(user.id).all();
    const ids = results.map((r) => r.id);
    let verif = [];
    if (ids.length) {
      verif = (await env.DB.prepare(`SELECT request_id, status, source, created_at FROM payments WHERE request_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).bind(...ids).all()).results;
    }
    return json({
      payments: results.map((r) => {
        const v = verif.filter((x) => x.request_id === r.id).pop();
        return { ...requestOut(r), verification: v ? { status: v.status, source: v.source, at: v.created_at } : null };
      }),
    });
  }

  // ── notifications ──
  if (path === '/api/notifications' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT n.*, (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = ?) AS read
       FROM notifications n WHERE (n.user_id = ? OR n.user_id IS NULL) AND n.created_at >= ? ORDER BY n.created_at DESC, n.id DESC LIMIT 100`,
    ).bind(user.id, user.id, user.created_at - 86400 * 30).all();
    return json({ notifications: results.map((n) => ({ ...n, read: !!n.read, created_by: undefined })) });
  }
  if (path === '/api/notifications/read' && m === 'POST') {
    const b = await readJson(request);
    const ids = Array.isArray(b.ids) ? b.ids.filter(Number.isInteger).slice(0, 100) : null;
    const target = ids
      ? (await env.DB.prepare(`SELECT id FROM notifications WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'}) AND (user_id = ? OR user_id IS NULL)`).bind(...ids, user.id).all()).results
      : (await env.DB.prepare('SELECT id FROM notifications WHERE user_id = ? OR user_id IS NULL').bind(user.id).all()).results;
    if (target.length) await env.DB.batch(target.map((n) => env.DB.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?,?)').bind(n.id, user.id)));
    return json({ ok: true, unread: await unreadCount(env, user) });
  }

  // ── support ──
  if (path === '/api/support' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC').bind(user.id).all();
    return json({ tickets: results });
  }
  if (path === '/api/support' && m === 'POST') {
    await rateLimit(env, `ticket:${user.id}`, 10, 3600);
    const b = await readJson(request);
    const subject = str(b.subject, { min: 4, max: 120, field: 'subject' });
    const category = oneOf(b.category || 'general', ['general', 'request', 'payment', 'account', 'security'], 'category');
    const body = str(b.message, { min: 10, max: 2000, field: 'message' });
    let tracking = null;
    if (b.tracking_no) {
      const r = await env.DB.prepare('SELECT tracking_no FROM requests WHERE tracking_no = ? AND user_id = ?').bind(String(b.tracking_no).toUpperCase(), user.id).first();
      if (!r) throw new HttpError(422, 'validation', 'tracking number not found', { field: 'tracking_no' });
      tracking = r.tracking_no;
    }
    const t = now();
    const no = `T-${randomCode(6)}`;
    const res = await env.DB.prepare('INSERT INTO support_tickets (ticket_no, user_id, subject, category, tracking_no, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(no, user.id, subject, category, tracking, t, t).run();
    await env.DB.prepare('INSERT INTO support_messages (ticket_id, author_id, is_staff, body, created_at) VALUES (?,?,0,?,?)').bind(res.meta.last_row_id, user.id, body, t).run();
    await alertOperators(env, ctx, 'new support ticket opened.');
    return json({ ok: true, ticket_no: no }, 201);
  }
  const tMatch = path.match(/^\/api\/support\/(T-[A-Z0-9]{6})(\/messages)?$/);
  if (tMatch) {
    const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE ticket_no = ? AND user_id = ?').bind(tMatch[1], user.id).first();
    if (!ticket) throw new HttpError(404, 'not_found');
    if (!tMatch[2] && m === 'GET') {
      const msgs = (await env.DB.prepare('SELECT is_staff, body, created_at FROM support_messages WHERE ticket_id = ? ORDER BY id').bind(ticket.id).all()).results;
      return json({ ticket, messages: msgs });
    }
    if (tMatch[2] && m === 'POST') {
      if (ticket.status === 'closed') throw new HttpError(409, 'ticket_closed');
      const b = await readJson(request);
      const body = str(b.message, { min: 2, max: 2000, field: 'message' });
      await env.DB.batch([
        env.DB.prepare('INSERT INTO support_messages (ticket_id, author_id, is_staff, body, created_at) VALUES (?,?,0,?,?)').bind(ticket.id, user.id, body, now()),
        env.DB.prepare("UPDATE support_tickets SET status = 'open', updated_at = ? WHERE id = ?").bind(now(), ticket.id),
      ]);
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'not_found');
}

async function unreadCount(env, user) {
  return (await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM notifications n WHERE (n.user_id = ? OR n.user_id IS NULL) AND n.created_at >= ?
     AND NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = ?)`,
  ).bind(user.id, user.created_at - 86400 * 30, user.id).first()).n;
}

export async function serveFile(env, f) {
  let body;
  if (f.storage === 'r2') {
    const obj = await env.FILES?.get(`receipts/${f.owner_id}/${f.id}`);
    if (!obj) throw new HttpError(404, 'not_found');
    body = obj.body;
  } else {
    body = new Uint8Array(f.data);
  }
  return new Response(body, {
    headers: {
      'content-type': f.mime,
      'content-disposition': `inline; filename="${f.name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
