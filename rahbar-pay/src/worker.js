// Rahbar Pay — Cloudflare Worker entry point.
// Routes /api/* to the JSON API, /admin* to the admin single-page app, everything else to static assets.
import { HttpError, json, safeEqual, now } from './lib/util.js';
import { handleCustomer } from './routes/customer.js';
import { handleAdmin } from './routes/admin.js';
import { sendTelegram } from './lib/notify.js';

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "manifest-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'cross-origin-opener-policy': 'same-origin',
};

function withHeaders(res, extra = {}) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) if (!r.headers.has(k)) r.headers.set(k, v);
  return r;
}

function sameOrigin(request) {
  // CSRF defence for state-changing calls (in addition to SameSite=Strict cookies).
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  return origin === new URL(request.url).origin;
}

async function telegramWebhook(request, env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(request.headers.get('x-telegram-bot-api-secret-token') || '', env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json().catch(() => ({}));
  const msg = update.message;
  if (!msg?.text || !msg.chat?.id) return json({ ok: true });
  const chat = String(msg.chat.id);
  const m = msg.text.trim().match(/^\/start(?:\s+([A-Z0-9]{8}))?$/);
  if (m?.[1]) {
    const user = await env.DB.prepare("SELECT id, lang FROM users WHERE telegram_link_code = ? AND role = 'customer'").bind(m[1]).first();
    if (user) {
      await env.DB.prepare('UPDATE users SET telegram_chat = ?, telegram_link_code = NULL WHERE id = ?').bind(chat, user.id).run();
      await sendTelegram(env, chat, user.lang === 'fa'
        ? 'رهبر پی — اعلان‌ها فعال شد. ما فقط به‌روزرسانی وضعیت را بدون جزئیات مالی ارسال می‌کنیم.'
        : 'Rahbar Pay — notifications enabled. We only send status updates, never financial details.');
      return json({ ok: true });
    }
  }
  await sendTelegram(env, chat, 'Rahbar Pay — open Profile → Notifications in the app to link this chat.\nرهبر پی — برای اتصال، از بخش پروفایل ← اعلان‌ها در برنامه استفاده کنید.');
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/admin' || path.startsWith('/admin/')) {
        const page = await env.ASSETS.fetch(new Request(new URL('/admin', url), request));
        return withHeaders(page, { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
      }

      if (path.startsWith('/api/')) {
        if (path === '/api/telegram/webhook' && request.method === 'POST') return withHeaders(await telegramWebhook(request, env));
        if (!sameOrigin(request)) throw new HttpError(403, 'bad_origin');
        if (path === '/api/health') return withHeaders(json({ ok: true, time: now() }));
        const res = path.startsWith('/api/admin/')
          ? await handleAdmin(request, env, ctx, path)
          : await handleCustomer(request, env, ctx, path);
        return withHeaders(res);
      }

      return withHeaders(await env.ASSETS.fetch(request));
    } catch (err) {
      if (err instanceof HttpError) {
        return withHeaders(json({ error: err.code, message: err.message, ...(err.extra || {}) }, err.status));
      }
      console.error(err);
      return withHeaders(json({ error: 'server_error', message: 'Something went wrong.' }, 500));
    }
  },

  // Daily housekeeping (add `[triggers] crons = ["17 2 * * *"]` to wrangler.toml to enable).
  async scheduled(_event, env) {
    const t = now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
      env.DB.prepare('DELETE FROM otp_codes WHERE expires_at < ?').bind(t - 86400),
      env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(t),
    ]);
  },
};
