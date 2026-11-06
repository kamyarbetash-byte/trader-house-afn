// Customer app entry (mobile-first, Dari by default).
import { applyLang, setLang, extend, t } from '../core/i18n.js';
import { createRouter } from '../core/router.js';
import { state, api, refreshBadges } from './state.js';
import { bindShell } from './shell.js';
import strings from './strings.js';
import * as pub from './public.js';
import * as c from './customer.js';

extend(strings);

const routes = [
  // old addresses from the first version
  { path: '/dashboard', redirect: '/' },
  { path: '/services', redirect: '/' },
  { path: '/register', redirect: '/login' },
  { path: '/forgot', redirect: '/login' },
  { path: '/profile', redirect: '/me' },
  { path: '/notifications', redirect: '/alerts' },
  { path: '/requests/new', redirect: '/' },
  { path: '/', view: pub.home, public: true },
  { path: '/login', view: pub.login, public: true, guestOnly: true, title: 'signin' },
  { path: '/new/:service', view: c.newRequest, title: 'orders_new' },
  { path: '/account', view: c.account, title: 'btn_account' },
  { path: '/requests', view: c.requests, title: 'orders_title' },
  { path: '/requests/:id', view: c.chat, title: 'orders_title' },
  { path: '/support', view: c.support, title: 'sup_title' },
  { path: '/me', view: c.me, title: 'me_title' },
  { path: '/payments', view: c.payments, title: 'my_payments' },
  { path: '/alerts', view: c.alerts, title: 'alerts_title' },
  { path: '/404', view: pub.notFound, public: true },
];

async function onRoute(found, query) {
  c.stopPolling();
  const route = found?.route;
  if (route?.redirect) return state.router.go(route.redirect, { replace: true });
  document.title = route?.title ? `${t(route.title)} · ${t('brand')}` : t('brand');
  window.scrollTo(0, 0);
  if (!route) return pub.notFound();
  if (route.public) {
    if (route.guestOnly && state.user) return state.router.go('/', { replace: true });
    return route.view(found.params, query);
  }
  if (!state.user) return state.router.go(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  await route.view(found.params, query);
}

async function boot() {
  applyLang();
  try {
    const [cfg, meRes] = await Promise.all([api.get('/api/config'), api.get('/api/me')]);
    state.config = cfg;
    state.user = meRes.user;
    if (meRes.user?.lang && !localStorage.getItem('rp_lang')) setLang(meRes.user.lang);
  } catch {
    state.config = { demo_mode: true };
  }
  if (state.user) await refreshBadges();
  state.router = createRouter(routes, { onRoute });
  bindShell(() => state.router.render());
  await state.router.render();
  // Small badge poll; paused when the tab is hidden to save data.
  setInterval(() => { if (state.user && document.visibilityState === 'visible') refreshBadges(); }, 45000);
}

boot();
