// Customer application shell: sidebar (desktop), top bar, bottom tab bar (mobile), drawer.
import { html, $ } from '../core/html.js';
import { t, getLang, setLang } from '../core/i18n.js';
import { icon, logo, toast } from '../core/ui.js';
import { state, api } from './state.js';

const NAV = [
  { href: '/dashboard', key: 'nav_dashboard', ico: 'home' },
  { href: '/services', key: 'nav_services', ico: 'grid' },
  { href: '/requests/new', key: 'nav_new', ico: 'plus' },
  { href: '/requests', key: 'nav_requests', ico: 'list' },
  { href: '/payments', key: 'nav_payments', ico: 'card' },
  { href: '/notifications', key: 'nav_notifications', ico: 'bell', badge: true },
  { href: '/profile', key: 'nav_profile', ico: 'shield' },
  { href: '/support', key: 'nav_support', ico: 'life' },
];

function isActive(href) {
  const p = location.pathname;
  if (href === '/requests') return p === '/requests' || (p.startsWith('/requests/') && p !== '/requests/new');
  return p === href || (href !== '/dashboard' && p.startsWith(href + '/'));
}

export function demoBanner() {
  if (!state.config?.demo_mode) return '';
  return html`<div class="border-b border-gold-400/15 bg-gold-400/[0.06] px-4 py-2 text-center text-[12px] text-gold-200">
    <span class="demo-tag me-2">${t('demo')}</span>${t('demo_banner')}
  </div>`;
}

export function langButton(cls = 'btn-quiet btn-sm') {
  return html`<button data-lang class="${cls}" aria-label="Language">${icon('globe', 'size-4')}<span class="max-[420px]:hidden">${t('lang_toggle')}</span></button>`;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'RP';
}

