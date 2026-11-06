// Customer app state + API client.
import { client } from '../core/api.js';

export const state = { user: null, config: null, catalog: null, badges: { unread: 0, chats: 0, active: 0 }, router: null };

export const api = client(() => {
  state.user = null;
  if (!['/login', '/'].includes(location.pathname)) {
    state.router?.go(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  }
});

export async function loadCatalog(force = false) {
  if (!state.catalog || force) state.catalog = await api.get('/api/catalog');
  return state.catalog;
}

/** Small JSON poll for the badge counters (works on slow connections). */
export async function refreshBadges() {
  if (!state.user) return;
  try {
    state.badges = await api.get('/api/badges');
    const set = (sel, n) => document.querySelectorAll(sel).forEach((el) => {
      el.textContent = n > 9 ? '9+' : String(n);
      el.classList.toggle('hidden', !n);
    });
    set('[data-badge-chats]', state.badges.chats);
    set('[data-badge-unread]', state.badges.unread);
  } catch { /* ignore on bad connections */ }
}
