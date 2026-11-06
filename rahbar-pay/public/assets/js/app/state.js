// Customer app state + API client.
import { client } from '../core/api.js';

export const state = { user: null, config: null, catalog: null, unread: 0, router: null };

export const api = client(() => {
  state.user = null;
  const here = location.pathname + location.search;
  if (!['/login', '/register', '/forgot', '/'].includes(location.pathname)) state.router?.go(`/login?next=${encodeURIComponent(here)}`, { replace: true });
});

export async function loadCatalog(force = false) {
  if (!state.catalog || force) state.catalog = await api.get('/api/catalog');
  return state.catalog;
}

export async function refreshUnread() {
  if (!state.user) return;
  try {
    const d = await api.get('/api/dashboard');
    state.unread = d.unread;
    document.querySelectorAll('[data-unread]').forEach((el) => {
      el.textContent = d.unread > 9 ? '9+' : String(d.unread);
      el.classList.toggle('hidden', !d.unread);
    });
  } catch { /* ignore */ }
}
