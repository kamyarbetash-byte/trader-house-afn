import { parsePage, parsePost, PARSER_VERSION, CITIES } from "./parse.js";
import PAGE from "./page.html";

// Public Telegram channels read every minute. `city` is used when a post names no city.
// Message ids are stored as idx * 1e9 + id so channels never collide (kabul_dollar keeps its raw ids).
// To add a source, append it here and push; its history is backfilled automatically.
const CHANNELS = [
  { name: "kabul_dollar", city: null },
  { name: "Mazar_Nerkh", city: "mazar" },
];
const SPAN = 1e9;
const BACKFILL_DAYS = 45;
const KEEP_DAYS = 120;
const UA = "Mozilla/5.0 (compatible; TraderHouseRates/1.0)";

// News about the afghani, the dollar and Da Afghanistan Bank (auctions, rates, decisions).
// Feeds are checked every 30 minutes; Telegram posts that mention an auction or the central bank are added as they arrive.
const FEEDS = [
  { src: "د افغانستان بانک", url: "https://dab.gov.af/rss.xml" },
  { src: "د افغانستان بانک", url: "https://www.dab.gov.af/fa/rss.xml" },
  { src: "پژواک", url: "https://pajhwok.com/tag/dab/feed/" },
  { src: "پژواک", url: "https://pajhwok.com/tag/afghani/feed/" },
];
const NEWS_RE = /(لیلام|مزایده|بولی|افغانستان بانک|بانک مرکزی|DAB\b|Da Afghanistan Bank|central bank|auction|afghani|exchange rate|currency)/i;
const TG_NEWS_RE = /(لیلام|مزایده|بولی|افغانستان بانک|بانک مرکزی)/;
const NEWS_MAX = 40;

const unxml = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function parseFeed(xml, src) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const g = tag => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? unxml(m[1]) : ""; };
    const title = g("title");
    let link = g("link"); if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/); link = m ? m[1] : ""; }
    const ts = Math.floor(Date.parse(g("pubDate") || g("updated") || g("published") || g("dc:date")) / 1000);
    if (!title || !/^https?:\/\//.test(link) || !isFinite(ts)) continue;
    const desc = g("description") || g("summary");
    if (!NEWS_RE.test(title + " " + desc)) continue;
    out.push({ ts, src, title: title.slice(0, 220), link });
  }
  return out;
}
async function saveNews(db, add) {
  if (!add.length) return;
  let list = []; try { list = JSON.parse((await meta(db, "news")) || "[]"); } catch (e) {}
  const have = new Set(list.map(n => n.link));
  let changed = false;
  for (const n of add) if (!have.has(n.link)) { list.push(n); have.add(n.link); changed = true; }
  if (!changed) return;
  list.sort((a, b) => b.ts - a.ts);
  await setMeta(db, "news", JSON.stringify(list.slice(0, NEWS_MAX)));
}
async function collectNews(db) {
  const found = [], status = [];
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) { status.push(`${f.url} ${r.status}`); continue; }
      const items = parseFeed(await r.text(), f.src);
      status.push(`${f.url} ok ${items.length}`);
      found.push(...items);
    } catch (e) { status.push(`${f.url} ${e && e.name || "error"}`); }
  }
  await saveNews(db, found);
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
  ]);
}

function parseFor(uid, text) {
  const ch = CHANNELS[chOf(uid)];
  return parsePost(text, ch ? ch.city : null);
}
const tickStmt = (db, uid, ts, p) =>
  db.prepare("INSERT OR REPLACE INTO ticks VALUES(?,?,?,?,?,?,?)").bind(uid, ts, p.city, p.kind, p.buy, p.sell, p.price);

