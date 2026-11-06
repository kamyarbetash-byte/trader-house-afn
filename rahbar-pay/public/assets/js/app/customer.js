// Signed-in customer screens: 3-step request, WhatsApp-style tracking, support chat, account.
import { html, raw, $, $$ } from '../core/html.js';
import { t, L, getLang, setLang, fmtMoney, fmtDate, fmtNumber, errorText } from '../core/i18n.js';
import { icon, emptyState, skeletonRows, errorBox, kv, toast, field, formErrorSlot, clearErrors, setFieldError, showApiError, busy, latin, demoTag } from '../core/ui.js';
import { state, api, loadCatalog, refreshBadges } from './state.js';
import { frame } from './shell.js';

const root = () => document.getElementById('app');
const view = () => $('#view');

// ── shared helpers ──────────────────────────────────────────────────────
const SVC_ICON = { bill_payment: 'bolt', mobile_topup: 'phone', account_statement: 'doc', account_update: 'user', buy_crypto: 'lock', sell_crypto: 'lock' };
const svcIcon = (id) => SVC_ICON[id] || 'service';
const svcName = (r) => L({ name_en: r.service_en, name_fa: r.service_fa }, 'name');
const optLabel = (f, v) => { const o = (f?.options || []).find((x) => (x.value ?? x) === v); return o ? (typeof o === 'string' ? o : L(o, 'label')) : v; };
const methodIcon = (m) => (m.provider === 'bank_transfer' ? 'bank' : m.provider === 'gateway' ? 'card' : 'wallet');

let poll = null;
export function stopPolling() { if (poll) { clearInterval(poll); poll = null; } }
function startPolling(fn, ms = 15000) {
  stopPolling();
  poll = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
}

function timeOnly(ts) {
  return new Intl.DateTimeFormat(getLang() === 'fa' ? 'fa-AF' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts * 1000));
}
function dayLabel(ts) {
  const d = new Date(ts * 1000).toDateString();
  const now = new Date();
  if (d === now.toDateString()) return t('today');
  if (d === new Date(now - 86400000).toDateString()) return t('yesterday');
  return fmtDate(ts, { time: false });
}
function shortTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toDateString() === new Date().toDateString() ? timeOnly(ts) : dayLabel(ts);
}

async function loadingFrame(opts) {
  root().innerHTML = frame(skeletonRows(4), opts).s;
}

/** Resize photos before upload (slow connections): max 1600 px, JPEG 80 %. */
async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.8));
    if (blob && (blob.size < file.size || file.type !== 'image/jpeg' && file.type !== 'image/png')) {
      return new File([blob], (file.name || 'receipt').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  } catch { /* fall back to original */ }
  return file;
}

// ── Account services chooser ───────────────────────────────────────────
export async function account() {
  await loadingFrame({ title: t('btn_account'), back: '/' });
  let catalog;
  try { catalog = await loadCatalog(); } catch (err) { view().innerHTML = errorBox(err, account).s; return; }
  const list = catalog.services.filter((s) => s.category_id === 'account' && s.status === 'active');
  view().innerHTML = html`
    <p class="mb-4 text-[17px] font-bold">${t('account_q')}</p>
    <div class="space-y-3">${list.map((s) => html`<a href="/new/${s.id}" class="choice">
      <span class="choice-ico">${icon(svcIcon(s.id), 'size-5')}</span>
      <span class="min-w-0 flex-1"><span class="block font-bold">${L(s, 'name')}</span><span class="block text-[13px] text-fog-500">${L(s, 'desc')}</span></span>
      <span class="text-fog-500">${icon('chevL', 'size-5 ltr:rotate-180')}</span>
    </a>`)}</div>`.s;
}

