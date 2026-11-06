// Signed-in customer pages.
import { html, raw, $, $$ } from '../core/html.js';
import { t, L, getLang, fmtMoney, fmtDate, fmtRelative, fmtNumber, errorText } from '../core/i18n.js';
import {
  icon, pageHeader, emptyState, skeletonRows, errorBox, statusBadge, kv, toast, modal, field, formErrorSlot,
  clearErrors, setFieldError, showApiError, busy, copyText, latin, demoTag, STATUSES,
} from '../core/ui.js';
import { lineChart, demoSeries, sparkline, DEMO_MARKETS } from '../core/chart.js';
import { state, api, loadCatalog, refreshUnread } from './state.js';
import { svcIcon } from './public.js';

const view = () => $('#view');
const loading = () => { view().innerHTML = skeletonRows(5).s; };
const money = (r) => (r.amount ? fmtMoney(r.amount, r.currency) : '—');

// ── Dashboard ───────────────────────────────────────────────────────────
export async function dashboard() {
  loading();
  let data, catalog;
  try { [data, catalog] = await Promise.all([api.get('/api/dashboard'), loadCatalog()]); }
  catch (err) { view().innerHTML = errorBox(err, dashboard).s; return; }
  const c = data.counts;
  const active = (c.pending || 0) + (c.under_review || 0) + (c.payment_verified || 0) + (c.processing || 0);
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const h = new Date().getHours();
  const greet = t(h < 12 ? 'dash_greeting_morning' : h < 18 ? 'dash_greeting_afternoon' : 'dash_greeting_evening');
  const first = state.user.full_name.split(' ')[0];
  const svc = Object.fromEntries(catalog.services.map((s) => [s.id, s]));
  const accountSvc = catalog.services.find((s) => s.category_id === 'account' && s.status === 'active');

  const cards = [
    { ico: 'buy', key: 'card_buy', svc: svc.buy_crypto, href: '/services' },
    { ico: 'sell', key: 'card_sell', svc: svc.sell_crypto, href: '/services' },
    { ico: 'user', key: 'card_account', href: accountSvc ? '/services#account' : '/services', sub: L(accountSvc, 'name') },
    { ico: 'card', key: 'card_history', href: '/payments' },
    { ico: 'life', key: 'card_support', href: '/support' },
  ];

  view().innerHTML = html`
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm text-fog-500">${fmtDate(Date.now() / 1000, { time: false })}</p>
        <h1 class="mt-1 text-[28px] font-semibold tracking-tight">${greet}${t('comma')}${first}</h1>
        <p class="mt-1 text-sm text-fog-400">${t('dash_sub')}</p>
      </div>
      <a href="/requests/new" class="btn-gold">${icon('plus', 'size-4')}${t('nav_new')}</a>
    </div>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div class="flex items-center gap-3"><h2 class="font-semibold">${t('dash_market')}</h2>${demoTag()}</div>
          <div class="seg" data-range>${['24h', '7d', '30d'].map((r) => html`<button data-r="${r}" class="${r === '24h' ? 'on' : ''}">${t('chart_' + r)}</button>`)}</div>
        </div>
        <div class="grid grid-cols-2 gap-2 px-5 pt-5 sm:px-6 md:grid-cols-4" data-markets>
          ${DEMO_MARKETS.map((m, i) => html`<button data-m="${i}" class="rounded-xl border px-3.5 py-3 text-start transition ${i === 0 ? 'border-gold-400/40 bg-gold-400/[0.05]' : 'border-line hover:border-line-strong'}">
            <p class="truncate text-[11.5px] text-fog-500">${t(m.key)}</p>
            <div class="mt-1.5 flex items-end justify-between gap-2"><span class="num text-[15px] font-semibold">${fmtNumber(m.base, m.digits)}</span><span data-spark="${i}"></span></div>
          </button>`)}
        </div>
        <div class="flex flex-wrap items-end justify-between gap-4 px-5 pt-6 sm:px-6">
          <div><p class="text-xs text-fog-500" data-mname>${t(DEMO_MARKETS[0].key)}</p><p class="num mt-1 text-[32px] font-semibold leading-none tracking-tight" data-mval></p></div>
          <dl class="flex gap-6 text-xs"><div><dt class="text-fog-500">${t('chart_high')}</dt><dd class="num mt-1 text-fog-200" data-hi></dd></div><div><dt class="text-fog-500">${t('chart_low')}</dt><dd class="num mt-1 text-fog-200" data-lo></dd></div><div><dt class="text-fog-500">${t('chart_change')}</dt><dd class="num mt-1" data-chg></dd></div></dl>
        </div>
        <div data-chart class="px-2 pb-2 pt-3 sm:px-3"></div>
        <p class="border-t border-line px-6 py-3 text-[11.5px] text-fog-600">${icon('info', 'size-3.5 inline -mt-0.5 me-1')}${t('indicative')}</p>
      </section>

      <div class="flex flex-col gap-5">
        <section class="card card-pad">
          <div class="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
            ${[['dash_active', active, 'text-fog-50'], ['dash_completed', c.completed || 0, 'text-ok'], ['dash_attention', c.rejected || 0, (c.rejected ? 'text-bad' : 'text-fog-50')], ['dash_total', total, 'text-gold-300']].map(([k, v, cls]) => html`
              <div class="bg-ink-850 p-4"><p class="text-[11.5px] text-fog-500">${t(k)}</p><p class="num mt-2 text-2xl font-semibold ${cls}">${fmtNumber(v)}</p></div>`)}
          </div>
          <form data-track class="mt-4 flex gap-2">
            <input name="q" class="input h-10 text-sm" placeholder="RP-XXXX-XXXXXX" dir="ltr" autocomplete="off"/>
            <button class="btn-ghost btn-sm h-10">${t('dash_track')}</button>
          </form>
        </section>
        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('dash_security')}</h2>
          <ul class="mt-4 space-y-3 text-sm">
            <li class="flex items-center justify-between"><span class="flex items-center gap-2.5 text-fog-400">${icon('phone', 'size-4')}${t('dash_security_ok')}</span><span class="text-ok">${icon('check', 'size-4')}</span></li>
            <li class="flex items-center justify-between"><span class="flex items-center gap-2.5 text-fog-400">${icon('send', 'size-4')}${t('dash_security_tg')}</span><span class="${state.user.telegram_linked ? 'text-ok' : 'text-fog-500'} text-xs">${t(state.user.telegram_linked ? 'dash_security_tg_on' : 'dash_security_tg_off')}</span></li>
            <li class="flex items-center justify-between"><span class="flex items-center gap-2.5 text-fog-400">${icon('user', 'size-4')}${t('prof_customer_id')}</span><span class="mono text-fog-200">${state.user.id}</span></li>
          </ul>
          <a href="/profile" class="btn-ghost btn-sm mt-5 w-full">${t('nav_profile')}</a>
        </section>
      </div>
    </div>

    <section class="mt-8">
      <h2 class="mb-4 font-semibold">${t('dash_quick')}</h2>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        ${cards.map((cd) => {
          const locked = cd.svc && cd.svc.status !== 'active';
          return html`<a href="${cd.href}" class="card card-hover group flex flex-col p-5 ${locked ? 'opacity-80' : ''}">
            <div class="flex items-start justify-between">
              <span class="grid size-11 place-items-center rounded-xl border border-line bg-ink-800 ${locked ? 'text-fog-500' : 'text-gold-300'}">${icon(cd.ico)}</span>
              ${locked ? html`<span class="text-fog-600">${icon('lock', 'size-4')}</span>` : html`<span class="text-fog-600 transition group-hover:text-gold-300">${icon('arrowUR', 'size-4 flip-rtl')}</span>`}
            </div>
            <p class="mt-6 font-medium">${t(cd.key)}</p>
            <p class="mt-1 text-xs text-fog-500">${locked ? t('card_locked') : cd.sub || t('card_open')}</p>
          </a>`;
        })}
      </div>
    </section>

    <div class="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 sm:px-6"><h2 class="font-semibold">${t('dash_recent')}</h2><a href="/requests" class="text-sm text-gold-300 hover:text-gold-200">${t('view_all')}</a></div>
        <div class="divider"></div>
        ${data.recent.length ? requestTable(data.recent) : emptyState(t('dash_recent_empty'), '', html`<a href="/services" class="btn-ghost btn-sm">${t('nav_services')}</a>`, 'list')}
      </section>
      <section class="card card-pad flex flex-col">
        <span class="grid size-11 place-items-center rounded-xl border border-line bg-ink-800 text-gold-300">${icon('life')}</span>
        <h2 class="mt-5 font-semibold">${t('dash_support_title')}</h2>
        <p class="mt-1.5 text-sm text-fog-400">${t('dash_support_sub')}</p>
        <p class="mt-4 text-xs text-fog-500">${icon('clock', 'size-3.5 inline -mt-0.5 me-1')}${L(state.config, 'support_hours')}</p>
        <a href="/support" class="btn-ghost mt-auto w-full pt-0" style="margin-top:1.5rem">${t('dash_support_cta')}</a>
      </section>
    </div>`.s;

  // market overview interactions
  let mi = 0, range = '24h', stop = null;
  DEMO_MARKETS.forEach((m, i) => { $(`[data-spark="${i}"]`).innerHTML = sparkline(demoSeries(m, '24h'), { w: 56, h: 22 }).s; });
  const drawMarket = () => {
    const m = DEMO_MARKETS[mi];
    const pts = demoSeries(m, range);
    const first = pts[0].v, last = pts[pts.length - 1].v;
    const chg = ((last - first) / first) * 100;
    $('[data-mname]').textContent = t(m.key);
    $('[data-mval]').textContent = fmtNumber(last, m.digits);
    $('[data-hi]').textContent = fmtNumber(Math.max(...pts.map((p) => p.v)), m.digits);
    $('[data-lo]').textContent = fmtNumber(Math.min(...pts.map((p) => p.v)), m.digits);
    const el = $('[data-chg]');
    el.textContent = `${chg >= 0 ? '+' : ''}${fmtNumber(chg, 2)}%`;
    el.className = `num mt-1 ${chg >= 0 ? 'text-ok' : 'text-bad'}`;
    stop?.();
    stop = lineChart($('[data-chart]'), pts, { digits: m.digits, height: 250, range });
  };
  $('[data-range]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    range = b.dataset.r;
    $$('[data-range] button').forEach((x) => x.classList.toggle('on', x === b));
    drawMarket();
  });
  $('[data-markets]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    mi = Number(b.dataset.m);
    $$('[data-markets] button').forEach((x) => {
      const on = x === b;
      x.classList.toggle('border-gold-400/40', on); x.classList.toggle('bg-gold-400/[0.05]', on); x.classList.toggle('border-line', !on);
    });
    drawMarket();
  });
  drawMarket();
  bindRowLinks(view());
}

