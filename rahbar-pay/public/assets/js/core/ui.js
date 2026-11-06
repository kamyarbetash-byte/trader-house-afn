// Design-system components shared by the customer app and the admin console.
import { html, raw, $, $$ } from './html.js';
import { t, getLang, errorText } from './i18n.js';

// ── icons (24×24, 1.6 stroke, outline) ──────────────────────────────────
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  card: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3 10h18M7 15h3',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4.5-6.5',
  life: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  arrowUR: 'M7 17 17 7M8 7h9v9',
  arrowDL: 'M17 7 7 17M16 17H7V8',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 1 1 7 0v3',
  shield: 'M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z',
  shieldCheck: 'M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6zM9 12l2 2 4-4',
  doc: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h6',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  chevR: 'm9 6 6 6-6 6',
  chevL: 'm15 6-6 6 6 6',
  chevD: 'm6 9 6 6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v11H9zM5 15V5a1 1 0 0 1 1-1h9',
  menu: 'M4 7h16M4 12h16M4 17h16',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  chart: 'M4 4v16h16M8 15l3-4 3 2 5-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  key: 'M14.5 13.5a5 5 0 1 0-4.6-3L3 17.5V21h3.5v-2h2v-2h2l1.4-1.4a5 5 0 0 0 2.6-.1zM16.5 7.5h.01',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h4',
  buy: 'M12 4v16M5 13l7 7 7-7',
  sell: 'M12 20V4M5 11l7-7 7 7',
  service: 'M12 3 3 7.5 12 12l9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  scroll: 'M8 3h10a2 2 0 0 1 2 2v12M8 3a2 2 0 0 0-2 2v14a2 2 0 0 1-2-2v-2h12v2a2 2 0 0 1-2 2H6M10 8h6M10 12h6',
  bank: 'M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v4M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14.5h.01',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01',
  message: 'M4 5h16v11H8l-4 4z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  layers: 'M12 3 3 7.5 12 12l9-4.5zM3 12l9 4.5 9-4.5',
  dot: 'M12 12h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  drop: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z',
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1zM17 20a4 4 0 0 1-4 2h-1',
  chats: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ticks: 'M2 12.5 6 16.5 14 8.5M10 15.5l1 1 8-8',
};

export function icon(name, cls = 'size-[18px]') {
  return html`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || P.dot}"/></svg>`;
}

