// In-app notifications and Telegram delivery.
// Telegram messages never include amounts, account details, names or payment references —
// only a generic status line and a link back to the app.
import { now } from './util.js';

export const STATUS_TEXT = {
  pending: { en: 'Request received', fa: 'درخواست دریافت شد', body_en: 'We have received your request and it is waiting for review.', body_fa: 'درخواست شما دریافت شد و در انتظار بررسی است.' },
  under_review: { en: 'Request under review', fa: 'درخواست در حال بررسی', body_en: 'An operator is reviewing your request.', body_fa: 'یک کارمند در حال بررسی درخواست شماست.' },
  payment_verified: { en: 'Payment verified', fa: 'پرداخت تأیید شد', body_en: 'Your payment has been verified against official records.', body_fa: 'پرداخت شما با سوابق رسمی تطبیق و تأیید شد.' },
  processing: { en: 'Request processing', fa: 'درخواست در حال انجام', body_en: 'Your request is being processed.', body_fa: 'درخواست شما در حال انجام است.' },
  completed: { en: 'Request completed', fa: 'درخواست تکمیل شد', body_en: 'Your request has been completed.', body_fa: 'درخواست شما تکمیل شد.' },
  rejected: { en: 'Request rejected', fa: 'درخواست رد شد', body_en: 'Your request could not be accepted. Open it to see the reason.', body_fa: 'درخواست شما پذیرفته نشد. برای دیدن دلیل آن را باز کنید.' },
};

export async function notifyUser(env, ctx, user, { kind, title_en, title_fa, body_en = '', body_fa = '', link = null, createdBy = null, tg_en, tg_fa }) {
  await env.DB.prepare(
    'INSERT INTO notifications (user_id, kind, title_en, title_fa, body_en, body_fa, link, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
  ).bind(user.id, kind, title_en, title_fa, body_en, body_fa, link, createdBy, now()).run();

  if (user.telegram_chat && user.notify_telegram && env.TELEGRAM_BOT_TOKEN) {
    const fa = user.lang === 'fa';
    const text = `${fa ? 'راهبر پی' : 'Rahbar Pay'} — ${fa ? (tg_fa ?? title_fa) : (tg_en ?? title_en)}\n${fa ? 'برای جزئیات وارد برنامه شوید.' : 'Sign in to the app for details.'}`;
    const p = sendTelegram(env, user.telegram_chat, text);
    if (ctx?.waitUntil) ctx.waitUntil(p); else await p;
  }
}

export async function notifyStatus(env, ctx, user, request, status, actorId) {
  const t = STATUS_TEXT[status];
  if (!t) return;
  await notifyUser(env, ctx, user, {
    kind: 'request_status',
    title_en: `${t.en} · ${request.tracking_no}`,
    title_fa: `${t.fa} · ${request.tracking_no}`,
    body_en: t.body_en,
    body_fa: t.body_fa,
    link: `/requests/${request.tracking_no}`,
    createdBy: actorId,
    tg_en: t.en, // no tracking number or amounts on Telegram
    tg_fa: t.fa,
  });
}

export async function sendTelegram(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Operator alert: counts only, no customer data. */
export async function alertOperators(env, ctx, text) {
  if (!env.TELEGRAM_ADMIN_CHAT) return;
  const p = sendTelegram(env, env.TELEGRAM_ADMIN_CHAT, `Rahbar Pay ops — ${text}`);
  if (ctx?.waitUntil) ctx.waitUntil(p);
}
