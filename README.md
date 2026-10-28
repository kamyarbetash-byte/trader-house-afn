# Raahbar — USD/AFN Live

Live candlestick chart of the dollar-to-afghani open-market rate by province (Kabul Sarai Shahzada, Mazar-i-Sharif, Herat, Kandahar, plus Nangarhar and Ghazni), with a market-average series, drawing tools and indicators. By Raahbar (راهبر).

- **Data sources:** public Telegram channels listed in `CHANNELS` in `src/index.js` (currently [@kabul_dollar](https://t.me/kabul_dollar) and [@Mazar_Nerkh](https://t.me/Mazar_Nerkh)), read once a minute from their web previews. Adding a channel there backfills ~45 days automatically.
- **Runs on:** a Cloudflare Worker with a cron trigger (every minute) and a D1 database. Each city's history is kept in one `snap` row so a page load costs a handful of row reads.
- **Endpoints:** `/` chart page · `/api/history` all city series · `/api/updates?since=<unix>` recent ticks.
- **Page tools:** timeframes 5m–1D, MA20/MA50, Bollinger, RSI, deals-only; trend line, ray, horizontal/vertical line, rectangle, Fibonacci, measure (saved per viewer in the browser).

Deploys automatically to Cloudflare on every push to `main` (Workers Builds).
