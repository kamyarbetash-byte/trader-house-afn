import { parsePage, parsePost, PARSER_VERSION, CITIES } from "./parse.js";
import PAGE from "./page.html";

const CHANNEL = "kabul_dollar";
const BACKFILL_DAYS = 45;
const UA = "Mozilla/5.0 (compatible; TraderHouseRates/1.0; +https://t.me/kabul_dollar)";

const meta = async (db, k) => (await db.prepare("SELECT v FROM meta WHERE k=?").bind(k).first("v")) ?? null;
const setMeta = (db, k, v) => db.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)").bind(k, String(v)).run();

function tickStmt(db, m) {
  const p = parsePost(m.text);
  return p ? db.prepare("INSERT OR REPLACE INTO ticks VALUES(?,?,?,?,?,?,?)").bind(m.id, m.ts, p.city, p.kind, p.buy, p.sell, p.price) : null;
}

// Store only messages not seen before (keeps daily writes low).
async function ingest(db, list) {
  if (!list.length) return 0;
  const ids = list.map(m => m.id);
  const seen = new Set((await db.prepare(`SELECT id FROM msgs WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results.map(r => r.id));
  const fresh = list.filter(m => !seen.has(m.id));
  if (!fresh.length) return 0;
  const stmts = [];
  for (const m of fresh) {
    stmts.push(db.prepare("INSERT OR IGNORE INTO msgs VALUES(?,?,?)").bind(m.id, m.ts, m.text));
    const t = tickStmt(db, m); if (t) stmts.push(t);
  }
  await db.batch(stmts);
  return fresh.length;
}

async function reparseIfNeeded(db) {
  if ((await meta(db, "parser")) === String(PARSER_VERSION)) return;
  const rows = (await db.prepare("SELECT id, ts, text FROM msgs").all()).results;
  const stmts = [db.prepare("DELETE FROM ticks")];
  for (const m of rows) { const t = tickStmt(db, m); if (t) stmts.push(t); }
  for (let i = 0; i < stmts.length; i += 500) await db.batch(stmts.slice(i, i + 500));
  await setMeta(db, "parser", PARSER_VERSION);
}

const bounds = db => db.prepare("SELECT MIN(id) AS minId, MAX(id) AS maxId, MIN(ts) AS minTs, COUNT(*) AS n FROM msgs").first();

async function fetchPage(before) {
  const url = `https://t.me/s/${CHANNEL}` + (before ? `?before=${before}` : "");
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fa,en;q=0.8" } });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
  return parsePage(await res.text(), CHANNEL);
}

async function collect(env) {
  const db = env.DB;
  await reparseIfNeeded(db);
  const before = await bounds(db);
  const latest = await fetchPage();
  await ingest(db, latest);

  // Fill a gap if more than one page of posts arrived since the last run.
  let low = latest.length ? Math.min(...latest.map(m => m.id)) : null;
  for (let i = 0; i < 6 && before.maxId && low && low - 1 > before.maxId; i++) {
    const page = await fetchPage(low);
    if (!page.length) break;
    await ingest(db, page);
    low = Math.min(...page.map(m => m.id));
  }

  // Walk back through history until BACKFILL_DAYS is covered.
  if ((await meta(db, "backfill")) !== "done") {
    const stopTs = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400;
    let b = await bounds(db);
    for (let i = 0; i < 12; i++) {
      if (!b.minId || b.minTs < stopTs) { await setMeta(db, "backfill", "done"); break; }
      const page = await fetchPage(b.minId);
      if (!page.length || Math.min(...page.map(m => m.id)) >= b.minId) { await setMeta(db, "backfill", "done"); break; }
      await ingest(db, page);
      b = await bounds(db);
    }
  }
  await setMeta(db, "lastRun", Math.floor(Date.now() / 1000));
}

async function summary(db) {
  const latest = (await db.prepare(`SELECT t.city, t.ts, t.price FROM ticks t
    JOIN (SELECT city, MAX(ts) AS m FROM ticks GROUP BY city) x ON x.city=t.city AND x.m=t.ts`).all()).results;
  const counts = (await db.prepare("SELECT city, COUNT(*) AS n FROM ticks GROUP BY city").all()).results;
  const b = await bounds(db);
  return { latest, counts, messages: b.n, since: b.minTs, backfillDone: (await meta(db, "backfill")) === "done", lastRun: +(await meta(db, "lastRun")) || null };
}

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=15", "access-control-allow-origin": "*" },
});

export default {
  async scheduled(_ev, env, ctx) {
    ctx.waitUntil((async () => {
      try { await setMeta(env.DB, "lastTick", Math.floor(Date.now() / 1000)); } catch (e) {}
      try { await collect(env); await setMeta(env.DB, "lastError", ""); }
      catch (e) { try { await setMeta(env.DB, "lastError", new Date().toISOString() + " " + (e && e.stack || e)); } catch (_) {} }
    })());
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ticks") {
      const city = url.searchParams.get("city") || "kabul";
      if (!CITIES.some(c => c.key === city)) return json({ error: "unknown city" }, 400);
      const since = +url.searchParams.get("since") || 0;
      const rows = (await env.DB.prepare("SELECT ts, price, kind FROM ticks WHERE city=? AND ts>=? ORDER BY ts").bind(city, since).all()).results;
      return json({ city, ticks: rows.map(r => [r.ts, r.price, r.kind === "deal" ? 1 : 0]) });
    }
    if (url.pathname === "/api/summary") return json(await summary(env.DB));
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    return new Response("Not found", { status: 404 });
  },
};
