// Home (four big buttons) and the one-screen sign-in: phone → code → name (first time only).
import { html, $ } from '../core/html.js';
import { t, getLang, errorText } from '../core/i18n.js';
import { icon, logoMark, field, formErrorSlot, clearErrors, setFieldError, showApiError, busy, toast, validPhone, latin } from '../core/ui.js';
import { state, api, loadCatalog } from './state.js';
import { frame } from './shell.js';

const root = () => document.getElementById('app');

/** The four home buttons. Each maps to one or more services; buttons for closed services show as unavailable. */
export const HOME_BUTTONS = [
  { key: 'btn_bill', ico: 'bolt', href: '/new/bill_payment', services: ['bill_payment'] },
  { key: 'btn_topup', ico: 'phone', href: '/new/mobile_topup', services: ['mobile_topup'] },
  { key: 'btn_account', ico: 'user', href: '/account', services: ['account_statement', 'account_update'] },
  { key: 'btn_orders', ico: 'chats', href: '/requests', services: null },
];

export async function home() {
  let catalog = state.catalog;
  try { catalog = await loadCatalog(); } catch { /* still show buttons */ }
  const open = new Set((catalog?.services || []).filter((s) => s.status === 'active').map((s) => s.id));
  const first = state.user?.full_name.split(/\s+/)[0];

  root().innerHTML = frame(html`
    <h1 class="text-[24px] font-bold leading-snug">${state.user ? html`${t('hello')} ${first} 👋` : t('hello_guest')}</h1>
    <p class="mt-1 text-[16px] text-fog-400">${t('home_q')}</p>
    <div class="mt-6 grid grid-cols-2 gap-3.5">
      ${HOME_BUTTONS.map((b) => {
        const closed = catalog && b.services && !b.services.some((id) => open.has(id));
        const href = state.user ? b.href : `/login?next=${encodeURIComponent(b.href)}`;
        return html`<a href="${closed ? '#' : href}" class="tile" ${closed ? html`aria-disabled="true" data-closed` : ''}>
          <span class="tile-ico">${icon(b.ico, 'size-7')}</span>
          <span><span class="tile-title block">${t(b.key)}</span><span class="tile-sub block">${closed ? t('closed_now') : t(b.key + '_sub')}</span></span>
          ${b.key === 'btn_orders' && state.user ? html`<span data-badge-chats class="${state.badges.chats ? '' : 'hidden'} absolute end-4 top-4 grid min-w-[24px] place-items-center rounded-full bg-gold-400 px-1.5 text-[12px] font-bold leading-6 text-ink-950">${state.badges.chats}</span>` : ''}
        </a>`;
      })}
    </div>`).s;
  root().querySelectorAll('[data-closed]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast(t('closed_now'), 'info'); }));
}

// ── sign in / sign up in one flow ───────────────────────────────────────
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/admin') ? n : '/');

export function login(_p, query) {
  const next = safeNext(query.get('next'));
  let phone = '';
  let code = '';

  const page = (inner) => {
    root().innerHTML = frame(html`<div class="mx-auto w-full max-w-[420px] pt-4">
      <div class="mb-6 flex justify-center">${logoMark('size-14')}</div>${inner}
      <p class="mt-8 text-center text-[12.5px] leading-relaxed text-fog-600">${t('terms_line')}</p></div>`).s;
  };

  const stepPhone = () => {
    page(html`
      <h1 class="text-center text-[22px] font-bold">${t('login_title')}</h1>
      <p class="mt-2 text-center text-[15px] text-fog-400">${t('login_sub')}</p>
      <form class="mt-7 space-y-5" novalidate>
        ${formErrorSlot()}
        ${field({ name: 'phone', label: t('phone_label'), type: 'tel', value: phone, placeholder: t('phone_ph'), attrs: 'inputmode="tel" autocomplete="tel" dir="ltr" maxlength="16"' })}
        <button class="btn-gold btn-xl" type="submit">${t('send_code')}</button>
      </form>`);
    const form = $('form', root());
    const input = $('#f_phone', root());
    input.classList.add('input-lg', 'text-center', 'tracking-wider');
    input.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clearErrors(form);
      const v = latin(input.value).replace(/\s/g, '');
      if (!validPhone(v)) return setFieldError(form, 'phone', t('v_phone'));
      const btn = form.querySelector('button'); busy(btn, true);
      try {
        const r = await api.post('/api/auth/start', { phone: v });
        phone = r.phone;
        stepCode(r.demo_code);
      } catch (err) {
        busy(btn, false);
        if (err.field) setFieldError(form, 'phone', err.code === 'validation' ? t('v_phone') : errorText(err));
        else showApiError(form, err);
      }
    });
  };

  const stepCode = (demo) => {
    page(html`
      <h1 class="text-center text-[22px] font-bold">${t('code_title')}</h1>
      <p class="mt-2 text-center text-[15px] text-fog-400">${t('code_sub')}</p>
      <p class="mt-1 text-center text-[17px] font-bold" dir="ltr">${phone}</p>
      <form class="mt-6 space-y-5" novalidate>
        <div data-demo>${demoNote(demo)}</div>
        ${formErrorSlot()}
        ${field({ name: 'code', label: t('auth_code'), attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"' })}
        <button class="btn-gold btn-xl" type="submit">${t('code_btn')}</button>
        <div class="flex justify-between gap-2">
          <button type="button" data-resend class="btn-quiet btn-sm">${t('code_resend')}</button>
          <button type="button" data-change class="btn-quiet btn-sm">${t('code_change')}</button>
        </div>
      </form>`);
    const form = $('form', root());
    const input = $('#f_code', root());
    input.classList.add('input-lg', 'text-center', 'text-2xl', 'tracking-[0.5em]');
    input.focus();
    let sending = false;
    const submit = async () => {
      if (sending) return;
      clearErrors(form);
      code = latin(input.value).trim();
      if (!/^\d{6}$/.test(code)) return setFieldError(form, 'code', t('v_code'));
      const btn = form.querySelector('button[type=submit]');
      sending = true; busy(btn, true);
      try {
        const r = await api.post('/api/auth/confirm', { phone, code });
        if (r.need_name) return stepName();
        state.user = r.user;
        state.router.go(next, { replace: true });
      } catch (err) {
        sending = false; busy(btn, false);
        if (err.code === 'otp_invalid') setFieldError(form, 'code', errorText(err)); else showApiError(form, err);
      }
    };
    // Submits by itself as soon as 6 digits are typed — one less button to find.
    input.addEventListener('input', () => { if (/^\d{6}$/.test(latin(input.value).trim())) submit(); });
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    $('[data-change]', root()).addEventListener('click', stepPhone);
    $('[data-resend]', root()).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      busy(b, true);
      try { const r = await api.post('/api/auth/start', { phone }); $('[data-demo]', root()).innerHTML = demoNote(r.demo_code).s; toast(t('code_resent')); }
      catch (err) { toast(errorText(err), 'error'); } finally { busy(b, false); }
    });
  };

  const stepName = () => {
    page(html`
      <h1 class="text-center text-[22px] font-bold">${t('name_title')}</h1>
      <p class="mt-2 text-center text-[15px] text-fog-400">${t('name_sub')}</p>
      <form class="mt-7 space-y-5" novalidate>
        ${formErrorSlot()}
        ${field({ name: 'full_name', label: t('name_label'), attrs: 'autocomplete="name" maxlength="80"' })}
        <button class="btn-gold btn-xl" type="submit">${t('name_btn')}</button>
      </form>`);
    const form = $('form', root());
    const input = $('#f_full_name', root());
    input.classList.add('input-lg');
    input.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clearErrors(form);
      if (input.value.trim().length < 2) return setFieldError(form, 'full_name', t('v_name'));
      const btn = form.querySelector('button'); busy(btn, true);
      try {
        const r = await api.post('/api/auth/confirm', { phone, code, full_name: input.value.trim(), lang: getLang() });
        state.user = r.user;
        state.router.go(next, { replace: true });
      } catch (err) {
        busy(btn, false);
        if (err.code === 'otp_invalid') { toast(errorText(err), 'error'); stepCode(); } else showApiError(form, err);
      }
    });
  };

  stepPhone();
}

function demoNote(code) {
  if (!code) return html``;
  return html`<div class="rounded-2xl border border-gold-400/25 bg-gold-400/[0.07] px-4 py-3 text-center text-[14px] text-gold-200">${t('code_demo')} <b class="ms-1 text-xl tracking-[0.3em]" dir="ltr">${code}</b></div>`;
}

export function notFound() {
  root().innerHTML = frame(html`<div class="flex flex-col items-center py-20 text-center">
    <p class="text-6xl font-bold gold-text">404</p>
    <p class="mt-5 text-[17px]">${t('err_not_found')}</p>
    <a href="/" class="btn-gold btn-xl mt-8 max-w-xs">${t('back_home')}</a>
  </div>`).s;
}
