// Parsing of Telegram web-preview pages and rate posts from @kabul_dollar.
export const PARSER_VERSION = 1;

export const CITIES = [
  { key: "kabul", fa: "کابل", words: ["کابل"] },
  { key: "mazar", fa: "مزارشریف", words: ["مزار", "بلخ"] },
  { key: "kandahar", fa: "کندهار", words: ["کندهار", "قندهار"] },
  { key: "jalalabad", fa: "ننگرهار", words: ["ننگرهار", "جلال"] },
  { key: "ghazni", fa: "غزنی", words: ["غزنی"] },
  { key: "herat", fa: "هرات", words: ["هرات"] },
  { key: "khost", fa: "خوست", words: ["خوست"] },
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
export function parsePost(raw) {
  const t = normalize(raw);
  const city = cityOf(t);
  if (!city) return null;
  const segs = t.split(/[\/\n|]+/).map(s => s.trim()).filter(Boolean);
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
