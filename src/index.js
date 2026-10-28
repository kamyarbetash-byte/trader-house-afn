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

// Cheap lookups only: MIN/MAX on the primary key read one row each.
const bounds = async db => {
  const r = await db.prepare("SELECT MIN(id) AS minId, MAX(id) AS maxId FROM msgs").first();
  const minTs = r.minId ? await db.prepare("SELECT ts FROM msgs WHERE id=?").bind(r.minId).first("ts") : null;
  return { minId: r.minId, maxId: r.maxId, minTs };
};

async function fetchPage(before) {
  const url = `https://t.me/s/${CHANNEL}` + (before ? `?before=${before}` : "");
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fa,en;q=0.8" } });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
  return parsePage(await res.text(), CHANNEL);
}
const minId = list => Math.min(...list.map(m => m.id));
const maxId = list => Math.max(...list.map(m => m.id));

async function collect(env) {
  const db = env.DB;
  await reparseIfNeeded(db);

  // cursor: every post up to this id has been read. gapTop/gapCeil: an unfinished catch-up.
  let cursor = +(await meta(db, "cursor")) || (await bounds(db)).maxId || 0;
  let gapTop = +(await meta(db, "gapTop")) || 0;
  let gapCeil = +(await meta(db, "gapCeil")) || 0;

  const latest = await fetchPage();
  if (!latest.length) return;
  await ingest(db, latest);
  const top = Math.max(maxId(latest), gapCeil);

  let low = gapTop || minId(latest), closed = !cursor || low - 1 <= cursor;
  for (let i = 0; i < 10 && !closed; i++) {
    const page = await fetchPage(low);
    if (!page.length || minId(page) >= low) { closed = true; break; }
    await ingest(db, page);
    low = minId(page);
    closed = low - 1 <= cursor;
  }
  if (closed) {
    if (cursor !== top) await setMeta(db, "cursor", top);
    if (gapTop) { await setMeta(db, "gapTop", 0); await setMeta(db, "gapCeil", 0); }
  } else {
    await setMeta(db, "gapTop", low);
    if (!gapCeil) await setMeta(db, "gapCeil", top);
  }

  // One-time history walk (already finished on the live site).
  if ((await meta(db, "backfill")) !== "done") {
    const stopTs = Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400;
    let b = await bounds(db);
    for (let i = 0; i < 10; i++) {
      if (!b.minId || b.minTs < stopTs) { await setMeta(db, "backfill", "done"); break; }
      const page = await fetchPage(b.minId);
      if (!page.length || minId(page) >= b.minId) { await setMeta(db, "backfill", "done"); break; }
      await ingest(db, page);
      b = await bounds(db);
    }
  }
  await setMeta(db, "lastRun", Math.floor(Date.now() / 1000));
}

// Latest price per city: one indexed row per city.
async function summary(db) {
  const latest = [];
  for (const c of CITIES) {
    const r = await db.prepare("SELECT ts, price FROM ticks WHERE city=? ORDER BY ts DESC LIMIT 1").bind(c.key).first();
    if (r) latest.push({ city: c.key, ts: r.ts, price: r.price });
  }
  return { latest, lastRun: +(await meta(db, "lastRun")) || null };
}

// Short in-memory cache so many viewers don't each re-read the database.
const memo = new Map();
async function cached(key, ttl, fn) {
  const hit = memo.get(key), now = Date.now();
  if (hit && now - hit.t < ttl) return hit.v;
  const v = await fn();
  memo.set(key, { t: now, v });
  return v;
}

const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=15", "access-control-allow-origin": "*" },
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
    if (url.pathname === "/api/ticks") {
      const city = url.searchParams.get("city") || "kabul";
      if (!CITIES.some(c => c.key === city)) return json({ error: "unknown city" }, 400);
      const since = +url.searchParams.get("since") || 0;
      const load = async () => (await env.DB.prepare("SELECT ts, price, kind FROM ticks WHERE city=? AND ts>=? ORDER BY ts").bind(city, since).all())
        .results.map(r => [r.ts, r.price, r.kind === "deal" ? 1 : 0]);
      const ticks = since ? await load() : await cached("all:" + city, 60000, load);
      return json({ city, ticks });
    }
    if (url.pathname === "/api/summary") return json(await cached("summary", 20000, () => summary(env.DB)));
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
    return new Response("Not found", { status: 404 });
  },
};
