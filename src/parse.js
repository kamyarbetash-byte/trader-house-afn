// Parsing of Telegram web-preview pages and USD/AFN rate posts.
export const PARSER_VERSION = 1;

export const CITIES = [
  { key: "kabul", fa: "کابل", words: ["کابل"] },
  { key: "mazar", fa: "مزارشریف", words: ["مزار", "بلخ"] },
  { key: "kandahar", fa: "کندهار", words: ["کندهار", "قندهار"] },
  { key: "jalalabad", fa: "ننگرهار", words: ["ننگرهار", "جلال"] },
  { key: "ghazni", fa: "غزنی", words: ["غزنی"] },
  { key: "herat", fa: "هرات", words: ["هرات"] },
  { key: "khost", fa: "خوست", words: ["خوست"] },
  // Gold series (not cities): world ounce in USD, Herat melted 18k in AFN per gram.
  { key: "xau", fa: "اونس طلا", words: [] },
  { key: "g18herat", fa: "طلای ۱۸ عیار هرات", words: [] },
];

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹", AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalize(s) {
  return String(s)
    .replace(/[ـ​-‏؜‪-‮⁦-⁩*]/g, "")
    .replace(/[ڪك]/g, "ک").replace(/[يۍېى]/g, "ی").replace(/ۀ/g, "ه")
    .replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d))
    .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d))
    .replace(/٫/g, ".");
}

const OTHER_PAIR = /(کلدار|چک|یورو|ایرو|euro|درهم|تومان|ریال|روپیه|لیر|پوند|کمیشن|کمیسیون)/i;
const isUsdAfn = seg => /دالر/.test(seg) && /افغان/.test(seg) && !OTHER_PAIR.test(seg);
// Rates are always written with decimals (65.03); whole numbers are amounts.
const rates = seg => (seg.match(/\d+\.\d+/g) || []).map(Number).filter(n => n >= 40 && n <= 130);

function cityOf(t) {
  let best = null, at = Infinity;
  for (const c of CITIES) for (const w of c.words) {
    const i = t.indexOf(w);
    if (i >= 0 && i < at) { at = i; best = c.key; }
  }
  return best;
}

// Returns {city, kind:'quote'|'deal', buy, sell, price} or null.
export function parsePost(raw, defaultCity = null) {
  const t = normalize(raw);
  const city = cityOf(t) || defaultCity;
  if (!city) return null;
  const segs = t.split(/[\/\n]+/).map(s => s.trim()).filter(Boolean);
  let nums = [];
  for (let i = 0; i < segs.length && !nums.length; i++) {
    if (!isUsdAfn(segs[i])) continue;
    nums = rates(segs[i]);
    for (let j = i + 1; j < segs.length && j <= i + 3 && nums.length < 2; j++) {
      if (OTHER_PAIR.test(segs[j]) || (/دالر|افغان/.test(segs[j]) && !/خرید|فروش/.test(segs[j]))) break;
      nums = nums.concat(rates(segs[j]));
    }
  }
  if (!nums.length) return null;
  const deal = /سودا\s*شد/.test(t);
  if (deal) return { city, kind: "deal", buy: null, sell: null, price: nums[0] };
  let [buy, sell] = nums;
  if (sell == null || Math.abs(sell - buy) > 2) sell = buy;
  return { city, kind: "quote", buy, sell, price: +((buy + sell) / 2).toFixed(4) };
}

function decode(s) {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
}

// Parse a t.me/s/<channel> HTML page into [{id, ts, text}].
export function parsePage(html, channel) {
  const out = [];
  const parts = html.split('class="tgme_widget_message_wrap');
  for (const p of parts.slice(1)) {
    const idm = p.match(new RegExp('data-post="' + channel + '/(\\d+)"', "i"));
    const tm = p.match(/<time[^>]*datetime="([^"]+)"/);
    const xm = p.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!idm || !tm) continue;
    const ts = Math.floor(Date.parse(tm[1]) / 1000);
    if (!isFinite(ts)) continue;
    out.push({ id: +idm[1], ts, text: xm ? decode(xm[1]).trim() : "" });
  }
  return out;
}

// A post may hold several markets, each under its own "#city" header (closing summaries of all
// bid markets, «آخرین معاملات تمام بولی های افغانستان»). Returns a list of quotes, one per market.
const SUMMARY_RE = /(پایان ساعت کاری|تمام بولی|اخیر بازار|اخیری|اخیري)/;
export function parseAll(raw, defaultCity = null) {
  const t = normalize(raw);
  const sections = t.split("#").map(x => x.trim()).filter(Boolean);
  const cityParts = sections.filter(x => cityOf(x.slice(0, 40)));
  if (cityParts.length >= 2) {
    const out = [], seen = new Set();
    for (const part of cityParts) {
      const c = cityOf(part.slice(0, 40));
      if (seen.has(c)) continue;
      const p = parsePost(part, c);
      if (p && p.city === c) { seen.add(c); out.push(p); }
    }
    if (out.length >= 2) return { quotes: out, summary: SUMMARY_RE.test(t) };
  }
  const p = parsePost(raw, defaultCity);
  return { quotes: p ? [p] : [], summary: false };
}

// Gold board posts (@herat_gold): "فی انس: 4023.80$" and "طلا 18 هرات: خرید: 6310؋ فروش: 6340؋"
// (3-hourly posts say "نرخ داخلی: خرید: 6310؋ فروش: 6340؋"). Returns {ounce, buy18, sell18} or null.
export function parseGold(raw) {
  const t = normalize(raw).replace(/,/g, "");
  const om = t.match(/انس\s*:?\s*(\d{3,5}(?:\.\d+)?)\s*\$/);
  const gm = t.match(/(?:طلا\s*18\s*هرات|نرخ داخلی)\s*:?\s*خرید\s*:?\s*(\d{3,6})\D{0,12}?فروش\s*:?\s*(\d{3,6})/);
  const ounce = om ? +om[1] : null;
  const buy18 = gm ? +gm[1] : null, sell18 = gm ? +gm[2] : null;
  const okO = ounce && ounce > 500 && ounce < 20000, okG = buy18 && sell18 && buy18 > 1000 && sell18 >= buy18 && sell18 - buy18 < buy18 * 0.05;
  if (!okO && !okG) return null;
  return { ounce: okO ? ounce : null, buy18: okG ? buy18 : null, sell18: okG ? sell18 : null };
}
