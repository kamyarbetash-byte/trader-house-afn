import { parsePage, parsePost, parseAll, parseGold, PARSER_VERSION, CITIES } from "./parse.js";
import PAGE from "./page.html";
import { handleAuth, listUsers, cleanupAuth } from "./auth.js";
import { seoPage, sitemap } from "./seo.js";
const LOGO = (() => { const m = PAGE.match(/data:image\/jpeg;base64,([^"]+)/); return m ? Uint8Array.from(atob(m[1]), c => c.charCodeAt(0)) : null; })();

// Public Telegram channels read every minute. `city` is used when a post names no city.
// Message ids are stored as idx * 1e9 + id so channels never collide (kabul_dollar keeps its raw ids).
// To add a source, append it here and push; its history is backfilled automatically.
const CHANNELS = [
  { name: "kabul_dollar", city: null },            // Kabul plus Mazar, Kandahar, Nangarhar, Ghazni deals (~312k members)
  { name: "Mazar_Nerkh", city: "mazar" },          // Mazar-i-Sharif
  { name: "Exchange_Rate", city: null },           // Sarai Shahzada + every province, closing summary of all bid markets (~70k)
  { name: "herat_gold", city: "herat", live: true, gold: true }, // Herat dollar + world ounce + Herat melted 18k; newest post edited every few seconds
];
const SPAN = 1e9;
const BACKFILL_DAYS = 45;
const KEEP_DAYS = 120;
const UA = "Mozilla/5.0 (compatible; TraderHouseRates/1.0)";

// News about the afghani, the dollar and Da Afghanistan Bank (auctions, rates, decisions).
// Feeds are checked every 30 minutes; Telegram posts that mention an auction or the central bank are added as they arrive.
const BING = q => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
const FEEDS = [
  { src: "Bing News", search: true, url: BING('"Da Afghanistan Bank" OR "Afghan central bank" OR afghani') },
  { src: "Bing News", search: true, url: BING('"د افغانستان بانک"') },
  { src: "Bing News", search: true, url: BING('نرخ دالر افغانی') },
  { src: "Bing News", search: true, url: BING('Afghanistan central bank auction dollars') },
  { src: "Bing News", search: true, url: BING('لیلام دالر د افغانستان بانک') },
  { src: "Bing News", search: true, url: BING('ارزش افغانی در برابر دالر') },
  { src: "Amu TV", url: "https://amu.tv/feed/" },
  { src: "Ariana News", url: "https://www.ariananews.af/feed/" },
  { src: "KabulNow", url: "https://kabulnow.com/feed/" },
  { src: "Hasht-e Subh", url: "https://8am.media/eng/feed/" },
  { src: "Hasht-e Subh", url: "https://8am.media/fa/feed/" },
];
// Gold news: world gold market and the Afghan gold market, kept in a separate list.
const GOLD_FEEDS = [
  { src: "Bing News", search: true, url: BING('gold price') },
  { src: "Bing News", search: true, url: BING('XAUUSD gold ounce') },
  { src: "Bing News", search: true, url: BING('قیمت جهانی طلا اونس') },
  { src: "Bing News", search: true, url: BING('نرخ طلا افغانستان') },
  { src: "Bing News", search: true, url: BING('طلا کابل زرگران') },
];
const GOLD_RE = /(\bgold\b|\bXAU|bullion|طلا|زرگر|اونس|سکه طلا)/i;
// Iran's domestic coin/toman market and sports results are left out.
const GOLD_NOT_RE = /(cup|medal|medalist|olympic|golden|gold coast|مدال|جام طلا|توپ طلا|تومان|سکه امامی|بهار آزادی|ریال|بورس|حراج سکه)/i;
// General outlet feeds must name the topic in the headline; targeted searches may match in the summary.
const NEWS_RE = /(Da Afghanistan Bank|\bDAB\b|central bank|\bafghanis?\b|\bAFN\b|auction|exchange rate|money ?changer|Sarai Shahzada|forex|د افغانستان بانک|افغانستان بانک|بانک مرکزی|لیلام|مزایده|افغانی|نرخ ارز|نرخ دالر|نرخ اسعار|اسعار|صرافی|صرافان|سرای شهزاده|ارزش پول)/i;
// Auction / central-bank posts in rate channels (e.g. «15ملیون سودا بانک به فردا اعلام شد»); ads are skipped.
const TG_NEWS_RE = /(لیلام|ليلام|مزایده|سودا\s*بانک|سودای\s*بانک|بانک مرکزی|افغانستان بانک)/;
const TG_AD_RE = /(تبلیغ|آموزش|ثبت نام|ثبت‌نام|تماس بگیرید|واتساپ|whatsapp|پاسپورت|جواز|رایگان|کورس)/i;
const NEWS_MAX = 40;

const unxml = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function parseFeed(xml, src, search = false, re = NEWS_RE, notRe = null, maxDays = 45) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const g = tag => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? unxml(m[1]) : ""; };
    const title = g("title");
    let link = g("link"); if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/); link = m ? m[1] : ""; }
    const ts = Math.floor(Date.parse(g("pubDate") || g("updated") || g("published") || g("dc:date")) / 1000);
    if (!title || !/^https?:\/\//.test(link) || !isFinite(ts)) continue;
    if (ts < Date.now() / 1000 - maxDays * 86400) continue;
    const desc = g("description") || g("summary");
    if (!re.test(search ? title + " " + desc.slice(0, 400) : title)) continue;
    if (notRe && notRe.test(title)) continue;
    const outlet = g("source") || g("News:Source");
    const clean = outlet && title.endsWith(" - " + outlet) ? title.slice(0, -(outlet.length + 3)) : title;
    out.push({ ts, src: outlet || src, title: clean.slice(0, 220), link });
  }
  return out;
}
async function saveNews(db, add, mkey = "news") {
  if (!add.length) return;
  let list = []; try { list = JSON.parse((await meta(db, mkey)) || "[]"); } catch (e) {}
  const key = n => n.title.replace(/[\s\p{P}\p{S}]+/gu, "").slice(0, 60).toLowerCase();
  const have = new Set(list.map(n => n.link)), haveT = new Set(list.map(key));
  let changed = false;
  for (const n of add) if (!have.has(n.link) && !haveT.has(key(n))) { list.push(n); have.add(n.link); haveT.add(key(n)); changed = true; }
  if (!changed) return;
  list.sort((a, b) => b.ts - a.ts);
  await setMeta(db, mkey, JSON.stringify(list.slice(0, NEWS_MAX)));
}
async function collectNews(db) {
  const found = [], foundGold = [], status = [];
  const get = async (f, gold) => {
    try {
      const r = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) { status.push(`${gold ? "gold:" : ""}${f.src} ${r.status}`); return; }
      const xml = await r.text();
      if (!gold) { const items = parseFeed(xml, f.src, !!f.search); found.push(...items); status.push(`${f.src} ok ${items.length}`); }
      // every feed also contributes gold headlines; gold searches only feed the gold list
      const g = parseFeed(xml, f.src, gold && !!f.search, GOLD_RE, GOLD_NOT_RE, 10);
      foundGold.push(...g);
      if (gold) status.push(`gold:${f.src} ok ${g.length}`);
    } catch (e) { status.push(`${gold ? "gold:" : ""}${f.src} ${e && e.name || "error"}`); }
  };
  await Promise.all([...FEEDS.map(f => get(f, false)), ...GOLD_FEEDS.map(f => get(f, true))]);
  await saveNews(db, found);
  await saveNews(db, foundGold, "newsGold");
  await setMeta(db, "newsAt", Math.floor(Date.now() / 1000));
  await setMeta(db, "newsStatus", status.join(" | "));
}