// ── New request: 3 steps (details → payment → send); 2 steps when no payment ──
export async function newRequest({ service: sid }) {
  await loadingFrame({ title: '…', back: '/' });
  let catalog;
  try { catalog = await loadCatalog(true); } catch (err) { view().innerHTML = errorBox(err, () => newRequest({ service: sid })).s; return; }
  const s = catalog.services.find((x) => x.id === sid);
  if (!s || s.status !== 'active') {
    root().innerHTML = frame(emptyState(t('closed_now'), '', html`<a href="/" class="btn-gold btn-xl">${t('back_home')}</a>`, 'lock'), { title: s ? L(s, 'name') : '', back: '/' }).s;
    return;
  }
  const paid = s.requires_payment;
  const total = paid ? 3 : 2;
  const labels = paid ? ['s_info', 's_pay', 's_send'] : ['s_info', 's_send'];
  const st = { step: 1, details: {}, amount: '', currency: s.currencies[0], method: null, ref: '', receipt: null };
  const methods = () => catalog.payment_methods.filter((m) => m.currencies.includes(st.currency));
  const chips = sid === 'mobile_topup' ? [50, 100, 200, 500] : [];

  const render = () => {
    const back = st.step === 1 ? (s.category_id === 'account' ? '/account' : '/') : null;
    root().innerHTML = frame(html`
      <div class="mb-5 grid gap-1.5" style="grid-template-columns:repeat(${total},1fr)">
        ${labels.map((k, i) => html`<div><div class="h-1.5 rounded-full ${i < st.step ? 'bg-gold-400' : 'bg-ink-700'}"></div><p class="mt-1.5 text-center text-[12px] ${i + 1 === st.step ? 'font-bold text-gold-300' : 'text-fog-500'}">${t(k)}</p></div>`)}
      </div>
      <form novalidate class="flex flex-1 flex-col">
        ${formErrorSlot()}
        <div class="flex-1 space-y-6 pt-2">${body()}</div>
        <div class="sticky bottom-0 -mx-4 mt-6 flex gap-3 border-t border-line bg-ink-950/95 px-4 py-3 backdrop-blur">
          ${st.step > 1 ? html`<button type="button" data-prev class="btn-ghost h-14 rounded-2xl px-5 text-[16px]">${t('prev')}</button>` : ''}
          <button type="submit" class="btn-gold btn-xl flex-1">${st.step === total ? t('send_btn') : t('next')}</button>
        </div>
      </form>`, { title: L(s, 'name'), sub: t('step_of', { n: fmtNumber(st.step), total: fmtNumber(total) }), back: back || location.pathname, noFab: true, noNav: true }).s;
    // back arrow in header goes to previous step instead of leaving
    if (!back) root().querySelector('header a').addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); st.step--; render(); }, true);
    bind();
  };

  const body = () => {
    if (st.step === 1) {
      return html`
        ${s.fields.map((f) => fieldUi(f))}
        ${paid ? html`<div class="field" data-field="amount">
          <label for="f_amount" class="label text-[16px] font-bold">${t('amount_label')}</label>
          <div class="input-group" dir="ltr"><input id="f_amount" name="amount" class="input input-lg pe-24 text-[22px] font-bold" inputmode="decimal" dir="ltr" autocomplete="off" value="${st.amount}" placeholder="0"/><span class="input-addon text-[15px]">${st.currency === 'AFN' ? (getLang() === 'fa' ? 'افغانی' : 'AFN') : (getLang() === 'fa' ? 'دالر' : 'USD')}</span></div>
          ${chips.length ? html`<div class="mt-3 flex flex-wrap gap-2">${chips.map((c) => html`<button type="button" data-chip="${c}" class="h-11 rounded-xl border border-line-strong bg-ink-900 px-4 text-[16px] font-bold hover:border-gold-400/50">${fmtNumber(c)}</button>`)}</div>` : ''}
          <p class="hint text-[13px]">${t('amount_range', { min: fmtMoney(s.min_amount, st.currency), max: fmtMoney(s.max_amount, st.currency) })}</p>
          <p class="field-error text-[14px]" role="alert"></p>
        </div>
        ${s.currencies.length > 1 ? html`<div class="grid grid-cols-2 gap-2">${s.currencies.map((c) => html`<label class="choice min-h-12 justify-center"><input type="radio" name="currency" value="${c}" class="sr-only" ${st.currency === c ? raw('checked') : ''}/>${c === 'AFN' ? (getLang() === 'fa' ? 'افغانی' : 'Afghani') : (getLang() === 'fa' ? 'دالر' : 'Dollar')}</label>`)}</div>` : ''}` : ''}`;
    }
    if (paid && st.step === 2) {
      const sel = catalog.payment_methods.find((m) => m.id === st.method);
      return html`
        <div class="field" data-field="payment_method_id">
          <p class="label text-[16px] font-bold">${t('pay_q')}</p>
          <div class="space-y-2.5">${methods().map((m) => html`<label class="choice">
            <input type="radio" name="payment_method_id" value="${m.id}" class="sr-only" ${m.status === 'disabled' ? raw('disabled') : ''} ${st.method === m.id ? raw('checked') : ''}/>
            <span class="choice-ico">${icon(methodIcon(m), 'size-5')}</span>
            <span class="flex-1 font-bold">${L(m, 'name')}${m.status === 'disabled' ? html` <span class="ms-1 text-[12px] font-normal text-fog-500">· ${t('soon')}</span>` : ''}</span>
            <span class="tick">${icon('check', 'size-4')}</span>
          </label>`)}</div>
          <p class="field-error text-[14px]" role="alert"></p>
        </div>
        <div data-instr>${sel ? instr(sel) : ''}</div>
        <div class="field" data-field="payment_ref">
          <label for="f_ref" class="label text-[16px] font-bold">${t('ref_label')}</label>
          <input id="f_ref" name="payment_ref" class="input input-lg tracking-wide" dir="ltr" autocomplete="off" maxlength="40" value="${st.ref}"/>
          <p class="hint text-[13px]">${t('ref_hint')}</p>
          <p class="field-error text-[14px]" role="alert"></p>
        </div>
        <div class="field" data-field="receipt">
          <p class="label text-[16px] font-bold">${t('photo_label')}${s.requires_receipt ? '' : html` <span class="text-[13px] font-normal text-fog-500">· ${t('optional')}</span>`}</p>
          <div data-photo>${photoBox()}</div>
          <p class="field-error text-[14px]" role="alert"></p>
        </div>`;
    }
    // last step: review + send
    const m = catalog.payment_methods.find((x) => x.id === st.method);
    return html`
      <p class="text-[19px] font-bold">${t('review_title')}</p>
      <div class="card divide-y divide-line px-4">
        ${kv(t('req_service'), L(s, 'name'))}
        ${s.fields.map((f) => (st.details[f.key] ? kv(L(f, 'label'), optLabel(f, st.details[f.key]), !!f.pattern) : ''))}
        ${paid ? kv(t('amount'), html`<b class="text-[17px]">${fmtMoney(Math.round(Number(st.amount) * 100), st.currency)}</b>`) : ''}
        ${m ? kv(t('method'), L(m, 'name')) : ''}
        ${st.ref ? kv(t('receipt_no'), st.ref, true) : ''}
        ${st.receipt ? kv(t('photo'), html`<span class="text-ok">${icon('check', 'size-4 inline')} ${t('photo_done')}</span>`) : ''}
      </div>
      ${paid ? html`<p class="flex items-start gap-2.5 text-[15px] text-fog-200">${icon('shieldCheck', 'size-5 shrink-0 text-gold-400')}${t('declare_line')}</p>
        <p class="rounded-2xl bg-ink-850 p-4 text-[13.5px] leading-relaxed text-fog-400">${t('receipt_note')}</p>` : ''}`;
  };

  const fieldUi = (f) => {
    if (f.type === 'select') {
      return html`<div class="field" data-field="d_${f.key}">
        <p class="label text-[16px] font-bold">${L(f, 'label')}</p>
        <div class="grid ${f.options.length > 3 ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5">${f.options.map((o) => {
          const v = o.value ?? o;
          return html`<label class="choice"><input type="radio" name="d_${f.key}" value="${v}" class="sr-only" ${st.details[f.key] === v ? raw('checked') : ''}/>
            ${o.icon ? html`<span class="choice-ico">${icon(o.icon, 'size-5')}</span>` : ''}<span class="flex-1 font-bold">${typeof o === 'string' ? o : L(o, 'label')}</span><span class="tick">${icon('check', 'size-4')}</span></label>`;
        })}</div>
        <p class="field-error text-[14px]" role="alert"></p></div>`;
    }
    const tag = f.type === 'textarea'
      ? html`<textarea id="f_d_${f.key}" name="d_${f.key}" class="input text-[17px]" rows="3" maxlength="1000">${st.details[f.key] || ''}</textarea>`
      : html`<input id="f_d_${f.key}" name="d_${f.key}" class="input input-lg" ${f.inputmode ? raw(`inputmode="${f.inputmode}"`) : ''} ${f.type === 'tel' || f.pattern ? raw('dir="ltr"') : ''} autocomplete="off" maxlength="40" value="${st.details[f.key] || ''}"/>`;
    return html`<div class="field" data-field="d_${f.key}">
      <label for="f_d_${f.key}" class="label text-[16px] font-bold">${L(f, 'label')}</label>${tag}
      ${L(f, 'hint') ? html`<p class="hint text-[13px]">${L(f, 'hint')}</p>` : ''}
      <p class="field-error text-[14px]" role="alert"></p></div>`;
  };

  const instr = (m) => html`<p class="flex gap-2.5 rounded-2xl border border-line bg-ink-850 p-4 text-[14.5px] leading-relaxed text-fog-300">${icon('info', 'size-5 shrink-0 text-gold-400')}<span>${L(m, 'instructions')}</span></p>`;

  const photoBox = () => (st.receipt
    ? html`<div class="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/[0.06] p-3.5">
        <span class="grid size-11 place-items-center rounded-xl bg-ok/15 text-ok">${icon('check', 'size-5')}</span>
        <span class="flex-1 font-bold">${t('photo_done')}</span>
        <button type="button" data-remove class="btn-quiet btn-sm">${t('photo_remove')}</button></div>`
    : html`<label class="flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-ink-900 px-4 text-[16px] font-bold text-fog-300 hover:border-gold-400/50">
        ${icon('camera', 'size-6 text-gold-400')}${t('photo_btn')}
        <input type="file" accept="image/*,application/pdf" class="sr-only" data-file/></label>`);

  const readStep = (form) => {
    const fd = new FormData(form);
    if (st.step === 1) {
      for (const f of s.fields) { const v = fd.get(`d_${f.key}`); if (v !== null) st.details[f.key] = latin(String(v)).trim(); }
      if (paid) { st.amount = latin(fd.get('amount') || '').replace(/[,\s٬]/g, ''); if (fd.get('currency')) st.currency = fd.get('currency'); }
    }
    if (paid && st.step === 2) {
      st.method = fd.get('payment_method_id') || st.method;
      st.ref = latin(fd.get('payment_ref') || '').trim();
    }
  };

  const validate = (form) => {
    let bad = false;
    if (st.step === 1) {
      for (const f of s.fields) {
        const v = st.details[f.key] || '';
        if (f.required && !v) bad = setFieldError(form, `d_${f.key}`, f.type === 'select' ? t('v_pick') : t('v_required')) || bad;
        else if (v && f.pattern && !new RegExp(f.pattern).test(v)) bad = setFieldError(form, `d_${f.key}`, f.key === 'msisdn' ? t('v_phone') : f.key === 'bill_no' ? t('v_bill_no') : t('err_validation')) || bad;
      }
      if (paid) {
        const minor = Math.round(Number(st.amount) * 100);
        if (!/^\d+(\.\d{1,2})?$/.test(st.amount)) bad = setFieldError(form, 'amount', t('v_amount'));
        else if (minor < s.min_amount) bad = setFieldError(form, 'amount', t('v_low', { x: fmtMoney(s.min_amount, st.currency) }));
        else if (minor > s.max_amount) bad = setFieldError(form, 'amount', t('v_high', { x: fmtMoney(s.max_amount, st.currency) }));
      }
    }
    if (paid && st.step === 2) {
      const m = catalog.payment_methods.find((x) => x.id === st.method);
      if (!m) bad = setFieldError(form, 'payment_method_id', t('v_pick'));
      if (!st.ref) bad = setFieldError(form, 'payment_ref', t('v_required'));
      else if (m && !new RegExp(m.ref_pattern).test(st.ref)) bad = setFieldError(form, 'payment_ref', t('v_ref'));
      if (s.requires_receipt && !st.receipt) bad = setFieldError(form, 'receipt', t('v_required'));
    }
    if (bad) form.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !bad;
  };

  const bind = () => {
    const form = $('#view form');
    $$('[data-chip]', form).forEach((b) => b.addEventListener('click', () => { $('#f_amount').value = b.dataset.chip; clearErrors(form); }));
    $('[data-prev]', form)?.addEventListener('click', () => { readStep(form); st.step--; render(); });
    $$('input[name=payment_method_id]', form).forEach((r) => r.addEventListener('change', () => {
      st.method = r.value;
      $('[data-instr]', form).innerHTML = instr(catalog.payment_methods.find((m) => m.id === r.value)).s;
    }));
    $$('input[type=radio]', form).forEach((r) => r.addEventListener('change', () => r.closest('.field')?.classList.remove('has-error')));
    bindPhoto(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clearErrors(form);
      readStep(form);
      if (!validate(form)) return;
      if (st.step < total) { st.step++; render(); window.scrollTo(0, 0); return; }
      const btn = form.querySelector('button[type=submit]'); busy(btn, true);
      try {
        const b = { service_id: s.id, details: st.details };
        if (paid) Object.assign(b, { amount: st.amount, currency: st.currency, payment_method_id: st.method, payment_ref: st.ref, receipt_file_id: st.receipt?.id });
        const r = await api.post('/api/requests', b);
        state.router.go(`/requests/${r.tracking_no}`, { replace: true });
      } catch (err) {
        busy(btn, false);
        const f = err.field || '';
        if (['payment_ref', 'payment_method_id', 'receipt'].includes(f)) { st.step = 2; render(); showApiError($('#view form'), err); }
        else if (f === 'amount' || f in st.details) { st.step = 1; render(); showApiError($('#view form'), f in st.details ? { ...err, field: `d_${f}` } : err); }
        else showApiError(form, err);
      }
    });
  };

  const bindPhoto = (form) => {
    const box = $('[data-photo]', form);
    if (!box) return;
    $('[data-file]', box)?.addEventListener('change', async (e) => {
      let file = e.target.files[0];
      if (!file) return;
      box.innerHTML = html`<div class="flex min-h-20 items-center justify-center gap-3 rounded-2xl border border-line bg-ink-900 text-fog-400"><span class="skeleton size-5 rounded-full"></span>${t('photo_busy')}</div>`.s;
      file = await compressImage(file);
      const fd = new FormData(); fd.append('file', file);
      try { st.receipt = (await api.upload('/api/uploads', fd)).file; }
      catch (err) { setFieldError(form, 'receipt', errorText(err)); }
      box.innerHTML = photoBox().s; bindPhoto(form);
    });
    $('[data-remove]', box)?.addEventListener('click', () => { st.receipt = null; box.innerHTML = photoBox().s; bindPhoto(form); });
  };

  render();
}

