# Trader House — USD/AFN Live

Live candlestick chart of the dollar-to-afghani open-market rate (Sarai Shahzada Kabul, Mazar-i-Sharif, Kandahar, Nangarhar, Ghazni), by Trader House.

- **Data source:** public Telegram channel [@kabul_dollar](https://t.me/kabul_dollar), read once a minute from its web preview.
- **Runs on:** a Cloudflare Worker with a cron trigger (every minute) and a SQLite Durable Object for storage. History is backfilled ~45 days on first runs.
- **Pages:** `/` chart · `/api/summary` latest rate per city · `/api/ticks?city=kabul&since=<unix>` raw ticks.

Deploys automatically to Cloudflare on every push to `main` (Workers Builds).
