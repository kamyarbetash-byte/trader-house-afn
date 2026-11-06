// Admin console SPA (served at /admin). All authorization is enforced server-side.
import { html, raw, $, $$ } from '../core/html.js';
import { t, L, extend, applyLang, setLang, getLang, fmtMoney, fmtDate, fmtRelative, fmtNumber, errorText } from '../core/i18n.js';
import { client } from '../core/api.js';
import { createRouter } from '../core/router.js';
import {
  icon, logo, pageHeader, emptyState, skeletonRows, errorBox, statusBadge, kv, toast, modal, field, formErrorSlot,
  clearErrors, setFieldError, showApiError, busy, copyText, demoTag, STATUSES, latin, confirmDialog,
} from '../core/ui.js';
import { barChart } from '../core/chart.js';
import strings from './strings.js';

extend(strings);
const root = document.getElementById('app');
const S = { user: null, router: null, settings: null };
const api = client(() => { S.user = null; if (location.pathname !== '/admin/login') S.router?.go('/admin/login', { replace: true }); });
const view = () => $('#view');
const loading = () => { view().innerHTML = skeletonRows(6).s; };
const isAdmin = () => S.user?.role === 'admin';
const money = (r) => (r.amount ? fmtMoney(r.amount, r.currency) : '—');
const svcName = (r) => L({ name_en: r.service_en, name_fa: r.service_fa }, 'name');

// ── shell ───────────────────────────────────────────────────────────────
const NAV = [
  { href: '/admin', key: 'an_overview', ico: 'home' },
  { href: '/admin/requests', key: 'an_requests', ico: 'list' },
  { href: '/admin/reconciliation', key: 'an_recon', ico: 'bank' },
  { href: '/admin/customers', key: 'an_customers', ico: 'users' },
  { href: '/admin/support', key: 'an_support', ico: 'message' },
  { href: '/admin/reports', key: 'an_reports', ico: 'chart' },
  { href: '/admin/notifications', key: 'an_notifications', ico: 'bell' },
  { href: '/admin/audit', key: 'an_audit', ico: 'scroll' },
  { href: '/admin/settings', key: 'an_settings', ico: 'settings' },
];
const active = (href) => (href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(href));

function shell() {
  const u = S.user;
  const nav = NAV.map((n) => html`<a href="${n.href}" class="nav-link ${active(n.href) ? 'active' : ''}">${icon(n.ico, 'nav-ico')}<span>${t(n.key)}</span></a>`);
  return html`
  <div class="flex min-h-dvh">
    <aside class="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-e border-line bg-ink-900/70 px-4 py-6 lg:flex">
      <a href="/admin" class="mb-2 px-2">${logo({ size: 'sm', sub: t('a_console') })}</a>
      <div class="mb-6 mt-4 px-2">${demoTag()}</div>
      <nav class="flex flex-1 flex-col gap-1">${nav}</nav>
      <div class="mt-6 rounded-xl border border-line p-3.5">
        <p class="truncate text-sm font-medium">${u.full_name}</p>
        <p class="mt-0.5 text-[11.5px] text-fog-500"><span class="mono">${u.id}</span> · ${t(u.role === 'admin' ? 'a_role_admin' : 'a_role_operator')}</p>
        <button data-logout class="btn-quiet btn-sm mt-2 w-full justify-start px-2">${icon('logout', 'size-4 flip-rtl')}${t('nav_logout')}</button>
      </div>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur-xl">
        <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button data-drawer class="icon-btn lg:hidden">${icon('menu')}</button>
          <a href="/admin" class="lg:hidden">${logo({ size: 'sm' })}</a>
          <div class="relative ms-auto hidden w-full max-w-md md:block lg:ms-0">
            <span class="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-fog-500">${icon('search', 'size-4')}</span>
            <input data-search class="input h-10 ps-10 text-sm" placeholder="${t('a_search_ph')}" autocomplete="off" dir="ltr"/>
            <div data-search-results class="card absolute inset-x-0 top-12 hidden max-h-96 overflow-auto p-2"></div>
          </div>
          <div class="ms-auto flex items-center gap-2">
            <button data-lang class="btn-quiet btn-sm">${icon('globe', 'size-4')}${t('lang_toggle')}</button>
          </div>
        </div>
      </header>
      <main id="view" class="anim-in mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"></main>
    </div>
  </div>
  <div data-drawer-panel class="fixed inset-0 z-50 hidden lg:hidden">
    <div data-drawer-close class="absolute inset-0 bg-black/70"></div>
    <div class="absolute inset-y-0 start-0 flex w-[280px] flex-col border-e border-line bg-ink-900 p-5">
      <div class="mb-6 flex items-center justify-between">${logo({ size: 'sm' })}<button data-drawer-close class="icon-btn size-9">${icon('x', 'size-4')}</button></div>
      <nav class="flex flex-col gap-1">${nav}</nav>
      <button data-logout class="btn-quiet mt-auto">${icon('logout', 'size-4 flip-rtl')}${t('nav_logout')}</button>
    </div>
  </div>`;
}