const meta = async (db, k) => (await db.prepare("SELECT v FROM meta WHERE k=?").bind(k).first("v")) ?? null;
const setMeta = (db, k, v) => db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)").bind(k, String(v)).run();
const mkey = (idx, name) => (idx === 0 ? name : `${name}:${CHANNELS[idx].name}`);
const chOf = uid => Math.floor(uid / SPAN);

async function ensureSchema(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY, ts INTEGER, text TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ticks(id INTEGER PRIMARY KEY, ts INTEGER, city TEXT, kind TEXT, buy REAL, sell REAL, price REAL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ticks_city_ts ON ticks(city, ts)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ticks_ts ON ticks(ts)"),
    db.prepare("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS snap(city TEXT PRIMARY KEY, data TEXT)"),
    db.prepare(MEMBERS_SQL),
  ]);
}

function parseFor(uid, text) {
  const ch = CHANNELS[chOf(uid)];
  return parseAll(text, ch ? ch.city : null);
}
const tickStmt = (db, uid, ts, p) =>
  db.prepare("INSERT OR REPLACE INTO ticks VALUES(?,?,?,?,?,?,?)").bind(uid, ts, p.city, p.kind, p.buy, p.sell, p.price);
// One post can quote several markets; the k-th market gets id uid + k * 1e7 (ids stay inside the channel's range).
const subId = (uid, k) => uid + k * 1e7;

