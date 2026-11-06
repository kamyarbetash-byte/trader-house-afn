// Minimal history-API router. Routes: [{ path: '/requests/:id', view, auth }]
export function createRouter(routes, { base = '', onRoute }) {
  const compiled = routes.map((r) => {
    const keys = [];
    const re = new RegExp('^' + (base + r.path).replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }).replace(/\/$/, '') + '/?$');
    return { ...r, re, keys };
  });

  function match(pathname) {
    for (const r of compiled) {
      const m = pathname.match(r.re);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }

  async function go(to, { replace = false } = {}) {
    const url = new URL(to, location.origin);
    if (url.pathname + url.search !== location.pathname + location.search) {
      history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
    }
    await render();
  }

  async function render() {
    const found = match(location.pathname) || match(base + '/404');
    await onRoute(found, new URLSearchParams(location.search));
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return;
    if (base && !href.startsWith(base)) return;
    if (!base && href.startsWith('/admin')) return;
    e.preventDefault();
    go(href);
  });
  window.addEventListener('popstate', render);

  return { go, render, match };
}
