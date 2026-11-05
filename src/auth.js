// Accounts for Raahbar: email + password, cookie sessions, per-user saved data
// (chart drawings, demo trading account), email verification and password reset.
//
// Passwords are stored only as PBKDF2-SHA256 hashes with a per-user salt.
// Sessions are random tokens in an HttpOnly cookie; only their SHA-256 is stored.
// Email is sent through Resend when D1 meta has `resendKey` and `mailFrom`; until then
// accounts work and verification / reset simply wait for mail to be configured.

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a); };
const sha = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const PBKDF2_ITER = 30000; // kept modest for the Workers free-plan CPU budget; stored per user so it can be raised
const SESSION_DAYS = 30;
const COOKIE = "rb_s";

async function hashPw(pw, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256));
}
function same(a, b) { if (!a || !b || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

const AUTH_SQL = [
  "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, phone TEXT, city TEXT, role TEXT, wants INTEGER, ads INTEGER, pw TEXT, salt TEXT, iter INTEGER, verified INTEGER DEFAULT 0, created INTEGER, last_login INTEGER)",
  "CREATE TABLE IF NOT EXISTS sessions(h TEXT PRIMARY KEY, uid INTEGER, created INTEGER, expires INTEGER)",
  "CREATE TABLE IF NOT EXISTS userdata(uid INTEGER, k TEXT, v TEXT, updated INTEGER, PRIMARY KEY(uid, k))",
  "CREATE TABLE IF NOT EXISTS tokens(h TEXT PRIMARY KEY, uid INTEGER, kind TEXT, expires INTEGER)",
  "CREATE TABLE IF NOT EXISTS authlog(iph TEXT, ts INTEGER)",
  "CREATE INDEX IF NOT EXISTS authlog_iph ON authlog(iph, ts)",
];
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch(AUTH_SQL.map(q => db.prepare(q)));
  ready = true;
}
const getMeta = async (db, k) => (await db.prepare("SELECT v FROM meta WHERE k=?").bind(k).first("v")) ?? null;

const now = () => Math.floor(Date.now() / 1000);
const toLatin = s => String(s || "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const clip = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

function res(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
const err = (msg, status = 400) => res({ error: msg }, status);

function cookieOf(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]{20,})"));
  return m ? m[1] : null;
}
const setCookie = tok => `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const pub = u => u && { name: u.name, email: u.email, phone: u.phone || "", city: u.city || "", role: u.role || "", wants: !!u.wants, ads: !!u.ads, verified: !!u.verified, created: u.created };

async function currentUser(req, db) {
  const tok = cookieOf(req);
  if (!tok) return null;
  const h = await sha(tok);
  return await db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.uid WHERE s.h = ? AND s.expires > ?").bind(h, now()).first();
}
async function newSession(db, uid) {
  const tok = rand(32), t = now();
  await db.prepare("INSERT INTO sessions(h, uid, created, expires) VALUES(?,?,?,?)").bind(await sha(tok), uid, t, t + SESSION_DAYS * 86400).run();
  return tok;
}

// Simple abuse limit: at most 20 sensitive attempts (failed logins, sign-ups, reset requests) per hashed IP per 15 minutes.
async function ipHash(req, db) {
  let salt = await getMeta(db, "salt");
  if (!salt) { salt = crypto.randomUUID(); await db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('salt',?)").bind(salt).run(); }
  return (await sha((req.headers.get("cf-connecting-ip") || "") + salt)).slice(0, 16);
}
async function limited(db, iph) {
  const n = await db.prepare("SELECT COUNT(*) AS n FROM authlog WHERE iph = ? AND ts > ?").bind(iph, now() - 900).first("n");
  return n >= 20;
}
const note = (db, iph) => db.prepare("INSERT INTO authlog(iph, ts) VALUES(?,?)").bind(iph, now()).run();

// ---- email (Resend) ----
async function mailer(db) {
  const key = await getMeta(db, "resendKey"), from = await getMeta(db, "mailFrom");
  return key && from ? { key, from } : null;
}
function mailHtml(title, body, button, link) {
  return `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;background:#0E1220;font-family:Tahoma,Arial,sans-serif;color:#EDEBE4">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<div style="font-weight:bold;letter-spacing:3px;color:#E2B847;font-size:18px">RAAHBAR · راهبر</div>
<h1 style="font-size:20px;margin:18px 0 8px">${title}</h1>
<p style="line-height:1.9;font-size:15px;color:#C9CCD6">${body}</p>
<p style="margin:24px 0"><a href="${link}" style="background:#E2B847;color:#0E1220;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;display:inline-block">${button}</a></p>
<p style="font-size:12px;color:#9AA2B5;line-height:1.8">اگر این درخواست را شما نفرستاده‌اید، این ایمیل را نادیده بگیرید.<br><span dir="ltr">${link}</span></p>
</div></body></html>`;
}
async function sendMail(db, to, subject, html) {
  const m = await mailer(db);
  if (!m) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${m.key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: m.from, to: [to], subject, html }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch (e) { return false; }
}
async function sendToken(db, origin, user, kind) {
  const tok = rand(32), hours = kind === "verify" ? 72 : 1;
  await db.prepare("INSERT INTO tokens(h, uid, kind, expires) VALUES(?,?,?,?)").bind(await sha(tok), user.id, kind, now() + hours * 3600).run();
  if (kind === "verify") {
    const link = `${origin}/verify?t=${tok}`;
    return sendMail(db, user.email, "تأیید ایمیل حساب راهبر",
      mailHtml(`سلام ${clip(user.name, 60)}، خوش آمدید!`, "برای فعال شدن حساب راهبر، ایمیل خود را با زدن دکمه‌ی زیر تأیید کنید. این لینک تا سه روز اعتبار دارد.", "تأیید ایمیل", link));
  }
  const link = `${origin}/?reset=${tok}`;
  return sendMail(db, user.email, "بازیابی رمز حساب راهبر",
    mailHtml("بازیابی رمز", "برای ساختن رمز تازه، دکمه‌ی زیر را بزنید. این لینک فقط یک ساعت اعتبار دارد.", "ساختن رمز تازه", link));
}

// Keys a viewer may store on the server: chart drawings per series, the demo account, preferences.
const DATA_KEY = /^(draw:[a-z0-9]{2,12}|demo|prefs)$/;

export async function handleAuth(req, url, db) {
  const p = url.pathname;
  if (!(p.startsWith("/api/auth/") || p === "/api/user/data" || p === "/verify")) return null;
  await ensure(db);
  const origin = url.origin;
  if (req.method !== "GET") {
    const o = req.headers.get("origin");
    if (o && o !== origin) return err("forbidden", 403);
    if (+(req.headers.get("content-length") || 0) > 200000) return err("too large", 413);
  }
  const body = async () => { try { return await req.json(); } catch (e) { return {}; } };

  if (p === "/verify" && req.method === "GET") {
    const tok = url.searchParams.get("t") || "";
    const row = tok && await db.prepare("SELECT uid FROM tokens WHERE h = ? AND kind = 'verify' AND expires > ?").bind(await sha(tok), now()).first();
    if (row) {
      await db.batch([db.prepare("UPDATE users SET verified = 1 WHERE id = ?").bind(row.uid), db.prepare("DELETE FROM tokens WHERE uid = ? AND kind = 'verify'").bind(row.uid)]);
      return Response.redirect(origin + "/?ok=verified#usd", 302);
    }
    return Response.redirect(origin + "/?ok=badlink#usd", 302);
  }

  if (p === "/api/auth/me") {
    const u = await currentUser(req, db);
    return res({ user: pub(u), mail: !!(await mailer(db)) });
  }

  if (p === "/api/auth/register" && req.method === "POST") {
    const iph = await ipHash(req, db);
    if (await limited(db, iph)) return err("تعداد درخواست‌ها زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.", 429);
    const d = await body();
    if (d.website) return res({ user: null });
    const name = clip(d.name, 60), email = clip(d.email, 120).toLowerCase(), pw = String(d.password || "");
    let phone = toLatin(d.phone).replace(/[\s\-().]/g, ""); if (phone.startsWith("00")) phone = "+" + phone.slice(2);
    if (name.length < 2) return err("لطفاً نام خود را بنویسید.");
    if (!EMAIL_RE.test(email)) return err("ایمیل درست نیست. مثال: name@gmail.com");
    if (pw.length < 8) return err("رمز باید حداقل ۸ حرف باشد.");
    if (pw.length > 200) return err("رمز خیلی طولانی است.");
    if (phone && !/^\+?\d{9,15}$/.test(phone)) return err("شماره‌ی تماس درست نیست. مثال: 0700123456");
    await note(db, iph);
    if (await db.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return err("با این ایمیل قبلاً حساب ساخته شده؛ وارد شوید یا رمز را بازیابی کنید.", 409);
    const salt = rand(16), t = now();
    const r = await db.prepare("INSERT INTO users(email, name, phone, city, role, wants, ads, pw, salt, iter, verified, created, last_login) VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?)")
      .bind(email, name, phone || null, clip(d.city, 40), clip(d.role, 40), d.wants ? 1 : 0, d.ads ? 1 : 0, await hashPw(pw, salt, PBKDF2_ITER), salt, PBKDF2_ITER, t, t).run();
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(r.meta.last_row_id).first();
    const mailed = await sendToken(db, origin, user, "verify");
    const tok = await newSession(db, user.id);
    return res({ user: pub(user), mailed }, 200, { "set-cookie": setCookie(tok) });
  }

  if (p === "/api/auth/login" && req.method === "POST") {
    const iph = await ipHash(req, db);
    if (await limited(db, iph)) return err("تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید.", 429);
    const d = await body();
    const email = clip(d.email, 120).toLowerCase(), pw = String(d.password || "");
    const u = email && await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    const ok = u && pw && same(await hashPw(pw, u.salt, u.iter || PBKDF2_ITER), u.pw);
    if (!ok) { await note(db, iph); return err("ایمیل یا رمز اشتباه است.", 401); }
    await db.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now(), u.id).run();
    const tok = await newSession(db, u.id);
    return res({ user: pub(u) }, 200, { "set-cookie": setCookie(tok) });
  }

  if (p === "/api/auth/logout" && req.method === "POST") {
    const tok = cookieOf(req);
    if (tok) await db.prepare("DELETE FROM sessions WHERE h = ?").bind(await sha(tok)).run();
    return res({ ok: true }, 200, { "set-cookie": clearCookie() });
  }

  if (p === "/api/auth/resend" && req.method === "POST") {
    const u = await currentUser(req, db);
    if (!u) return err("ابتدا وارد شوید.", 401);
    if (u.verified) return res({ ok: true, verified: true });
    const iph = await ipHash(req, db);
    if (await limited(db, iph)) return err("تعداد درخواست‌ها زیاد است؛ کمی بعد امتحان کنید.", 429);
    await note(db, iph);
    return res({ ok: true, mailed: await sendToken(db, origin, u, "verify") });
  }

  if (p === "/api/auth/forgot" && req.method === "POST") {
    const iph = await ipHash(req, db);
    if (await limited(db, iph)) return err("تعداد درخواست‌ها زیاد است؛ کمی بعد امتحان کنید.", 429);
    await note(db, iph);
    if (!(await mailer(db))) return err("بازیابی رمز با ایمیل هنوز فعال نشده است؛ به‌زودی فعال می‌شود.", 503);
    const d = await body(), email = clip(d.email, 120).toLowerCase();
    const u = EMAIL_RE.test(email) && await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (u) await sendToken(db, origin, u, "reset");
    return res({ ok: true }); // same answer whether or not the email has an account
  }

  if (p === "/api/auth/reset" && req.method === "POST") {
    const d = await body(), tok = String(d.token || ""), pw = String(d.password || "");
    if (pw.length < 8 || pw.length > 200) return err("رمز باید حداقل ۸ حرف باشد.");
    const row = tok && await db.prepare("SELECT uid FROM tokens WHERE h = ? AND kind = 'reset' AND expires > ?").bind(await sha(tok), now()).first();
    if (!row) return err("این لینک باطل شده یا وقتش گذشته است؛ دوباره «فراموشی رمز» را بزنید.", 400);
    const salt = rand(16);
    await db.batch([
      db.prepare("UPDATE users SET pw = ?, salt = ?, iter = ?, verified = 1 WHERE id = ?").bind(await hashPw(pw, salt, PBKDF2_ITER), salt, PBKDF2_ITER, row.uid),
      db.prepare("DELETE FROM tokens WHERE uid = ? AND kind = 'reset'").bind(row.uid),
      db.prepare("DELETE FROM sessions WHERE uid = ?").bind(row.uid),
    ]);
    const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(row.uid).first();
    const s = await newSession(db, u.id);
    return res({ user: pub(u) }, 200, { "set-cookie": setCookie(s) });
  }

  if (p === "/api/auth/profile" && req.method === "POST") {
    const u = await currentUser(req, db);
    if (!u) return err("ابتدا وارد شوید.", 401);
    const d = await body();
    let phone = toLatin(d.phone).replace(/[\s\-().]/g, ""); if (phone.startsWith("00")) phone = "+" + phone.slice(2);
    if (phone && !/^\+?\d{9,15}$/.test(phone)) return err("شماره‌ی تماس درست نیست.");
    const name = clip(d.name, 60) || u.name;
    await db.prepare("UPDATE users SET name = ?, phone = ?, city = ?, role = ?, wants = ?, ads = ? WHERE id = ?")
      .bind(name, phone || null, clip(d.city, 40), clip(d.role, 40), d.wants ? 1 : 0, d.ads ? 1 : 0, u.id).run();
    return res({ user: pub(await db.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first()) });
  }

  if (p === "/api/user/data") {
    const u = await currentUser(req, db);
    if (!u) return err("ابتدا وارد شوید.", 401);
    if (req.method === "GET") {
      const rows = (await db.prepare("SELECT k, v, updated FROM userdata WHERE uid = ?").bind(u.id).all()).results;
      const data = {}; for (const r of rows) data[r.k] = { v: r.v, updated: r.updated };
      return res({ data });
    }
    if (req.method === "PUT") {
      const d = await body(), k = String(d.k || ""), v = d.v;
      if (!DATA_KEY.test(k)) return err("bad key");
      if (typeof v !== "string" || v.length > 150000) return err("bad value");
      if (v === "" || v === "[]" || v === "null") { await db.prepare("DELETE FROM userdata WHERE uid = ? AND k = ?").bind(u.id, k).run(); return res({ ok: true }); }
      const n = await db.prepare("SELECT COUNT(*) AS n FROM userdata WHERE uid = ?").bind(u.id).first("n");
      if (n >= 60 && !(await db.prepare("SELECT 1 FROM userdata WHERE uid = ? AND k = ?").bind(u.id, k).first())) return err("too many keys");
      await db.prepare("INSERT INTO userdata(uid, k, v, updated) VALUES(?,?,?,?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, updated = excluded.updated").bind(u.id, k, v, now()).run();
      return res({ ok: true });
    }
  }
  return err("not found", 404);
}

// Owner view: registered accounts (no passwords or hashes leave the database).
export async function listUsers(db) {
  await ensure(db);
  return (await db.prepare("SELECT name, email, phone, city, role, wants, ads, verified, created, last_login FROM users ORDER BY created DESC LIMIT 5000").all()).results;
}

// Housekeeping, called from the cron: drop expired sessions/tokens and old rate-limit rows.
export async function cleanupAuth(db) {
  await ensure(db);
  const t = now();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires < ?").bind(t),
    db.prepare("DELETE FROM tokens WHERE expires < ?").bind(t),
    db.prepare("DELETE FROM authlog WHERE ts < ?").bind(t - 86400),
  ]);
}