// Closing rates of every bid market (بولی), kept for the "بازار بولی" panel.
async function saveBoli(db, ts, link, quotes) {
  const prev = JSON.parse((await meta(db, "boli")) || "null");
  if (prev && prev.ts >= ts) return;
  await setMeta(db, "boli", JSON.stringify({ ts, link, rows: quotes.map(q => ({ city: q.city, buy: q.buy, sell: q.sell })) }));
}

// Gold board -> two series: "xau" (world ounce, USD) and "g18herat" (Herat melted 18k, AFN/gram, mid of buy/sell).
function goldTicks(db, uid, ts, g) {
  const stmts = [], ticks = [];
  if (g.ounce) { stmts.push(tickStmt(db, subId(uid, 5), ts, { city: "xau", kind: "quote", buy: g.ounce, sell: g.ounce, price: g.ounce })); ticks.push({ city: "xau", ts, price: g.ounce, deal: 0 }); }
  if (g.buy18) { const m = (g.buy18 + g.sell18) / 2; stmts.push(tickStmt(db, subId(uid, 6), ts, { city: "g18herat", kind: "quote", buy: g.buy18, sell: g.sell18, price: m })); ticks.push({ city: "g18herat", ts, price: m, deal: 0 }); }
  return { stmts, ticks };
}
async function saveGold(db, ts, g) {
  const prev = JSON.parse((await meta(db, "gold")) || "null") || {};
  if (prev.ts && prev.ts > ts) return;
  await setMeta(db, "gold", JSON.stringify({ ts, ounce: g.ounce || prev.ounce || null, buy18: g.buy18 || prev.buy18 || null, sell18: g.sell18 || prev.sell18 || null }));
}

// Store only messages not seen before. Returns the new ticks so snapshots can be updated in memory.
async function ingest(db, idx, list) {
  if (!list.length) return [];
  const base = idx * SPAN;
  const uids = list.map(m => base + m.id);
  const seen = new Set((await db.prepare(`SELECT id FROM msgs WHERE id IN (${uids.map(() => "?").join(",")})`).bind(...uids).all()).results.map(r => r.id));
  const stmts = [], ticks = [], news = [];
  let boli = null, gold = null;
  for (const m of list) {
    const uid = base + m.id;
    if (seen.has(uid)) continue;
    stmts.push(db.prepare("INSERT OR IGNORE INTO msgs VALUES(?,?,?)").bind(uid, m.ts, m.text));
    const { quotes, summary } = parseAll(m.text, CHANNELS[idx].city);
    quotes.forEach((p, k) => { stmts.push(tickStmt(db, subId(uid, k), m.ts, p)); ticks.push({ city: p.city, ts: m.ts, price: p.price, deal: p.kind === "deal" ? 1 : 0 }); });
    if (summary && quotes.length >= 3 && (!boli || m.ts > boli.ts)) boli = { ts: m.ts, link: `https://t.me/${CHANNELS[idx].name}/${m.id}`, quotes };
    if (CHANNELS[idx].gold) { const g = parseGold(m.text); if (g) { const r = goldTicks(db, uid, m.ts, g); stmts.push(...r.stmts); ticks.push(...r.ticks); if (!gold || m.ts > gold.ts) gold = { ts: m.ts, g }; } }
    if (!quotes.length && m.text.length > 25 && m.text.length < 600 && TG_NEWS_RE.test(m.text) && !TG_AD_RE.test(m.text) && m.ts > Date.now() / 1000 - 30 * 86400)
      news.push({ ts: m.ts, src: "@" + CHANNELS[idx].name, title: m.text.replace(/\s+/g, " ").slice(0, 220), link: `https://t.me/${CHANNELS[idx].name}/${m.id}` });
  }
  if (stmts.length) await db.batch(stmts);
  if (news.length) await saveNews(db, news);
  if (boli) await saveBoli(db, boli.ts, boli.link, boli.quotes);
  if (gold) await saveGold(db, gold.ts, gold.g);
  return ticks;
}

