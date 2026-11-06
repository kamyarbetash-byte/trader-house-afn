// Administration API. Every route requires a staff session that passed password + TOTP,
// except setup/login. Every state-changing action is written to audit_log with operator ID + time.
import {
  HttpError, json, readJson, str, oneOf, now, randomCode, hashPassword, safeEqual, clientIp,
  newTotpSecret, verifyTotp, amountToMinor, normRef, parseJsonSafe,
} from '../lib/util.js';
import { createSession, destroySession, pendingStaff, requireStaff, rateLimit, audit, publicUser } from '../lib/auth.js';
import { notifyStatus, notifyUser } from '../lib/notify.js';
import { requestOut, serveFile, settingsMap } from './customer.js';

export const TRANSITIONS = {
  pending: ['under_review', 'rejected'],
  under_review: ['payment_verified', 'processing', 'rejected'],
  payment_verified: ['processing', 'rejected'],
  processing: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

const REQ_SELECT = `SELECT r.*, s.name_en AS service_en, s.name_fa AS service_fa, s.requires_payment,
  m.name_en AS method_en, m.name_fa AS method_fa, u.full_name AS customer_name, u.phone AS customer_phone,
  a.full_name AS assignee_name
  FROM requests r JOIN services s ON s.id = r.service_id LEFT JOIN payment_methods m ON m.id = r.payment_method_id
  JOIN users u ON u.id = r.user_id LEFT JOIN users a ON a.id = r.assigned_to`;

function adminReq(r) {
  return {
    ...requestOut(r),
    id: r.id,
    user_id: r.user_id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    assigned_to: r.assigned_to,
    assignee_name: r.assignee_name,
    duplicate_of: r.duplicate_of,
    requires_payment: !!r.requires_payment,
  };
}

function dayStart(t) { return t - (t % 86400); }

export async function handleAdmin(request, env, ctx, path) {
  const m = request.method;
  const ip = clientIp(request);

  // ── first administrator (one time, needs ADMIN_SETUP_KEY secret) ──
  if (path === '/api/admin/setup' && m === 'GET') {
    const any = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").first();
    return json({ available: !any && !!env.ADMIN_SETUP_KEY });
  }
  if (path === '/api/admin/setup' && m === 'POST') {
    await rateLimit(env, `setup:${ip}`, 5, 3600);
    const any = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").first();
    if (any || !env.ADMIN_SETUP_KEY) throw new HttpError(403, 'setup_closed');
    const b = await readJson(request);
    if (!safeEqual(String(b.setup_key || ''), env.ADMIN_SETUP_KEY)) throw new HttpError(403, 'bad_setup_key');
    const user = await createStaff(env, b, 'admin');
    await audit(env, request, user, 'staff.bootstrap_admin', 'user', user.id);
    return json({ ok: true, staff_id: user.id });
  }

  // ── login: password → TOTP ──
  if (path === '/api/admin/login' && m === 'POST') {
    await rateLimit(env, `alogin:${ip}`, 10, 900);
    const b = await readJson(request);
    const email = str(b.email, { max: 120, field: 'email' }).toLowerCase();
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? AND role IN ('operator','admin')").bind(email).first();
    if (user && user.locked_until > now()) throw new HttpError(423, 'locked', 'account temporarily locked');
    const { hash } = await hashPassword(String(b.password || ''), user?.pass_salt || '00000000000000000000000000000000');
    if (!user || !safeEqual(hash, user.pass_hash)) {
      if (user) {
        const fails = user.failed_logins + 1;
        await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').bind(fails >= 5 ? 0 : fails, fails >= 5 ? now() + 1800 : 0, user.id).run();
        await audit(env, request, user, 'staff.login_failed', 'user', user.id);
      }
      throw new HttpError(401, 'bad_credentials');
    }
    if (user.status !== 'active') throw new HttpError(403, 'suspended');
    let secret = user.totp_secret;
    if (!user.totp_enabled) {
      secret = newTotpSecret();
      await env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').bind(secret, user.id).run();
    }
    const setCookie = await createSession(env, request, user.id, 'staff_2fa');
    return json({
      ok: true,
      step: 'totp',
      enroll: user.totp_enabled ? null : { secret, uri: `otpauth://totp/Rahbar%20Pay:${encodeURIComponent(email)}?secret=${secret}&issuer=Rahbar%20Pay&digits=6&period=30` },
    }, 200, { 'set-cookie': setCookie });
  }

  if (path === '/api/admin/login/2fa' && m === 'POST') {
    await rateLimit(env, `a2fa:${ip}`, 10, 900);
    const user = await pendingStaff(env, request);
    if (!user) throw new HttpError(401, 'unauthenticated');
    const b = await readJson(request);
    if (!(await verifyTotp(user.totp_secret, b.code))) {
      await audit(env, request, user, 'staff.2fa_failed', 'user', user.id);
      throw new HttpError(401, 'bad_totp');
    }
    await destroySession(env, request, 'staff');
    await env.DB.prepare('UPDATE users SET totp_enabled = 1, failed_logins = 0, last_login_at = ? WHERE id = ?').bind(now(), user.id).run();
    await audit(env, request, user, user.totp_enabled ? 'staff.login' : 'staff.2fa_enrolled', 'user', user.id);
    const setCookie = await createSession(env, request, user.id, 'staff');
    return json({ ok: true, user: publicUser({ ...user, totp_enabled: 1 }) }, 200, { 'set-cookie': setCookie });
  }

  if (path === '/api/admin/logout' && m === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': await destroySession(env, request, 'staff') });
  }

  // ── everything below: authenticated staff ──
  const staff = await requireStaff(env, request);
  const adminOnly = () => { if (staff.role !== 'admin') throw new HttpError(403, 'forbidden'); };
  const url = new URL(request.url);
  const q = (k) => (url.searchParams.get(k) || '').trim();

  if (path === '/api/admin/me' && m === 'GET') return json({ user: publicUser(staff) });

  if (path === '/api/admin/overview' && m === 'GET') {
    const t = now();
    const counts = Object.fromEntries((await env.DB.prepare('SELECT status, COUNT(*) AS n FROM requests GROUP BY status').all()).results.map((r) => [r.status, r.n]));
    const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE created_at >= ?').bind(dayStart(t)).first();
    const customers = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND phone_verified = 1").first();
    const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE assigned_to = ? AND status NOT IN ('completed','rejected')").bind(staff.id).first();
    const dups = await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE duplicate_of IS NOT NULL AND status NOT IN ('completed','rejected')").first();
    const tickets = await env.DB.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'").first();
    const series = (await env.DB.prepare('SELECT (created_at / 86400) AS d, COUNT(*) AS n FROM requests WHERE created_at >= ? GROUP BY d ORDER BY d').bind(dayStart(t) - 13 * 86400).all()).results;
    const recent = (await env.DB.prepare(`${REQ_SELECT} ORDER BY r.created_at DESC LIMIT 8`).all()).results.map(adminReq);
    return json({ counts, today: today.n, customers: customers.n, assigned_to_me: mine.n, duplicates: dups.n, open_tickets: tickets.n, series, recent });
  }

  if (path === '/api/admin/search' && m === 'GET') {
    const term = q('q').toUpperCase();
    if (term.length < 3) return json({ customers: [], requests: [] });
    const customers = (await env.DB.prepare("SELECT id, full_name, phone, status FROM users WHERE role = 'customer' AND (id LIKE ? OR phone LIKE ?) LIMIT 10").bind(`%${term}%`, `%${term}%`).all()).results;
    const requests = (await env.DB.prepare(`${REQ_SELECT} WHERE r.tracking_no LIKE ? OR r.user_id LIKE ? ORDER BY r.created_at DESC LIMIT 10`).bind(`%${term}%`, `%${term}%`).all()).results.map(adminReq);
    return json({ customers, requests });
  }

  // ── customers ──
  if (path === '/api/admin/customers' && m === 'GET') {
    let sql = `SELECT u.id, u.full_name, u.phone, u.status, u.phone_verified, u.created_at, u.last_login_at, u.telegram_chat IS NOT NULL AS telegram,
      (SELECT COUNT(*) FROM requests r WHERE r.user_id = u.id) AS requests FROM users u WHERE u.role = 'customer'`;
    const args = [];
    if (q('q')) { sql += ' AND (u.id LIKE ? OR u.phone LIKE ? OR u.full_name LIKE ?)'; const t = `%${q('q')}%`; args.push(t.toUpperCase(), t, t); }
    if (q('status')) { sql += ' AND u.status = ?'; args.push(q('status')); }
    sql += ' ORDER BY u.created_at DESC LIMIT 300';
    return json({ customers: (await env.DB.prepare(sql).bind(...args).all()).results });
  }
  const custMatch = path.match(/^\/api\/admin\/customers\/(C-[A-Z0-9]{6})$/);
  if (custMatch) {
    const c = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").bind(custMatch[1]).first();
    if (!c) throw new HttpError(404, 'not_found');
    if (m === 'GET') {
      const reqs = (await env.DB.prepare(`${REQ_SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100`).bind(c.id).all()).results.map(adminReq);
      const tickets = (await env.DB.prepare('SELECT ticket_no, subject, status, updated_at FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC').bind(c.id).all()).results;
      await audit(env, request, staff, 'customer.viewed', 'user', c.id);
      return json({ customer: { ...publicUser(c), status: c.status }, requests: reqs, tickets });
    }
    if (m === 'PATCH') {
      adminOnly();
      const b = await readJson(request);
      const status = oneOf(b.status, ['active', 'suspended'], 'status');
      const reason = str(b.reason, { min: 3, max: 300, field: 'reason' });
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, c.id).run();
      if (status === 'suspended') await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(c.id).run();
      await audit(env, request, staff, `customer.${status === 'active' ? 'activated' : 'suspended'}`, 'user', c.id, { reason });
      return json({ ok: true });
    }
  }

  // ── requests ──
  if (path === '/api/admin/requests' && m === 'GET') {
    let sql = `${REQ_SELECT} WHERE 1 = 1`;
    const args = [];
    if (q('status')) { sql += ' AND r.status = ?'; args.push(q('status')); }
    if (q('service')) { sql += ' AND r.service_id = ?'; args.push(q('service')); }
    if (q('assigned') === 'me') { sql += ' AND r.assigned_to = ?'; args.push(staff.id); }
    else if (q('assigned') === 'none') sql += ' AND r.assigned_to IS NULL';
    if (q('flag') === 'duplicate') sql += ' AND r.duplicate_of IS NOT NULL';
    if (q('q')) { sql += ' AND (r.tracking_no LIKE ? OR r.user_id LIKE ? OR r.payment_ref_norm LIKE ?)'; const t = `%${q('q').toUpperCase()}%`; args.push(t, t, `%${normRef(q('q'))}%`); }
    sql += ' ORDER BY r.created_at DESC LIMIT 300';
    return json({ requests: (await env.DB.prepare(sql).bind(...args).all()).results.map(adminReq) });
  }

  const rq = path.match(/^\/api\/admin\/requests\/(RP-\d{4}-[A-Z0-9]{6})(?:\/(status|notes|assign|payments))?$/);
  if (rq) {
    const r = await env.DB.prepare(`${REQ_SELECT} WHERE r.tracking_no = ?`).bind(rq[1]).first();
    if (!r) throw new HttpError(404, 'not_found');
    const action = rq[2];

    if (!action && m === 'GET') {
      const [events, notes, payments, dups, file] = await Promise.all([
        env.DB.prepare('SELECT e.*, u.full_name AS actor_name FROM request_events e LEFT JOIN users u ON u.id = e.actor_id WHERE request_id = ? ORDER BY e.id').bind(r.id).all(),
        env.DB.prepare('SELECT n.*, u.full_name AS author_name FROM internal_notes n JOIN users u ON u.id = n.author_id WHERE request_id = ? ORDER BY n.id').bind(r.id).all(),
        env.DB.prepare('SELECT p.*, u.full_name AS operator_name FROM payments p JOIN users u ON u.id = p.operator_id WHERE request_id = ? ORDER BY p.id').bind(r.id).all(),
        r.payment_ref_norm
          ? env.DB.prepare('SELECT tracking_no, user_id, status, created_at FROM requests WHERE payment_method_id = ? AND payment_ref_norm = ? AND id != ?').bind(r.payment_method_id, r.payment_ref_norm, r.id).all()
          : Promise.resolve({ results: [] }),
        r.receipt_file_id ? env.DB.prepare('SELECT id, name, mime, size, sha256, created_at FROM files WHERE id = ?').bind(r.receipt_file_id).first() : null,
      ]);
      return json({
        request: adminReq(r), events: events.results, notes: notes.results, payments: payments.results,
        duplicates: dups.results, receipt: file, transitions: TRANSITIONS[r.status],
      });
    }

    if (action === 'status' && m === 'POST') {
      const b = await readJson(request);
      const next = oneOf(b.status, TRANSITIONS[r.status] || [], 'status');
      const note = str(b.note, { max: 500, optional: true, field: 'note' });
      let reason = null;
      if (next === 'rejected') reason = str(b.reason, { min: 5, max: 500, field: 'reason' });
      if (next === 'payment_verified') {
        // Never on a customer screenshot alone: needs an independent verification record.
        const v = await env.DB.prepare("SELECT 1 FROM payments WHERE request_id = ? AND status = 'verified'").bind(r.id).first();
        if (!v) throw new HttpError(409, 'payment_not_verified', 'record a payment verification from the provider API, bank record or official statement first');
      }
      if (next === 'processing' && r.requires_payment) {
        const v = await env.DB.prepare("SELECT 1 FROM payments WHERE request_id = ? AND status = 'verified'").bind(r.id).first();
        if (!v) throw new HttpError(409, 'payment_not_verified');
      }
      const t = now();
      await env.DB.batch([
        env.DB.prepare('UPDATE requests SET status = ?, reject_reason = COALESCE(?, reject_reason), updated_at = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ? AND status = ?')
          .bind(next, reason, t, staff.id, r.id, r.status),
        env.DB.prepare('INSERT INTO request_events (request_id, status, note, actor_id, created_at) VALUES (?,?,?,?,?)').bind(r.id, next, next === 'rejected' ? reason : note, staff.id, t),
      ]);
      await audit(env, request, staff, 'request.status_changed', 'request', r.tracking_no, { from: r.status, to: next, note, reason });
      const customer = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(r.user_id).first();
      await notifyStatus(env, ctx, customer, r, next, staff.id);
      return json({ ok: true, status: next });
    }

    if (action === 'notes' && m === 'POST') {
      const b = await readJson(request);
      const body = str(b.body, { min: 2, max: 2000, field: 'body' });
      await env.DB.prepare('INSERT INTO internal_notes (request_id, author_id, body, created_at) VALUES (?,?,?,?)').bind(r.id, staff.id, body, now()).run();
      await audit(env, request, staff, 'request.note_added', 'request', r.tracking_no);
      return json({ ok: true }, 201);
    }

    if (action === 'assign' && m === 'POST') {
      const b = await readJson(request);
      let target = null;
      if (b.operator_id) {
        const op = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role IN ('operator','admin') AND status = 'active'").bind(String(b.operator_id)).first();
        if (!op) throw new HttpError(422, 'validation', 'operator is invalid', { field: 'operator_id' });
        target = op.id;
      }
      if (staff.role !== 'admin' && target && target !== staff.id) throw new HttpError(403, 'forbidden');
      await env.DB.prepare('UPDATE requests SET assigned_to = ?, updated_at = ? WHERE id = ?').bind(target, now(), r.id).run();
      await audit(env, request, staff, 'request.assigned', 'request', r.tracking_no, { from: r.assigned_to, to: target });
      return json({ ok: true });
    }

    if (action === 'payments' && m === 'POST') {
      if (!r.payment_method_id) throw new HttpError(409, 'no_payment');
      const b = await readJson(request);
      const status = oneOf(b.status, ['verified', 'mismatch', 'rejected', 'refunded'], 'status');
      const source = oneOf(b.source, ['provider_api', 'bank_record', 'official_statement'], 'source');
      const evidence = str(b.evidence_ref, { min: 4, max: 80, field: 'evidence_ref' });
      const amount = amountToMinor(b.amount);
      const note = str(b.note, { max: 500, optional: true, field: 'note' });
      if (status === 'verified') {
        if (amount !== r.amount) throw new HttpError(422, 'amount_mismatch', 'verified amount must equal the requested amount — record a mismatch instead', { field: 'amount' });
        if (b.confirm_independent !== true) throw new HttpError(422, 'validation', 'confirm the record was checked independently of the customer receipt', { field: 'confirm_independent' });
        const used = await env.DB.prepare("SELECT r.tracking_no FROM payments p JOIN requests r ON r.id = p.request_id WHERE p.payment_method_id = ? AND p.reference_norm = ? AND p.status = 'verified'")
          .bind(r.payment_method_id, r.payment_ref_norm).first();
        if (used) throw new HttpError(409, 'duplicate_transaction', `this payment reference was already verified on ${used.tracking_no}`);
      }
      if (status === 'refunded') {
        const v = await env.DB.prepare("SELECT 1 FROM payments WHERE request_id = ? AND status = 'verified'").bind(r.id).first();
        if (!v) throw new HttpError(409, 'nothing_to_refund');
        await env.DB.prepare("UPDATE payments SET status = 'refunded' WHERE request_id = ? AND status = 'verified'").bind(r.id).run();
      }
      await env.DB.prepare(
        'INSERT INTO payments (request_id, payment_method_id, reference_norm, amount, currency, status, source, evidence_ref, note, operator_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(r.id, r.payment_method_id, status === 'refunded' ? `${r.payment_ref_norm}#R${now()}` : r.payment_ref_norm, amount, r.currency, status, source, evidence, note, staff.id, now()).run();
      await audit(env, request, staff, `payment.${status}`, 'request', r.tracking_no, { source, evidence_ref: evidence, amount });
      return json({ ok: true }, 201);
    }
  }

  const fileMatch = path.match(/^\/api\/admin\/files\/(F-[A-Z0-9]{16})$/);
  if (fileMatch && m === 'GET') {
    const f = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileMatch[1]).first();
    if (!f) throw new HttpError(404, 'not_found');
    await audit(env, request, staff, 'file.viewed', 'file', f.id);
    return serveFile(env, f);
  }

  // ── reconciliation ──
  if (path === '/api/admin/reconciliation' && m === 'GET') {
    const from = Number(q('from')) || dayStart(now()) - 29 * 86400;
    const to = Number(q('to')) || now() + 86400;
    let sql = `${REQ_SELECT} WHERE r.payment_method_id IS NOT NULL AND r.created_at BETWEEN ? AND ?`;
    const args = [from, to];
    if (q('method')) { sql += ' AND r.payment_method_id = ?'; args.push(q('method')); }
    sql += ' ORDER BY r.created_at DESC LIMIT 500';
    const reqs = (await env.DB.prepare(sql).bind(...args).all()).results;
    const ids = reqs.map((r) => r.id);
    const pays = ids.length
      ? (await env.DB.prepare(`SELECT p.*, u.full_name AS operator_name FROM payments p JOIN users u ON u.id = p.operator_id WHERE request_id IN (${ids.map(() => '?').join(',')}) ORDER BY p.id`).bind(...ids).all()).results
      : [];
    const rows = reqs.map((r) => {
      const list = pays.filter((p) => p.request_id === r.id);
      const last = list[list.length - 1] || null;
      let state = 'awaiting';
      if (r.status === 'rejected' && !last) state = 'rejected';
      if (last) state = last.status;
      if (r.duplicate_of && state === 'awaiting') state = 'duplicate_flag';
      return { ...adminReq(r), recon_state: state, verification: last };
    });
    const summary = {};
    for (const row of rows) summary[row.recon_state] = (summary[row.recon_state] || 0) + 1;
    return json({ rows, summary, from, to });
  }

  // ── reports ──
  if ((path === '/api/admin/reports' || path === '/api/admin/reports.csv') && m === 'GET') {
    const period = q('period') === 'monthly' ? 'monthly' : 'daily';
    const ref = q('date') ? Date.parse(q('date') + 'T00:00:00Z') / 1000 : now();
    if (!Number.isFinite(ref)) throw new HttpError(422, 'validation', 'date is invalid', { field: 'date' });
    let from, to;
    if (period === 'daily') { from = dayStart(ref); to = from + 86400; }
    else { const d = new Date(ref * 1000); from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
    const byStatus = (await env.DB.prepare('SELECT status, COUNT(*) AS n FROM requests WHERE created_at >= ? AND created_at < ? GROUP BY status').bind(from, to).all()).results;
    const byService = (await env.DB.prepare(`SELECT s.name_en, s.name_fa, r.currency, COUNT(*) AS n, SUM(r.amount) AS total
      FROM requests r JOIN services s ON s.id = r.service_id WHERE r.created_at >= ? AND r.created_at < ? GROUP BY r.service_id, r.currency ORDER BY n DESC`).bind(from, to).all()).results;
    const verified = (await env.DB.prepare(`SELECT p.currency, p.status, COUNT(*) AS n, SUM(p.amount) AS total FROM payments p
      WHERE p.created_at >= ? AND p.created_at < ? GROUP BY p.currency, p.status`).bind(from, to).all()).results;
    const byOperator = (await env.DB.prepare(`SELECT u.full_name, a.actor_id, COUNT(*) AS n FROM audit_log a JOIN users u ON u.id = a.actor_id
      WHERE a.action = 'request.status_changed' AND a.created_at >= ? AND a.created_at < ? GROUP BY a.actor_id ORDER BY n DESC`).bind(from, to).all()).results;
    const newCustomers = (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND phone_verified = 1 AND created_at >= ? AND created_at < ?").bind(from, to).first()).n;
    await audit(env, request, staff, 'report.generated', 'report', `${period}:${from}`, { csv: path.endsWith('.csv') });
    if (path.endsWith('.csv')) {
      const rows = (await env.DB.prepare(`SELECT r.tracking_no, r.user_id, s.name_en AS service, r.amount, r.currency, r.payment_method_id, r.status, r.created_at, r.updated_at
        FROM requests r JOIN services s ON s.id = r.service_id WHERE r.created_at >= ? AND r.created_at < ? ORDER BY r.created_at`).bind(from, to).all()).results;
      const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
      const lines = ['tracking_no,customer_id,service,amount,currency,payment_method,status,created_utc,updated_utc'];
      for (const r of rows) lines.push([r.tracking_no, r.user_id, r.service, (r.amount / 100).toFixed(2), r.currency, r.payment_method_id || '', r.status, new Date(r.created_at * 1000).toISOString(), new Date(r.updated_at * 1000).toISOString()].map(esc).join(','));
      return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="rahbar-pay-${period}-${new Date(from * 1000).toISOString().slice(0, period === 'daily' ? 10 : 7)}.csv"`, 'cache-control': 'no-store' } });
    }
    return json({ period, from, to, by_status: byStatus, by_service: byService, payments: verified, by_operator: byOperator, new_customers: newCustomers });
  }

  // ── audit ──
  if (path === '/api/admin/audit' && m === 'GET') {
    let sql = 'SELECT a.*, u.full_name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE 1 = 1';
    const args = [];
    if (q('actor')) { sql += ' AND a.actor_id = ?'; args.push(q('actor')); }
    if (q('action')) { sql += ' AND a.action LIKE ?'; args.push(`${q('action')}%`); }
    if (q('target')) { sql += ' AND a.target_id LIKE ?'; args.push(`%${q('target').toUpperCase()}%`); }
    sql += ' ORDER BY a.id DESC LIMIT 300';
    return json({ entries: (await env.DB.prepare(sql).bind(...args).all()).results });
  }

  // ── staff ──
  if (path === '/api/admin/staff' && m === 'GET') {
    const { results } = await env.DB.prepare("SELECT id, role, full_name, email, status, totp_enabled, last_login_at, created_at FROM users WHERE role IN ('operator','admin') ORDER BY created_at").all();
    return json({ staff: results });
  }
  if (path === '/api/admin/staff' && m === 'POST') {
    adminOnly();
    const b = await readJson(request);
    const role = oneOf(b.role, ['operator', 'admin'], 'role');
    const u = await createStaff(env, b, role);
    await audit(env, request, staff, 'staff.created', 'user', u.id, { role });
    return json({ ok: true, staff_id: u.id }, 201);
  }
  const staffMatch = path.match(/^\/api\/admin\/staff\/(S-[A-Z0-9]{6})$/);
  if (staffMatch && m === 'PATCH') {
    adminOnly();
    const target = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role IN ('operator','admin')").bind(staffMatch[1]).first();
    if (!target) throw new HttpError(404, 'not_found');
    if (target.id === staff.id) throw new HttpError(409, 'cannot_modify_self');
    const b = await readJson(request);
    if (b.status) {
      const status = oneOf(b.status, ['active', 'suspended'], 'status');
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, target.id).run();
      if (status === 'suspended') await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run();
      await audit(env, request, staff, `staff.${status}`, 'user', target.id);
    }
    if (b.reset_2fa === true) {
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').bind(target.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
      ]);
      await audit(env, request, staff, 'staff.2fa_reset', 'user', target.id);
    }
    return json({ ok: true });
  }

  // ── service catalog ──
  if (path === '/api/admin/services' && m === 'GET') {
    const cats = (await env.DB.prepare('SELECT * FROM service_categories ORDER BY sort').all()).results;
    const services = (await env.DB.prepare('SELECT * FROM services ORDER BY sort').all()).results.map((s) => ({ ...s, fields: parseJsonSafe(s.fields, []) }));
    const methods = (await env.DB.prepare('SELECT * FROM payment_methods ORDER BY sort').all()).results;
    return json({ categories: cats, services, payment_methods: methods });
  }
  const svcMatch = path.match(/^\/api\/admin\/services\/([a-z0-9_]{2,40})$/);
  if (svcMatch && m === 'PATCH') {
    adminOnly();
    const s = await env.DB.prepare('SELECT * FROM services WHERE id = ?').bind(svcMatch[1]).first();
    if (!s) throw new HttpError(404, 'not_found');
    const b = await readJson(request);
    const status = b.status ? oneOf(b.status, ['active', 'legal_pending', 'disabled'], 'status') : s.status;
    if (status === 'active' && s.category_id === 'digital_assets' && b.legal_confirmation !== true) {
      throw new HttpError(422, 'legal_confirmation_required', 'confirm that the legal authorization for this service has been obtained', { field: 'legal_confirmation' });
    }
    const name_en = b.name_en !== undefined ? str(b.name_en, { min: 2, max: 80, field: 'name_en' }) : s.name_en;
    const name_fa = b.name_fa !== undefined ? str(b.name_fa, { min: 2, max: 80, field: 'name_fa' }) : s.name_fa;
    const desc_en = b.desc_en !== undefined ? str(b.desc_en, { max: 300, optional: true, field: 'desc_en' }) : s.desc_en;
    const desc_fa = b.desc_fa !== undefined ? str(b.desc_fa, { max: 300, optional: true, field: 'desc_fa' }) : s.desc_fa;
    const min = b.min_amount !== undefined ? amountToMinor(b.min_amount, 'min_amount') : s.min_amount;
    const max = b.max_amount !== undefined ? amountToMinor(b.max_amount, 'max_amount') : s.max_amount;
    if (min > max) throw new HttpError(422, 'validation', 'minimum is above maximum', { field: 'min_amount' });
    await env.DB.prepare('UPDATE services SET status = ?, name_en = ?, name_fa = ?, desc_en = ?, desc_fa = ?, min_amount = ?, max_amount = ?, updated_at = ? WHERE id = ?')
      .bind(status, name_en, name_fa, desc_en, desc_fa, min, max, now(), s.id).run();
    await audit(env, request, staff, 'service.updated', 'service', s.id, { from: s.status, to: status, legal_confirmation: b.legal_confirmation === true });
    return json({ ok: true });
  }
  if (path === '/api/admin/categories' && m === 'POST') {
    adminOnly();
    const b = await readJson(request);
    const id = str(b.id, { min: 2, max: 40, pattern: '^[a-z0-9_]+$', field: 'id' });
    const name_en = str(b.name_en, { min: 2, max: 60, field: 'name_en' });
    const name_fa = str(b.name_fa, { min: 2, max: 60, field: 'name_fa' });
    await env.DB.prepare('INSERT INTO service_categories (id, name_en, name_fa, sort) VALUES (?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM service_categories))').bind(id, name_en, name_fa).run()
      .catch(() => { throw new HttpError(409, 'exists'); });
    await audit(env, request, staff, 'category.created', 'category', id);
    return json({ ok: true }, 201);
  }
  const pmMatch = path.match(/^\/api\/admin\/payment-methods\/([a-z0-9_]{2,40})$/);
  if (pmMatch && m === 'PATCH') {
    adminOnly();
    const pm = await env.DB.prepare('SELECT * FROM payment_methods WHERE id = ?').bind(pmMatch[1]).first();
    if (!pm) throw new HttpError(404, 'not_found');
    const b = await readJson(request);
    // 'api' can only be chosen once a real provider integration is deployed (none in this prototype).
    const status = b.status ? oneOf(b.status, ['manual', 'disabled'], 'status') : pm.status;
    const ie = b.instructions_en !== undefined ? str(b.instructions_en, { max: 600, optional: true, field: 'instructions_en' }) : pm.instructions_en;
    const ifa = b.instructions_fa !== undefined ? str(b.instructions_fa, { max: 600, optional: true, field: 'instructions_fa' }) : pm.instructions_fa;
    await env.DB.prepare('UPDATE payment_methods SET status = ?, instructions_en = ?, instructions_fa = ?, updated_at = ? WHERE id = ?').bind(status, ie, ifa, now(), pm.id).run();
    await audit(env, request, staff, 'payment_method.updated', 'payment_method', pm.id, { from: pm.status, to: status });
    return json({ ok: true });
  }

  // ── settings ──
  if (path === '/api/admin/settings' && m === 'GET') {
    return json({ settings: await settingsMap(env), integrations: { telegram: !!env.TELEGRAM_BOT_TOKEN, r2: !!env.FILES, demo_mode: env.DEMO_MODE === 'true' } });
  }
  if (path === '/api/admin/settings' && m === 'PATCH') {
    adminOnly();
    const b = await readJson(request);
    const allowed = ['support_hours_en', 'support_hours_fa', 'support_email', 'maintenance', 'telegram_bot_username', 'submissions_open'];
    const changed = {};
    for (const k of allowed) {
      if (b[k] === undefined) continue;
      const v = ['maintenance', 'submissions_open'].includes(k) ? (b[k] ? '1' : '0') : str(b[k], { max: 120, optional: true, field: k });
      await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, v).run();
      changed[k] = v;
    }
    await audit(env, request, staff, 'settings.updated', 'settings', null, changed);
    return json({ ok: true });
  }

  // ── notifications (broadcast) ──
  if (path === '/api/admin/notifications' && m === 'GET') {
    const { results } = await env.DB.prepare(`SELECT n.*, u.full_name AS author FROM notifications n LEFT JOIN users u ON u.id = n.created_by
      WHERE n.kind = 'announcement' ORDER BY n.id DESC LIMIT 100`).all();
    return json({ notifications: results });
  }
  if (path === '/api/admin/notifications' && m === 'POST') {
    adminOnly();
    const b = await readJson(request);
    const data = {
      title_en: str(b.title_en, { min: 3, max: 120, field: 'title_en' }),
      title_fa: str(b.title_fa, { min: 3, max: 120, field: 'title_fa' }),
      body_en: str(b.body_en, { max: 600, optional: true, field: 'body_en' }),
      body_fa: str(b.body_fa, { max: 600, optional: true, field: 'body_fa' }),
    };
    if (b.customer_id) {
      const c = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").bind(String(b.customer_id).toUpperCase()).first();
      if (!c) throw new HttpError(422, 'validation', 'customer not found', { field: 'customer_id' });
      await notifyUser(env, ctx, c, { kind: 'announcement', ...data, createdBy: staff.id });
    } else {
      await env.DB.prepare("INSERT INTO notifications (user_id, kind, title_en, title_fa, body_en, body_fa, created_by, created_at) VALUES (NULL,'announcement',?,?,?,?,?,?)")
        .bind(data.title_en, data.title_fa, data.body_en, data.body_fa, staff.id, now()).run();
    }
    await audit(env, request, staff, 'notification.sent', 'notification', b.customer_id || 'all', { title: data.title_en });
    return json({ ok: true }, 201);
  }

  // ── support tickets ──
  if (path === '/api/admin/support' && m === 'GET') {
    let sql = 'SELECT t.*, u.full_name AS customer_name FROM support_tickets t JOIN users u ON u.id = t.user_id';
    const args = [];
    if (q('status')) { sql += ' WHERE t.status = ?'; args.push(q('status')); }
    sql += ' ORDER BY t.updated_at DESC LIMIT 200';
    return json({ tickets: (await env.DB.prepare(sql).bind(...args).all()).results });
  }
  const st = path.match(/^\/api\/admin\/support\/(T-[A-Z0-9]{6})(?:\/(reply|close))?$/);
  if (st) {
    const ticket = await env.DB.prepare('SELECT t.*, u.full_name AS customer_name FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE ticket_no = ?').bind(st[1]).first();
    if (!ticket) throw new HttpError(404, 'not_found');
    if (!st[2] && m === 'GET') {
      const msgs = (await env.DB.prepare('SELECT m.*, u.full_name AS author_name FROM support_messages m LEFT JOIN users u ON u.id = m.author_id WHERE ticket_id = ? ORDER BY m.id').bind(ticket.id).all()).results;
      return json({ ticket, messages: msgs });
    }
    if (st[2] === 'reply' && m === 'POST') {
      const b = await readJson(request);
      const body = str(b.message, { min: 2, max: 2000, field: 'message' });
      await env.DB.batch([
        env.DB.prepare('INSERT INTO support_messages (ticket_id, author_id, is_staff, body, created_at) VALUES (?,?,1,?,?)').bind(ticket.id, staff.id, body, now()),
        env.DB.prepare("UPDATE support_tickets SET status = 'answered', updated_at = ? WHERE id = ?").bind(now(), ticket.id),
      ]);
      const customer = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(ticket.user_id).first();
      await notifyUser(env, ctx, customer, {
        kind: 'support', title_en: `Support replied · ${ticket.ticket_no}`, title_fa: `پاسخ پشتیبانی · ${ticket.ticket_no}`,
        link: `/support/${ticket.ticket_no}`, createdBy: staff.id, tg_en: 'Support replied to your ticket', tg_fa: 'پشتیبانی به تیکت شما پاسخ داد',
      });
      await audit(env, request, staff, 'support.replied', 'ticket', ticket.ticket_no);
      return json({ ok: true });
    }
    if (st[2] === 'close' && m === 'POST') {
      await env.DB.prepare("UPDATE support_tickets SET status = 'closed', updated_at = ? WHERE id = ?").bind(now(), ticket.id).run();
      await audit(env, request, staff, 'support.closed', 'ticket', ticket.ticket_no);
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'not_found');
}

async function createStaff(env, b, role) {
  const full_name = str(b.full_name, { min: 3, max: 80, field: 'full_name' });
  const email = str(b.email, { max: 120, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', field: 'email' }).toLowerCase();
  const pw = String(b.password || '');
  if (pw.length < 12 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new HttpError(422, 'weak_password', 'staff passwords need 12+ characters with letters and numbers', { field: 'password' });
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw new HttpError(409, 'email_taken');
  const { hash, salt } = await hashPassword(pw);
  const id = `S-${randomCode(6)}`;
  await env.DB.prepare('INSERT INTO users (id, role, full_name, email, pass_hash, pass_salt, phone_verified, created_at) VALUES (?,?,?,?,?,?,0,?)')
    .bind(id, role, full_name, email, hash, salt, now()).run();
  return { id, role, full_name, email };
}