// ── My requests: a chat list ────────────────────────────────────────────
const STATUS_DOT = { pending: 'bg-fog-500', under_review: 'bg-info', payment_verified: 'bg-gold-400', processing: 'bg-warn', completed: 'bg-ok', rejected: 'bg-bad' };
export async function requests() {
  await loadingFrame();
  let d;
  try { d = await api.get('/api/requests'); } catch (err) { view().innerHTML = errorBox(err, requests).s; return; }
  view().innerHTML = html`
    <h1 class="mb-3 text-[22px] font-bold">${t('orders_title')}</h1>
    ${d.requests.length ? html`<ul class="-mx-4 divide-y divide-line border-y border-line">${d.requests.map((r) => {
      const last = r.last;
      const preview = last.type === 'message' ? `${last.staff ? '' : t('chat_you') + ': '}${last.body}` : t('cst_' + (last.status || r.status));
      return html`<li><a href="/requests/${r.tracking_no}" class="flex items-center gap-3.5 px-4 py-3.5 transition active:bg-white/[0.03]">
        <span class="relative grid size-13 shrink-0 place-items-center rounded-full bg-ink-700 text-gold-300" style="width:52px;height:52px">${icon(svcIcon(r.service_id), 'size-6')}
          <span class="absolute bottom-0 end-0 size-3.5 rounded-full border-2 border-ink-950 ${STATUS_DOT[r.status]}"></span></span>
        <span class="min-w-0 flex-1">
          <span class="flex items-baseline justify-between gap-2"><span class="truncate text-[16.5px] font-bold">${svcName(r)}${r.amount ? html` · <span class="font-normal text-fog-300">${fmtMoney(r.amount, r.currency)}</span>` : ''}</span>
            <span class="shrink-0 text-[12px] ${r.unread ? 'font-bold text-gold-300' : 'text-fog-500'}">${shortTime(last.at || r.updated_at)}</span></span>
          <span class="mt-0.5 flex items-center justify-between gap-2"><span class="truncate text-[14px] ${r.unread ? 'text-fog-100' : 'text-fog-500'}">${preview}</span>
            ${r.unread ? html`<span class="grid min-w-[22px] shrink-0 place-items-center rounded-full bg-gold-400 px-1.5 text-[12px] font-bold leading-[22px] text-ink-950">${fmtNumber(r.unread)}</span>` : ''}</span>
        </span>
      </a></li>`;
    })}</ul>` : emptyState(t('orders_empty'), '', html`<a href="/" class="btn-gold btn-xl">${t('orders_new')}</a>`, 'chats')}`.s;
  startPolling(async () => {
    try { const n = await api.get('/api/badges'); if (n.chats !== state.badges.chats) { state.badges = n; requests(); } } catch { /* */ }
  }, 20000);
}