// For a channel whose newest post is edited in place (a live price board): record a tick whenever its price changes.
async function liveTick(db, idx, latest) {
  const ch = CHANNELS[idx];
  const newest = latest.reduce((a, b) => (b.id > a.id ? b : a));
  const out = [];
  if (ch.gold) {
    const g = parseGold(newest.text);
    if (g) {
      const gkey = mkey(idx, "liveGold"), gp = JSON.parse((await meta(db, gkey)) || "null");
      if (!gp || gp.ounce !== g.ounce || gp.buy18 !== g.buy18 || gp.sell18 !== g.sell18) {
        const now = Math.floor(Date.now() / 1000), r = goldTicks(db, idx * SPAN + 5e8 + Math.floor(now / 60), now, g);
        if (r.stmts.length) await db.batch(r.stmts);
        out.push(...r.ticks);
        await setMeta(db, gkey, JSON.stringify(g));
        await saveGold(db, now, g);
      }
    }
  }
  const p = parsePost(newest.text, ch.city);
  if (!p) return out;
  const key = mkey(idx, "live"), prev = JSON.parse((await meta(db, key)) || "null");
  if (prev && prev.price === p.price) return out;
  const now = Math.floor(Date.now() / 1000);
  await tickStmt(db, idx * SPAN + 5e8 + Math.floor(now / 60), now, p).run();
  await setMeta(db, key, JSON.stringify({ price: p.price, ts: now }));
  out.push({ city: p.city, ts: now, price: p.price, deal: 0 });
  return out;
}

async function reparseIfNeeded(db) {
  if ((await meta(db, "parser")) === String(PARSER_VERSION)) return;
  const rows = (await db.prepare("SELECT id, ts, text FROM msgs").all()).results;
  const stmts = [db.prepare("DELETE FROM ticks"), db.prepare("DELETE FROM snap")];
  for (const m of rows) parseFor(m.id, m.text).quotes.forEach((p, k) => stmts.push(tickStmt(db, subId(m.id, k), m.ts, p)));
  for (let i = 0; i < stmts.length; i += 500) await db.batch(stmts.slice(i, i + 500));
  await setMeta(db, "parser", PARSER_VERSION);
}

// Primary-key range lookups: one or two row reads.
async function bounds(db, idx) {
  const lo = idx * SPAN, hi = lo + SPAN - 1;
  const r = await db.prepare("SELECT MIN(id) AS minId, MAX(id) AS maxId FROM msgs WHERE id BETWEEN ? AND ?").bind(lo, hi).first();
  const minTs = r.minId != null ? await db.prepare("SELECT ts FROM msgs WHERE id=?").bind(r.minId).first("ts") : null;
  return { minId: r.minId != null ? r.minId - lo : null, maxId: r.maxId != null ? r.maxId - lo : null, minTs };
}

async function fetchPage(channel, before) {
  const url = `https://t.me/s/${channel}` + (before ? `?before=${before}` : "");
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fa,en;q=0.8" } });
  if (!res.ok) throw new Error(`telegram ${channel} ${res.status}`);
  return parsePage(await res.text(), channel);
}
const minId = list => Math.min(...list.map(m => m.id));
const maxId = list => Math.max(...list.map(m => m.id));

async function collectChannel(db, idx) {
  const ch = CHANNELS[idx].name, out = [];
  const cursor = +(await meta(db, mkey(idx, "cursor"))) || (await bounds(db, idx)).maxId || 0;
  const gapTop = +(await meta(db, mkey(idx, "gapTop"))) || 0;
  const gapCeil = +(await meta(db, mkey(idx, "gapCeil"))) || 0;

  const latest = await fetchPage(ch);
  if (!latest.length) return out;
  out.push(...await ingest(db, idx, latest));
  if (CHANNELS[idx].live) out.push(...await liveTick(db, idx, latest));
  const top = Math.max(maxId(latest), gapCeil);

  // Catch up on anything posted since the last successful run, across runs if needed.
  let low = gapTop || minId(latest), closed = !cursor || low - 1 <= cursor;
  for (let i = 0; i < 8 && !closed; i++) {
    const page = await fetchPage(ch, low);
    if (!page.length || minId(page) >= low) { closed = true; break; }
    out.push(...await ingest(db, idx, page));
    low = minId(page);
    closed = low - 1 <= cursor;
  }
  if (closed) {
    if (cursor !== top) await setMeta(db, mkey(idx, "cursor"), top);
    if (gapTop) { await setMeta(db, mkey(idx, "gapTop"), 0); await setMeta(db, mkey(idx, "gapCeil"), 0); }
  } else {
    await setMeta(db, mkey(idx, "gapTop"), low);
    if (!gapCeil) await setMeta(db, mkey(idx, "gapCeil"), top);
  }

  // One-time history walk for a newly added channel.
  if ((await meta(db, mkey(idx, "backfill"))) !== "done") {
    const stopTs = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400;
    let b = await bounds(db, idx);
    for (let i = 0; i < 3; i++) {
      if (b.minId == null || b.minTs < stopTs) { await setMeta(db, mkey(idx, "backfill"), "done"); break; }
      const page = await fetchPage(ch, b.minId);
      if (!page.length || minId(page) >= b.minId) { await setMeta(db, mkey(idx, "backfill"), "done"); break; }
      out.push(...await ingest(db, idx, page));
      b = await bounds(db, idx);
    }
  }
  return out;
}