function bindGlobal() {
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-lang]')) { setLang(getLang() === 'fa' ? 'en' : 'fa'); S.router.render(); }
    if (e.target.closest('[data-logout]')) { await api.post('/api/admin/logout').catch(() => {}); S.user = null; S.router.go('/admin/login', { replace: true }); }
    if (e.target.closest('[data-drawer]')) $('[data-drawer-panel]')?.classList.remove('hidden');
    if (e.target.closest('[data-drawer-close]') || e.target.closest('[data-drawer-panel] a')) $('[data-drawer-panel]')?.classList.add('hidden');
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a,button')) S.router.go(tr.dataset.href);
    if (!e.target.closest('[data-search], [data-search-results]')) $('[data-search-results]')?.classList.add('hidden');
  });
  let timer;
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-search]')) return;
    clearTimeout(timer);
    const q = e.target.value.trim();
    const box = $('[data-search-results]');
    if (q.length < 3) { box.classList.add('hidden'); return; }
    timer = setTimeout(async () => {
      try {
        const r = await api.get(`/api/admin/search?q=${encodeURIComponent(latin(q))}`);
        box.innerHTML = html`${r.customers.map((c) => html`<a href="/admin/customers/${c.id}" class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.04]">${icon('user', 'size-4 text-fog-500')}<span class="mono text-sm">${c.id}</span><span class="truncate text-sm text-fog-400">${c.full_name}</span></a>`)}
          ${r.requests.map((x) => html`<a href="/admin/requests/${x.tracking_no}" class="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.04]">${icon('list', 'size-4 text-fog-500')}<span class="mono text-sm">${x.tracking_no}</span><span class="ms-auto">${statusBadge(x.status)}</span></a>`)}
          ${!r.customers.length && !r.requests.length ? html`<p class="px-3 py-3 text-sm text-fog-500">${t('none_yet')}</p>` : ''}`.s;
        box.classList.remove('hidden');
      } catch { /* */ }
    }, 250);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-search]') && e.key === 'Enter') {
      const q = latin(e.target.value).trim().toUpperCase();
      if (/^RP-\d{4}-[A-Z0-9]{6}$/.test(q)) S.router.go(`/admin/requests/${q}`);
      else if (/^C-[A-Z0-9]{6}$/.test(q)) S.router.go(`/admin/customers/${q}`);
    }
  });
}

// ── auth pages ─────────────────────────────────────────────────────────
function authFrame(inner) {
  return html`<div class="grain grid min-h-dvh place-items-center px-5 py-10">
    <div class="w-full max-w-[420px] anim-in">
      <div class="mb-8 flex items-center justify-between">${logo({ sub: t('a_console') })}<button data-lang class="btn-quiet btn-sm">${icon('globe', 'size-4')}${t('lang_toggle')}</button></div>
      <div class="card card-pad sm:p-8">${inner}</div>
      <p class="mt-6 flex items-center justify-center gap-2 text-xs text-fog-600">${icon('lock', 'size-3.5')}${t('a_login_sub')}</p>
    </div>
  </div>`;
}

async function loginPage() {
  const setup = await api.get('/api/admin/setup').catch(() => ({ available: false }));
  root.innerHTML = authFrame(html`
    <h1 class="text-xl font-semibold">${t('a_login_title')}</h1>
    <form class="mt-6 space-y-5" novalidate>
      ${formErrorSlot()}
      ${field({ name: 'email', label: t('a_email'), type: 'email', required: true, attrs: 'autocomplete="username" dir="ltr"' })}
      ${field({ name: 'password', label: t('auth_password'), type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
      <button class="btn-gold w-full">${t('continue')}</button>
    </form>
    ${setup.available ? html`<a href="/admin/setup" class="btn-quiet btn-sm mt-4 w-full">${icon('key', 'size-4')}${t('a_setup_link')}</a>` : ''}
  `).s;
  const form = $('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(form);
    const d = Object.fromEntries(new FormData(form));
    if (!d.email) return setFieldError(form, 'email', t('v_required'));
    if (!d.password) return setFieldError(form, 'password', t('v_required'));
    const btn = form.querySelector('button'); busy(btn, true);
    try { const r = await api.post('/api/admin/login', d); totpPage(r.enroll); }
    catch (err) { showApiError(form, err.code === 'bad_credentials' ? { ...err, field: null, code: 'bad_credentials' } : err); busy(btn, false); }
  });
}

function totpPage(enroll) {
  root.innerHTML = authFrame(html`
    <span class="mb-5 grid size-12 place-items-center rounded-2xl border border-line bg-ink-800 text-gold-300">${icon('shieldCheck', 'size-5')}</span>
    <h1 class="text-xl font-semibold">${enroll ? t('a_totp_enroll') : t('a_totp_title')}</h1>
    <p class="mt-2 text-sm text-fog-400">${enroll ? t('a_totp_enroll_sub') : t('a_totp_sub')}</p>
    ${enroll ? html`<div class="mt-5 space-y-3 rounded-xl border border-line bg-ink-900 p-4">
      <div><p class="text-xs text-fog-500">${t('a_totp_key')}</p><div class="mt-1 flex items-center gap-2"><code class="mono flex-1 break-all text-sm text-gold-200" dir="ltr">${enroll.secret.replace(/(.{4})/g, '$1 ').trim()}</code><button type="button" data-copy-key class="icon-btn size-8">${icon('copy', 'size-3.5')}</button></div></div>
      <a href="${enroll.uri}" class="block truncate text-xs text-fog-500 underline" dir="ltr">${t('a_totp_uri')}</a>
    </div>` : ''}
    <form class="mt-6 space-y-5" novalidate>
      ${formErrorSlot()}
      ${field({ name: 'code', label: t('auth_code'), required: true, attrs: 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"' })}
      <button class="btn-gold w-full">${t('auth_verify')}</button>
    </form>`).s;
  $('[data-copy-key]')?.addEventListener('click', () => copyText(enroll.secret));
  const form = $('form');
  const input = $('#f_code'); input.classList.add('text-center', 'text-xl', 'tracking-[0.5em]'); input.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(form);
    const code = latin(input.value).trim();
    if (!/^\d{6}$/.test(code)) return setFieldError(form, 'code', t('v_code'));
    const btn = form.querySelector('button'); busy(btn, true);
    try { const r = await api.post('/api/admin/login/2fa', { code }); S.user = r.user; S.router.go('/admin', { replace: true }); }
    catch (err) { err.status === 401 && err.code === 'unauthenticated' ? loginPage() : showApiError(form, { ...err, field: 'code' }); busy(btn, false); }
  });
}

function setupPage() {
  root.innerHTML = authFrame(html`
    <h1 class="text-xl font-semibold">${t('a_setup_title')}</h1>
    <p class="mt-2 text-sm text-fog-400">${t('a_setup_sub')}</p>
    <form class="mt-6 space-y-5" novalidate>
      ${formErrorSlot()}
      ${field({ name: 'setup_key', label: t('a_setup_key'), type: 'password', required: true })}
      ${field({ name: 'full_name', label: t('auth_full_name'), required: true })}
      ${field({ name: 'email', label: t('a_email'), type: 'email', required: true, attrs: 'dir="ltr"' })}
      ${field({ name: 'password', label: t('auth_password_new'), type: 'password', required: true, hint: t('a_staff_pw_hint'), attrs: 'autocomplete="new-password"' })}
      <button class="btn-gold w-full">${t('submit')}</button>
    </form>
    <a href="/admin/login" class="btn-quiet btn-sm mt-3 w-full">${t('back')}</a>`).s;
  const form = $('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(form);
    const btn = form.querySelector('button'); busy(btn, true);
    try { await api.post('/api/admin/setup', Object.fromEntries(new FormData(form))); toast(t('a_setup_done')); S.router.go('/admin/login', { replace: true }); }
    catch (err) { showApiError(form, err); busy(btn, false); }
  });
}

// ── overview ───────────────────────────────────────────────────────────
async function overview() {
  loading();
  let d;
  try { d = await api.get('/api/admin/overview'); } catch (err) { view().innerHTML = errorBox(err, overview).s; return; }
  const c = d.counts;
  const today = Math.floor(Date.now() / 86400000);
  const series = Array.from({ length: 14 }, (_, i) => {
    const day = today - 13 + i;
    return { label: new Intl.DateTimeFormat(getLang() === 'fa' ? 'fa-AF' : 'en-GB', { day: 'numeric' }).format(new Date(day * 86400000)), value: d.series.find((s) => s.d === day)?.n || 0 };
  });
  const stat = (k, v, href, accent) => html`<a href="${href}" class="card card-hover p-5"><p class="text-xs text-fog-500">${t(k)}</p><p class="num mt-3 text-3xl font-semibold ${accent || ''}">${fmtNumber(v)}</p></a>`;
  view().innerHTML = html`
    ${pageHeader(t('an_overview'), fmtDate(Date.now() / 1000, { time: false }), html`<a href="/admin/requests?status=pending" class="btn-gold btn-sm">${t('a_pending')} · ${fmtNumber(c.pending || 0)}</a>`)}
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      ${stat('a_pending', c.pending || 0, '/admin/requests?status=pending', 'text-gold-300')}
      ${stat('a_today', d.today, '/admin/requests')}
      ${stat('a_mine', d.assigned_to_me, '/admin/requests?assigned=me')}
      ${stat('a_dups', d.duplicates, '/admin/requests?flag=duplicate', d.duplicates ? 'text-bad' : '')}
      ${stat('a_tickets_open', d.open_tickets, '/admin/support?status=open')}
      ${stat('a_customers', d.customers, '/admin/customers')}
    </div>
    <div class="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section class="card card-pad"><h2 class="mb-6 text-sm font-semibold">${t('a_volume_14')}</h2>${barChart(series, { h: 200 })}</section>
      <section class="card card-pad">
        <h2 class="mb-5 text-sm font-semibold">${t('a_pipeline')}</h2>
        <ul class="space-y-3">${STATUSES.map((s) => {
          const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
          return html`<li><a href="/admin/requests?status=${s}" class="block"><div class="mb-1.5 flex items-center justify-between text-sm">${statusBadge(s)}<span class="num text-fog-300">${fmtNumber(c[s] || 0)}</span></div>
            <div class="h-1.5 overflow-hidden rounded-full bg-ink-700"><div class="h-full rounded-full bg-gold-400/70" style="width:${((c[s] || 0) / total) * 100}%"></div></div></a></li>`;
        })}</ul>
      </section>
    </div>
    <section class="card mt-5 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4"><h2 class="font-semibold">${t('a_latest')}</h2><a href="/admin/requests" class="text-sm text-gold-300">${t('view_all')}</a></div>
      <div class="divider"></div>${reqTable(d.recent)}
    </section>`.s;
}

function reqTable(rows) {
  if (!rows.length) return emptyState(t('none_yet'), '', '', 'list');
  return html`<div class="scroll-x"><table class="tbl min-w-[900px]">
    <thead><tr><th>${t('req_tracking')}</th><th>${t('a_customer')}</th><th>${t('req_service')}</th><th>${t('req_amount')}</th><th>${t('req_method')}</th><th>${t('a_assignee')}</th><th>${t('req_submitted')}</th><th class="!text-end">${t('col_status')}</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr class="clickable" data-href="/admin/requests/${r.tracking_no}">
      <td><span class="mono text-fog-50">${r.tracking_no}</span>${r.duplicate_of ? html`<span class="badge b-bad ms-2" title="${t('a_flag_dup')}">${icon('flag', 'size-3')}</span>` : ''}${r.customer_unread ? html`<span class="badge b-gold ms-2" title="${t('a_new_msg')}">${icon('chats', 'size-3')}${r.customer_unread}</span>` : ''}</td>
      <td><div class="text-fog-100">${r.customer_name}</div><div class="mono text-[11.5px] text-fog-500">${r.user_id}</div></td>
      <td>${svcName(r)}</td>
      <td class="num">${money(r)}</td>
      <td class="text-fog-400">${r.payment_method_id ? L({ name_en: r.method_en, name_fa: r.method_fa }, 'name') : '—'}</td>
      <td class="text-fog-400">${r.assignee_name || html`<span class="text-fog-600">${t('a_unassigned')}</span>`}</td>
      <td class="text-fog-400">${fmtRelative(r.created_at)}</td>
      <td class="text-end">${statusBadge(r.status)}</td>
    </tr>`)}</tbody></table></div>`;
}

// ── requests list ──────────────────────────────────────────────────────
async function requestsPage(_p, query) {
  const f = Object.fromEntries(query);
  const set = (k, v) => { const p = new URLSearchParams(location.search); v ? p.set(k, v) : p.delete(k); S.router.go(`/admin/requests?${p}`, { replace: true }); };
  const svcs = (await api.get('/api/admin/services').catch(() => ({ services: [] }))).services;
  view().innerHTML = html`
    ${pageHeader(t('an_requests'))}
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4">
        <div class="scroll-x"><div class="seg" data-status>${['', ...STATUSES].map((s) => html`<button data-s="${s}" class="${(f.status || '') === s ? 'on' : ''}">${s ? t('st_' + s) : t('filter_all')}</button>`)}</div></div>
        <div class="flex flex-wrap gap-2">
          <select data-svc class="input h-10 w-auto text-sm"><option value="">${t('a_all_services')}</option>${svcs.map((s) => html`<option value="${s.id}" ${f.service === s.id ? raw('selected') : ''}>${L(s, 'name')}</option>`)}</select>
          <div class="seg" data-assigned>${[['', 'filter_all'], ['me', 'a_filter_mine'], ['none', 'a_filter_unassigned']].map(([v, k]) => html`<button data-v="${v}" class="${(f.assigned || '') === v ? 'on' : ''}">${t(k)}</button>`)}</div>
          <button data-dups class="btn-sm ${f.flag === 'duplicate' ? 'btn-danger' : 'btn-ghost'}">${icon('flag', 'size-3.5')}${t('a_filter_dups')}</button>
          <form data-q class="relative ms-auto w-full sm:w-72"><span class="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-fog-500">${icon('search', 'size-4')}</span><input name="q" value="${f.q || ''}" class="input h-10 ps-10 text-sm" placeholder="${t('a_search_ph')}" dir="ltr"/></form>
        </div>
      </div>
      <div data-list>${skeletonRows(5)}</div>
    </div>`.s;
  $('[data-status]').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) set('status', b.dataset.s); });
  $('[data-assigned]').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) set('assigned', b.dataset.v); });
  $('[data-svc]').addEventListener('change', (e) => set('service', e.target.value));
  $('[data-dups]').addEventListener('click', () => set('flag', f.flag === 'duplicate' ? '' : 'duplicate'));
  $('[data-q]').addEventListener('submit', (e) => { e.preventDefault(); set('q', latin(new FormData(e.target).get('q'))); });
  try {
    const { requests } = await api.get(`/api/admin/requests?${new URLSearchParams(f)}`);
    $('[data-list]').innerHTML = reqTable(requests).s;
  } catch (err) { $('[data-list]').innerHTML = errorBox(err).s; }
}

// ── request detail ─────────────────────────────────────────────────────
const PV_STYLE = { verified: 'b-ok', mismatch: 'b-warn', rejected: 'b-bad', refunded: 'b-info' };
async function requestDetail({ id }) {
  loading();
  let d, staff;
  try { [d, staff] = await Promise.all([api.get(`/api/admin/requests/${encodeURIComponent(id)}`), api.get('/api/admin/staff')]); }
  catch (err) { view().innerHTML = errorBox(err, () => requestDetail({ id })).s; return; }
  const r = d.request;
  const verified = d.payments.some((p) => p.status === 'verified');
  const svc = (await api.get('/api/admin/services').catch(() => ({ services: [] }))).services.find((s) => s.id === r.service_id);

  view().innerHTML = html`
    <a href="/admin/requests" class="mb-5 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('an_requests')}</a>
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-wrap items-center gap-3"><h1 class="mono text-2xl font-semibold tracking-wider">${r.tracking_no}</h1>${statusBadge(r.status)}${r.is_demo ? demoTag() : ''}${r.duplicate_of ? html`<span class="badge b-bad">${icon('flag', 'size-3')}${t('a_flag_dup')}</span>` : ''}</div>
      <div class="flex flex-wrap items-center gap-2">
        <select data-assign class="input h-9 w-auto text-sm">
          <option value="">${t('a_unassigned')}</option>
          ${staff.staff.filter((s) => s.status === 'active').map((s) => html`<option value="${s.id}" ${r.assigned_to === s.id ? raw('selected') : ''} ${!isAdmin() && s.id !== S.user.id ? raw('disabled') : ''}>${s.full_name}</option>`)}
        </select>
        ${r.assigned_to !== S.user.id ? html`<button data-assign-me class="btn-ghost btn-sm">${t('a_assign_me')}</button>` : ''}
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div class="space-y-5">
        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('a_actions')}</h2>
          ${d.transitions.length ? html`<div class="mt-4 flex flex-wrap gap-2">${d.transitions.map((s) => {
            const needs = (s === 'payment_verified' || (s === 'processing' && r.requires_payment)) && !verified;
            return html`<button data-move="${s}" class="${s === 'rejected' ? 'btn-danger' : 'btn-ghost'} btn-sm" ${needs ? raw(`title="${t('a_need_verification')}"`) : ''}>${needs ? icon('lock', 'size-3.5') : icon('arrowR', 'size-3.5 flip-rtl')}${t('st_' + s)}</button>`;
          })}</div>
          ${r.requires_payment && !verified ? html`<p class="mt-3 flex items-center gap-2 text-xs text-warn">${icon('alert', 'size-3.5')}${t('a_need_verification')}</p>` : ''}` : html`<p class="mt-3 text-sm text-fog-500">—</p>`}
        </section>

        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('req_detail_info')}</h2>
          <dl class="mt-2 grid gap-x-10 divide-y divide-line md:grid-cols-2 md:divide-y-0">
            <div class="divide-y divide-line">
              ${kv(t('req_service'), svcName(r))}
              ${r.amount ? kv(t('req_amount'), money(r)) : ''}
              ${Object.entries(r.details).map(([k, v]) => { const fd = svc?.fields.find((x) => x.key === k); return kv(fd ? L(fd, 'label') : k, v); })}
              ${r.customer_note ? kv(t('req_note'), r.customer_note) : ''}
            </div>
            <div class="divide-y divide-line">
              ${r.payment_method_id ? kv(t('req_method'), L({ name_en: r.method_en, name_fa: r.method_fa }, 'name')) : ''}
              ${r.payment_ref ? kv(t('req_ref'), r.payment_ref, true) : ''}
              ${kv(t('req_submitted'), fmtDate(r.created_at))}
              ${kv(t('req_updated'), fmtDate(r.updated_at))}
              ${r.reject_reason ? kv(t('req_reason'), r.reject_reason) : ''}
            </div>
          </dl>
        </section>

        ${r.payment_method_id ? html`<section class="card card-pad">
          <div class="flex items-center justify-between"><h2 class="text-sm font-semibold">${t('a_payment_records')}</h2><button data-pv class="btn-gold btn-sm">${icon('shieldCheck', 'size-4')}${t('a_record_payment')}</button></div>
          <p class="mt-3 rounded-xl border border-gold-400/20 bg-gold-400/[0.05] px-4 py-3 text-xs leading-relaxed text-gold-200">${t('a_pv_warning')}</p>
          ${d.payments.length ? html`<ul class="mt-4 divide-y divide-line">${d.payments.map((p) => html`<li class="py-3.5 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2"><span class="badge ${PV_STYLE[p.status]}"><span class="badge-dot"></span>${t('a_pv_' + p.status).split(' — ')[0]}</span><span class="text-xs text-fog-500">${fmtDate(p.created_at)} · ${t('a_by')} ${p.operator_name} <span class="mono">(${p.operator_id})</span></span></div>
            <div class="mt-2 grid gap-1 text-xs text-fog-400 sm:grid-cols-3"><span>${t('a_pv_source')}: <span class="text-fog-200">${t('a_src_' + p.source)}</span></span><span>${t('a_pv_evidence')}: <span class="mono text-fog-200">${p.evidence_ref}</span></span><span>${t('a_pv_amount')}: <span class="num text-fog-200">${fmtMoney(p.amount, p.currency)}</span></span></div>
            ${p.note ? html`<p class="mt-2 text-xs text-fog-500">${p.note}</p>` : ''}
          </li>`)}</ul>` : html`<p class="mt-4 text-sm text-fog-500">${t('a_pv_none')}</p>`}
          ${d.duplicates.length ? html`<div class="mt-4 rounded-xl border border-bad/25 bg-bad/[0.06] p-4"><p class="flex items-center gap-2 text-sm font-medium text-bad">${icon('flag', 'size-4')}${t('a_dup_title')}</p>
            <ul class="mt-2 space-y-1.5">${d.duplicates.map((x) => html`<li class="flex items-center justify-between text-xs"><a href="/admin/requests/${x.tracking_no}" class="mono text-fog-200 underline">${x.tracking_no}</a><span class="mono text-fog-500">${x.user_id}</span>${statusBadge(x.status)}</li>`)}</ul></div>` : ''}
        </section>` : ''}

        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('a_chat')}</h2>
          <div class="mt-4 space-y-2.5">${d.messages.length ? d.messages.map((m) => html`<div class="flex ${m.is_staff ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 ${m.is_staff ? 'bg-gold-400/[0.12]' : 'border border-line bg-ink-800'}">
            <p class="mb-0.5 text-[11px] text-fog-400">${m.author_name || m.author_id} · ${fmtDate(m.created_at)}</p><p class="whitespace-pre-wrap text-sm">${m.body}</p></div></div>`) : html`<p class="text-sm text-fog-500">${t('a_chat_empty')}</p>`}</div>
          <form data-reply-msg class="mt-4 flex gap-2" novalidate><div class="flex-1" data-field="message"><textarea name="message" rows="2" class="input min-h-0 py-2.5 text-sm" placeholder="${t('a_chat_ph')}"></textarea><p class="field-error"></p></div><button class="btn-gold btn-sm self-start">${icon('send', 'size-4 rtl:-scale-x-100')}</button></form>
        </section>

        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('a_notes')}</h2>
          <ul class="mt-4 space-y-3">${d.notes.map((n) => html`<li class="rounded-xl border border-line bg-ink-900 p-3.5"><p class="whitespace-pre-wrap text-sm">${n.body}</p><p class="mt-2 text-[11.5px] text-fog-500">${n.author_name} <span class="mono">(${n.author_id})</span> · ${fmtDate(n.created_at)}</p></li>`)}</ul>
          <form data-note class="mt-4 flex gap-2" novalidate><div class="flex-1" data-field="body"><textarea name="body" rows="2" class="input min-h-0 py-2.5 text-sm" placeholder="${t('a_notes_ph')}"></textarea><p class="field-error"></p></div><button class="btn-ghost btn-sm self-start">${t('a_add_note')}</button></form>
        </section>
      </div>

      <aside class="space-y-5">
        <section class="card card-pad">
          <div class="flex items-center justify-between"><h2 class="text-sm font-semibold">${t('a_customer')}</h2><a href="/admin/customers/${r.user_id}" class="text-xs text-gold-300">${t('a_customer_profile')}</a></div>
          <dl class="mt-2 divide-y divide-line">${kv(t('auth_full_name'), r.customer_name)}${kv(t('prof_customer_id'), r.user_id, true)}${kv(t('auth_phone'), html`<span dir="ltr">${r.customer_phone}</span>`, true)}</dl>
        </section>
        ${r.payment_method_id ? html`<section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('a_receipt')}</h2>
          ${d.receipt ? html`<div class="mt-4 overflow-hidden rounded-xl border border-line bg-ink-900">
              ${d.receipt.mime.startsWith('image/') ? html`<img src="/api/admin/files/${d.receipt.id}" alt="" class="max-h-72 w-full object-contain"/>` : html`<div class="grid h-28 place-items-center text-fog-500">${icon('doc', 'size-8')}</div>`}
              <div class="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2.5 text-xs"><span class="truncate text-fog-400">${d.receipt.name} · ${fmtNumber(Math.ceil(d.receipt.size / 1024))} KB</span><a href="/api/admin/files/${d.receipt.id}" target="_blank" rel="noopener" class="text-gold-300">${t('a_open_file')}</a></div>
            </div>
            <p class="mt-2 text-[11.5px] text-fog-500">${t('a_receipt_note')} · SHA-256 <span class="mono">${d.receipt.sha256.slice(0, 16)}…</span></p>`
          : html`<p class="mt-3 text-sm text-fog-500">${t('a_receipt_none')}</p>`}
        </section>` : ''}
        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('a_history')}</h2>
          <ol class="mt-4 space-y-4">${d.events.map((e) => html`<li class="flex gap-3">
            <span class="mt-1.5 size-2 shrink-0 rounded-full ${e.status === 'rejected' ? 'bg-bad' : e.status === 'completed' ? 'bg-ok' : 'bg-gold-400'}"></span>
            <div><p class="text-sm">${t('st_' + e.status)}</p><p class="text-[11.5px] text-fog-500">${fmtDate(e.created_at)}${e.actor_name ? html` · ${e.actor_name}` : ''}</p>${e.note ? html`<p class="mt-1 text-xs text-fog-400">${e.note}</p>` : ''}</div>
          </li>`)}</ol>
        </section>
      </aside>
    </div>`.s;

  const reload = () => requestDetail({ id });
  const assign = async (opId) => { try { await api.post(`/api/admin/requests/${r.tracking_no}/assign`, { operator_id: opId || null }); toast(t('saved')); reload(); } catch (err) { toast(errorText(err), 'error'); reload(); } };
  $('[data-assign]').addEventListener('change', (e) => assign(e.target.value));
  $('[data-assign-me]')?.addEventListener('click', () => assign(S.user.id));

  $$('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const next = b.dataset.move;
    modal({
      title: `${t('a_move_to')}: ${t('st_' + next)}`,
      body: html`<form class="space-y-4" novalidate>${formErrorSlot()}
        ${next === 'rejected' ? field({ name: 'reason', label: t('a_reject_reason'), type: 'textarea', required: true, attrs: 'maxlength="500"' }) : field({ name: 'note', label: t('a_status_note'), type: 'textarea', optional: true, attrs: 'maxlength="500"' })}
        <div class="flex justify-end gap-2"><button type="button" class="btn-ghost btn-sm" data-close>${t('cancel')}</button><button class="${next === 'rejected' ? 'btn-danger' : 'btn-gold'} btn-sm">${t('confirm')}</button></div></form>`,
      onMount: (el, close) => {
        const form = $('form', el);
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); clearErrors(form);
          const fd = Object.fromEntries(new FormData(form));
          if (next === 'rejected' && (fd.reason || '').trim().length < 5) return setFieldError(form, 'reason', t('v_required'));
          const btn = form.querySelector('button:not([data-close])'); busy(btn, true);
          try { await api.post(`/api/admin/requests/${r.tracking_no}/status`, { status: next, ...fd }); close(); toast(t('a_status_updated')); reload(); }
          catch (err) { showApiError(form, err); busy(btn, false); }
        });
      },
    });
  }));

  $('[data-pv]')?.addEventListener('click', () => modal({
    title: t('a_record_payment'),
    size: 'max-w-xl',
    body: html`<form class="space-y-5" novalidate>${formErrorSlot()}
      <p class="rounded-xl border border-gold-400/20 bg-gold-400/[0.05] px-4 py-3 text-xs leading-relaxed text-gold-200">${t('a_pv_warning')}</p>
      ${field({ name: 'status', label: t('a_pv_result'), type: 'select', value: 'verified', options: ['verified', 'mismatch', 'rejected', 'refunded'].map((s) => ({ value: s, label: t('a_pv_' + s) })) })}
      ${field({ name: 'source', label: t('a_pv_source'), type: 'select', value: 'bank_record', options: ['provider_api', 'bank_record', 'official_statement'].map((s) => ({ value: s, label: t('a_src_' + s) })) })}
      <div class="grid gap-5 sm:grid-cols-2">
        ${field({ name: 'evidence_ref', label: t('a_pv_evidence'), required: true, attrs: 'dir="ltr" maxlength="80"' })}
        ${field({ name: 'amount', label: t('a_pv_amount'), required: true, value: (r.amount / 100).toFixed(2), addon: r.currency, attrs: 'dir="ltr" inputmode="decimal"' })}
      </div>
      <p class="-mt-3 text-xs text-fog-500">${t('a_pv_evidence_hint')}</p>
      ${field({ name: 'note', label: t('a_status_note'), type: 'textarea', optional: true, attrs: 'maxlength="500"' })}
      <div class="field" data-field="confirm_independent"><label class="flex cursor-pointer items-start gap-3 text-sm text-fog-300"><input type="checkbox" name="confirm_independent" class="check mt-0.5"/>${t('a_pv_confirm')}</label><p class="field-error"></p></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn-ghost btn-sm" data-close>${t('cancel')}</button><button class="btn-gold btn-sm">${t('a_record_payment')}</button></div>
    </form>`,
    onMount: (el, close) => {
      const form = $('form', el);
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); clearErrors(form);
        const fd = new FormData(form);
        const body = Object.fromEntries(fd);
        body.confirm_independent = !!fd.get('confirm_independent');
        body.amount = latin(body.amount);
        if ((body.evidence_ref || '').trim().length < 4) return setFieldError(form, 'evidence_ref', t('v_required'));
        if (body.status === 'verified' && !body.confirm_independent) return setFieldError(form, 'confirm_independent', t('v_terms'));
        const btn = form.querySelector('button:not([data-close])'); busy(btn, true);
        try { await api.post(`/api/admin/requests/${r.tracking_no}/payments`, body); close(); toast(t('a_pv_saved')); reload(); }
        catch (err) { showApiError(form, err); busy(btn, false); }
      });
    },
  }));

  const rf = $('[data-reply-msg]');
  rf.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(rf);
    const message = new FormData(rf).get('message').trim();
    if (!message) return setFieldError(rf, 'message', t('v_required'));
    try { await api.post(`/api/admin/requests/${r.tracking_no}/messages`, { message }); reload(); } catch (err) { showApiError(rf, err); }
  });

  const nf = $('[data-note]');
  nf.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(nf);
    const body = new FormData(nf).get('body').trim();
    if (body.length < 2) return setFieldError(nf, 'body', t('v_required'));
    try { await api.post(`/api/admin/requests/${r.tracking_no}/notes`, { body }); reload(); } catch (err) { showApiError(nf, err); }
  });
}