// Store only messages not seen before. Returns the new ticks so snapshots can be updated in memory.
async function ingest(db, idx, list) {
  if (!list.length) return [];
  const base = idx * SPAN;
  const uids = list.map(m => base + m.id);
  const seen = new Set((await db.prepare(`SELECT id FROM msgs WHERE id IN (${uids.map(() => "?").join(",")})`).bind(...uids).all()).results.map(r => r.id));
  const stmts = [], ticks = [], news = [];
  for (const m of list) {
    const uid = base + m.id;
    if (seen.has(uid)) continue;
    stmts.push(db.prepare("INSERT OR IGNORE INTO msgs VALUES(?,?,?)").bind(uid, m.ts, m.text));
    const p = parsePost(m.text, CHANNELS[idx].city);
    if (p) { stmts.push(tickStmt(db, uid, m.ts, p)); ticks.push({ city: p.city, ts: m.ts, price: p.price, deal: p.kind === "deal" ? 1 : 0 }); }
    else if (m.text.length > 25 && TG_NEWS_RE.test(m.text) && m.ts > Date.now() / 1000 - 30 * 86400)
      news.push({ ts: m.ts, src: "@" + CHANNELS[idx].name, title: m.text.replace(/\s+/g, " ").slice(0, 220), link: `https://t.me/${CHANNELS[idx].name}/${m.id}` });
  }
  if (stmts.length) await db.batch(stmts);
  if (news.length) await saveNews(db, news);
  return ticks;
}

async function reparseIfNeeded(db) {
  if ((await meta(db, "parser")) === String(PARSER_VERSION)) return;
  const rows = (await db.prepare("SELECT id, ts, text FROM msgs").all()).results;
  const stmts = [db.prepare("DELETE FROM ticks"), db.prepare("DELETE FROM snap")];
  for (const m of rows) { const p = parseFor(m.id, m.text); if (p) stmts.push(tickStmt(db, m.id, m.ts, p)); }
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
    for (let i = 0; i < 6; i++) {
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
  for (const c of CITIES) {
    let data;
    if (!have.has(c.key)) {
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

async function collect(env) {
  const db = env.DB;
  await ensureSchema(db);
  await reparseIfNeeded(db);
  const all = [], errors = [];
  for (let i = 0; i < CHANNELS.length; i++) {
    try { all.push(...await collectChannel(db, i)); }
    catch (e) { errors.push(`${CHANNELS[i].name}: ${e && e.message || e}`); }
  }
  await updateSnapshots(db, all);
  const now = Math.floor(Date.now() / 1000);
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
  return { series, lastRun: +(await meta(db, "lastRun")) || null };
}

const json = (d, maxAge = 15) => new Response(JSON.stringify(d), {
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" },
});

export default {
  async scheduled(_ev, env, ctx) {
    ctx.waitUntil((async () => {
      try { await collect(env); }
      catch (e) { try { await setMeta(env.DB, "lastError", new Date().toISOString() + " " + (e && e.stack || e)); } catch (_) {} }
    })());
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    const db = env.DB;
    try {
      if (url.pathname === "/api/history") return json(await cached("history", 30000, () => history(db)), 30);
      if (url.pathname === "/api/news")
        return json(await cached("news", 120000, async () => ({ news: JSON.parse((await meta(db, "news")) || "[]") })), 120);
      if (url.pathname === "/api/updates") {
        // Recent ticks for all cities. `since` is rounded to the minute so viewers share cache entries.
        const now = Math.floor(Date.now() / 1000);
        const s = Math.max(Math.floor((+url.searchParams.get("since") || 0) / 60) * 60, now - 3 * 86400);
        const ticks = await cached("upd:" + s, 15000, async () =>
          (await db.prepare("SELECT city, ts, price, kind FROM ticks WHERE ts>? ORDER BY ts LIMIT 2000").bind(s).all())
            .results.map(x => [x.city, x.ts, +x.price.toFixed(3), x.kind === "deal" ? 1 : 0]));
        const lastRun = await cached("lastRun", 15000, async () => +(await meta(db, "lastRun")) || null);
        return json({ ticks, lastRun });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
    return new Response("Not found", { status: 404 });
  },
};