// ── brand ───────────────────────────────────────────────────────────────
/** Rahbar Pay symbol: an "R" whose leg becomes a guiding arrow, on a metallic gold tile. */
let logoSeq = 0;
export function logoMark(cls = 'size-9') {
  const id = `rpg${++logoSeq}`;
  return html`<svg class="${cls} shrink-0" viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1dfb4"/><stop offset=".5" stop-color="#d4ad66"/><stop offset="1" stop-color="#8f6c34"/></linearGradient>
    </defs>
    <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#${id})"/>
    <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" fill="none" stroke="#fff" stroke-opacity=".35"/>
    <path d="M13 29V11h8.2a5.6 5.6 0 0 1 0 11.2H13" fill="none" stroke="#0a0b0d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19.5 22.2 27.5 30M27.5 23.6V30h-6.4" fill="none" stroke="#0a0b0d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function logo({ size = 'md', sub = false } = {}) {
  const mark = size === 'lg' ? 'size-11' : size === 'sm' ? 'size-8' : 'size-9';
  const fa = getLang() === 'fa';
  return html`<span class="inline-flex items-center gap-3">
    ${logoMark(mark)}
    <span class="leading-none">
      ${fa
        ? html`<span class="block text-[17px] font-bold tracking-tight">رهبر <span class="gold-text">پی</span></span>`
        : html`<span class="block text-[15px] font-semibold tracking-[0.2em]">RAHBAR<span class="gold-text ms-1.5">PAY</span></span>`}
      ${sub ? html`<span class="mt-1 block text-[10.5px] tracking-wide text-fog-500">${sub}</span>` : ''}
    </span>
  </span>`;
}

// ── status badges ───────────────────────────────────────────────────────
export const STATUS_STYLE = {
  pending: 'b-neutral',
  under_review: 'b-info',
  payment_verified: 'b-gold',
  processing: 'b-warn',
  completed: 'b-ok',
  rejected: 'b-bad',
};
export const STATUSES = ['pending', 'under_review', 'payment_verified', 'processing', 'completed', 'rejected'];

export function statusBadge(status) {
  return html`<span class="badge ${STATUS_STYLE[status] || 'b-neutral'}"><span class="badge-dot"></span>${t('st_' + status)}</span>`;
}

export function demoTag(label) {
  return html`<span class="demo-tag">${label || t('demo')}</span>`;
}

// ── layout helpers ──────────────────────────────────────────────────────
export function pageHeader(title, sub, actions = '') {
  return html`<div class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 class="h-page">${title}</h1>${sub ? html`<p class="mt-1.5 max-w-2xl text-sm text-fog-400">${sub}</p>` : ''}</div>
    ${actions ? html`<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ''}
  </div>`;
}

export function emptyState(title, sub = '', action = '', ico = 'layers') {
  return html`<div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-ink-800 text-fog-500">${icon(ico, 'size-5')}</div>
    <p class="font-medium">${title}</p>
    ${sub ? html`<p class="mt-1 max-w-sm text-sm text-fog-500">${sub}</p>` : ''}
    ${action ? html`<div class="mt-5">${action}</div>` : ''}
  </div>`;
}

export function skeletonRows(n = 4) {
  return html`<div class="space-y-3 p-5">${Array.from({ length: n }, () => html`<div class="skeleton h-12"></div>`)}</div>`;
}

export function errorBox(err, onRetry) {
  const id = 'r' + Math.random().toString(36).slice(2, 8);
  setTimeout(() => document.getElementById(id)?.addEventListener('click', onRetry));
  return html`<div class="card card-pad flex items-center justify-between gap-4">
    <div class="flex items-center gap-3 text-sm"><span class="text-bad">${icon('alert')}</span>${errorText(err)}</div>
    ${onRetry ? html`<button id="${id}" class="btn-ghost btn-sm">${t('retry')}</button>` : ''}
  </div>`;
}

export function kv(label, value, mono = false) {
  return html`<div class="flex items-start justify-between gap-6 py-3 text-sm">
    <dt class="text-fog-500">${label}</dt><dd class="text-end ${mono ? 'mono' : ''} text-fog-50 break-all">${value}</dd>
  </div>`;
}

// ── toast ───────────────────────────────────────────────────────────────
export function toast(message, kind = 'ok') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6';
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  const el = document.createElement('div');
  const color = kind === 'error' ? 'text-bad' : kind === 'info' ? 'text-info' : 'text-ok';
  el.className = 'anim-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-line-strong bg-ink-800/95 px-4 py-3 text-sm shadow-2xl backdrop-blur';
  el.innerHTML = html`<span class="${color}">${icon(kind === 'error' ? 'alert' : kind === 'info' ? 'info' : 'check')}</span><span></span>`.s;
  el.lastElementChild.textContent = message;
  host.append(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3800);
}