function requestTable(rows) {
  return html`<div class="scroll-x"><table class="tbl min-w-[640px]">
    <thead><tr><th>${t('req_tracking')}</th><th>${t('req_service')}</th><th>${t('req_amount')}</th><th>${t('req_submitted')}</th><th class="!text-end">${t('col_status')}</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr class="clickable" data-href="/requests/${r.tracking_no}">
      <td><span class="mono text-fog-50">${r.tracking_no}</span>${r.is_demo ? html` <span class="demo-tag ms-1">${t('demo')}</span>` : ''}</td>
      <td>${L({ name_en: r.service_en, name_fa: r.service_fa }, 'name')}</td>
      <td class="num">${money(r)}</td>
      <td class="text-fog-400">${fmtRelative(r.created_at)}</td>
      <td class="text-end">${statusBadge(r.status)}</td>
    </tr>`)}</tbody></table></div>`;
}

function bindRowLinks(root) {
  root.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]');
    if (tr) state.router.go(tr.dataset.href);
  });
}

// ── Service catalog ─────────────────────────────────────────────────────
export async function services() {
  loading();
  let catalog;
  try { catalog = await loadCatalog(true); } catch (err) { view().innerHTML = errorBox(err, services).s; return; }
  view().innerHTML = html`
    ${pageHeader(t('svc_title'), t('svc_sub'))}
    <div class="space-y-10">
      ${catalog.categories.map((cat) => {
        const list = catalog.services.filter((s) => s.category_id === cat.id);
        if (!list.length) return '';
        return html`<section id="${cat.id}">
          <h2 class="eyebrow mb-4">${L(cat, 'name')}</h2>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            ${list.map((s) => {
              const locked = s.status !== 'active';
              return html`<article class="card card-pad flex flex-col">
                <div class="flex items-start justify-between">
                  <span class="grid size-12 place-items-center rounded-xl border border-line bg-ink-800 ${locked ? 'text-fog-500' : 'text-gold-300'}">${icon(svcIcon(s), 'size-5')}</span>
                  ${locked ? html`<span class="badge b-neutral">${icon('lock', 'size-3')}${t('card_locked')}</span>` : ''}
                </div>
                <h3 class="mt-5 text-[17px] font-semibold">${L(s, 'name')}</h3>
                <p class="mt-2 flex-1 text-sm leading-relaxed text-fog-400">${L(s, 'desc')}</p>
                <div class="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                  <span class="text-xs text-fog-500">${s.requires_payment ? html`${t('svc_range')}: <span class="num text-fog-300">${fmtMoney(s.min_amount, s.currencies[0])} – ${fmtMoney(s.max_amount, s.currencies[0])}</span>` : t('svc_no_payment')}</span>
                  ${locked
                    ? html`<button class="btn-ghost btn-sm" data-locked>${icon('lock', 'size-3.5')}${t('svc_locked')}</button>`
                    : html`<a href="/requests/new?service=${s.id}" class="btn-gold btn-sm">${t('svc_start')}</a>`}
                </div>
              </article>`;
            })}
          </div>
        </section>`;
      })}
    </div>`.s;
  $$('[data-locked]').forEach((b) => b.addEventListener('click', () => modal({
    title: t('svc_locked'),
    body: html`<div class="flex gap-4"><span class="text-gold-400">${icon('shield', 'size-6')}</span><p class="text-sm leading-relaxed text-fog-400">${t('svc_locked_long')}</p></div>`,
    actions: html`<button class="btn-ghost btn-sm" data-close>${t('close')}</button>`,
  })));
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

// ── New request wizard ─────────────────────────────────────────────────
export async function newRequest(_p, query) {
  loading();
  let catalog;
  try { catalog = await loadCatalog(true); } catch (err) { view().innerHTML = errorBox(err, () => newRequest(_p, query)).s; return; }
  const active = catalog.services.filter((s) => s.status === 'active');
  const st = { service: active.find((s) => s.id === query.get('service')) || null, step: 0, data: { details: {} }, receipt: null };
  if (st.service) st.step = 1;
  const steps = ['req_step_service', 'req_step_details', 'req_step_payment', 'req_step_review'];

  const stepsFor = () => (st.service && !st.service.requires_payment ? [0, 1, 3] : [0, 1, 2, 3]);

  const render = () => {
    const visible = stepsFor();
    const pos = visible.indexOf(st.step);
    view().innerHTML = html`
      ${pageHeader(t('req_new_title'), st.service ? L(st.service, 'name') : t('req_choose_service'))}
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="card overflow-hidden">
          <ol class="flex border-b border-line">
            ${visible.map((s, i) => html`<li class="flex flex-1 items-center gap-2.5 px-4 py-4 text-[13px] sm:px-5 ${i === pos ? 'text-fog-50' : 'text-fog-500'}">
              <span class="step-dot ${i < pos ? 'border-gold-400 bg-gold-400 text-ink-950' : i === pos ? 'border-gold-400 text-gold-300' : 'border-line-strong'}">${i < pos ? icon('check', 'size-3.5') : i + 1}</span>
              <span class="hidden sm:inline">${t(steps[s])}</span>
            </li>`)}
          </ol>
          <div class="p-5 sm:p-7" data-step-body>${stepBody()}</div>
        </div>
        <aside class="space-y-4">${summary()}</aside>
      </div>`.s;
    bindStep();
  };

  const summary = () => {
    if (!st.service) return html`<div class="card card-pad text-sm text-fog-400">${t('svc_sub')}</div>`;
    const method = catalog.payment_methods.find((m) => m.id === st.data.payment_method_id);
    return html`<div class="card card-pad">
      <p class="eyebrow">${t('req_review_title')}</p>
      <dl class="mt-3 divide-y divide-line">
        ${kv(t('req_service'), L(st.service, 'name'))}
        ${st.service.requires_payment && st.data.amount ? kv(t('req_amount'), fmtMoney(Math.round(Number(st.data.amount) * 100), st.data.currency)) : ''}
        ${method ? kv(t('req_method'), L(method, 'name')) : ''}
        ${st.data.payment_ref ? kv(t('req_ref'), st.data.payment_ref, true) : ''}
      </dl>
    </div>
    <div class="rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] p-4 text-[13px] leading-relaxed text-gold-200">
      <span class="mb-2 block">${icon('shieldCheck', 'size-5')}</span>${t('req_warning_verify')}
    </div>`;
  };

  const stepBody = () => {
    const s = st.service;
    if (st.step === 0) {
      return html`<div class="grid gap-3 sm:grid-cols-2">
        ${catalog.services.map((x) => {
          const locked = x.status !== 'active';
          return html`<button data-pick="${x.id}" ${locked ? raw('disabled') : ''} class="flex items-start gap-4 rounded-xl border p-4 text-start transition ${s?.id === x.id ? 'border-gold-400/50 bg-gold-400/[0.05]' : 'border-line hover:border-line-strong'} disabled:cursor-not-allowed disabled:opacity-50">
            <span class="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 ${locked ? 'text-fog-500' : 'text-gold-300'}">${icon(svcIcon(x), 'size-4')}</span>
            <span class="min-w-0"><span class="block font-medium">${L(x, 'name')}</span><span class="mt-1 block text-xs leading-relaxed text-fog-500">${locked ? t('card_locked') : L(x, 'desc')}</span></span>
          </button>`;
        })}
      </div>`;
    }
    if (st.step === 1) {
      const cur = st.data.currency || s.currencies[0];
      return html`<form class="space-y-5" novalidate>
        ${formErrorSlot()}
        ${s.requires_payment ? html`<div class="grid gap-5 sm:grid-cols-[1fr_160px]">
          ${field({ name: 'amount', label: t('req_amount'), value: st.data.amount || '', required: true, attrs: 'inputmode="decimal" dir="ltr" autocomplete="off"', hint: `${t('v_min')} ${fmtMoney(s.min_amount, cur)} · ${t('v_max')} ${fmtMoney(s.max_amount, cur)}` })}
          ${field({ name: 'currency', label: t('req_currency'), type: 'select', value: cur, options: s.currencies.map((c) => ({ value: c, label: c === 'AFN' ? (getLang() === 'fa' ? 'افغانی (AFN)' : 'Afghani (AFN)') : (getLang() === 'fa' ? 'دالر (USD)' : 'US Dollar (USD)') })) })}
        </div>` : ''}
        ${s.fields.map((f) => field({
          name: `d_${f.key}`, label: L(f, 'label'), type: f.type === 'select' ? 'select' : f.type === 'textarea' ? 'textarea' : f.type === 'tel' ? 'tel' : 'text',
          value: st.data.details[f.key] || '', required: f.required, optional: !f.required,
          options: f.type === 'select' ? [{ value: '', label: '—' }, ...f.options.map((o) => ({ value: o, label: o }))] : null,
          attrs: f.type === 'tel' || f.pattern ? 'dir="ltr"' : '',
        }))}
        ${!s.requires_payment ? field({ name: 'customer_note', label: t('req_note'), type: 'textarea', value: st.data.customer_note || '', optional: true, attrs: 'maxlength="500"' }) : ''}
        ${nav()}
      </form>`;
    }
    if (st.step === 2) {
      const cur = st.data.currency;
      const methods = catalog.payment_methods.filter((m) => m.currencies.includes(cur));
      const sel = methods.find((m) => m.id === st.data.payment_method_id);
      return html`<form class="space-y-6" novalidate>
        ${formErrorSlot()}
        <div class="field" data-field="payment_method_id">
          <p class="label">${t('req_method')}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            ${methods.map((m) => html`<label class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition has-[:checked]:border-gold-400/50 has-[:checked]:bg-gold-400/[0.05] ${m.status === 'disabled' ? 'cursor-not-allowed opacity-45' : 'border-line hover:border-line-strong'}">
              <input type="radio" name="payment_method_id" value="${m.id}" class="mt-1 accent-[#d4ad66]" ${m.status === 'disabled' ? raw('disabled') : ''} ${sel?.id === m.id ? raw('checked') : ''}/>
              <span class="min-w-0 flex-1"><span class="flex items-center justify-between gap-2"><span class="font-medium">${L(m, 'name')}</span><span class="text-fog-500">${icon(m.provider === 'bank_transfer' ? 'bank' : m.provider === 'gateway' ? 'card' : 'wallet', 'size-4')}</span></span>
              <span class="mt-1 block text-xs text-fog-500">${m.status === 'disabled' ? t('req_method_disabled') : m.status === 'api' ? t('req_method_api') : t('req_method_manual')}</span></span>
            </label>`)}
          </div>
          <p class="field-error"></p>
        </div>
        <div data-instructions>${sel ? instructions(sel) : ''}</div>
        ${field({ name: 'payment_ref', label: t('req_ref'), value: st.data.payment_ref || '', required: true, hint: t('req_ref_hint'), attrs: 'dir="ltr" autocomplete="off" maxlength="40"' })}
        <div class="field" data-field="receipt">
          <p class="label">${t('req_receipt')}${s.requires_receipt ? '' : html` <span class="font-normal text-fog-500">· ${t('optional')}</span>`}</p>
          <div data-receipt>${receiptBox()}</div>
          <p class="hint">${t('req_receipt_hint')}</p>
          <p class="field-error"></p>
        </div>
        ${field({ name: 'customer_note', label: t('req_note'), type: 'textarea', value: st.data.customer_note || '', optional: true, attrs: 'maxlength="500"' })}
        ${nav()}
      </form>`;
    }
    // review
    const method = catalog.payment_methods.find((m) => m.id === st.data.payment_method_id);
    return html`<form class="space-y-6" novalidate>
      ${formErrorSlot()}
      <div><h3 class="font-semibold">${t('req_review_title')}</h3><p class="mt-1 text-sm text-fog-400">${t('req_review_sub')}</p></div>
      <dl class="divide-y divide-line rounded-xl border border-line px-4">
        ${kv(t('req_service'), L(s, 'name'))}
        ${s.requires_payment ? kv(t('req_amount'), fmtMoney(Math.round(Number(latin(st.data.amount).replace(/,/g, '')) * 100), st.data.currency)) : ''}
        ${s.fields.map((f) => (st.data.details[f.key] ? kv(L(f, 'label'), st.data.details[f.key]) : ''))}
        ${method ? kv(t('req_method'), L(method, 'name')) : ''}
        ${st.data.payment_ref ? kv(t('req_ref'), st.data.payment_ref, true) : ''}
        ${st.receipt ? kv(t('req_receipt'), st.receipt.name) : ''}
        ${st.data.customer_note ? kv(t('req_note'), st.data.customer_note) : ''}
      </dl>
      ${s.requires_payment ? html`<div class="field" data-field="declare">
        <label class="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fog-400"><input type="checkbox" name="declare" class="check mt-1"/>${t('req_declare')}</label>
        <p class="field-error"></p>
      </div>` : ''}
      ${nav(true)}
    </form>`;
  };

  const instructions = (m) => html`<div class="rounded-xl border border-line bg-ink-900 p-4 text-sm leading-relaxed text-fog-400">
    <p class="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-fog-200">${icon('info', 'size-4 text-gold-400')}${t('req_instructions')}</p>${L(m, 'instructions')}</div>`;

  const receiptBox = () => st.receipt
    ? html`<div class="flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-3.5">
        <span class="grid size-10 place-items-center rounded-lg bg-ink-700 text-gold-300">${icon('receipt', 'size-4')}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm">${st.receipt.name}</p><p class="text-xs text-fog-500">${fmtNumber(Math.ceil(st.receipt.size / 1024))} KB</p></div>
        <button type="button" data-remove class="btn-quiet btn-sm">${t('req_receipt_remove')}</button>
      </div>`
    : html`<label class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-ink-900 px-4 py-7 text-center transition hover:border-gold-400/40" data-drop>
        <span class="text-fog-500">${icon('upload', 'size-5')}</span><span class="text-sm text-fog-300">${t('req_receipt_drop')}</span><span class="text-xs text-fog-600">JPG · PNG · PDF</span>
        <input type="file" accept="image/jpeg,image/png,application/pdf" class="sr-only" data-file/>
      </label>`;

  const nav = (final = false) => html`<div class="flex items-center justify-between gap-3 border-t border-line pt-5">
    <button type="button" data-back class="btn-quiet">${icon('chevL', 'size-4 flip-rtl')}${t('back')}</button>
    <button type="submit" class="btn-gold">${final ? t('req_submit') : t('continue')}${final ? '' : icon('chevR', 'size-4 flip-rtl')}</button>
  </div>`;

  const go = (dir) => {
    const v = stepsFor();
    const i = v.indexOf(st.step) + dir;
    if (i < 0) return;
    st.step = v[i];
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bindStep = () => {
    const body = $('[data-step-body]');
    $$('[data-pick]', body).forEach((b) => b.addEventListener('click', () => {
      st.service = catalog.services.find((s) => s.id === b.dataset.pick);
      st.data = { details: {} }; st.receipt = null;
      history.replaceState({}, '', `/requests/new?service=${st.service.id}`);
      go(1);
    }));
    const form = $('form', body);
    if (!form) return;
    $('[data-back]', form)?.addEventListener('click', () => go(-1));
    // payment-method change shows instructions
    $$('input[name=payment_method_id]', form).forEach((r) => r.addEventListener('change', () => {
      const m = catalog.payment_methods.find((x) => x.id === r.value);
      st.data.payment_method_id = r.value;
      $('[data-instructions]', form).innerHTML = instructions(m).s;
    }));
    bindReceipt(form);
    form.addEventListener('submit', (e) => { e.preventDefault(); submitStep(form); });
  };

  const bindReceipt = (form) => {
    const box = $('[data-receipt]', form);
    if (!box) return;
    const input = $('[data-file]', box);
    const drop = $('[data-drop]', box);
    const upload = async (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return setFieldError(form, 'receipt', t('err_file_too_large'));
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return setFieldError(form, 'receipt', t('err_file_type'));
      box.innerHTML = html`<div class="flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-4 text-sm text-fog-400"><span class="skeleton size-5 rounded-full"></span>${t('req_receipt_uploading')}</div>`.s;
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await api.upload('/api/uploads', fd);
        st.receipt = r.file;
        form.querySelector('[data-field="receipt"]').classList.remove('has-error');
      } catch (err) { setFieldError(form, 'receipt', errorText(err)); }
      box.innerHTML = receiptBox().s;
      bindReceipt(form);
    };
    input?.addEventListener('change', () => upload(input.files[0]));
    drop?.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('border-gold-400/50'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('border-gold-400/50'));
    drop?.addEventListener('drop', (e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); });
    $('[data-remove]', box)?.addEventListener('click', () => { st.receipt = null; box.innerHTML = receiptBox().s; bindReceipt(form); });
  };

  const submitStep = async (form) => {
    clearErrors(form);
    const s = st.service;
    const fd = new FormData(form);
    let bad = false;
    if (st.step === 1) {
      if (s.requires_payment) {
        const raw = latin(fd.get('amount')).replace(/[,\s]/g, '');
        const cur = fd.get('currency');
        const minor = Math.round(Number(raw) * 100);
        if (!/^\d+(\.\d{1,2})?$/.test(raw)) bad = setFieldError(form, 'amount', t('v_amount'));
        else if (minor < s.min_amount) bad = setFieldError(form, 'amount', `${t('v_min')} ${fmtMoney(s.min_amount, cur)}`);
        else if (minor > s.max_amount) bad = setFieldError(form, 'amount', `${t('v_max')} ${fmtMoney(s.max_amount, cur)}`);
        st.data.amount = raw; st.data.currency = cur;
        if (st.data.payment_method_id && !catalog.payment_methods.find((m) => m.id === st.data.payment_method_id)?.currencies.includes(cur)) st.data.payment_method_id = null;
      }
      for (const f of s.fields) {
        const v = String(fd.get(`d_${f.key}`) || '').trim();
        st.data.details[f.key] = v;
        if (f.required && !v) bad = setFieldError(form, `d_${f.key}`, t('v_required'));
        else if (v && f.pattern && !new RegExp(f.pattern).test(latin(v))) bad = setFieldError(form, `d_${f.key}`, t('err_validation'));
      }
      if (!s.requires_payment) st.data.customer_note = String(fd.get('customer_note') || '');
      if (!bad) go(1);
      return;
    }
    if (st.step === 2) {
      const mid = fd.get('payment_method_id');
      const ref = latin(fd.get('payment_ref')).trim();
      st.data.payment_ref = ref;
      st.data.customer_note = String(fd.get('customer_note') || '');
      if (!mid) bad = setFieldError(form, 'payment_method_id', t('v_required'));
      else {
        st.data.payment_method_id = mid;
        const m = catalog.payment_methods.find((x) => x.id === mid);
        if (!new RegExp(m.ref_pattern).test(ref)) bad = setFieldError(form, 'payment_ref', t('v_ref'));
      }
      if (!ref) bad = setFieldError(form, 'payment_ref', t('v_required'));
      if (s.requires_receipt && !st.receipt) bad = setFieldError(form, 'receipt', t('v_required'));
      if (!bad) go(1);
      return;
    }
    if (s.requires_payment && !fd.get('declare')) return setFieldError(form, 'declare', t('v_terms'));
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const body = { service_id: s.id, details: Object.fromEntries(Object.entries(st.data.details).map(([k, v]) => [k, latin(v)])), customer_note: st.data.customer_note || '' };
      if (s.requires_payment) Object.assign(body, { amount: st.data.amount, currency: st.data.currency, payment_method_id: st.data.payment_method_id, payment_ref: st.data.payment_ref, receipt_file_id: st.receipt?.id });
      const r = await api.post('/api/requests', body);
      success(r.tracking_no);
      refreshUnread();
    } catch (err) {
      busy(btn, false);
      if (err.field === 'payment_ref' || err.field === 'receipt' || err.field === 'payment_method_id') { st.step = 2; render(); showApiError($('[data-step-body] form'), err); }
      else if (err.field === 'amount' || err.field?.startsWith?.('d_')) { st.step = 1; render(); showApiError($('[data-step-body] form'), err); }
      else showApiError(form, err);
    }
  };

  const success = (tn) => {
    view().innerHTML = html`<div class="anim-in mx-auto max-w-lg py-10 text-center">
      <div class="mx-auto grid size-16 place-items-center rounded-full border border-gold-400/30 bg-gold-400/10 text-gold-300">${icon('check', 'size-7')}</div>
      <h1 class="mt-6 text-2xl font-semibold tracking-tight">${t('req_success_title')}</h1>
      <p class="mt-2 text-sm text-fog-400">${t('req_success_sub')}</p>
      <div class="card mt-8 p-5">
        <p class="eyebrow">${t('req_tracking')}</p>
        <div class="mt-3 flex items-center justify-center gap-3"><span class="mono text-2xl font-semibold tracking-wider text-fog-50">${tn}</span><button class="icon-btn size-9" data-copy aria-label="${t('copy')}">${icon('copy', 'size-4')}</button></div>
        <div class="mt-4 flex justify-center">${statusBadge('pending')}</div>
      </div>
      <div class="mt-8 flex flex-wrap justify-center gap-3"><a href="/requests/${tn}" class="btn-gold">${t('req_view')}</a><a href="/services" class="btn-ghost">${t('req_new_another')}</a></div>
    </div>`.s;
    $('[data-copy]').addEventListener('click', () => copyText(tn));
  };

  render();
}

// ── Request list ───────────────────────────────────────────────────────
export async function requests(_p, query) {
  const status = query.get('status') || '';
  const q = query.get('q') || '';
  view().innerHTML = html`
    ${pageHeader(t('req_list_title'), t('req_list_sub'), html`<a href="/requests/new" class="btn-gold btn-sm">${icon('plus', 'size-4')}${t('nav_new')}</a>`)}
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
        <div class="scroll-x -mx-1 px-1"><div class="seg" data-status>
          ${['', ...STATUSES].map((s) => html`<button data-s="${s}" class="${s === status ? 'on' : ''}">${s ? t('st_' + s) : t('filter_all')}</button>`)}
        </div></div>
        <form data-filter class="relative md:w-72"><span class="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-fog-500">${icon('search', 'size-4')}</span><input name="q" value="${q}" class="input h-10 ps-10 text-sm" placeholder="${t('req_search_ph')}" dir="ltr"/></form>
      </div>
      <div data-list>${skeletonRows(4)}</div>
    </div>`.s;
  $('[data-status]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const p = new URLSearchParams(location.search); b.dataset.s ? p.set('status', b.dataset.s) : p.delete('status');
    state.router.go(`/requests${p.toString() ? '?' + p : ''}`, { replace: true });
  });
  $('[data-filter]').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams(location.search); const v = new FormData(e.target).get('q'); v ? p.set('q', v) : p.delete('q');
    state.router.go(`/requests${p.toString() ? '?' + p : ''}`, { replace: true });
  });
  try {
    const params = new URLSearchParams(); if (status) params.set('status', status); if (q) params.set('q', q);
    const { requests: rows } = await api.get(`/api/requests?${params}`);
    $('[data-list]').innerHTML = (rows.length ? requestTable(rows) : emptyState(t('req_empty'), t('req_empty_sub'), html`<a href="/services" class="btn-gold btn-sm">${t('nav_services')}</a>`, 'list')).s;
    bindRowLinks($('[data-list]'));
  } catch (err) { $('[data-list]').innerHTML = errorBox(err, () => requests(_p, query)).s; }
}

// ── Request detail / tracking ───────────────────────────────────────────
export async function requestDetail({ id }) {
  loading();
  let d;
  try { d = await api.get(`/api/requests/${encodeURIComponent(id.toUpperCase())}`); }
  catch (err) { view().innerHTML = (err.status === 404 ? emptyState(t('err_not_found'), id, html`<a href="/requests" class="btn-ghost btn-sm">${t('back')}</a>`, 'search') : errorBox(err, () => requestDetail({ id }))).s; return; }
  const r = d.request;
  const flow = r.payment_method_id ? STATUSES.filter((s) => s !== 'rejected') : ['pending', 'under_review', 'processing', 'completed'];
  const reached = new Map(d.events.map((e) => [e.status, e]));
  const rejected = r.status === 'rejected';
  const curIdx = flow.indexOf(r.status);
  const catalog = await loadCatalog().catch(() => null);
  const svc = catalog?.services.find((s) => s.id === r.service_id);

  view().innerHTML = html`
    <a href="/requests" class="mb-5 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('req_list_title')}</a>
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="eyebrow">${t('req_tracking')}</p>
        <div class="mt-2 flex flex-wrap items-center gap-3"><h1 class="mono text-2xl font-semibold tracking-wider">${r.tracking_no}</h1><button class="icon-btn size-8" data-copy aria-label="${t('copy')}">${icon('copy', 'size-3.5')}</button>${statusBadge(r.status)}${r.is_demo ? demoTag() : ''}</div>
      </div>
      <a href="/support?tracking=${r.tracking_no}" class="btn-ghost btn-sm">${icon('life', 'size-4')}${t('req_ask_support')}</a>
    </div>
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section class="card card-pad">
        <h2 class="font-semibold">${t('req_detail_timeline')}</h2>
        ${rejected ? html`<div class="mt-5 rounded-xl border border-bad/25 bg-bad/[0.07] p-4 text-sm"><p class="font-medium text-bad">${t('st_rejected')}</p>${r.reject_reason ? html`<p class="mt-1 text-fog-300">${t('req_reason')}: ${r.reject_reason}</p>` : ''}</div>` : ''}
        <ol class="relative mt-6">
          ${flow.map((s, i) => {
            const ev = reached.get(s);
            const done = !!ev && (rejected || i <= curIdx);
            const current = !rejected && i === curIdx;
            return html`<li class="relative flex gap-4 pb-7 last:pb-0">
              ${i < flow.length - 1 ? html`<span class="absolute start-[15px] top-8 bottom-0 w-px ${done && (reached.has(flow[i + 1])) ? 'bg-gold-400/50' : 'bg-line'}"></span>` : ''}
              <span class="step-dot relative z-10 ${done ? 'border-gold-400 bg-gold-400 text-ink-950' : 'border-line-strong bg-ink-850 text-fog-600'} ${current && r.status !== 'completed' ? 'ring-4 ring-gold-400/15' : ''}">${done ? icon('check', 'size-3.5') : i + 1}</span>
              <div class="pt-1">
                <p class="text-sm font-medium ${done ? 'text-fog-50' : 'text-fog-500'}">${t('st_' + s)}</p>
                <p class="mt-0.5 text-xs text-fog-500">${ev ? fmtDate(ev.created_at) : t('st_' + s + '_d')}</p>
                ${ev?.note ? html`<p class="mt-2 rounded-lg bg-ink-800 px-3 py-2 text-xs text-fog-300">${ev.note}</p>` : ''}
              </div>
            </li>`;
          })}
        </ol>
      </section>
      <section class="card card-pad">
        <h2 class="font-semibold">${t('req_detail_info')}</h2>
        <dl class="mt-3 divide-y divide-line">
          ${kv(t('req_service'), L({ name_en: r.service_en, name_fa: r.service_fa }, 'name'))}
          ${r.amount ? kv(t('req_amount'), fmtMoney(r.amount, r.currency)) : ''}
          ${Object.entries(r.details).map(([k, v]) => { const f = svc?.fields.find((x) => x.key === k); return kv(f ? L(f, 'label') : k, v); })}
          ${r.payment_method_id ? kv(t('req_method'), L({ name_en: r.method_en, name_fa: r.method_fa }, 'name')) : ''}
          ${r.payment_ref ? kv(t('req_ref'), r.payment_ref, true) : ''}
          ${r.customer_note ? kv(t('req_note'), r.customer_note) : ''}
          ${kv(t('req_submitted'), fmtDate(r.created_at))}
          ${kv(t('req_updated'), fmtDate(r.updated_at))}
        </dl>
        ${r.receipt_file_id ? html`<a href="/api/files/${r.receipt_file_id}" target="_blank" rel="noopener" class="btn-ghost btn-sm mt-4 w-full">${icon('receipt', 'size-4')}${t('req_receipt_view')}</a>` : ''}
      </section>
    </div>`.s;
  $('[data-copy]').addEventListener('click', () => copyText(r.tracking_no));
}

// ── Payments ────────────────────────────────────────────────────────────
const PAY_STYLE = { awaiting: 'b-neutral', verified: 'b-ok', mismatch: 'b-warn', rejected: 'b-bad', refunded: 'b-info' };
export async function payments() {
  loading();
  let d, catalog;
  try { [d, catalog] = await Promise.all([api.get('/api/payments'), loadCatalog()]); } catch (err) { view().innerHTML = errorBox(err, payments).s; return; }
  view().innerHTML = html`
    ${pageHeader(t('pay_title'), t('pay_sub'))}
    <section class="card overflow-hidden">
      ${d.payments.length ? html`<div class="scroll-x"><table class="tbl min-w-[760px]">
        <thead><tr><th>${t('pay_date')}</th><th>${t('req_tracking')}</th><th>${t('pay_method')}</th><th>${t('pay_reference')}</th><th>${t('pay_amount')}</th><th class="!text-end">${t('pay_status')}</th></tr></thead>
        <tbody>${d.payments.map((p) => {
          const s = p.verification?.status || (p.status === 'rejected' ? 'rejected' : 'awaiting');
          return html`<tr class="clickable" data-href="/requests/${p.tracking_no}">
            <td class="text-fog-400">${fmtDate(p.created_at, { short: true })}</td>
            <td class="mono text-fog-50">${p.tracking_no}</td>
            <td>${L({ name_en: p.method_en, name_fa: p.method_fa }, 'name')}</td>
            <td class="mono text-fog-400">${p.payment_ref}</td>
            <td class="num">${fmtMoney(p.amount, p.currency)}</td>
            <td class="text-end"><span class="badge ${PAY_STYLE[s]}"><span class="badge-dot"></span>${t('pay_state_' + s)}</span></td>
          </tr>`;
        })}</tbody></table></div>` : emptyState(t('pay_empty'), '', '', 'card')}
    </section>
    <section class="mt-8">
      <h2 class="font-semibold">${t('pay_methods_title')}</h2><p class="mt-1 text-sm text-fog-500">${t('pay_methods_sub')}</p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        ${catalog.payment_methods.map((m) => html`<div class="card p-4">
          <div class="flex items-center justify-between"><span class="text-gold-300">${icon(m.provider === 'bank_transfer' ? 'bank' : m.provider === 'gateway' ? 'card' : 'wallet')}</span>
            <span class="badge ${m.status === 'disabled' ? 'b-neutral' : 'b-gold'}">${m.status === 'disabled' ? t('req_method_disabled') : t('req_method_manual')}</span></div>
          <p class="mt-4 font-medium">${L(m, 'name')}</p><p class="mt-1 line-clamp-3 text-xs leading-relaxed text-fog-500">${L(m, 'instructions')}</p>
        </div>`)}
      </div>
    </section>`.s;
  bindRowLinks(view());
}

// ── Notifications ───────────────────────────────────────────────────────
export async function notifications() {
  loading();
  let d;
  try { d = await api.get('/api/notifications'); } catch (err) { view().innerHTML = errorBox(err, notifications).s; return; }
  const unread = d.notifications.filter((n) => !n.read).length;
  view().innerHTML = html`
    ${pageHeader(t('ntf_title'), t('ntf_sub'), unread ? html`<button data-all class="btn-ghost btn-sm">${icon('check', 'size-4')}${t('ntf_mark_all')}</button>` : '')}
    <section class="card overflow-hidden">
      ${d.notifications.length ? html`<ul class="divide-y divide-line">${d.notifications.map((n) => html`<li>
        <a ${n.link ? raw(`href="${n.link.replace(/"/g, '')}"`) : ''} data-id="${n.id}" class="flex gap-4 px-5 py-4 transition hover:bg-white/[0.02] sm:px-6 ${n.link ? 'cursor-pointer' : ''}">
          <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-ink-800 ${n.read ? 'text-fog-500' : 'text-gold-300'}">${icon(n.kind === 'request_status' ? 'list' : n.kind === 'support' ? 'message' : n.kind === 'announcement' ? 'flag' : 'bell', 'size-4')}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3"><p class="text-sm ${n.read ? 'text-fog-300' : 'font-medium text-fog-50'}">${L(n, 'title')}</p><span class="shrink-0 text-xs text-fog-500">${fmtRelative(n.created_at)}</span></div>
            ${L(n, 'body') ? html`<p class="mt-1 text-[13px] leading-relaxed text-fog-500">${L(n, 'body')}</p>` : ''}
          </div>
          ${n.read ? '' : html`<span class="mt-2 size-2 shrink-0 rounded-full bg-gold-400"></span>`}
        </a></li>`)}</ul>` : emptyState(t('ntf_empty'), '', '', 'bell')}
    </section>`.s;
  const markRead = async (ids) => { try { await api.post('/api/notifications/read', ids ? { ids } : {}); } catch { /* */ } refreshUnread(); };
  $('[data-all]')?.addEventListener('click', async () => { await markRead(null); notifications(); });
  $$('[data-id]').forEach((a) => a.addEventListener('click', () => markRead([Number(a.dataset.id)])));
}

// ── Profile & security ─────────────────────────────────────────────────
export async function profile() {
  const u = state.user;
  view().innerHTML = html`
    ${pageHeader(t('prof_title'))}
    <div class="grid gap-5 xl:grid-cols-2">
      <section class="card card-pad">
        <h2 class="font-semibold">${t('prof_personal')}</h2>
        <form data-personal class="mt-5 space-y-5" novalidate>
          ${formErrorSlot()}
          ${field({ name: 'full_name', label: t('auth_full_name'), value: u.full_name, required: true, attrs: 'maxlength="80"' })}
          <div class="grid gap-5 sm:grid-cols-2">
            <div><p class="label">${t('auth_phone')}</p><div class="input flex items-center justify-between opacity-80" dir="ltr"><span class="mono">${u.phone}</span><span class="text-ok">${icon('check', 'size-4')}</span></div></div>
            <div><p class="label">${t('prof_customer_id')}</p><div class="input flex items-center mono opacity-80">${u.id}</div></div>
          </div>
          ${field({ name: 'lang', label: t('prof_language'), type: 'select', value: getLang(), options: [{ value: 'en', label: 'English' }, { value: 'fa', label: 'دری' }] })}
          <p class="text-xs text-fog-500">${t('prof_member_since')} ${fmtDate(u.created_at, { time: false })}</p>
          <div class="flex justify-end"><button class="btn-gold btn-sm">${t('save')}</button></div>
        </form>
      </section>

      <section class="card card-pad">
        <h2 class="font-semibold">${t('prof_password')}</h2>
        <form data-password class="mt-5 space-y-5" novalidate>
          ${formErrorSlot()}
          ${field({ name: 'current', label: t('prof_current_pw'), type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
          ${field({ name: 'password', label: t('prof_new_pw'), type: 'password', required: true, hint: t('auth_password_hint'), attrs: 'autocomplete="new-password"' })}
          <div class="flex justify-end"><button class="btn-gold btn-sm">${t('prof_password')}</button></div>
        </form>
      </section>

      <section class="card card-pad">
        <h2 class="font-semibold">${t('prof_notifications')}</h2>
        <ul class="mt-4 divide-y divide-line">
          <li class="flex items-center justify-between gap-4 py-4"><div><p class="text-sm font-medium">${t('prof_inapp')}</p><p class="mt-0.5 text-xs text-fog-500">${t('prof_inapp_d')}</p></div><span class="badge b-ok">${t('yes')}</span></li>
          <li class="py-4"><div class="flex items-center justify-between gap-4"><div><p class="text-sm font-medium">${t('prof_tg')}</p><p class="mt-0.5 text-xs text-fog-500">${t('prof_tg_d')}</p></div>
            ${u.telegram_linked ? html`<button data-tg-unlink class="btn-ghost btn-sm">${t('prof_tg_unlink')}</button>` : html`<button data-tg-link class="btn-ghost btn-sm">${icon('send', 'size-4')}${t('prof_tg_link')}</button>`}</div>
            ${u.telegram_linked ? html`<label class="mt-3 flex items-center gap-2 text-xs text-fog-400"><input type="checkbox" class="check" data-pref="notify_telegram" ${u.notify_telegram ? raw('checked') : ''}/>${t('prof_tg')}</label>` : ''}
            <div data-tg-box></div></li>
          <li class="flex items-center justify-between gap-4 py-4"><div><p class="text-sm font-medium">${t('prof_email')}</p><p class="mt-0.5 text-xs text-fog-500">${t('prof_email_d')}</p></div><input type="checkbox" class="check" data-pref="notify_email" ${u.notify_email ? raw('checked') : ''}/></li>
        </ul>
      </section>

      <section class="card card-pad">
        <div class="flex items-center justify-between"><h2 class="font-semibold">${t('prof_sessions')}</h2><button data-revoke class="btn-ghost btn-sm">${t('prof_revoke')}</button></div>
        <ul data-sessions class="mt-4 divide-y divide-line">${skeletonRows(2)}</ul>
      </section>
    </div>`.s;

  const pf = $('[data-personal]');
  pf.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(pf);
    const d = Object.fromEntries(new FormData(pf));
    if (d.full_name.trim().length < 3) return setFieldError(pf, 'full_name', t('v_name'));
    const btn = pf.querySelector('button'); busy(btn, true);
    try {
      const r = await api.patch('/api/me', { full_name: d.full_name, lang: d.lang });
      state.user = r.user;
      if (d.lang !== getLang()) { (await import('../core/i18n.js')).setLang(d.lang); state.router.render(); }
      toast(t('saved'));
    } catch (err) { showApiError(pf, err); } finally { busy(btn, false); }
  });

  const pw = $('[data-password]');
  pw.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(pw);
    const d = Object.fromEntries(new FormData(pw));
    if (!d.current) return setFieldError(pw, 'current', t('v_required'));
    if (d.password.length < 10 || !/[A-Za-z]/.test(d.password) || !/\d/.test(d.password)) return setFieldError(pw, 'password', t('err_weak_password'));
    const btn = pw.querySelector('button'); busy(btn, true);
    try { await api.post('/api/me/password', d); pw.reset(); toast(t('prof_pw_changed')); loadSessions(); }
    catch (err) { err.code === 'bad_credentials' ? setFieldError(pw, 'current', errorText(err)) : showApiError(pw, err); } finally { busy(btn, false); }
  });

  $$('[data-pref]').forEach((c) => c.addEventListener('change', async () => {
    try { const r = await api.patch('/api/me', { [c.dataset.pref]: c.checked }); state.user = r.user; toast(t('saved')); } catch (err) { toast(errorText(err), 'error'); }
  }));
  $('[data-tg-link]')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try {
      const r = await api.post('/api/me/telegram-link');
      $('[data-tg-box]').innerHTML = html`<div class="mt-4 rounded-xl border border-line bg-ink-900 p-4 text-sm">
        ${r.bot ? html`<p class="text-fog-400">${t('prof_tg_code')}</p><p class="mono mt-2 text-fog-50">/start ${r.code}</p>
          <a class="btn-gold btn-sm mt-3" target="_blank" rel="noopener" href="https://t.me/${r.bot}?start=${r.code}">${icon('ext', 'size-4')}@${r.bot}</a>` : html`<p class="text-fog-500">${t('prof_tg_nobot')}</p>`}
      </div>`.s;
    } catch (err) { toast(errorText(err), 'error'); } finally { busy(e.currentTarget, false); }
  });
  $('[data-tg-unlink]')?.addEventListener('click', async () => {
    await api.post('/api/me/telegram-unlink'); state.user = { ...state.user, telegram_linked: false }; profile();
  });
  const loadSessions = async () => {
    try {
      const { sessions } = await api.get('/api/me/sessions');
      $('[data-sessions]').innerHTML = html`${sessions.map((s) => html`<li class="flex items-center gap-4 py-3.5">
        <span class="grid size-9 place-items-center rounded-xl border border-line bg-ink-800 text-fog-400">${icon(/mobile|android|iphone/i.test(s.ua) ? 'phone' : 'grid', 'size-4')}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm">${shortUa(s.ua)}</p><p class="text-xs text-fog-500">${s.ip} · ${fmtRelative(s.created_at)}</p></div>
        ${s.current ? html`<span class="badge b-gold">${t('prof_this_device')}</span>` : ''}
      </li>`)}`.s;
    } catch (err) { $('[data-sessions]').innerHTML = errorBox(err).s; }
  };
  $('[data-revoke]').addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try { await api.post('/api/me/sessions/revoke-others'); toast(t('prof_revoked')); loadSessions(); } finally { busy(e.currentTarget, false); }
  });
  loadSessions();
}

function shortUa(ua = '') {
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${b}${os ? ' · ' + os : ''}`;
}

// ── Support ─────────────────────────────────────────────────────────────
const TK_STYLE = { open: 'b-info', answered: 'b-gold', closed: 'b-neutral' };
export async function support(_p, query) {
  loading();
  let d, reqs;
  try { [d, reqs] = await Promise.all([api.get('/api/support'), api.get('/api/requests')]); } catch (err) { view().innerHTML = errorBox(err, () => support(_p, query)).s; return; }
  const preTracking = query.get('tracking') || '';
  view().innerHTML = html`
    ${pageHeader(t('sup_title'), t('sup_sub'))}
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section class="card card-pad">
        <h2 class="font-semibold">${t('sup_new')}</h2>
        <form data-ticket class="mt-5 space-y-5" novalidate>
          ${formErrorSlot()}
          <div class="grid gap-5 sm:grid-cols-2">
            ${field({ name: 'category', label: t('sup_category'), type: 'select', value: preTracking ? 'request' : 'general', options: ['general', 'request', 'payment', 'account', 'security'].map((c) => ({ value: c, label: t('cat_' + c) })) })}
            ${field({ name: 'tracking_no', label: t('sup_tracking'), type: 'select', value: preTracking, optional: true, options: [{ value: '', label: '—' }, ...reqs.requests.map((r) => ({ value: r.tracking_no, label: r.tracking_no }))] })}
          </div>
          ${field({ name: 'subject', label: t('sup_subject'), required: true, attrs: 'maxlength="120"' })}
          ${field({ name: 'message', label: t('sup_message'), type: 'textarea', required: true, attrs: 'maxlength="2000" rows="5"' })}
          <div class="flex justify-end"><button class="btn-gold">${icon('send', 'size-4 flip-rtl')}${t('sup_send')}</button></div>
        </form>
      </section>
      <div class="space-y-5">
        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('sup_hours')}</h2>
          <p class="mt-2 text-sm text-fog-400">${L(state.config, 'support_hours')}</p>
          ${state.config.support_email ? html`<p class="mono mt-2 text-sm text-fog-300">${state.config.support_email}</p>` : ''}
        </section>
        <section class="card card-pad">
          <h2 class="text-sm font-semibold">${t('sup_faq')}</h2>
          <div class="mt-3 divide-y divide-line">${[1, 2, 3].map((n) => html`<details class="group py-3"><summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">${t(`sup_faq${n}`)}<span class="text-fog-500 transition group-open:rotate-180">${icon('chevD', 'size-4')}</span></summary><p class="mt-2 text-[13px] leading-relaxed text-fog-500">${t(`sup_faq${n}a`)}</p></details>`)}</div>
        </section>
      </div>
    </div>
    <section class="card mt-5 overflow-hidden">
      <div class="px-5 py-4 sm:px-6"><h2 class="font-semibold">${t('sup_tickets')}</h2></div><div class="divider"></div>
      ${d.tickets.length ? html`<ul class="divide-y divide-line">${d.tickets.map((tk) => html`<li><a href="/support/${tk.ticket_no}" class="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] sm:px-6">
        <span class="grid size-9 place-items-center rounded-xl border border-line bg-ink-800 text-fog-400">${icon('message', 'size-4')}</span>
        <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">${tk.subject}</p><p class="mt-0.5 text-xs text-fog-500"><span class="mono">${tk.ticket_no}</span> · ${t('cat_' + tk.category)}${tk.tracking_no ? html` · <span class="mono">${tk.tracking_no}</span>` : ''} · ${fmtRelative(tk.updated_at)}</p></div>
        <span class="badge ${TK_STYLE[tk.status]}">${t('tk_' + tk.status)}</span>
      </a></li>`)}</ul>` : emptyState(t('sup_empty'), '', '', 'message')}
    </section>`.s;

  const form = $('[data-ticket]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(form);
    const dd = Object.fromEntries(new FormData(form));
    let bad = false;
    if (dd.subject.trim().length < 4) bad = setFieldError(form, 'subject', t('v_required'));
    if (dd.message.trim().length < 10) bad = setFieldError(form, 'message', t('v_required'));
    if (bad) return;
    const btn = form.querySelector('button'); busy(btn, true);
    try { const r = await api.post('/api/support', dd); toast(`${t('sup_created')} · ${r.ticket_no}`); state.router.go(`/support/${r.ticket_no}`); }
    catch (err) { showApiError(form, err); busy(btn, false); }
  });
}

export async function ticket({ id }) {
  loading();
  let d;
  try { d = await api.get(`/api/support/${encodeURIComponent(id)}`); } catch (err) { view().innerHTML = errorBox(err, () => ticket({ id })).s; return; }
  const tk = d.ticket;
  view().innerHTML = html`
    <a href="/support" class="mb-5 inline-flex items-center gap-2 text-sm text-fog-500 hover:text-fog-200">${icon('chevL', 'size-4 flip-rtl')}${t('sup_title')}</a>
    <div class="mb-6 flex flex-wrap items-center gap-3"><h1 class="h-page">${tk.subject}</h1><span class="badge ${TK_STYLE[tk.status]}">${t('tk_' + tk.status)}</span></div>
    <p class="-mt-4 mb-6 text-xs text-fog-500"><span class="mono">${tk.ticket_no}</span> · ${t('cat_' + tk.category)}${tk.tracking_no ? html` · <a class="mono text-gold-300" href="/requests/${tk.tracking_no}">${tk.tracking_no}</a>` : ''}</p>
    <section class="card mx-auto max-w-3xl">
      <div class="space-y-4 p-5 sm:p-6">${d.messages.map((m) => html`<div class="flex ${m.is_staff ? 'justify-start' : 'justify-end'}">
        <div class="max-w-[85%] rounded-2xl px-4 py-3 ${m.is_staff ? 'rounded-ss-md border border-line bg-ink-800' : 'rounded-se-md bg-gold-400/[0.12] text-fog-50'}">
          <p class="mb-1 text-[11px] ${m.is_staff ? 'text-gold-300' : 'text-fog-400'}">${m.is_staff ? t('sup_staff') : t('sup_you')} · ${fmtRelative(m.created_at)}</p>
          <p class="whitespace-pre-wrap text-sm leading-relaxed">${m.body}</p>
        </div></div>`)}</div>
      <div class="divider"></div>
      ${tk.status === 'closed' ? html`<p class="p-5 text-center text-sm text-fog-500">${t('sup_closed')}</p>` : html`<form data-reply class="flex gap-3 p-4" novalidate>
        <div class="flex-1" data-field="message"><textarea name="message" class="input min-h-0 py-2.5" rows="2" maxlength="2000" placeholder="${t('sup_reply_ph')}"></textarea><p class="field-error"></p></div>
        <button class="btn-gold self-start">${icon('send', 'size-4 flip-rtl')}</button>
      </form>`}
    </section>`.s;
  const f = $('[data-reply]');
  f?.addEventListener('submit', async (e) => {
    e.preventDefault(); clearErrors(f);
    const msg = new FormData(f).get('message').trim();
    if (msg.length < 2) return setFieldError(f, 'message', t('v_required'));
    const btn = f.querySelector('button'); busy(btn, true);
    try { await api.post(`/api/support/${tk.ticket_no}/messages`, { message: msg }); ticket({ id }); } catch (err) { showApiError(f, err); busy(btn, false); }
  });
}