// ── customers ──────────────────────────────────────────────────────────
async function customers(_p, query) {
  const q = query.get('q') || '';
  view().innerHTML = html`${pageHeader(t('an_customers'))}
    <div class="card overflow-hidden"><div class="border-b border-line p-4"><form data-q class="relative max-w-sm"><span class="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-fog-500">${icon('search', 'size-4')}</span><input name="q" value="${q}" class="input h-10 ps-10 text-sm" placeholder="${t('a_search_ph')}"/></form></div><div data-list>${skeletonRows(5)}</div></div>`.s;
  $('[data-q]').addEventListener('submit', (e) => { e.preventDefault(); S.router.go(`/admin/customers?q=${encodeURIComponent(latin(new FormData(e.target).get('q')))}`, { replace: true }); });
  try {
    const { customers: rows } = await api.get(`/api/admin/customers?q=${encodeURIComponent(q)}`);
    $('[data-list]').innerHTML = (rows.length ? html`<div class="scroll-x"><table class="tbl min-w-[820px]"><thead><tr><th>ID</th><th>${t('auth_full_name')}</th><th>${t('auth_phone')}</th><th>${t('a_requests_count')}</th><th>${t('a_telegram')}</th><th>${t('a_joined')}</th><th class="!text-end">${t('col_status')}</th></tr></thead>
      <tbody>${rows.map((c) => html`<tr class="clickable" data-href="/admin/customers/${c.id}"><td class="mono text-fog-50">${c.id}</td><td>${c.full_name}</td><td class="mono text-fog-400" dir="ltr">${c.phone}</td><td class="num">${fmtNumber(c.requests)}</td><td>${c.telegram ? html`<span class="text-ok">${icon('check', 'size-4')}</span>` : html`<span class="text-fog-600">—</span>`}</td><td class="text-fog-400">${fmtDate(c.created_at, { time: false })}</td>
        <td class="text-end">${!c.phone_verified ? html`<span class="badge b-neutral">${t('a_unverified')}</span>` : html`<span class="badge ${c.status === 'active' ? 'b-ok' : 'b-bad'}"><span class="badge-dot"></span>${t('a_status_' + c.status)}</span>`}</td></tr>`)}</tbody></table></div>` : emptyState(t('none_yet'), '', '', 'users')).s;
  } catch (err) { $('[data-list]').innerHTML = errorBox(err).s; }
}

