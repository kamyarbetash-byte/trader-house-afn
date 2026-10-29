# Raahbar — USD/AFN Live

Live candlestick chart of the dollar-to-afghani open-market rate by province (Kabul Sarai Shahzada, Mazar-i-Sharif, Herat, Kandahar, plus Nangarhar and Ghazni), with a market-average series, drawing tools and indicators. By Raahbar (راهبر).

- **Data sources:** public Telegram channels listed in `CHANNELS` in `src/index.js` (currently [@kabul_dollar](https://t.me/kabul_dollar), [@Mazar_Nerkh](https://t.me/Mazar_Nerkh), [@Exchange_Rate](https://t.me/Exchange_Rate) — Sarai Shahzada plus every province and the daily closing summary of all bid markets — and [@herat_gold](https://t.me/herat_gold), whose live-edited price board is sampled every minute), read once a minute from their web previews. Adding a channel there backfills ~45 days automatically.
- **Runs on:** a Cloudflare Worker with a cron trigger (every minute) and a D1 database. Each city's history is kept in one `snap` row so a page load costs a handful of row reads.
- **News:** Bing News searches and Afghan outlet feeds (Amu TV, Ariana News, KabulNow, Hasht-e Subh), filtered for Da Afghanistan Bank / afghani topics and checked every 30 min (Google News blocks Workers; DAB and Pajhwok publish no feeds) plus Telegram posts that mention an auction (لیلام), bid (بولی) or the central bank.
- **Endpoints:** `/` chart page · `/api/history` all city series · `/api/updates?since=<unix>` recent ticks · `/api/news` latest news.
- **بازار بولی board:** closing buy/sell of every market from the latest all-markets summary post.
- **Demo trading inside the chart:** a compact SELL / amount / BUY bar on the chart (per-viewer practice account, 1,000,000 AFN); the open position is a price line whose label shows live P&L, with trade markers on the candles.
- **Saraf calculator:** USD ⇄ AFN at the live buy/mid/sell rate (or a typed rate), with the result written out in Dari words.
- **Gold:** world ounce and Herat melted 18k from the @herat_gold board (series `xau`, `g18herat`, both chartable); karat table (24/22/21/18/15/14) per gram and misqal at the Kabul dollar rate; jewelry calculator (gram/misqal/tola, karat, making charge in USD per gram) with the total in words.
- **Page tools:** timeframes 5m–1D, MA20/MA50, Bollinger, RSI, deals-only; trend line, ray, horizontal/vertical line, rectangle, Fibonacci, measure (saved per viewer in the browser).

Deploys automatically to Cloudflare on every push to `main` (Workers Builds).
