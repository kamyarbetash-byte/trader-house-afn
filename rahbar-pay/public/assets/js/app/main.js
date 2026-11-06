// Customer SPA entry.
import { applyLang, setLang, t } from '../core/i18n.js';
import { createRouter } from '../core/router.js';
import { state, api, refreshUnread } from './state.js';
import { appShell, bindShell } from './shell.js';
import * as pub from './public.js';
import * as c from './customer.js';

const root = document.getElementById('app');

const routes = [
  { path: '/', view: pub.landing, public: true, title: null },
  { path: '/login', view: pub.login, public: true, guestOnly: true, title: 'auth_signin' },
  { path: '/register', view: pub.register, public: true, guestOnly: true, title: 'auth_create' },
  { path: '/forgot', view: pub.forgot, public: true, guestOnly: true, title: 'auth_reset_title' },
  { path: '/dashboard', view: c.dashboard, title: 'nav_dashboard' },
  { path: '/services', view: c.services, title: 'nav_services' },
  { path: '/requests/new', view: c.newRequest, title: 'nav_new' },
  { path: '/requests', view: c.requests, title: 'nav_requests' },
  { path: '/requests/:id', view: c.requestDetail, title: 'req_tracking' },
  { path: '/payments', view: c.payments, title: 'nav_payments' },
  { path: '/notifications', view: c.notifications, title: 'nav_notifications' },
  { path: '/profile', view: c.profile, title: 'nav_profile' },
  { path: '/support', view: c.support, title: 'nav_support' },
  { path: '/support/:id', view: c.ticket, title: 'nav_support' },
  { path: '/404', view: null, public: true, title: 'nf_title' },
];

async function onRoute(found, query) {
  const route = found?.route;
  document.title = route?.title ? `${t(route.title)} · ${t('brand')}` : `${t('brand')} — ${t('tagline')}`;
  window.scrollTo(0, 0);
  if (!route || !route.view) {
    if (state.user) { root.innerHTML = appShell(pub.notFound(null, true)).s; return; }
    return pub.notFound(root, false);
  }
  if (route.public) {
    if (route.guestOnly && state.user) return state.router.go('/dashboard', { replace: true });
    return route.view(root, query);
  }
  if (!state.user) return state.router.go(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  root.innerHTML = appShell('').s;
  await route.view(found.params, query);
}

async function boot() {
  applyLang();
  try {
    const [cfg, me] = await Promise.all([api.get('/api/config'), api.get('/api/me')]);
    state.config = cfg;
    state.user = me.user;
    if (me.user?.lang && !localStorage.getItem('rp_lang')) setLang(me.user.lang);
  } catch {
    state.config = { demo_mode: true };
  }
  state.router = createRouter(routes, { onRoute });
  bindShell(() => state.router.render());
  await state.router.render();
  if (state.user) await refreshUnread();
  setInterval(() => { if (state.user && document.visibilityState === 'visible') refreshUnread(); }, 30000);
}

boot();