// ── Conversation view (request tracking + support) ─────────────────────
function chatLayout({ title, sub, back, top = '', composer, right = '' }) {
  return frame(html`
    ${top}
    <div data-scroll class="chat-bg flex-1 overflow-y-auto px-3 py-3"><div data-msgs class="flex flex-col gap-1.5"></div></div>
    ${composer}`, { title, sub, back, chat: true, right }).s;
}

function composerHtml(chips) {
  return html`<div class="safe-bottom shrink-0 border-t border-line bg-ink-950 px-3 pb-3 pt-2">
    ${chips.length ? html`<div class="scroll-x mb-2 flex gap-2 pb-0.5">${chips.map((c) => html`<button type="button" data-chip class="h-9 shrink-0 rounded-full border border-line-strong bg-ink-850 px-3.5 text-[14px] text-fog-200">${c}</button>`)}</div>` : ''}
    <form data-send class="flex items-end gap-2" novalidate>
      <textarea name="message" rows="1" maxlength="1000" class="input max-h-32 min-h-12 flex-1 resize-none rounded-3xl py-3 text-[16px] leading-6" placeholder="${t('chat_type')}"></textarea>
      <button class="btn-gold size-12 shrink-0 rounded-full p-0" aria-label="${t('submit')}">${icon('send', 'size-5 rtl:-scale-x-100')}</button>
    </form></div>`;
}

