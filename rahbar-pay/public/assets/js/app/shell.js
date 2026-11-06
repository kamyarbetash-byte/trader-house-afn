// Mobile-first customer shell: slim top bar, big content, 3-item bottom bar, persistent support button.
import { html, $ } from '../core/html.js';
import { t, getLang, setLang } from '../core/i18n.js';
import { icon, logo } from '../core/ui.js';
import { state, api } from './state.js';

export function demoBanner() {
  if (!state.config?.demo_mode) return '';
  return html`<div class="bg-gold-400/[0.08] px-4 py-1.5 text-center text-[12.5px] text-gold-200">${t('demo_short')}</div>`;
}

export function langButton() {
  return html`<button data-lang class="btn-quiet btn-sm px-2.5" aria-label="Language">${icon('globe', 'size-4')}<span>${t('lang_toggle')}</span></button>`;
}

const badge = (attr, n, cls = '') => html`<span ${attr} class="${n ? '' : 'hidden'} grid min-w-[20px] place-items-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold leading-5 text-ink-950 ${cls}">${n > 9 ? '9+' : n}</span>`;

/**
 * opts.title: page title shown in the top bar with a back arrow (inner pages)
 * opts.back: where the back arrow goes
 * opts.chat: full-height conversation page (no bottom bar, no floating button)
 */
export function frame(content, opts = {}) {
  const u = state.user;
  const p = location.pathname;
  const tab = p === '/' ? 'home' : p.startsWith('/requests') ? 'orders' : p.startsWith('/me') || p.startsWith('/payments') ? 'me' : '';
  const top = opts.title
    ? html`<a href="${opts.back || '/'}" class="icon-btn size-11 border-0 bg-transparent" aria-label="${t('back')}">${icon('chevR', 'size-6 ltr:rotate-180')}</a>
        <div class="min-w-0 flex-1"><p class="truncate text-[17px] font-bold">${opts.title}</p>${opts.sub ? html`<p class="truncate text-[12px] text-fog-500">${opts.sub}</p>` : ''}</div>
        ${opts.right || ''}`
    : html`<a href="/" aria-label="${t('brand')}">${logo({ size: 'sm' })}</a>
        <div class="ms-auto flex items-center gap-1.5">
          ${langButton()}
          ${u ? html`<a href="/alerts" class="icon-btn relative size-11" aria-label="${t('nav_alerts')}">${icon('bell', 'size-5')}${badge('data-badge-unread', state.badges.unread, 'absolute -top-1 -end-1')}</a>`
            : html`<a href="/login" class="btn-gold btn-sm h-10 px-4">${t('signin')}</a>`}
        </div>`;
  return html`
  <div class="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col border-line sm:border-x ${opts.chat ? 'h-dvh' : ''}">
    ${opts.chat ? '' : demoBanner()}
    <header class="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-ink-950/90 px-3 backdrop-blur-xl">${top}</header>
    <main id="view" class="anim-in flex min-h-0 flex-1 flex-col ${opts.chat ? '' : 'px-4 pb-32 pt-5'}">${content}</main>
    ${u && !opts.chat && !opts.noNav ? html`<nav class="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink-950/95 backdrop-blur-xl">
      <div class="mx-auto grid max-w-[560px] grid-cols-3">
        ${[['/', 'home', 'home', 'nav_home'], ['/requests', 'orders', 'chats', 'nav_orders'], ['/me', 'me', 'user', 'nav_me']].map(([href, key, ico, label]) => html`
          <a href="${href}" class="relative flex flex-col items-center gap-1 py-2.5 text-[12.5px] ${tab === key ? 'text-gold-300' : 'text-fog-500'}">
            <span class="relative">${icon(ico, 'size-6')}${key === 'orders' ? badge('data-badge-chats', state.badges.chats, 'absolute -top-1.5 -end-3') : ''}</span>${t(label)}
          </a>`)}
      </div></nav>` : ''}
    ${opts.chat || opts.noFab ? '' : html`<a href="${u ? '/support' : '/login?next=/support'}" class="fab" aria-label="${t('help')}">${icon('headset', 'size-5')}<span>${t('help')}</span></a>`}
  </div>`;
}

export function bindShell(rerender) {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang]')) {
      setLang(getLang() === 'fa' ? 'en' : 'fa');
      if (state.user) api.patch('/api/me', { lang: getLang() }).catch(() => {});
      rerender();
    }
  });
}