async function customerDetail({ id }) {
  loading();
  let d;
  try { d = await api.get(`/api/admin/customers/${encodeURIComponent(id)}`); } catch (err) { view().innerHTML = errorBox(err, () => customerDetail({ id })).s; return; }
  const c = d.customer;
  view().innerHTML = html`
    <a href="/admin/customers" class="mb-5 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('an_customers')}</a>
    ${pageHeader(c.full_name, html`<span class="mono">${c.id}</span>`, isAdmin() ? html`<button data-toggle class="${c.status === 'active' ? 'btn-danger' : 'btn-gold'} btn-sm">${t(c.status === 'active' ? 'a_suspend' : 'a_activate')}</button>` : '')}
    <div class="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section class="card card-pad"><dl class="divide-y divide-line">
        ${kv(t('col_status'), html`<span class="badge ${c.status === 'active' ? 'b-ok' : 'b-bad'}">${t('a_status_' + c.status)}</span>`)}
        ${kv(t('auth_phone'), html`<span dir="ltr">${c.phone}</span>`, true)}
        ${kv(t('auth_code'), c.phone_verified ? t('a_verified') : t('a_unverified'))}
        ${kv(t('prof_language'), c.lang === 'fa' ? 'دری' : 'English')}
        ${kv(t('a_telegram'), c.telegram_linked ? t('dash_security_tg_on') : t('dash_security_tg_off'))}
        ${kv(t('a_joined'), fmtDate(c.created_at))}
        ${kv(t('a_last_login'), fmtDate(c.last_login_at))}
      </dl></section>
      <div class="space-y-5">
        <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="font-semibold">${t('an_requests')}</h2></div><div class="divider"></div>${reqTable(d.requests)}</section>
        <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="font-semibold">${t('an_support')}</h2></div><div class="divider"></div>
          ${d.tickets.length ? html`<ul class="divide-y divide-line">${d.tickets.map((tk) => html`<li><a href="/admin/support/${tk.ticket_no}" class="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02]"><span class="text-sm">${tk.subject}</span><span class="badge b-neutral">${t('tk_' + tk.status)}</span></a></li>`)}</ul>` : emptyState(t('none_yet'), '', '', 'message')}
        </section>
      </div>
    </div>`.s;
  $('[data-toggle]')?.addEventListener('click', () => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    modal({
      title: t(next === 'active' ? 'a_activate' : 'a_suspend'),
      body: html`<form class="space-y-4" novalidate>${formErrorSlot()}${field({ name: 'reason', label: t('a_reason'), type: 'textarea', required: true })}<div class="flex justify-end gap-2"><button type="button" class="btn-ghost btn-sm" data-close>${t('cancel')}</button><button class="btn-gold btn-sm">${t('confirm')}</button></div></form>`,
      onMount: (el, close) => $('form', el).addEventListener('submit', async (e) => {
        e.preventDefault(); const form = e.target; clearErrors(form);
        const reason = new FormData(form).get('reason').trim();
        if (reason.length < 3) return setFieldError(form, 'reason', t('v_required'));
        try { await api.patch(`/api/admin/customers/${c.id}`, { status: next, reason }); close(); toast(t('saved')); customerDetail({ id }); } catch (err) { showApiError(form, err); }
      }),
    });
  });
}