function bindComposer(onSend) {
  const form = $('[data-send]');
  const ta = $('textarea', form);
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); form.requestSubmit(); } });
  $$('[data-chip]').forEach((c) => c.addEventListener('click', () => { ta.value = c.textContent.trim(); grow(); form.requestSubmit(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    const btn = form.querySelector('button'); busy(btn, true);
    try { await onSend(text); ta.value = ''; grow(); } catch (err) { toast(errorText(err), 'error'); } finally { busy(btn, false); }
  });
}

function scrollBottom() { const s = $('[data-scroll]'); if (s) s.scrollTop = s.scrollHeight; }

function bubble(side, inner, meta) {
  return html`<div class="flex ${side === 'out' ? 'justify-end' : 'justify-start'}"><div class="bubble ${side === 'out' ? 'bubble-out' : 'bubble-in'}">${inner}<div class="bubble-meta">${meta}</div></div></div>`;
}

function withDays(items) {
  const out = [];
  let day = '';
  for (const it of items) {
    const d = new Date(it.at * 1000).toDateString();
    if (d !== day) { out.push(html`<div class="day-chip">${dayLabel(it.at)}</div>`); day = d; }
    out.push(it.html);
  }
  return out;
}

const STATUS_ICON = { pending: ['clock', 'text-fog-300'], under_review: ['eye', 'text-info'], payment_verified: ['shieldCheck', 'text-gold-300'], processing: ['refresh', 'text-warn'], completed: ['check', 'text-ok'], rejected: ['x', 'text-bad'] };

export async function chat({ id }) {
  const tn = id.toUpperCase();
  await loadingFrame({ title: tn, back: '/requests', chat: true });
  let catalog;
  try { catalog = await loadCatalog(); } catch { catalog = null; }
  let d;
  try { d = await api.get(`/api/requests/${encodeURIComponent(tn)}`); }
  catch (err) { view().innerHTML = (err.status === 404 ? emptyState(t('err_not_found'), tn, html`<a href="/requests" class="btn-ghost">${t('back')}</a>`, 'search') : errorBox(err, () => chat({ id }))).s; return; }

  const r = d.request;
  const svc = catalog?.services.find((x) => x.id === r.service_id);
  const flow = r.payment_method_id ? ['pending', 'under_review', 'payment_verified', 'processing', 'completed'] : ['pending', 'under_review', 'processing', 'completed'];

  const progress = (req) => {
    const rejected = req.status === 'rejected';
    const idx = rejected ? -1 : flow.indexOf(req.status);
    return html`<div data-progress class="shrink-0 border-b border-line bg-ink-900 px-4 py-3">
      <div class="flex items-center justify-between text-[14px]">
        <span class="font-bold ${rejected ? 'text-bad' : req.status === 'completed' ? 'text-ok' : 'text-gold-300'}">${t('sst_' + req.status)}</span>
        ${rejected ? '' : html`<span class="text-fog-500">${t('progress', { n: fmtNumber(idx + 1), total: fmtNumber(flow.length) })}</span>`}
      </div>
      <div class="mt-2 grid gap-1" style="grid-template-columns:repeat(${flow.length},1fr)">${flow.map((_, i) => html`<span class="h-1.5 rounded-full ${rejected ? 'bg-bad/40' : i <= idx ? (req.status === 'completed' ? 'bg-ok' : 'bg-gold-400') : 'bg-ink-700'}"></span>`)}</div>
      ${!rejected && req.status !== 'completed' && flow[idx + 1] ? html`<p class="mt-2 text-[12.5px] text-fog-500">${t('chat_next_step', { s: t('sst_' + flow[idx + 1]) })}</p>` : ''}
    </div>`;
  };

  const summary = html`<div class="min-w-[220px]">
    <p class="mb-1 text-[12px] font-bold text-gold-300">${t('chat_your_request')}</p>
    <p class="text-[16px] font-bold">${svcName(r)}</p>
    <div class="mt-1.5 space-y-0.5 text-[14px] text-fog-200">
      ${r.amount ? html`<p>${t('amount')}: <b>${fmtMoney(r.amount, r.currency)}</b></p>` : ''}
      ${Object.entries(r.details).map(([k, v]) => { const f = svc?.fields.find((x) => x.key === k); return html`<p>${f ? L(f, 'label') : k}: ${optLabel(f, v)}</p>`; })}
      ${r.payment_method_id ? html`<p>${t('method')}: ${L({ name_en: r.method_en, name_fa: r.method_fa }, 'name')}</p>` : ''}
      ${r.payment_ref ? html`<p>${t('receipt_no')}: <span dir="ltr">${r.payment_ref}</span></p>` : ''}
    </div>
    ${r.receipt_file_id ? html`<a href="/api/files/${r.receipt_file_id}" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1.5 text-[13px] text-gold-300 underline">${icon('receipt', 'size-4')}${t('open_photo')}</a>` : ''}
    <p class="mt-2 border-t border-white/10 pt-1.5 text-[12px] text-fog-400">${t('tracking_no')}: <span dir="ltr" class="font-bold">${r.tracking_no}</span>${r.is_demo ? html` · ${demoTag()}` : ''}</p>
  </div>`;

  const renderMsgs = (data) => {
    const items = [{ at: r.created_at, ord: 0, html: bubble('out', summary, html`${timeOnly(r.created_at)}`) }];
    for (const e of data.events) {
      const [ico, color] = STATUS_ICON[e.status] || ['dot', ''];
      items.push({ at: e.created_at, ord: 1, html: bubble('in', html`
        <p class="mb-0.5 text-[12px] font-bold text-gold-300">${t('chat_rahbar')}</p>
        <p class="flex items-start gap-2"><span class="mt-0.5 ${color}">${icon(ico, 'size-[18px]')}</span><span>${t('cst_' + e.status)}</span></p>
        ${e.note ? html`<p class="mt-1.5 rounded-lg bg-black/25 px-2.5 py-1.5 text-[14px] text-fog-200">${e.status === 'rejected' ? t('chat_reason') + ' ' : ''}${e.note}</p>` : ''}`, timeOnly(e.created_at)) });
    }
    for (const m of data.messages) {
      const seen = data.staff_seen_at >= m.created_at;
      items.push({ at: m.created_at, ord: 2, html: m.is_staff
        ? bubble('in', html`<p class="mb-0.5 text-[12px] font-bold text-gold-300">${t('chat_staff')}</p><p class="whitespace-pre-wrap">${m.body}</p>`, timeOnly(m.created_at))
        : bubble('out', html`<p class="whitespace-pre-wrap">${m.body}</p>`, html`${timeOnly(m.created_at)}<span class="${seen ? 'text-gold-300' : ''}">${icon(seen ? 'ticks' : 'check', 'size-4')}</span>`) });
    }
    items.sort((a, b) => a.at - b.at || a.ord - b.ord);
    $('[data-msgs]').innerHTML = html`${withDays(items)}
      ${!['completed', 'rejected'].includes(data.request.status) ? html`<p class="day-chip">${t('chat_ask')}</p>` : ''}`.s;
  };

  root().innerHTML = chatLayout({
    title: svcName(r), sub: html`<span dir="ltr">${r.tracking_no}</span>`, back: '/requests', top: progress(r),
    composer: composerHtml([t('chat_q1'), t('chat_q2'), t('chat_q3')]),
  });
  renderMsgs(d);
  scrollBottom();
  refreshBadges();

  let sig = `${d.events.length}:${d.messages.length}:${d.staff_seen_at}`;
  const reload = async (force = false) => {
    try {
      const nd = await api.get(`/api/requests/${encodeURIComponent(tn)}`);
      const nsig = `${nd.events.length}:${nd.messages.length}:${nd.staff_seen_at}`;
      if (force || nsig !== sig) {
        sig = nsig;
        Object.assign(r, nd.request);
        $('[data-progress]').outerHTML = progress(nd.request).s;
        renderMsgs(nd);
        scrollBottom();
      }
    } catch { /* keep current view on bad connection */ }
  };
  bindComposer(async (text) => { await api.post(`/api/requests/${r.tracking_no}/messages`, { message: text }); await reload(true); });
  startPolling(reload, 15000);
}

export async function support() {
  await loadingFrame({ title: t('sup_title'), back: '/', chat: true });
  let d;
  try { d = await api.get('/api/support/thread'); } catch (err) { view().innerHTML = errorBox(err, support).s; return; }
  const hours = L(state.config, 'support_hours');
  const render = (data) => {
    const items = data.messages.map((m) => ({ at: m.created_at, html: m.is_staff
      ? bubble('in', html`<p class="mb-0.5 text-[12px] font-bold text-gold-300">${t('chat_staff')}</p><p class="whitespace-pre-wrap">${m.body}</p>`, timeOnly(m.created_at))
      : bubble('out', html`<p class="whitespace-pre-wrap">${m.body}</p>`, timeOnly(m.created_at)) }));
    $('[data-msgs]').innerHTML = html`
      ${bubble('in', html`<p class="mb-0.5 text-[12px] font-bold text-gold-300">${t('chat_rahbar')}</p><p>${t('sup_hello')}</p>${hours ? html`<p class="mt-1.5 text-[13px] text-fog-400">${t('sup_hours_label')}: ${hours}</p>` : ''}`, '')}
      ${withDays(items)}`.s;
  };
  root().innerHTML = chatLayout({ title: t('sup_title'), sub: hours, back: '/', composer: composerHtml([t('sup_q1'), t('sup_q2')]) });
  render(d);
  scrollBottom();
  let sig = d.messages.length;
  const reload = async () => {
    try { const nd = await api.get('/api/support/thread'); if (nd.messages.length !== sig) { sig = nd.messages.length; render(nd); scrollBottom(); } } catch { /* */ }
  };
  bindComposer(async (text) => { await api.post('/api/support/thread', { message: text }); await reload(); });
  startPolling(reload, 15000);
}

// ── My account ─────────────────────────────────────────────────────────
export async function me() {
  const u = state.user;
  const row = (href, ico, label, extra = '') => html`<a href="${href}" class="flex min-h-16 items-center gap-4 px-4 py-3 active:bg-white/[0.03]"><span class="choice-ico">${icon(ico, 'size-5')}</span><span class="flex-1 text-[16px] font-bold">${label}</span>${extra}<span class="text-fog-500">${icon('chevL', 'size-5 ltr:rotate-180')}</span></a>`;
  root().innerHTML = frame(html`
    <div class="card flex items-center gap-4 p-5">
      <span class="grid size-14 place-items-center rounded-full bg-ink-700 text-xl font-bold text-gold-300">${u.full_name.trim()[0] || '؟'}</span>
      <div class="min-w-0"><p class="truncate text-[19px] font-bold">${u.full_name}</p><p class="text-[14px] text-fog-400" dir="ltr">${u.phone}</p>
        <p class="mt-0.5 text-[12.5px] text-fog-500">${t('customer_no')}: <span dir="ltr" class="font-bold text-fog-300">${u.id}</span></p></div>
    </div>
    <div class="card mt-4 p-4">
      <p class="mb-3 text-[15px] font-bold">${t('lang_label')}</p>
      <div class="grid grid-cols-2 gap-2">${[['fa', 'دری'], ['en', 'English']].map(([v, l]) => html`<button data-setlang="${v}" class="choice min-h-12 justify-center font-bold ${getLang() === v ? 'on' : ''}">${l}</button>`)}</div>
    </div>
    <div class="card mt-4 divide-y divide-line overflow-hidden">
      ${row('/payments', 'card', t('my_payments'))}
      ${row('/alerts', 'bell', t('alerts_title'), html`<span data-badge-unread class="${state.badges.unread ? '' : 'hidden'} grid min-w-[22px] place-items-center rounded-full bg-gold-400 px-1.5 text-[12px] font-bold leading-[22px] text-ink-950">${state.badges.unread}</span>`)}
      ${row('/support', 'headset', t('sup_title'))}
    </div>
    <div class="card mt-4 p-4">
      <div class="flex items-center gap-3"><span class="choice-ico">${icon('send', 'size-5')}</span><div class="flex-1"><p class="text-[15px] font-bold">${t('prof_tg')}</p><p class="text-[12.5px] text-fog-500">${t('prof_tg_d')}</p></div>
        ${u.telegram_linked ? html`<button data-tg-unlink class="btn-ghost btn-sm">${t('prof_tg_unlink')}</button>` : html`<button data-tg-link class="btn-ghost btn-sm">${t('prof_tg_link')}</button>`}</div>
      <div data-tg-box></div>
    </div>
    <div class="card mt-4 p-4">
      <p class="mb-2 text-[15px] font-bold">${t('devices')}</p>
      <ul data-sessions class="divide-y divide-line text-[14px]"></ul>
      <button data-revoke class="btn-quiet btn-sm mt-2">${t('signout_others')}</button>
    </div>
    <button data-logout class="btn-danger btn-xl mt-6">${icon('logout', 'size-5 rtl:-scale-x-100')}${t('logout')}</button>`).s;

  $$('[data-setlang]').forEach((b) => b.addEventListener('click', async () => {
    setLang(b.dataset.setlang);
    api.patch('/api/me', { lang: b.dataset.setlang }).then((r) => { state.user = r.user; }).catch(() => {});
    me();
  }));
  $('[data-logout]').addEventListener('click', async () => { await api.post('/api/auth/logout').catch(() => {}); state.user = null; state.router.go('/', { replace: true }); });
  $('[data-tg-link]')?.addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try {
      const r = await api.post('/api/me/telegram-link');
      $('[data-tg-box]').innerHTML = (r.bot
        ? html`<a class="btn-gold btn-xl mt-3" target="_blank" rel="noopener" href="https://t.me/${r.bot}?start=${r.code}">${icon('send', 'size-5')}@${r.bot}</a>`
        : html`<p class="mt-3 text-[13px] text-fog-500">${t('prof_tg_nobot')}</p>`).s;
    } catch (err) { toast(errorText(err), 'error'); } finally { busy(e.currentTarget, false); }
  });
  $('[data-tg-unlink]')?.addEventListener('click', async () => { await api.post('/api/me/telegram-unlink'); state.user = { ...state.user, telegram_linked: false }; me(); });
  $('[data-revoke]').addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try { await api.post('/api/me/sessions/revoke-others'); toast(t('signout_others_done')); loadSessions(); } finally { busy(e.currentTarget, false); }
  });
  const loadSessions = async () => {
    try {
      const { sessions } = await api.get('/api/me/sessions');
      $('[data-sessions]').innerHTML = html`${sessions.map((x) => html`<li class="flex items-center gap-3 py-2.5">${icon(/mobile|android|iphone/i.test(x.ua) ? 'phone' : 'grid', 'size-4 text-fog-500')}<span class="flex-1">${shortUa(x.ua)}</span>${x.current ? html`<span class="badge b-gold">${t('this_device')}</span>` : html`<span class="text-[12px] text-fog-500">${shortTime(x.created_at)}</span>`}</li>`)}`.s;
    } catch { /* */ }
  };
  loadSessions();
}

function shortUa(ua = '') {
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return `${b}${os ? ' · ' + os : ''}`;
}

// ── Payments ───────────────────────────────────────────────────────────
const PAY_BADGE = { awaiting: 'b-neutral', verified: 'b-ok', mismatch: 'b-warn', rejected: 'b-bad', refunded: 'b-info' };
export async function payments() {
  await loadingFrame({ title: t('my_payments'), back: '/me' });
  let d;
  try { d = await api.get('/api/payments'); } catch (err) { view().innerHTML = errorBox(err, payments).s; return; }
  view().innerHTML = (d.payments.length ? html`<div class="space-y-3">${d.payments.map((p) => {
    const s = p.verification?.status || (p.status === 'rejected' ? 'rejected' : 'awaiting');
    return html`<a href="/requests/${p.tracking_no}" class="card block p-4">
      <div class="flex items-center justify-between gap-3"><span class="text-[16px] font-bold">${svcName(p)}</span><span class="badge ${PAY_BADGE[s]}">${t('pay_' + s)}</span></div>
      <p class="mt-2 text-[20px] font-bold">${fmtMoney(p.amount, p.currency)}</p>
      <p class="mt-1 text-[13px] text-fog-500">${L({ name_en: p.method_en, name_fa: p.method_fa }, 'name')} · <span dir="ltr">${p.payment_ref}</span> · ${fmtDate(p.created_at, { time: false })}</p>
    </a>`;
  })}</div>` : emptyState(t('my_payments_empty'), '', '', 'card')).s;
}

// ── Alerts ─────────────────────────────────────────────────────────────
export async function alerts() {
  await loadingFrame({ title: t('alerts_title'), back: '/' });
  let d;
  try { d = await api.get('/api/notifications'); } catch (err) { view().innerHTML = errorBox(err, alerts).s; return; }
  view().innerHTML = (d.notifications.length ? html`<ul class="-mx-4 divide-y divide-line border-y border-line">${d.notifications.map((n) => html`<li>
    <a ${n.link ? raw(`href="${String(n.link).replace(/"/g, '')}"`) : ''} class="flex gap-3.5 px-4 py-4">
      <span class="choice-ico ${n.read ? 'text-fog-500' : ''}">${icon(n.kind === 'announcement' ? 'flag' : n.kind === 'welcome' ? 'user' : 'chats', 'size-5')}</span>
      <span class="min-w-0 flex-1"><span class="flex justify-between gap-2"><span class="text-[15px] ${n.read ? 'text-fog-300' : 'font-bold'}">${L(n, 'title')}</span><span class="shrink-0 text-[12px] text-fog-500">${shortTime(n.created_at)}</span></span>
        ${L(n, 'body') ? html`<span class="mt-0.5 block text-[14px] text-fog-500">${L(n, 'body')}</span>` : ''}</span>
    </a></li>`)}</ul>` : emptyState(t('alerts_empty'), '', '', 'bell')).s;
  api.post('/api/notifications/read', {}).then(refreshBadges).catch(() => {});
}