// One row per city holding its recent history, so a page load costs one row read per city.
async function updateSnapshots(db, newTicks) {
  const byCity = {};
  for (const t of newTicks) (byCity[t.city] ||= []).push([t.ts, +t.price.toFixed(3), t.deal]);
  const have = new Set((await db.prepare("SELECT city FROM snap").all()).results.map(r => r.city));
  const cutoff = Math.floor(Date.now() / 1000) - KEEP_DAYS * 86400;
  let built = 0; // build at most one missing snapshot per run to keep each run light
  for (const c of CITIES) {
    let data;
    if (!have.has(c.key)) {
      if (built++) continue;
      const rows = (await db.prepare("SELECT ts, price, kind FROM ticks WHERE city=? AND ts>=? ORDER BY ts").bind(c.key, cutoff).all()).results;
      if (!rows.length) continue;
      data = rows.map(r => [r.ts, +r.price.toFixed(3), r.kind === "deal" ? 1 : 0]);
    } else if (byCity[c.key]) {
      data = JSON.parse(await db.prepare("SELECT data FROM snap WHERE city=?").bind(c.key).first("data"));
      data.push(...byCity[c.key]);
      data.sort((a, b) => a[0] - b[0]);
      data = data.filter(t => t[0] >= cutoff);
    } else continue;
    await db.prepare("INSERT OR REPLACE INTO snap(city, data) VALUES(?,?)").bind(c.key, JSON.stringify(data)).run();
  }
}

// One-time: build gold ticks from gold-board messages stored before gold parsing existed.
async function seedGold(db) {
  if ((await meta(db, "goldSeed")) === "1") return;
  const stmts = [];
  for (let idx = 0; idx < CHANNELS.length; idx++) {
    if (!CHANNELS[idx].gold) continue;
    const rows = (await db.prepare("SELECT id, ts, text FROM msgs WHERE id BETWEEN ? AND ?").bind(idx * SPAN, idx * SPAN + SPAN - 1).all()).results;
    for (const m of rows) { const g = parseGold(m.text); if (g) stmts.push(...goldTicks(db, m.id, m.ts, g).stmts); }
  }
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200));
  await db.prepare("DELETE FROM snap WHERE city IN ('xau','g18herat')").run();
  await setMeta(db, "goldSeed", "1");
}

async function collect(env) {
  const db = env.DB;
  await ensureSchema(db);
  await reparseIfNeeded(db);
  await seedGold(db);
  const all = [], errors = [];
  for (let i = 0; i < CHANNELS.length; i++) {
    try { all.push(...await collectChannel(db, i)); }
    catch (e) { errors.push(`${CHANNELS[i].name}: ${e && e.message || e}`); }
  }
  await updateSnapshots(db, all);
  const now = Math.floor(Date.now() / 1000);
  try { await collectXau(db); } catch (e) { errors.push("xau: " + (e && e.message || e)); }
  if (now - (+(await meta(db, "authCleanAt")) || 0) >= 3600) { try { await cleanupAuth(db); await setMeta(db, "authCleanAt", now); } catch (e) { errors.push("auth: " + (e && e.message || e)); } }
  if (now - (+(await meta(db, "newsAt")) || 0) >= 1800) {
    try { await collectNews(db); } catch (e) { errors.push("news: " + (e && e.message || e)); }
  }
  await setMeta(db, "lastRun", now);
  if (errors.length) await setMeta(db, "lastError", new Date().toISOString() + " " + errors.join(" | "));
}

// Short in-memory cache so many viewers don't each re-read the database.
const memo = new Map();
async function cached(key, ttl, fn) {
  const hit = memo.get(key), now = Date.now();
  if (hit && now - hit.t < ttl) return hit.v;
  const v = await fn();
  memo.set(key, { t: now, v });
  if (memo.size > 200) memo.delete(memo.keys().next().value);
  return v;
}

async function history(db) {
  const rows = (await db.prepare("SELECT city, data FROM snap").all()).results;
  const series = {};
  for (const r of rows) series[r.city] = JSON.parse(r.data);
  return { series, lastRun: +(await meta(db, "lastRun")) || null, gold: JSON.parse((await meta(db, "gold")) || "null") };
}

