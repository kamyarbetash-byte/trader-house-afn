// Lightweight SVG line chart (no dependencies) + clearly-labelled demo market series.
import { html } from './html.js';
import { fmtNumber, getLang, isRtl } from './i18n.js';

// Seeded PRNG so demo series are stable between renders.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** Indicative DEMO series — never presented as live market data. */
export const DEMO_MARKETS = [
  { id: 'usd', key: 'market_usd', base: 70.85, vol: 0.0016, digits: 2 },
  { id: 'eur', key: 'market_eur', base: 76.4, vol: 0.0021, digits: 2 },
  { id: 'gold', key: 'market_gold', base: 2648, vol: 0.0032, digits: 0 },
  { id: 'btc', key: 'market_btc', base: 68250, vol: 0.006, digits: 0 },
];

export function demoSeries(market, range) {
  const cfg = { '24h': { n: 96, step: 900 }, '7d': { n: 84, step: 7200 }, '30d': { n: 90, step: 28800 } }[range];
  const r = rng(market.id.charCodeAt(0) * 977 + range.length * 131 + market.base);
  const end = Math.floor(Date.now() / 1000 / cfg.step) * cfg.step;
  const pts = [];
  let v = market.base * (1 - market.vol * 6);
  for (let i = 0; i < cfg.n; i++) {
    const drift = (market.base - v) * 0.04;
    v = v + drift + (r() - 0.48) * market.base * market.vol * (range === '24h' ? 0.6 : 1.4);
    pts.push({ t: end - (cfg.n - 1 - i) * cfg.step, v });
  }
  pts[pts.length - 1].v = market.base;
  return pts;
}

export function lineChart(el, points, { digits = 2, height = 260, range = '24h', color = '#d4ad66' } = {}) {
  const draw = () => {
    const w = Math.max(el.clientWidth, 280);
    const h = height;
    const pad = { t: 16, r: 56, b: 28, l: 12 };
    const vals = points.map((p) => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    min -= span * 0.12; max += span * 0.12;
    const x = (i) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${d}L${x(points.length - 1).toFixed(1)},${h - pad.b}L${x(0).toFixed(1)},${h - pad.b}Z`;
    const ticks = 4;
    const grid = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = min + ((max - min) * i) / ticks;
      return { y: y(v), label: fmtNumber(v, digits) };
    });
    const loc = getLang() === 'fa' ? 'fa-AF' : 'en-GB';
    const fmtT = (ts) => new Intl.DateTimeFormat(loc, range === '24h' ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(new Date(ts * 1000));
    const xl = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1)));
    const last = points[points.length - 1];
    const gid = 'g' + Math.random().toString(36).slice(2, 7);

    el.innerHTML = html`<div class="relative" style="direction:ltr">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="block select-none" role="img">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        ${grid.map((g) => html`<line x1="${pad.l}" x2="${w - pad.r}" y1="${g.y}" y2="${g.y}" stroke="rgba(255,255,255,.05)"/><text x="${w - pad.r + 10}" y="${g.y + 4}" fill="#565b63" font-size="10.5">${g.label}</text>`)}
        ${xl.map((i) => html`<text x="${x(i)}" y="${h - 8}" fill="#565b63" font-size="10.5" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${fmtT(points[i].t)}</text>`)}
        <path d="${area}" fill="url(#${gid})"/>
        <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        <line x1="${pad.l}" x2="${w - pad.r}" y1="${y(last.v)}" y2="${y(last.v)}" stroke="${color}" stroke-opacity=".35" stroke-dasharray="2 4"/>
        <rect x="${w - pad.r + 4}" y="${y(last.v) - 10}" width="${pad.r - 6}" height="20" rx="5" fill="${color}"/>
        <text x="${w - pad.r + 4 + (pad.r - 6) / 2}" y="${y(last.v) + 4}" fill="#050506" font-size="10.5" font-weight="600" text-anchor="middle">${fmtNumber(last.v, digits)}</text>
        <g data-hover style="display:none">
          <line data-hx y1="${pad.t}" y2="${h - pad.b}" stroke="rgba(255,255,255,.18)"/>
          <circle data-hc r="4" fill="#050506" stroke="${color}" stroke-width="2"/>
        </g>
        <rect data-capture x="${pad.l}" y="0" width="${w - pad.l - pad.r}" height="${h}" fill="transparent"/>
      </svg>
      <div data-tip class="pointer-events-none absolute top-2 hidden rounded-lg border border-line-strong bg-ink-800/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur"></div>
    </div>`.s;

    const svg = el.querySelector('svg');
    const hov = el.querySelector('[data-hover]');
    const tip = el.querySelector('[data-tip]');
    const move = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      const i = Math.max(0, Math.min(points.length - 1, Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (points.length - 1))));
      const p = points[i];
      hov.style.display = '';
      hov.querySelector('[data-hx]').setAttribute('x1', x(i));
      hov.querySelector('[data-hx]').setAttribute('x2', x(i));
      hov.querySelector('[data-hc]').setAttribute('cx', x(i));
      hov.querySelector('[data-hc]').setAttribute('cy', y(p.v));
      tip.classList.remove('hidden');
      tip.innerHTML = html`<div class="font-semibold text-fog-50">${fmtNumber(p.v, digits)}</div><div class="text-fog-500">${new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(p.t * 1000))}</div>`.s;
      const tx = Math.min(Math.max(x(i) - tip.offsetWidth / 2, 0), w - tip.offsetWidth);
      tip.style.left = `${tx}px`;
    };
    const cap = el.querySelector('[data-capture]');
    cap.addEventListener('pointermove', (e) => move(e.clientX));
    cap.addEventListener('pointerdown', (e) => move(e.clientX));
    cap.addEventListener('pointerleave', () => { hov.style.display = 'none'; tip.classList.add('hidden'); });
  };
  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(el);
  return () => ro.disconnect();
}

export function sparkline(points, { w = 96, h = 32, color = '#d4ad66' } = {}) {
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p.v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`).join('');
  return html`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

/** Simple bar chart for admin reports: [{label, value}] */
export function barChart(items, { h = 180, color = '#d4ad66' } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return html`<div class="flex items-end gap-1.5" style="height:${h}px">
    ${items.map((i) => html`<div class="group flex flex-1 flex-col items-center justify-end gap-2" title="${i.label}: ${i.value}">
      <span class="text-[10px] text-fog-500 opacity-0 transition group-hover:opacity-100">${fmtNumber(i.value)}</span>
      <div class="w-full rounded-t-md" style="height:${Math.max(2, (i.value / max) * (h - 40))}px;background:linear-gradient(180deg,${color},${color}55)"></div>
      <span class="text-[10px] text-fog-600">${i.label}</span>
    </div>`)}
  </div>`;
}

export const rtlAware = () => (isRtl() ? 'rtl' : 'ltr');
