// Public pages: landing, sign-in, registration + phone verification, password reset.
import { html, $ } from '../core/html.js';
import { t, L, getLang, fmtMoney, errorText } from '../core/i18n.js';
import {
  icon, logo, field, formErrorSlot, clearErrors, setFieldError, showApiError, busy, toast, validPhone, latin, demoTag,
} from '../core/ui.js';
import { lineChart, demoSeries, DEMO_MARKETS } from '../core/chart.js';
import { state, api, loadCatalog } from './state.js';
import { demoBanner, langButton } from './shell.js';

const SVC_ICON = { buy: 'buy', sell: 'sell', bill: 'bill', phone: 'phone', document: 'doc', user: 'user', service: 'service' };
export const svcIcon = (s) => SVC_ICON[s.icon] || 'service';

// ── Landing ─────────────────────────────────────────────────────────────
export async function landing(root) {
  let catalog = null;
  try { catalog = await loadCatalog(); } catch { /* landing still renders */ }
  const services = catalog?.services || [];
  const methods = catalog?.payment_methods || [];
  const signedIn = !!state.user;

  root.innerHTML = html`
  ${demoBanner()}
  <div class="grain">
    <header class="sticky top-0 z-30 border-b border-line bg-ink-950/75 backdrop-blur-xl">
      <div class="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <a href="/">${logo()}</a>
        <nav class="ms-6 hidden items-center gap-1 md:flex">
          <a href="#services" data-anchor class="btn-quiet btn-sm">${t('land_nav_services')}</a>
          <a href="#how" data-anchor class="btn-quiet btn-sm">${t('land_nav_how')}</a>
          <a href="#security" data-anchor class="btn-quiet btn-sm">${t('land_nav_security')}</a>
        </nav>
        <div class="ms-auto flex items-center gap-2">
          ${langButton()}
          ${signedIn
            ? html`<a href="/dashboard" class="btn-gold btn-sm">${t('nav_dashboard')}</a>`
            : html`<a href="/login" class="btn-quiet btn-sm hidden sm:inline-flex">${t('land_signin')}</a><a href="/register" class="btn-gold btn-sm">${t('land_open')}</a>`}
        </div>
      </div>
    </header>

    <section class="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-28 lg:pt-24">
      <div class="anim-in">
        <p class="eyebrow mb-6 flex items-center gap-3"><span class="h-px w-8 bg-gold-400/60"></span>${t('land_kicker')}</p>
        <h1 class="text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">${t('land_title_1')}<br/><span class="gold-text">${t('land_title_2')}</span></h1>
        <p class="mt-6 max-w-xl text-[16.5px] leading-relaxed text-fog-400">${t('land_sub')}</p>
        <div class="mt-9 flex flex-wrap gap-3">
          <a href="${signedIn ? '/dashboard' : '/register'}" class="btn-gold btn-lg">${t('land_cta')}${icon('arrowR', 'size-4 flip-rtl')}</a>
          <a href="${signedIn ? '/requests' : '/login?next=/requests'}" class="btn-ghost btn-lg">${icon('search', 'size-4')}${t('land_cta2')}</a>
        </div>
        <dl class="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-8">
          <div><dt class="text-2xl font-semibold">100%</dt><dd class="mt-1 text-xs leading-snug text-fog-500">${t('land_stat1')}</dd></div>
          <div><dt class="text-2xl font-semibold">2</dt><dd class="mt-1 text-xs leading-snug text-fog-500">${t('land_stat2')} · EN / دری</dd></div>
          <div><dt class="text-2xl font-semibold">24/7</dt><dd class="mt-1 text-xs leading-snug text-fog-500">${t('land_stat3')}</dd></div>
        </dl>
      </div>

      <div class="relative min-w-0">
        <div class="absolute -inset-6 rounded-[32px] bg-gold-400/[0.04] blur-2xl"></div>
        <div class="card relative overflow-hidden">
          <div class="hairline-top"></div>
          <div class="flex items-center justify-between px-6 pt-5">
            <div><p class="eyebrow">${t('land_preview_title')}</p><p class="mt-2 text-sm text-fog-400">${t('market_usd')}</p></div>
            ${demoTag()}
          </div>
          <div class="px-6 pt-1"><p class="num text-[34px] font-semibold tracking-tight">70.85 <span class="text-base font-normal text-fog-500">AFN</span></p></div>
          <div id="hero-chart" class="px-3"></div>
          <div class="grid grid-cols-2 gap-px border-t border-line bg-line">
            ${[
              ['buy', 'card_buy', true], ['sell', 'card_sell', true], ['user', 'card_account', false], ['card', 'card_history', false],
            ].map(([ico, key, locked]) => html`<div class="flex items-center gap-3 bg-ink-850 px-5 py-4">
              <span class="grid size-9 place-items-center rounded-xl border border-line bg-ink-800 ${locked ? 'text-fog-500' : 'text-gold-300'}">${icon(ico, 'size-4')}</span>
              <div class="min-w-0"><p class="truncate text-[13px] font-medium">${t(key)}</p><p class="truncate text-[11px] text-fog-500">${locked ? t('card_locked') : t('card_open')}</p></div>
              ${locked ? html`<span class="ms-auto text-fog-600">${icon('lock', 'size-3.5')}</span>` : ''}
            </div>`)}
          </div>
        </div>
      </div>
    </section>

    <section id="services" class="border-t border-line">
      <div class="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <div class="max-w-2xl"><p class="eyebrow mb-4">${t('land_nav_services')}</p><h2 class="h-display">${t('land_services_title')}</h2><p class="mt-4 text-fog-400">${t('land_services_sub')}</p></div>
        <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${services.map((s) => html`<div class="card card-pad">
            <div class="flex items-start justify-between">
              <span class="grid size-11 place-items-center rounded-xl border border-line bg-ink-800 ${s.status === 'active' ? 'text-gold-300' : 'text-fog-500'}">${icon(svcIcon(s))}</span>
              ${s.status === 'legal_pending' ? html`<span class="badge b-neutral">${icon('lock', 'size-3')}${t('svc_locked')}</span>` : html`<span class="badge b-ok"><span class="badge-dot"></span>${t('card_open')}</span>`}
            </div>
            <h3 class="mt-5 font-semibold">${L(s, 'name')}</h3>
            <p class="mt-2 text-sm leading-relaxed text-fog-400">${L(s, 'desc')}</p>
          </div>`)}
        </div>
        <div class="mt-14">
          <p class="eyebrow mb-5">${t('pay_methods_title')}</p>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            ${methods.map((m) => html`<div class="flex items-center gap-3 rounded-xl border border-line px-4 py-3.5">
              <span class="text-fog-400">${icon(m.provider === 'bank_transfer' ? 'bank' : m.provider === 'gateway' ? 'card' : 'wallet', 'size-4')}</span>
              <div class="min-w-0"><p class="truncate text-sm font-medium">${L(m, 'name')}</p><p class="truncate text-[11px] text-fog-500">${m.status === 'disabled' ? t('req_method_disabled') : t('req_method_manual')}</p></div>
            </div>`)}
          </div>
        </div>
      </div>
    </section>

    <section id="how" class="border-t border-line bg-ink-900/40">
      <div class="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 lg:py-28">
        <h2 class="h-display max-w-xl">${t('land_how_title')}</h2>
        <div class="mt-12 grid gap-4 md:grid-cols-3">
          ${[1, 2, 3].map((n) => html`<div class="card card-pad">
            <span class="num text-sm font-semibold text-gold-400">0${n}</span>
            <h3 class="mt-6 text-lg font-semibold">${t(`land_how_${n}`)}</h3>
            <p class="mt-2 text-sm leading-relaxed text-fog-400">${t(`land_how_${n}d`)}</p>
          </div>`)}
        </div>
      </div>
    </section>

    <section id="security" class="border-t border-line">
      <div class="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-28">
        <div><p class="eyebrow mb-4">${t('land_nav_security')}</p><h2 class="h-display">${t('land_sec_title')}</h2></div>
        <div class="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          ${[['shieldCheck', 1], ['scroll', 2], ['key', 3], ['send', 4]].map(([ico, n]) => html`<div class="bg-ink-850 p-6">
            <span class="text-gold-400">${icon(ico, 'size-5')}</span>
            <h3 class="mt-4 font-semibold">${t(`land_sec_${n}`)}</h3>
            <p class="mt-2 text-sm leading-relaxed text-fog-400">${t(`land_sec_${n}d`)}</p>
          </div>`)}
        </div>
      </div>
    </section>

    <section class="border-t border-line">
      <div class="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <h2 class="text-2xl font-semibold tracking-tight">${t('auth_side_title')}</h2>
        <a href="${signedIn ? '/dashboard' : '/register'}" class="btn-gold btn-lg">${t('land_open')}${icon('arrowR', 'size-4 flip-rtl')}</a>
      </div>
    </section>

    <footer class="border-t border-line">
      <div class="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <div class="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          ${logo({ sub: t('tagline') })}
          <p class="max-w-xl text-xs leading-relaxed text-fog-500">${t('land_footer_legal')}</p>
        </div>
        <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs text-fog-600">
          <span>© ${new Date().getFullYear()} Rahbar Pay</span>
          <span>${state.config?.support_email || ''}</span>
        </div>
      </div>
    </footer>
  </div>`.s;

  const usd = DEMO_MARKETS[0];
  lineChart($('#hero-chart', root), demoSeries(usd, '7d'), { digits: 2, height: 200, range: '7d' });
  root.querySelectorAll('[data-anchor]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
  }));
}

