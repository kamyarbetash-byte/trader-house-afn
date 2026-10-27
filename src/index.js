import { DurableObject } from "cloudflare:workers";
import { parsePage, parsePost, PARSER_VERSION, CITIES } from "./parse.js";
import PAGE from "./page.html";

const CHANNEL = "kabul_dollar";
const BACKFILL_DAYS = 45;
const UA = "Mozilla/5.0 (compatible; TraderHouseRates/1.0; +https://t.me/kabul_dollar)";

export class RateStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY, ts INTEGER, text TEXT);
      CREATE TABLE IF NOT EXISTS ticks(id INTEGER PRIMARY KEY, ts INTEGER, city TEXT, kind TEXT, buy REAL, sell REAL, price REAL);
      CREATE INDEX IF NOT EXISTS ticks_city_ts ON ticks(city, ts);
      CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);`);
  }
  meta(k) { const r = this.sql.exec("SELECT v FROM meta WHERE k=?", k).toArray(); return r.length ? r[0].v : null; }
  setMeta(k, v) { this.sql.exec("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)", k, String(v)); }

  saveTick(m) {
    const p = parsePost(m.text);
    if (p) this.sql.exec("INSERT OR REPLACE INTO ticks VALUES(?,?,?,?,?,?,?)", m.id, m.ts, p.city, p.kind, p.buy, p.sell, p.price);
    else this.sql.exec("DELETE FROM ticks WHERE id=?", m.id);
  }
  ingest(list) {
    let added = 0;
    for (const m of list) {
      const had = this.sql.exec("SELECT 1 FROM msgs WHERE id=?", m.id).toArray().length;
      this.sql.exec("INSERT OR REPLACE INTO msgs VALUES(?,?,?)", m.id, m.ts, m.text);
      this.saveTick(m);
      if (!had) added++;
    }
    return added;
  }
  reparseIfNeeded() {
    if (this.meta("parser") === String(PARSER_VERSION)) return false;
    for (const m of this.sql.exec("SELECT id, ts, text FROM msgs").toArray()) this.saveTick(m);
    this.setMeta("parser", PARSER_VERSION);
    return true;
  }
  bounds() {
    const r = this.sql.exec("SELECT MIN(id) AS minId, MAX(id) AS maxId, MIN(ts) AS minTs, COUNT(*) AS n FROM msgs").one();
    return { ...r, backfillDone: this.meta("backfill") === "done" };
  }
  markBackfillDone() { this.setMeta("backfill", "done"); }
  ticks(city, since) {
    return this.sql.exec("SELECT ts, price, kind FROM ticks WHERE city=? AND ts>=? ORDER BY ts", city, since)
      .toArray().map(r => [r.ts, r.price, r.kind === "deal" ? 1 : 0]);
  }
  summary() {
    const rows = this.sql.exec(`SELECT t.city, t.ts, t.price FROM ticks t
      JOIN (SELECT city, MAX(ts) AS m FROM ticks GROUP BY city) x ON x.city=t.city AND x.m=t.ts`).toArray();
    const counts = this.sql.exec("SELECT city, COUNT(*) AS n FROM ticks GROUP BY city").toArray();
    const b = this.bounds();
    return { latest: rows, counts, messages: b.n, since: b.minTs, backfillDone: b.backfillDone, lastRun: +this.meta("lastRun") || null };
  }
  noteRun(t) { this.setMeta("lastRun", t); }
}

async function fetchPage(before) {
  const url = `https://t.me/s/${CHANNEL}` + (before ? `?before=${before}` : "");
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fa,en;q=0.8" } });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
  return parsePage(await res.text(), CHANNEL);
}

async function collect(env) {
  const store = env.STORE.get(env.STORE.idFromName("main"));
  await store.reparseIfNeeded();
  const before = await store.bounds();
  const latest = await fetchPage();
  await store.ingest(latest);

  // Fill a gap if more than one page of posts arrived since the last run.
  let low = latest.length ? Math.min(...latest.map(m => m.id)) : null;
  for (let i = 0; i < 6 && before.maxId && low && low - 1 > before.maxId; i++) {
    const page = await fetchPage(low);
    if (!page.length) break;
    await store.ingest(page);
    low = Math.min(...page.map(m => m.id));
  }

  // Walk back through history until BACKFILL_DAYS is covered.
  if (!before.backfillDone) {
    let b = await store.bounds();
    const stopTs = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400;
    for (let i = 0; i < 12; i++) {
      if (!b.minId || b.minTs < stopTs) { await store.markBackfillDone(); break; }
      const page = await fetchPage(b.minId);
      if (!page.length || Math.min(...page.map(m => m.id)) >= b.minId) { await store.markBackfillDone(); break; }
      await store.ingest(page);
      b = await store.bounds();
    }
  }
  await store.noteRun(Math.floor(Date.now() / 1000));
}

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=15", "access-control-allow-origin": "*" },
});

export default {
  async scheduled(_ev, env, ctx) { ctx.waitUntil(collect(env)); },

  async fetch(req, env) {
    const url = new URL(req.url);
    const store = env.STORE.get(env.STORE.idFromName("main"));
    if (url.pathname === "/api/ticks") {
      const city = url.searchParams.get("city") || "kabul";
      if (!CITIES.some(c => c.key === city)) return json({ error: "unknown city" }, 400);
      const since = +url.searchParams.get("since") || 0;
      return json({ city, ticks: await store.ticks(city, since) });
    }
    if (url.pathname === "/api/summary") return json(await store.summary());
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    return new Response("Not found", { status: 404 });
  },
};