export function appShell(content) {
  const u = state.user;
  const unread = state.unread;
  const badge = html`<span data-unread class="${unread ? '' : 'hidden'} ms-auto rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ink-950">${unread > 9 ? '9+' : unread}</span>`;
  return html`
  ${demoBanner()}
  <div class="flex min-h-[calc(100dvh-36px)]">
    <aside class="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-e border-line bg-ink-900/60 px-4 py-6 lg:flex">
      <a href="/dashboard" class="mb-8 px-2">${logo()}</a>
      <nav class="flex flex-1 flex-col gap-1">
        ${NAV.map((n) => html`<a href="${n.href}" class="nav-link ${isActive(n.href) ? 'active' : ''}">${icon(n.ico, 'nav-ico')}<span>${t(n.key)}</span>${n.badge ? badge : ''}</a>`)}
      </nav>
      <div class="card mt-6 p-4">
        <div class="flex items-center gap-3">
          <div class="grid size-9 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-gold-300">${initials(u.full_name)}</div>
          <div class="min-w-0"><p class="truncate text-sm font-medium">${u.full_name}</p><p class="mono text-[11.5px] text-fog-500">${u.id}</p></div>
        </div>
        <button data-logout class="btn-quiet btn-sm mt-3 w-full justify-start px-2">${icon('logout', 'size-4 flip-rtl')}${t('nav_logout')}</button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 border-b border-line bg-ink-950/80 backdrop-blur-xl">
        <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
          <a href="/dashboard" class="lg:hidden">${logo({ size: 'sm' })}</a>
          <form data-track class="relative ms-auto hidden max-w-md flex-1 md:block lg:ms-0">
            <span class="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-fog-500">${icon('search', 'size-4')}</span>
            <input name="q" class="input h-10 ps-10 text-sm" placeholder="${t('dash_track_ph')}" autocomplete="off" />
          </form>
          <div class="ms-auto flex items-center gap-2">
            ${langButton('btn-quiet btn-sm hidden sm:inline-flex')}
            <a href="/notifications" class="icon-btn relative" aria-label="${t('nav_notifications')}">${icon('bell')}
              <span data-unread class="${unread ? '' : 'hidden'} absolute -end-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-gold-400 px-1 text-[10px] font-bold leading-[18px] text-ink-950">${unread > 9 ? '9+' : unread}</span>
            </a>
            <a href="/profile" class="hidden size-10 place-items-center rounded-xl border border-line bg-ink-850 text-xs font-semibold text-gold-300 sm:grid lg:hidden">${initials(u.full_name)}</a>
            <button data-drawer class="icon-btn lg:hidden" aria-label="${t('nav_more')}">${icon('menu')}</button>
          </div>
        </div>
      </header>
      <main id="view" class="anim-in mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">${content}</main>
    </div>
  </div>

  <nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-950/90 backdrop-blur-xl lg:hidden">
    <div class="mx-auto grid max-w-md grid-cols-5 px-2">
      ${[
        { href: '/dashboard', key: 'nav_home', ico: 'home' },
        { href: '/services', key: 'nav_services', ico: 'grid' },
        { href: '/requests/new', key: 'nav_new', ico: 'plus', primary: true },
        { href: '/requests', key: 'nav_requests', ico: 'list' },
        { href: '/payments', key: 'nav_payments', ico: 'card' },
      ].map((n) => n.primary
        ? html`<a href="${n.href}" class="flex flex-col items-center justify-center py-2"><span class="btn-gold size-11 rounded-2xl p-0">${icon('plus', 'size-5')}</span></a>`
        : html`<a href="${n.href}" class="flex flex-col items-center gap-1 py-2.5 text-[10.5px] ${isActive(n.href) ? 'text-gold-300' : 'text-fog-500'}">${icon(n.ico, 'size-5')}<span>${t(n.key)}</span></a>`)}
    </div>
  </nav>

  <div data-drawer-panel class="fixed inset-0 z-50 hidden lg:hidden">
    <div data-drawer-close class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
    <div class="absolute inset-y-0 end-0 flex w-[300px] max-w-[85vw] flex-col border-s border-line bg-ink-900 p-5">
      <div class="mb-6 flex items-center justify-between">${logo({ size: 'sm' })}<button data-drawer-close class="icon-btn size-9">${icon('x', 'size-4')}</button></div>
      <div class="card mb-5 flex items-center gap-3 p-3.5">
        <div class="grid size-9 place-items-center rounded-full bg-ink-700 text-xs font-semibold text-gold-300">${initials(u.full_name)}</div>
        <div class="min-w-0"><p class="truncate text-sm font-medium">${u.full_name}</p><p class="mono text-[11.5px] text-fog-500">${u.id}</p></div>
      </div>
      <nav class="flex flex-col gap-1">${NAV.map((n) => html`<a href="${n.href}" class="nav-link ${isActive(n.href) ? 'active' : ''}">${icon(n.ico, 'nav-ico')}<span>${t(n.key)}</span>${n.badge ? badge : ''}</a>`)}</nav>
      <div class="mt-auto flex flex-col gap-2 pt-6">
        ${langButton('btn-ghost w-full')}
        <button data-logout class="btn-quiet w-full">${icon('logout', 'size-4 flip-rtl')}${t('nav_logout')}</button>
      </div>
    </div>
  </div>`;
}

/** Global handlers bound once on document. */
export function bindShell(rerender) {
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-lang]')) {
      setLang(getLang() === 'fa' ? 'en' : 'fa');
      if (state.user) api.patch('/api/me', { lang: getLang() }).catch(() => {});
      rerender();
    }
    if (e.target.closest('[data-logout]')) {
      await api.post('/api/auth/logout').catch(() => {});
      state.user = null;
      state.router.go('/login', { replace: true });
    }
    if (e.target.closest('[data-drawer]')) $('[data-drawer-panel]')?.classList.remove('hidden');
    if (e.target.closest('[data-drawer-close]') || (e.target.closest('[data-drawer-panel] a'))) $('[data-drawer-panel]')?.classList.add('hidden');
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-track]');
    if (!f) return;
    e.preventDefault();
    const q = String(new FormData(f).get('q') || '').trim().toUpperCase();
    if (/^RP-\d{4}-[A-Z0-9]{6}$/.test(q)) state.router.go(`/requests/${q}`);
    else if (q) state.router.go(`/requests?q=${encodeURIComponent(q)}`);
    else toast(t('dash_track_ph'), 'info');
  });
}