// ---- World gold candles (XAU/USD) from Yahoo Finance's chart API ----
// 5-minute bars every 5 minutes, hourly every 30 minutes, daily every 6 hours. Kept in meta as [[t,o,h,l,c],...].
const XAU_SETS = [["xau5m", "5m", "5d", 300], ["xau1h", "60m", "60d", 1800], ["xau1d", "1d", "2y", 21600]];
const XAU_SYMBOLS = ["XAUUSD=X", "GC=F"];
async function fetchXau(interval, range) {
  for (const sym of XAU_SYMBOLS) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`,
        { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/json" }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) continue;
      const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp) continue;
      const q = res.indicators.quote[0], out = [];
      res.timestamp.forEach((t, i) => {
        const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
        if ([o, h, l, c].every(v => typeof v === "number" && v > 500)) out.push([t, +o.toFixed(2), +h.toFixed(2), +l.toFixed(2), +c.toFixed(2)]);
      });
      if (out.length > 5) return { sym, bars: out };
    } catch (e) {}
  }
  return null;
}
async function collectXau(db) {
  const now = Math.floor(Date.now() / 1000), status = [];
  for (const [key, interval, range, every] of XAU_SETS) {
    if (now - (+(await meta(db, key + "At")) || 0) < every - 30) continue;
    const r = await fetchXau(interval, range);
    await setMeta(db, key + "At", now);
    if (r) { await setMeta(db, key, JSON.stringify(r.bars)); status.push(`${key} ${r.sym} ${r.bars.length}`); }
    else status.push(`${key} failed`);
  }
  if (status.length) await setMeta(db, "xauStatus", new Date().toISOString() + " " + status.join(" | "));
}

// ---- Live gold price for open pages (Yahoo 1-minute bars, shared by all viewers for 10 s) ----
async function liveGold() {
  try {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d",
      { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { xau: null };
    const res = (await r.json()).chart.result[0], q = res.indicators.quote[0], bars = [];
    (res.timestamp || []).forEach((t, i) => {
      const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
      if ([o, h, l, c].every(v => typeof v === "number" && v > 500)) bars.push([t, +o.toFixed(2), +h.toFixed(2), +l.toFixed(2), +c.toFixed(2)]);
    });
    const m = res.meta || {}, p = +m.regularMarketPrice || (bars.length ? bars[bars.length - 1][4] : 0);
    if (!(p > 500)) return { xau: null };
    return { xau: { p: +p.toFixed(2), t: +m.regularMarketTime || Math.floor(Date.now() / 1000), bars: bars.slice(-90) } };
  } catch (e) { return { xau: null }; }
}

// ---- Optional member registration ----
const MEMBERS_SQL = "CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, name TEXT, phone TEXT UNIQUE, city TEXT, role TEXT, wants INTEGER, iph TEXT, email TEXT, ads INTEGER)";
const toLatin = s => String(s || "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const clip = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function join(req, db) {
  const bad = (msg, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json; charset=utf-8" } });
  if (req.method !== "POST") return bad("method", 405);
  // Only this site's own form may post here, and only small bodies.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return bad("forbidden", 403);
  if (+(req.headers.get("content-length") || 0) > 4096) return bad("too large", 413);
  let d; try { d = await req.json(); } catch (e) { return bad("درخواست نامعتبر است."); }
  if (d.website) return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); // bots fill the hidden field
  const name = clip(d.name, 60), city = clip(d.city, 40), role = clip(d.role, 40);
  let phone = toLatin(d.phone).replace(/[\s\-().]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  const email = clip(d.email, 120).toLowerCase();
  if (name.length < 2) return bad("لطفاً نام خود را بنویسید.");
  if (!phone && !email) return bad("لطفاً شماره‌ی تماس یا ایمیل خود را بنویسید.");
  if (phone && !/^\+?\d{9,15}$/.test(phone)) return bad("شماره‌ی تماس درست نیست. مثال: 0700123456 یا ‎+93700123456");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad("ایمیل درست نیست. مثال: name@gmail.com");
  await db.prepare(MEMBERS_SQL).run();
  let salt = await meta(db, "salt");
  if (!salt) { salt = crypto.randomUUID(); await setMeta(db, "salt", salt); }
  const iph = (await sha((req.headers.get("cf-connecting-ip") || "") + salt)).slice(0, 16);
  const now = Math.floor(Date.now() / 1000);
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM members WHERE iph=? AND ts>?").bind(iph, now - 3600).first("n");
  if (recent >= 5) return bad("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.", 429);
  const prev = await db.prepare("SELECT id FROM members WHERE (phone IS NOT NULL AND phone=?) OR (email IS NOT NULL AND email=?) LIMIT 1").bind(phone || null, email || null).first("id");
  if (prev) await db.prepare("UPDATE members SET ts=?, name=?, phone=COALESCE(?,phone), email=COALESCE(?,email), city=?, role=?, wants=?, ads=? WHERE id=?")
    .bind(now, name, phone || null, email || null, city, role, d.wants ? 1 : 0, d.ads ? 1 : 0, prev).run();
  else await db.prepare("INSERT INTO members(ts,name,phone,email,city,role,wants,ads,iph) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(now, name, phone || null, email || null, city, role, d.wants ? 1 : 0, d.ads ? 1 : 0, iph).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function admin(url, db) {
  const key = await meta(db, "adminKey"), given = url.searchParams.get("key") || "";
  if (!key || given.length !== key.length || (await sha(given)) !== (await sha(key)))
    return new Response("Not found", { status: 404 });
  await db.prepare(MEMBERS_SQL).run();
  const rows = (await db.prepare("SELECT ts,name,phone,email,city,role,wants,ads FROM members ORDER BY ts DESC LIMIT 5000").all()).results;
  const day = t => new Date((t + 16200) * 1000).toISOString().slice(0, 16).replace("T", " ");
  const users = await listUsers(db);
  const yn = v => (v ? "بلی" : "نخیر");
  if (url.pathname.endsWith(".csv") && url.searchParams.get("t") !== "old") {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "\ufeffcreated,name,email,phone,province,role,email_verified,wants_rates_news,accepts_ads,last_login\n" +
      users.map(r => [day(r.created), r.name, r.email, r.phone, r.city, r.role, r.verified ? "yes" : "no", r.wants ? "yes" : "no", r.ads ? "yes" : "no", r.last_login ? day(r.last_login) : ""].map(q).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=raahbar-accounts.csv", "cache-control": "no-store" } });
  }
  if (url.pathname.endsWith(".csv")) {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "\ufeffdate,name,phone,email,province,role,wants_rates_news,accepts_ads\n" + rows.map(r => [day(r.ts), r.name, r.phone, r.email, r.city, r.role, r.wants ? "yes" : "no", r.ads ? "yes" : "no"].map(q).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=raahbar-members.csv", "cache-control": "no-store" } });
  }
  const tr = rows.map(r => `<tr><td>${esc(day(r.ts))}</td><td>${esc(r.name)}</td><td dir="ltr">${esc(r.phone)}</td><td dir="ltr">${esc(r.email)}</td><td>${esc(r.city)}</td><td>${esc(r.role)}</td><td>${r.wants ? "بلی" : "نخیر"}</td><td>${r.ads ? "بلی" : "نخیر"}</td></tr>`).join("");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>اعضای راهبر</title>
<style>body{font-family:Tahoma,system-ui,sans-serif;margin:0;padding:16px;background:#0E1220;color:#EDEBE4}h1{font-size:20px;color:#E2B847}a{color:#E2B847}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #252D44;padding:7px 8px;text-align:right}th{color:#9AA2B5;font-weight:500}.w{overflow-x:auto}</style></head>
<body><h1>حساب‌های راهبر: ${users.length} نفر</h1><p><a href="/admin.csv?key=${encodeURIComponent(given)}">دانلود فایل اکسل حساب‌ها (CSV)</a></p>
<div class="w"><table><thead><tr><th>تاریخ ساخت (وقت کابل)</th><th>نام</th><th>ایمیل</th><th>تأیید ایمیل</th><th>شماره</th><th>ولایت</th><th>شغل</th><th>نرخ و خبر</th><th>اعلانات تجاری</th><th>آخرین ورود</th></tr></thead><tbody>${users.map(r => `<tr><td>${esc(day(r.created))}</td><td>${esc(r.name)}</td><td dir="ltr">${esc(r.email)}</td><td>${yn(r.verified)}</td><td dir="ltr">${esc(r.phone)}</td><td>${esc(r.city)}</td><td>${esc(r.role)}</td><td>${yn(r.wants)}</td><td>${yn(r.ads)}</td><td>${r.last_login ? esc(day(r.last_login)) : ""}</td></tr>`).join("")}</tbody></table></div>
<h2 style="font-size:16px;color:#9AA2B5;margin-top:28px">ثبت‌نام‌های قبلی (بدون رمز): ${rows.length} نفر · <a href="/admin.csv?t=old&key=${encodeURIComponent(given)}">CSV</a></h2>
<div class="w"><table><thead><tr><th>تاریخ (وقت کابل)</th><th>نام</th><th>شماره</th><th>ایمیل</th><th>ولایت</th><th>شغل</th><th>نرخ و خبر</th><th>اعلانات تجاری</th></tr></thead><tbody>${tr}</tbody></table></div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

const json = (d, maxAge = 15) => new Response(JSON.stringify(d), {
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" },
});

// Security headers on every response: no framing (clickjacking), no MIME sniffing, HTTPS only,
// and a content policy that allows scripts only from this site and the pinned chart library.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com/lightweight-charts@4.1.3/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
function secure(res) {
  const r = new Response(res.body, res);
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("x-frame-options", "DENY");
  r.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  r.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  r.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if ((r.headers.get("content-type") || "").startsWith("text/html")) r.headers.set("content-security-policy", CSP);
  return r;
}

export default {
  async scheduled(_ev, env, ctx) {
    ctx.waitUntil((async () => {
      try { await collect(env); }
      catch (e) { try { await setMeta(env.DB, "lastError", new Date().toISOString() + " " + (e && e.stack || e)); } catch (_) {} }
    })());
  },

  async fetch(req, env) { return secure(await handle(req, env)); },
};

async function handle(req, env) {
  {
    const url = new URL(req.url);
    const db = env.DB;
    // One public address: www.nirkh.com and the old workers.dev link move to nirkh.com.
    if ((url.hostname === "www.nirkh.com" || url.hostname.endsWith(".workers.dev")) &&
        (req.method === "GET" || req.method === "HEAD") && !url.pathname.startsWith("/api/"))
      return Response.redirect("https://nirkh.com" + url.pathname + url.search, 301);
    try {
      const a = await handleAuth(req, url, db);
      if (a) return a;
      if (url.pathname === "/api/history") return json(await cached("history", 30000, () => history(db)), 30);
      if (url.pathname === "/api/news")
        return json(await cached("news", 120000, async () => ({ news: JSON.parse((await meta(db, "news")) || "[]"), newsGold: JSON.parse((await meta(db, "newsGold")) || "[]"), boli: JSON.parse((await meta(db, "boli")) || "null"), gold: JSON.parse((await meta(db, "gold")) || "null") })), 120);
      if (url.pathname === "/api/xau")
        return json(await cached("xau", 60000, async () => {
          const g = async k => { try { return JSON.parse((await meta(db, k)) || "[]"); } catch (e) { return []; } };
          return { m5: await g("xau5m"), h1: await g("xau1h"), d1: await g("xau1d") };
        }), 60);
      if (url.pathname === "/api/live") return json(await cached("live", 10000, liveGold), 5);
      if (url.pathname === "/api/join") return await join(req, db);
      if (url.pathname === "/admin" || url.pathname === "/admin.csv") return await admin(url, db);
      if (url.pathname === "/api/updates") {
        // Recent ticks for all cities. `since` is rounded to the minute so viewers share cache entries.
        const now = Math.floor(Date.now() / 1000);
        const s = Math.max(Math.floor((+url.searchParams.get("since") || 0) / 60) * 60, now - 3 * 86400);
        const ticks = await cached("upd:" + s, 15000, async () =>
          (await db.prepare("SELECT city, ts, price, kind FROM ticks WHERE ts>? ORDER BY ts LIMIT 2000").bind(s).all())
            .results.map(x => [x.city, x.ts, +x.price.toFixed(3), x.kind === "deal" ? 1 : 0]));
        const lastRun = await cached("lastRun", 15000, async () => +(await meta(db, "lastRun")) || null);
        const gold = await cached("goldMeta", 15000, async () => JSON.parse((await meta(db, "gold")) || "null"));
        return json({ ticks, lastRun, gold });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/robots.txt")
      return new Response("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://nirkh.com/sitemap.xml\n", { headers: { "content-type": "text/plain" } });
    if (url.pathname === "/sitemap.xml")
      return new Response(sitemap(), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
    if (url.pathname === "/logo.jpg" && LOGO)
      return new Response(LOGO, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800" } });
    if (url.pathname === "/index.html") return Response.redirect(url.origin + "/", 301);
    if (url.pathname === "/" || url.pathname === "/gold") {
      const kind = url.pathname === "/gold" ? "gold" : "usd";
      let html;
      try { html = await cached("seo:" + kind, 60000, async () => seoPage(PAGE, await cached("history", 30000, () => history(env.DB)), kind)); }
      catch (e) { html = PAGE; }
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
    }
    return new Response("Not found", { status: 404 });
  }
}