// ── modal ───────────────────────────────────────────────────────────────
export function modal({ title, body, actions = '', size = 'max-w-lg', onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6';
  wrap.innerHTML = html`<div role="dialog" aria-modal="true" class="anim-in card max-h-[92dvh] w-full ${size} overflow-auto rounded-b-none sm:rounded-2xl">
    <div class="flex items-center justify-between border-b border-line px-6 py-4">
      <h2 class="text-base font-semibold">${title}</h2>
      <button data-close class="icon-btn size-8 border-0 bg-transparent" aria-label="${t('close')}">${icon('x', 'size-4')}</button>
    </div>
    <div class="px-6 py-5">${body}</div>
    ${actions ? html`<div class="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">${actions}</div>` : ''}
  </div>`.s;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  onMount?.(wrap, close);
  $('input, select, textarea, button:not([data-close])', wrap)?.focus();
  return close;
}

export function confirmDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const close = modal({
      title,
      body: html`<p class="text-sm leading-relaxed text-fog-400">${message}</p>`,
      actions: html`<button class="btn-ghost btn-sm" data-close>${t('cancel')}</button><button class="${danger ? 'btn-danger' : 'btn-gold'} btn-sm" data-ok>${confirmLabel || t('confirm')}</button>`,
      onMount: (el, c) => {
        el.querySelector('[data-ok]').addEventListener('click', () => { done = true; c(); resolve(true); });
        new MutationObserver((_, obs) => { if (!el.isConnected) { obs.disconnect(); if (!done) resolve(false); } }).observe(document.body, { childList: true });
      },
    });
    return close;
  });
}

// ── forms ───────────────────────────────────────────────────────────────
/** field({ name, label, type, ... }) renders label + control + hint + error slot */
export function field({ name, label, type = 'text', value = '', placeholder = '', hint = '', required = false, options = null, attrs = '', addon = '', optional = false, cls = '' }) {
  const id = `f_${name}`;
  let control;
  if (type === 'select') {
    control = html`<select id="${id}" name="${name}" class="input" ${required ? raw('required') : ''} ${raw(attrs)}>
      ${options.map((o) => html`<option value="${o.value}" ${o.value === value ? raw('selected') : ''} ${o.disabled ? raw('disabled') : ''}>${o.label}</option>`)}
    </select>`;
  } else if (type === 'textarea') {
    control = html`<textarea id="${id}" name="${name}" class="input" placeholder="${placeholder}" ${required ? raw('required') : ''} ${raw(attrs)}>${value}</textarea>`;
  } else {
    control = html`<div class="input-group"><input id="${id}" name="${name}" type="${type}" class="input ${addon ? 'pe-14' : ''}" value="${value}" placeholder="${placeholder}" ${required ? raw('required') : ''} ${raw(attrs)}/>${addon ? html`<span class="input-addon">${addon}</span>` : ''}</div>`;
  }
  return html`<div class="field ${cls}" data-field="${name}">
    <label for="${id}" class="label">${label}${optional ? html` <span class="font-normal text-fog-500">· ${t('optional')}</span>` : ''}</label>
    ${control}
    ${hint ? html`<p class="hint">${hint}</p>` : ''}
    <p class="field-error" role="alert"></p>
  </div>`;
}

export function setFieldError(form, name, message) {
  const f = form.querySelector(`[data-field="${name}"]`);
  if (!f) return false;
  f.classList.add('has-error');
  f.querySelector('.field-error').textContent = message;
  return true;
}
export function clearErrors(form) {
  $$('.has-error', form).forEach((f) => f.classList.remove('has-error'));
  const g = form.querySelector('[data-form-error]');
  if (g) { g.textContent = ''; g.classList.add('hidden'); }
}
export function formError(form, message) {
  const g = form.querySelector('[data-form-error]');
  if (g) { g.textContent = message; g.classList.remove('hidden'); } else toast(message, 'error');
}
/** Show an ApiError on a form: field-level when the server names one, otherwise a form banner. */
export function showApiError(form, err) {
  if (!(err.field && setFieldError(form, err.field, errorText(err)))) formError(form, errorText(err));
}
export const formErrorSlot = () => html`<div data-form-error class="hidden rounded-xl border border-bad/25 bg-bad/10 px-4 py-3 text-sm text-bad" role="alert"></div>`;

export function busy(btn, on) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = html`<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".25" stroke-width="2.5"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`.s;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => toast(t('copied'), 'ok'), () => {});
}

/** Latin digits for parsing user input typed with Dari/Arabic digits. */
export const latin = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

export function validPhone(v) {
  const s = latin(v).replace(/[\s()-]/g, '');
  return /^(07\d{8}|\+?937\d{8}|\+\d{9,15}|00\d{8,15})$/.test(s);
}