// ── Auth layout ─────────────────────────────────────────────────────────
function authLayout(inner) {
  return html`${demoBanner()}
  <div class="grid min-h-[calc(100dvh-36px)] lg:grid-cols-[1fr_1.05fr]">
    <div class="flex flex-col px-5 py-6 sm:px-10">
      <div class="flex items-center justify-between"><a href="/">${logo()}</a>${langButton()}</div>
      <div class="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12 anim-in">${inner}</div>
      <p class="text-center text-xs text-fog-600">© Rahbar Pay · ${t('tagline')}</p>
    </div>
    <div class="relative hidden overflow-hidden border-s border-line bg-ink-900 lg:block">
      <div class="grain absolute inset-0"></div>
      <div class="relative flex h-full flex-col justify-between p-14">
        <div class="hairline-top"></div>
        <div>
          <p class="eyebrow mb-5">${t('land_kicker')}</p>
          <h2 class="max-w-md text-4xl font-semibold leading-tight tracking-tight">${t('auth_side_title')}</h2>
          <p class="mt-5 max-w-md text-fog-400">${t('auth_side_sub')}</p>
        </div>
        <div class="card max-w-md p-5">
          <div class="flex items-center justify-between"><span class="mono text-sm text-fog-200">RP-2611-K7Q4ZM</span><span class="badge b-gold"><span class="badge-dot"></span>${t('st_payment_verified')}</span></div>
          <div class="mt-5 space-y-3">
            ${['pending', 'under_review', 'payment_verified'].map((s, i) => html`<div class="flex items-center gap-3 text-sm">
              <span class="grid size-6 place-items-center rounded-full ${i < 3 ? 'bg-gold-400 text-ink-950' : 'border border-line'}">${icon('check', 'size-3.5')}</span>
              <span class="${i === 2 ? 'text-fog-50' : 'text-fog-400'}">${t('st_' + s)}</span>
            </div>`)}
            <div class="flex items-center gap-3 text-sm"><span class="size-6 rounded-full border border-line-strong"></span><span class="text-fog-600">${t('st_completed')}</span></div>
          </div>
          <div class="mt-4 border-t border-line pt-3">${demoTag()}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function demoCodeNote(code) {
  if (!code) return '';
  return html`<div class="mb-5 rounded-xl border border-gold-400/25 bg-gold-400/[0.07] px-4 py-3 text-sm text-gold-200">${t('auth_demo_code')} <b class="mono ms-1 text-base tracking-[0.25em]">${code}</b></div>`;
}

// ── Login ───────────────────────────────────────────────────────────────
export function login(root, query) {
  const next = query.get('next');
  root.innerHTML = authLayout(html`
    <h1 class="h-page">${t('auth_welcome')}</h1>
    <p class="mt-2 text-sm text-fog-400">${t('auth_welcome_sub')}</p>
    <form class="mt-8 space-y-5" novalidate>
      ${formErrorSlot()}
      ${field({ name: 'phone', label: t('auth_phone'), type: 'tel', placeholder: t('auth_phone_ph'), required: true, attrs: 'autocomplete="tel" inputmode="tel" dir="ltr"' })}
      <div>
        ${field({ name: 'password', label: t('auth_password'), type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
        <div class="mt-2 text-end"><a href="/forgot" class="text-xs text-gold-300 hover:text-gold-200">${t('auth_forgot')}</a></div>
      </div>
      <button class="btn-gold w-full" type="submit">${t('auth_signin')}</button>
    </form>
    <p class="mt-8 text-center text-sm text-fog-500">${t('auth_no_account')} <a href="/register" class="font-medium text-gold-300 hover:text-gold-200">${t('auth_create')}</a></p>
  `).s;

  const form = $('form', root);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const d = Object.fromEntries(new FormData(form));
    let bad = false;
    if (!validPhone(d.phone)) bad = setFieldError(form, 'phone', t('v_phone'));
    if (!d.password) bad = setFieldError(form, 'password', t('v_required'));
    if (bad) return;
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const r = await api.post('/api/auth/login', { phone: latin(d.phone), password: d.password });
      if (r.needs_verification) return verifyStep(root, r.phone, r.demo_code, next);
      state.user = r.user;
      state.router.go(safeNext(next), { replace: true });
    } catch (err) {
      showApiError(form, err);
    } finally { busy(btn, false); }
  });
}

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/admin') ? n : '/dashboard');

// ── Register ────────────────────────────────────────────────────────────
export function register(root) {
  root.innerHTML = authLayout(html`
    <h1 class="h-page">${t('auth_register_title')}</h1>
    <p class="mt-2 text-sm text-fog-400">${t('auth_register_sub')}</p>
    <form class="mt-8 space-y-5" novalidate>
      ${formErrorSlot()}
      ${field({ name: 'full_name', label: t('auth_full_name'), required: true, attrs: 'autocomplete="name" maxlength="80"' })}
      ${field({ name: 'phone', label: t('auth_phone'), type: 'tel', placeholder: t('auth_phone_ph'), required: true, attrs: 'autocomplete="tel" inputmode="tel" dir="ltr"' })}
      ${field({ name: 'password', label: t('auth_password_new'), type: 'password', hint: t('auth_password_hint'), required: true, attrs: 'autocomplete="new-password" minlength="10"' })}
      <div class="field" data-field="accept_terms">
        <label class="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fog-400"><input type="checkbox" name="accept_terms" class="check mt-1"/>${t('auth_terms')}</label>
        <p class="field-error"></p>
      </div>
      <button class="btn-gold w-full" type="submit">${t('continue')}</button>
    </form>
    <p class="mt-8 text-center text-sm text-fog-500">${t('auth_have_account')} <a href="/login" class="font-medium text-gold-300 hover:text-gold-200">${t('auth_signin')}</a></p>
  `).s;

  const form = $('form', root);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const fd = new FormData(form);
    const d = Object.fromEntries(fd);
    let bad = false;
    if ((d.full_name || '').trim().length < 3) bad = setFieldError(form, 'full_name', t('v_name'));
    if (!validPhone(d.phone)) bad = setFieldError(form, 'phone', t('v_phone'));
    if ((d.password || '').length < 10 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password)) bad = setFieldError(form, 'password', t('err_weak_password'));
    if (!fd.get('accept_terms')) bad = setFieldError(form, 'accept_terms', t('v_terms'));
    if (bad) return;
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const r = await api.post('/api/auth/register', { full_name: d.full_name, phone: latin(d.phone), password: d.password, accept_terms: true, lang: getLang() });
      verifyStep(root, r.phone, r.demo_code);
    } catch (err) {
      showApiError(form, err);
    } finally { busy(btn, false); }
  });
}

function verifyStep(root, phone, demoCode, next) {
  root.innerHTML = authLayout(html`
    <span class="mb-6 grid size-12 place-items-center rounded-2xl border border-line bg-ink-800 text-gold-300">${icon('phone', 'size-5')}</span>
    <h1 class="h-page">${t('auth_verify_title')}</h1>
    <p class="mt-2 text-sm text-fog-400">${t('auth_verify_sub')} <span class="mono text-fog-200" dir="ltr">${phone}</span></p>
    <form class="mt-8 space-y-5" novalidate>
      <div data-demo>${demoCodeNote(demoCode)}</div>
      ${formErrorSlot()}
      ${field({ name: 'code', label: t('auth_code'), required: true, attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"' })}
      <button class="btn-gold w-full" type="submit">${t('auth_verify')}</button>
      <button class="btn-quiet w-full" type="button" data-resend>${t('auth_resend')}</button>
    </form>
  `).s;
  const form = $('form', root);
  const input = $('#f_code', root);
  input.classList.add('text-center', 'text-xl', 'tracking-[0.5em]');
  input.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const code = latin(input.value).trim();
    if (!/^\d{6}$/.test(code)) return setFieldError(form, 'code', t('v_code'));
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const r = await api.post('/api/auth/verify-phone', { phone, code });
      state.user = r.user;
      state.router.go(safeNext(next), { replace: true });
    } catch (err) { showApiError(form, err); } finally { busy(btn, false); }
  });
  $('[data-resend]', root).addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try {
      const r = await api.post('/api/auth/resend', { phone, purpose: 'verify' });
      $('[data-demo]', root).innerHTML = demoCodeNote(r.demo_code).s || '';
      toast(t('auth_resent'));
    } catch (err) { toast(errorText(err), 'error'); } finally { busy(e.currentTarget, false); }
  });
}

// ── Forgot / reset ──────────────────────────────────────────────────────
export function forgot(root) {
  root.innerHTML = authLayout(html`
    <a href="/login" class="mb-8 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('back')}</a>
    <h1 class="h-page">${t('auth_reset_title')}</h1>
    <p class="mt-2 text-sm text-fog-400">${t('auth_reset_sub')}</p>
    <form class="mt-8 space-y-5" novalidate data-step="1">
      ${formErrorSlot()}
      ${field({ name: 'phone', label: t('auth_phone'), type: 'tel', placeholder: t('auth_phone_ph'), required: true, attrs: 'autocomplete="tel" inputmode="tel" dir="ltr"' })}
      <div data-step2 class="hidden space-y-5">
        <div data-demo></div>
        ${field({ name: 'code', label: t('auth_code'), required: true, attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"' })}
        ${field({ name: 'password', label: t('prof_new_pw'), type: 'password', hint: t('auth_password_hint'), required: true, attrs: 'autocomplete="new-password"' })}
      </div>
      <button class="btn-gold w-full" type="submit">${t('auth_send_code')}</button>
    </form>
  `).s;
  const form = $('form', root);
  let phone = null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const d = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    if (!phone) {
      if (!validPhone(d.phone)) return setFieldError(form, 'phone', t('v_phone'));
      busy(btn, true);
      try {
        const r = await api.post('/api/auth/forgot', { phone: latin(d.phone) });
        phone = latin(d.phone);
        $('[data-step2]', root).classList.remove('hidden');
        $('#f_phone', root).readOnly = true;
        $('[data-demo]', root).innerHTML = demoCodeNote(r.demo_code).s || '';
        busy(btn, false);
        btn.textContent = t('auth_set_password');
        $('#f_code', root).focus();
      } catch (err) { busy(btn, false); showApiError(form, err); }
      return;
    }
    let bad = false;
    if (!/^\d{6}$/.test(latin(d.code))) bad = setFieldError(form, 'code', t('v_code'));
    if ((d.password || '').length < 10) bad = setFieldError(form, 'password', t('err_weak_password'));
    if (bad) return;
    busy(btn, true);
    try {
      await api.post('/api/auth/reset', { phone, code: latin(d.code), password: d.password });
      toast(t('auth_reset_done'));
      state.router.go('/login', { replace: true });
    } catch (err) { showApiError(form, err); } finally { busy(btn, false); }
  });
}

export function notFound(root, inShell) {
  const body = html`<div class="flex flex-col items-center py-24 text-center">
    <p class="num text-6xl font-semibold gold-text">404</p>
    <h1 class="mt-6 text-xl font-semibold">${t('nf_title')}</h1>
    <p class="mt-2 text-sm text-fog-500">${t('nf_sub')}</p>
    <a href="${state.user ? '/dashboard' : '/'}" class="btn-ghost mt-8">${t('back')}</a>
  </div>`;
  return inShell ? body : (root.innerHTML = html`${demoBanner()}<div class="px-6">${body}</div>`.s);
}

export { fmtMoney };