// ── reconciliation ─────────────────────────────────────────────────────
const RS_STYLE = { awaiting: 'b-neutral', verified: 'b-ok', mismatch: 'b-warn', rejected: 'b-bad', refunded: 'b-info', duplicate_flag: 'b-bad' };
async function reconciliation(_p, query) {
  loading();
  const method = query.get('method') || '';
  const state = query.get('state') || '';
  let d, svc;
  try { [d, svc] = await Promise.all([api.get(`/api/admin/reconciliation?method=${encodeURIComponent(method)}`), api.get('/api/admin/services')]); } catch (err) { view().innerHTML = errorBox(err).s; return; }
  const rows = state ? d.rows.filter((r) => r.recon_state === state) : d.rows;
  const totals = {};
  for (const r of d.rows.filter((x) => x.recon_state === 'verified')) totals[r.currency] = (totals[r.currency] || 0) + (r.verification?.amount || 0);
  view().innerHTML = html`
    ${pageHeader(t('an_recon'), t('a_recon_sub'), html`<span class="badge b-neutral">${t('a_period_30')}</span>`)}
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      ${['awaiting', 'verified', 'mismatch', 'rejected', 'refunded', 'duplicate_flag'].map((s) => html`<a href="?state=${state === s ? '' : s}${method ? `&method=${method}` : ''}" class="card card-hover p-4 ${state === s ? '!border-gold-400/40' : ''}"><span class="badge ${RS_STYLE[s]}">${t('a_rs_' + s)}</span><p class="num mt-3 text-2xl font-semibold">${fmtNumber(d.summary[s] || 0)}</p></a>`)}
    </div>
    <div class="mt-3 flex flex-wrap gap-3 text-sm text-fog-400">${Object.entries(totals).map(([cur, v]) => html`<span class="rounded-lg border border-line px-3 py-1.5">${t('a_rs_verified')}: <span class="num text-fog-50">${fmtMoney(v, cur)}</span></span>`)}</div>
    <section class="card mt-5 overflow-hidden">
      <div class="border-b border-line p-4"><select data-method class="input h-10 w-auto text-sm"><option value="">${t('a_all_methods')}</option>${svc.payment_methods.map((m) => html`<option value="${m.id}" ${method === m.id ? raw('selected') : ''}>${L(m, 'name')}</option>`)}</select></div>
      ${rows.length ? html`<div class="scroll-x"><table class="tbl min-w-[980px]"><thead><tr><th>${t('req_tracking')}</th><th>${t('req_method')}</th><th>${t('req_ref')}</th><th>${t('req_amount')}</th><th>${t('a_pv_source')}</th><th>${t('a_pv_evidence')}</th><th>${t('a_audit_actor')}</th><th class="!text-end">${t('col_status')}</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr class="clickable" data-href="/admin/requests/${r.tracking_no}">
          <td class="mono text-fog-50">${r.tracking_no}</td><td>${L({ name_en: r.method_en, name_fa: r.method_fa }, 'name')}</td><td class="mono text-fog-400">${r.payment_ref}</td><td class="num">${money(r)}</td>
          <td class="text-fog-400">${r.verification ? t('a_src_' + r.verification.source) : '—'}</td><td class="mono text-fog-400">${r.verification?.evidence_ref || '—'}</td><td class="text-fog-400">${r.verification?.operator_name || '—'}</td>
          <td class="text-end"><span class="badge ${RS_STYLE[r.recon_state]}">${t('a_rs_' + r.recon_state)}</span></td></tr>`)}</tbody></table></div>` : emptyState(t('none_yet'), '', '', 'bank')}
    </section>`.s;
  $('[data-method]').addEventListener('change', (e) => S.router.go(`/admin/reconciliation?method=${e.target.value}`, { replace: true }));
}

// ── reports ────────────────────────────────────────────────────────────
async function reports(_p, query) {
  const period = query.get('period') === 'monthly' ? 'monthly' : 'daily';
  const date = query.get('date') || new Date().toISOString().slice(0, 10);
  view().innerHTML = html`${pageHeader(t('an_reports'), t('a_reports_sub'), html`
    <div class="seg" data-period>${['daily', 'monthly'].map((p) => html`<button data-p="${p}" class="${p === period ? 'on' : ''}">${t('a_' + p)}</button>`)}</div>
    <input data-date type="date" value="${date}" class="input h-10 w-auto text-sm" dir="ltr"/>
    <a class="btn-ghost btn-sm" href="/api/admin/reports.csv?period=${period}&date=${date}" download>${icon('download', 'size-4')}${t('a_export')}</a>`)}
    <div data-report>${skeletonRows(4)}</div>`.s;
  const go = (p, dt) => S.router.go(`/admin/reports?period=${p}&date=${dt}`, { replace: true });
  $('[data-period]').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p, date); });
  $('[data-date]').addEventListener('change', (e) => go(period, e.target.value));
  try {
    const d = await api.get(`/api/admin/reports?period=${period}&date=${date}`);
    const total = d.by_status.reduce((a, b) => a + b.n, 0);
    $('[data-report]').innerHTML = html`
      <p class="mb-4 text-sm text-fog-500">${fmtDate(d.from, { time: false })} – ${fmtDate(d.to - 1, { time: false })}</p>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="card p-5"><p class="text-xs text-fog-500">${t('dash_total')}</p><p class="num mt-3 text-3xl font-semibold">${fmtNumber(total)}</p></div>
        <div class="card p-5"><p class="text-xs text-fog-500">${t('st_completed')}</p><p class="num mt-3 text-3xl font-semibold text-ok">${fmtNumber(d.by_status.find((s) => s.status === 'completed')?.n || 0)}</p></div>
        <div class="card p-5"><p class="text-xs text-fog-500">${t('st_rejected')}</p><p class="num mt-3 text-3xl font-semibold text-bad">${fmtNumber(d.by_status.find((s) => s.status === 'rejected')?.n || 0)}</p></div>
        <div class="card p-5"><p class="text-xs text-fog-500">${t('a_new_customers')}</p><p class="num mt-3 text-3xl font-semibold text-gold-300">${fmtNumber(d.new_customers)}</p></div>
      </div>
      <div class="mt-5 grid gap-5 xl:grid-cols-2">
        <section class="card card-pad"><h2 class="mb-4 text-sm font-semibold">${t('a_by_status')}</h2>${d.by_status.length ? html`<ul class="space-y-2.5">${d.by_status.map((s) => html`<li class="flex items-center justify-between">${statusBadge(s.status)}<span class="num">${fmtNumber(s.n)}</span></li>`)}</ul>` : emptyState(t('none_yet'))}</section>
        <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="text-sm font-semibold">${t('a_by_service')}</h2></div>${d.by_service.length ? html`<table class="tbl"><thead><tr><th>${t('req_service')}</th><th>${t('a_count')}</th><th class="!text-end">${t('a_total')}</th></tr></thead><tbody>${d.by_service.map((s) => html`<tr><td>${L(s, 'name')}</td><td class="num">${fmtNumber(s.n)}</td><td class="num text-end">${s.total ? fmtMoney(s.total, s.currency) : '—'}</td></tr>`)}</tbody></table>` : emptyState(t('none_yet'))}</section>
        <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="text-sm font-semibold">${t('a_payments_rec')}</h2></div>${d.payments.length ? html`<table class="tbl"><thead><tr><th>${t('a_pv_result')}</th><th>${t('a_count')}</th><th class="!text-end">${t('a_total')}</th></tr></thead><tbody>${d.payments.map((p) => html`<tr><td><span class="badge ${PV_STYLE[p.status]}">${t('a_rs_' + p.status)}</span></td><td class="num">${fmtNumber(p.n)}</td><td class="num text-end">${fmtMoney(p.total, p.currency)}</td></tr>`)}</tbody></table>` : emptyState(t('none_yet'))}</section>
        <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="text-sm font-semibold">${t('a_by_operator')}</h2></div>${d.by_operator.length ? html`<table class="tbl"><thead><tr><th>${t('a_audit_actor')}</th><th class="!text-end">${t('a_count')}</th></tr></thead><tbody>${d.by_operator.map((o) => html`<tr><td>${o.full_name} <span class="mono text-xs text-fog-500">${o.actor_id}</span></td><td class="num text-end">${fmtNumber(o.n)}</td></tr>`)}</tbody></table>` : emptyState(t('none_yet'))}</section>
      </div>`.s;
  } catch (err) { $('[data-report]').innerHTML = errorBox(err).s; }
}

// ── support ────────────────────────────────────────────────────────────
async function supportList(_p, query) {
  loading();
  const status = query.get('status') || '';
  let d;
  try { d = await api.get(`/api/admin/support?status=${status}`); } catch (err) { view().innerHTML = errorBox(err).s; return; }
  view().innerHTML = html`${pageHeader(t('an_support'), '', html`<div class="seg" data-st>${['', 'open', 'answered', 'closed'].map((s) => html`<button data-s="${s}" class="${s === status ? 'on' : ''}">${s ? t('tk_' + s) : t('filter_all')}</button>`)}</div>`)}
    <section class="card overflow-hidden">${d.tickets.length ? html`<div class="scroll-x"><table class="tbl min-w-[720px]"><thead><tr><th>#</th><th>${t('sup_subject')}</th><th>${t('a_customer')}</th><th>${t('sup_category')}</th><th>${t('req_updated')}</th><th class="!text-end">${t('col_status')}</th></tr></thead>
      <tbody>${d.tickets.map((tk) => html`<tr class="clickable" data-href="/admin/support/${tk.ticket_no}"><td class="mono text-fog-50">${tk.ticket_no}</td><td>${tk.subject}</td><td>${tk.customer_name} <span class="mono text-xs text-fog-500">${tk.user_id}</span></td><td class="text-fog-400">${t('cat_' + tk.category)}</td><td class="text-fog-400">${fmtRelative(tk.updated_at)}</td><td class="text-end"><span class="badge ${tk.status === 'open' ? 'b-info' : tk.status === 'answered' ? 'b-gold' : 'b-neutral'}">${t('tk_' + tk.status)}</span></td></tr>`)}</tbody></table></div>` : emptyState(t('none_yet'), '', '', 'message')}</section>`.s;
  $('[data-st]').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) S.router.go(`/admin/support?status=${b.dataset.s}`, { replace: true }); });
}

async function supportTicket({ id }) {
  loading();
  let d;
  try { d = await api.get(`/api/admin/support/${encodeURIComponent(id)}`); } catch (err) { view().innerHTML = errorBox(err).s; return; }
  const tk = d.ticket;
  view().innerHTML = html`
    <a href="/admin/support" class="mb-5 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('an_support')}</a>
    ${pageHeader(tk.subject, html`<span class="mono">${tk.ticket_no}</span> · <a class="text-gold-300" href="/admin/customers/${tk.user_id}">${tk.customer_name}</a>${tk.tracking_no ? html` · <a class="mono text-gold-300" href="/admin/requests/${tk.tracking_no}">${tk.tracking_no}</a>` : ''}`, tk.status !== 'closed' ? html`<button data-close-ticket class="btn-ghost btn-sm">${t('a_close_ticket')}</button>` : '')}
    <section class="card mx-auto max-w-3xl">
      <div class="space-y-4 p-6">${d.messages.map((m) => html`<div class="flex ${m.is_staff ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] rounded-2xl px-4 py-3 ${m.is_staff ? 'bg-gold-400/[0.12]' : 'border border-line bg-ink-800'}">
        <p class="mb-1 text-[11px] text-fog-400">${m.author_name || m.author_id} · ${fmtDate(m.created_at)}</p><p class="whitespace-pre-wrap text-sm">${m.body}</p></div></div>`)}</div>
      <div class="divider"></div>
      ${tk.status === 'closed' ? html`<p class="p-5 text-center text-sm text-fog-500">${t('sup_closed')}</p>` : html`<form data-reply class="flex gap-3 p-4" novalidate><div class="flex-1" data-field="message"><textarea name="message" rows="2" class="input min-h-0 py-2.5" placeholder="${t('sup_reply_ph')}"></textarea><p class="field-error"></p></div><button class="btn-gold btn-sm self-start">${t('a_reply')}</button></form>`}
    </section>`.s;
  $('[data-reply]')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; clearErrors(f);
    const message = new FormData(f).get('message').trim();
    if (message.length < 2) return setFieldError(f, 'message', t('v_required'));
    try { await api.post(`/api/admin/support/${tk.ticket_no}/reply`, { message }); supportTicket({ id }); } catch (err) { showApiError(f, err); }
  });
  $('[data-close-ticket]')?.addEventListener('click', async () => { await api.post(`/api/admin/support/${tk.ticket_no}/close`); supportTicket({ id }); });
}

// ── notifications ──────────────────────────────────────────────────────
async function notificationsPage() {
  loading();
  let d;
  try { d = await api.get('/api/admin/notifications'); } catch (err) { view().innerHTML = errorBox(err).s; return; }
  view().innerHTML = html`${pageHeader(t('an_notifications'), t('a_ntf_sub'))}
    <div class="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section class="card card-pad"><h2 class="text-sm font-semibold">${t('a_ntf_new')}</h2>
        ${isAdmin() ? html`<form class="mt-5 space-y-4" novalidate>${formErrorSlot()}
          ${field({ name: 'customer_id', label: t('a_ntf_target'), optional: true, hint: t('a_ntf_target_hint'), attrs: 'dir="ltr" placeholder="C-XXXXXX"' })}
          <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'title_en', label: t('a_ntf_title_en'), required: true, attrs: 'dir="ltr"' })}${field({ name: 'title_fa', label: t('a_ntf_title_fa'), required: true, attrs: 'dir="rtl"' })}</div>
          <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'body_en', label: t('a_ntf_body_en'), type: 'textarea', optional: true, attrs: 'dir="ltr"' })}${field({ name: 'body_fa', label: t('a_ntf_body_fa'), type: 'textarea', optional: true, attrs: 'dir="rtl"' })}</div>
          <div class="flex justify-end"><button class="btn-gold btn-sm">${icon('send', 'size-4 flip-rtl')}${t('sup_send')}</button></div></form>` : html`<p class="mt-4 text-sm text-fog-500">${t('a_admin_only')}</p>`}
      </section>
      <section class="card overflow-hidden"><div class="px-5 py-4"><h2 class="text-sm font-semibold">${t('a_ntf_history')}</h2></div><div class="divider"></div>
        ${d.notifications.length ? html`<ul class="divide-y divide-line">${d.notifications.map((n) => html`<li class="px-5 py-4"><div class="flex items-start justify-between gap-3"><p class="text-sm font-medium">${L(n, 'title')}</p><span class="badge b-neutral shrink-0">${n.user_id || t('a_everyone')}</span></div>${L(n, 'body') ? html`<p class="mt-1 text-xs text-fog-400">${L(n, 'body')}</p>` : ''}<p class="mt-2 text-[11.5px] text-fog-500">${n.author || ''} · ${fmtDate(n.created_at)}</p></li>`)}</ul>` : emptyState(t('none_yet'), '', '', 'bell')}
      </section>
    </div>`.s;
  const form = $('form', view());
  form?.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(form);
    const body = Object.fromEntries(new FormData(form));
    let bad = false;
    if (body.title_en.trim().length < 3) bad = setFieldError(form, 'title_en', t('v_required'));
    if (body.title_fa.trim().length < 3) bad = setFieldError(form, 'title_fa', t('v_required'));
    if (bad) return;
    const btn = form.querySelector('button'); busy(btn, true);
    try { await api.post('/api/admin/notifications', body); toast(t('a_ntf_sent')); notificationsPage(); } catch (err) { showApiError(form, err); busy(btn, false); }
  });
}

// ── audit ──────────────────────────────────────────────────────────────
async function audit(_p, query) {
  const f = Object.fromEntries(query);
  view().innerHTML = html`${pageHeader(t('an_audit'), t('a_audit_sub'))}
    <div class="card overflow-hidden">
      <form data-f class="flex flex-wrap gap-2 border-b border-line p-4">
        <input name="action" value="${f.action || ''}" class="input h-10 w-48 text-sm" placeholder="${t('a_audit_action')} (request., payment.)" dir="ltr"/>
        <input name="actor" value="${f.actor || ''}" class="input h-10 w-40 text-sm" placeholder="${t('a_audit_actor')} S-…" dir="ltr"/>
        <input name="target" value="${f.target || ''}" class="input h-10 w-48 text-sm" placeholder="${t('a_audit_target')} RP-…" dir="ltr"/>
        <button class="btn-ghost btn-sm h-10">${icon('search', 'size-4')}${t('search')}</button>
      </form>
      <div data-list>${skeletonRows(6)}</div>
    </div>`.s;
  $('[data-f]').addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams([...new FormData(e.target)].filter(([, v]) => v)); S.router.go(`/admin/audit?${p}`, { replace: true }); });
  try {
    const { entries } = await api.get(`/api/admin/audit?${new URLSearchParams(f)}`);
    $('[data-list]').innerHTML = (entries.length ? html`<div class="scroll-x"><table class="tbl min-w-[960px]"><thead><tr><th>${t('a_audit_time')}</th><th>${t('a_audit_actor')}</th><th>${t('a_audit_action')}</th><th>${t('a_audit_target')}</th><th>${t('a_audit_detail')}</th><th>IP</th></tr></thead>
      <tbody>${entries.map((a) => html`<tr><td class="whitespace-nowrap text-fog-400">${fmtDate(a.created_at)}</td><td>${a.actor_name || '—'} <span class="mono text-xs text-fog-500">${a.actor_id || 'system'}</span></td><td><span class="mono text-gold-200">${a.action}</span></td><td class="mono text-fog-300">${a.target_id || '—'}</td><td class="max-w-xs truncate mono text-xs text-fog-500" title="${a.detail}">${a.detail === '{}' ? '' : a.detail}</td><td class="mono text-xs text-fog-500">${a.ip || ''}</td></tr>`)}</tbody></table></div>` : emptyState(t('none_yet'), '', '', 'scroll')).s;
  } catch (err) { $('[data-list]').innerHTML = errorBox(err).s; }
}

// ── settings ───────────────────────────────────────────────────────────
async function settings(_p, query) {
  const tab = query.get('tab') || 'general';
  loading();
  let st, svc, staff;
  try { [st, svc, staff] = await Promise.all([api.get('/api/admin/settings'), api.get('/api/admin/services'), api.get('/api/admin/staff')]); } catch (err) { view().innerHTML = errorBox(err).s; return; }
  const tabs = ['general', 'services', 'methods', 'staff', 'integrations'];
  const s = st.settings;
  const dis = isAdmin() ? '' : raw('disabled');
  const body = {
    general: () => html`<form data-general class="max-w-2xl space-y-5" novalidate>${formErrorSlot()}
      <div class="grid gap-5 sm:grid-cols-2">${field({ name: 'support_hours_en', label: t('a_set_hours_en'), value: s.support_hours_en, attrs: 'dir="ltr"' })}${field({ name: 'support_hours_fa', label: t('a_set_hours_fa'), value: s.support_hours_fa, attrs: 'dir="rtl"' })}</div>
      <div class="grid gap-5 sm:grid-cols-2">${field({ name: 'support_email', label: t('a_set_email'), value: s.support_email, attrs: 'dir="ltr"' })}${field({ name: 'telegram_bot_username', label: t('a_set_tg_bot'), value: s.telegram_bot_username, attrs: 'dir="ltr" placeholder="RahbarPayBot"' })}</div>
      <label class="flex items-center gap-3 text-sm"><input type="checkbox" name="submissions_open" class="check" ${s.submissions_open !== '0' ? raw('checked') : ''}/>${t('a_set_submissions')}</label>
      <label class="flex items-center gap-3 text-sm"><input type="checkbox" name="maintenance" class="check" ${s.maintenance === '1' ? raw('checked') : ''}/>${t('a_set_maintenance')}</label>
      ${isAdmin() ? html`<div class="flex justify-end"><button class="btn-gold btn-sm">${t('save')}</button></div>` : html`<p class="text-xs text-fog-500">${t('a_admin_only')}</p>`}</form>`,
    services: () => html`<div class="space-y-3">${svc.services.map((x) => html`<div class="flex flex-col gap-3 rounded-xl border border-line p-4 md:flex-row md:items-center">
        <div class="min-w-0 flex-1"><p class="font-medium">${L(x, 'name')} <span class="mono ms-2 text-xs text-fog-500">${x.id}</span></p><p class="mt-0.5 text-xs text-fog-500">${L(svc.categories.find((c) => c.id === x.category_id), 'name')}${x.requires_payment ? html` · ${fmtMoney(x.min_amount, x.currencies.split(',')[0])} – ${fmtMoney(x.max_amount, x.currencies.split(',')[0])}` : ''}</p></div>
        <select data-svc-status="${x.id}" class="input h-9 w-auto text-sm" ${dis}>${['active', 'legal_pending', 'disabled'].map((v) => html`<option value="${v}" ${x.status === v ? raw('selected') : ''}>${t('a_svc_status_' + v)}</option>`)}</select>
        ${isAdmin() && x.requires_payment ? html`<button data-svc-edit="${x.id}" class="btn-ghost btn-sm">${t('a_edit')}</button>` : ''}
      </div>`)}
      ${isAdmin() ? html`<form data-cat class="mt-6 grid gap-3 rounded-xl border border-dashed border-line-strong p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" novalidate>
        <input name="id" class="input h-10 text-sm" placeholder="${t('a_cat_id')} (e.g. remittance)" dir="ltr"/><input name="name_en" class="input h-10 text-sm" placeholder="${t('a_cat_name_en')}"/><input name="name_fa" class="input h-10 text-sm" placeholder="${t('a_cat_name_fa')}" dir="rtl"/><button class="btn-ghost btn-sm h-10">${icon('plus', 'size-4')}${t('a_add_category')}</button></form>` : ''}
    </div>`,
    methods: () => html`<p class="mb-4 text-xs text-fog-500">${t('a_pm_api_note')}</p><div class="grid gap-3 md:grid-cols-2">${svc.payment_methods.map((m) => html`<div class="rounded-xl border border-line p-4">
        <div class="flex items-center justify-between gap-3"><p class="font-medium">${L(m, 'name')} <span class="mono ms-1 text-xs text-fog-500">${m.provider}</span></p>
          <select data-pm="${m.id}" class="input h-9 w-auto text-sm" ${dis}>${['manual', 'disabled'].map((v) => html`<option value="${v}" ${m.status === v ? raw('selected') : ''}>${t('a_pm_' + v)}</option>`)}</select></div>
        <p class="mt-3 text-xs leading-relaxed text-fog-500">${L(m, 'instructions')}</p></div>`)}</div>`,
    staff: () => html`<div class="scroll-x"><table class="tbl min-w-[720px]"><thead><tr><th>ID</th><th>${t('auth_full_name')}</th><th>${t('a_email')}</th><th>${t('a_role')}</th><th>${t('a_2fa')}</th><th>${t('a_last_login')}</th><th></th></tr></thead><tbody>
      ${staff.staff.map((u) => html`<tr><td class="mono">${u.id}</td><td>${u.full_name}</td><td class="mono text-fog-400">${u.email}</td><td>${t(u.role === 'admin' ? 'a_role_admin' : 'a_role_operator')}</td><td>${u.totp_enabled ? html`<span class="text-ok">${icon('check', 'size-4')}</span>` : html`<span class="text-fog-600">—</span>`}</td><td class="text-fog-400">${fmtDate(u.last_login_at)}</td>
        <td class="text-end">${isAdmin() && u.id !== S.user.id ? html`<div class="flex justify-end gap-2"><button data-staff-2fa="${u.id}" class="btn-quiet btn-sm">${t('a_reset_2fa')}</button><button data-staff-toggle="${u.id}" data-to="${u.status === 'active' ? 'suspended' : 'active'}" class="${u.status === 'active' ? 'btn-danger' : 'btn-ghost'} btn-sm">${t(u.status === 'active' ? 'a_suspend' : 'a_activate')}</button></div>` : ''}</td></tr>`)}
      </tbody></table></div>
      ${isAdmin() ? html`<form data-staff class="mt-6 max-w-2xl space-y-4 rounded-xl border border-dashed border-line-strong p-5" novalidate><h3 class="text-sm font-semibold">${t('a_staff_new')}</h3>${formErrorSlot()}
        <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'full_name', label: t('auth_full_name'), required: true })}${field({ name: 'email', label: t('a_email'), type: 'email', required: true, attrs: 'dir="ltr"' })}</div>
        <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'role', label: t('a_role'), type: 'select', value: 'operator', options: [{ value: 'operator', label: t('a_role_operator') }, { value: 'admin', label: t('a_role_admin') }] })}${field({ name: 'password', label: t('auth_password'), type: 'password', required: true, hint: t('a_staff_pw_hint'), attrs: 'autocomplete="new-password"' })}</div>
        <div class="flex justify-end"><button class="btn-gold btn-sm">${icon('plus', 'size-4')}${t('a_staff_new')}</button></div></form>` : ''}`,
    integrations: () => html`<div class="grid gap-3 md:grid-cols-3">${[['a_int_telegram', st.integrations.telegram, 'send'], ['a_int_r2', st.integrations.r2, 'doc'], ['a_int_demo', st.integrations.demo_mode, 'flag']].map(([k, on, ico]) => html`<div class="rounded-xl border border-line p-5"><span class="text-gold-300">${icon(ico)}</span><p class="mt-4 font-medium">${t(k)}</p><span class="badge mt-2 ${on ? 'b-ok' : 'b-neutral'}">${on ? t('a_int_on') : t('a_int_off')}</span></div>`)}</div>`,
  };
  view().innerHTML = html`${pageHeader(t('an_settings'))}
    <div class="scroll-x mb-5"><div class="seg">${tabs.map((x) => html`<a href="/admin/settings?tab=${x}" class="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium ${x === tab ? 'bg-ink-700 text-fog-50' : 'text-fog-500 hover:text-fog-200'}">${t('a_set_' + x)}</a>`)}</div></div>
    <section class="card card-pad">${body[tab]()}</section>`.s;

  const reload = () => settings(_p, query);
  $('[data-general]')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const fd = new FormData(f);
    const b = Object.fromEntries(fd); b.submissions_open = !!fd.get('submissions_open'); b.maintenance = !!fd.get('maintenance');
    try { await api.patch('/api/admin/settings', b); toast(t('saved')); } catch (err) { showApiError(f, err); }
  });
  $$('[data-svc-status]').forEach((sel) => sel.addEventListener('change', async () => {
    const x = svc.services.find((v) => v.id === sel.dataset.svcStatus);
    let legal = false;
    if (sel.value === 'active' && x.category_id === 'digital_assets') {
      legal = await confirmDialog({ title: L(x, 'name'), message: t('a_svc_legal_confirm'), confirmLabel: t('confirm') });
      if (!legal) { sel.value = x.status; return; }
    }
    try { await api.patch(`/api/admin/services/${x.id}`, { status: sel.value, legal_confirmation: legal }); toast(t('saved')); } catch (err) { toast(errorText(err), 'error'); sel.value = x.status; }
  }));
  $$('[data-svc-edit]').forEach((b) => b.addEventListener('click', () => {
    const x = svc.services.find((v) => v.id === b.dataset.svcEdit);
    const cur = x.currencies.split(',')[0];
    modal({ title: L(x, 'name'), body: html`<form class="space-y-4" novalidate>${formErrorSlot()}
      <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'name_en', label: t('a_cat_name_en'), value: x.name_en })}${field({ name: 'name_fa', label: t('a_cat_name_fa'), value: x.name_fa, attrs: 'dir="rtl"' })}</div>
      ${field({ name: 'desc_en', label: 'Description (English)', type: 'textarea', value: x.desc_en })}${field({ name: 'desc_fa', label: 'توضیحات (دری)', type: 'textarea', value: x.desc_fa, attrs: 'dir="rtl"' })}
      <div class="grid gap-4 sm:grid-cols-2">${field({ name: 'min_amount', label: t('a_svc_min'), value: (x.min_amount / 100).toFixed(2), addon: cur, attrs: 'dir="ltr"' })}${field({ name: 'max_amount', label: t('a_svc_max'), value: (x.max_amount / 100).toFixed(2), addon: cur, attrs: 'dir="ltr"' })}</div>
      <div class="flex justify-end gap-2"><button type="button" class="btn-ghost btn-sm" data-close>${t('cancel')}</button><button class="btn-gold btn-sm">${t('save')}</button></div></form>`,
    onMount: (el, close) => $('form', el).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; clearErrors(f);
      try { await api.patch(`/api/admin/services/${x.id}`, Object.fromEntries(new FormData(f))); close(); toast(t('saved')); reload(); } catch (err) { showApiError(f, err); }
    }) });
  }));
  $('[data-cat]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/api/admin/categories', Object.fromEntries(new FormData(e.target))); toast(t('saved')); reload(); } catch (err) { toast(errorText(err), 'error'); }
  });
  $$('[data-pm]').forEach((sel) => sel.addEventListener('change', async () => {
    try { await api.patch(`/api/admin/payment-methods/${sel.dataset.pm}`, { status: sel.value }); toast(t('saved')); } catch (err) { toast(errorText(err), 'error'); reload(); }
  }));
  $('[data-staff]')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; clearErrors(f);
    const btn = f.querySelector('button'); busy(btn, true);
    try { await api.post('/api/admin/staff', Object.fromEntries(new FormData(f))); toast(t('saved')); reload(); } catch (err) { showApiError(f, err); busy(btn, false); }
  });
  $$('[data-staff-toggle]').forEach((b) => b.addEventListener('click', async () => {
    try { await api.patch(`/api/admin/staff/${b.dataset.staffToggle}`, { status: b.dataset.to }); reload(); } catch (err) { toast(errorText(err), 'error'); }
  }));
  $$('[data-staff-2fa]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: t('a_reset_2fa'), message: t('a_reset_2fa') + '?', danger: true }))) return;
    try { await api.patch(`/api/admin/staff/${b.dataset.staff2fa}`, { reset_2fa: true }); toast(t('saved')); reload(); } catch (err) { toast(errorText(err), 'error'); }
  }));
}

// ── routing ────────────────────────────────────────────────────────────
const routes = [
  { path: '/login', view: loginPage, public: true },
  { path: '/setup', view: setupPage, public: true },
  { path: '', view: overview, key: 'an_overview' },
  { path: '/requests', view: requestsPage, key: 'an_requests' },
  { path: '/requests/:id', view: requestDetail, key: 'an_requests' },
  { path: '/customers', view: customers, key: 'an_customers' },
  { path: '/customers/:id', view: customerDetail, key: 'an_customers' },
  { path: '/reconciliation', view: reconciliation, key: 'an_recon' },
  { path: '/reports', view: reports, key: 'an_reports' },
  { path: '/support', view: supportList, key: 'an_support' },
  { path: '/support/:id', view: supportTicket, key: 'an_support' },
  { path: '/notifications', view: notificationsPage, key: 'an_notifications' },
  { path: '/audit', view: audit, key: 'an_audit' },
  { path: '/settings', view: settings, key: 'an_settings' },
];

async function onRoute(found, query) {
  const route = found?.route;
  document.title = `${route?.key ? t(route.key) : t('a_console')} · ${t('brand')}`;
  window.scrollTo(0, 0);
  if (!route) return S.router.go('/admin', { replace: true });
  if (route.public) return route.view();
  if (!S.user) return S.router.go('/admin/login', { replace: true });
  root.innerHTML = shell().s;
  await route.view(found.params, query);
}

async function boot() {
  applyLang();
  try { S.user = (await api.get('/api/admin/me')).user; } catch { S.user = null; }
  S.router = createRouter(routes, { base: '/admin', onRoute });
  bindGlobal();
  await S.router.render();
}
boot();
