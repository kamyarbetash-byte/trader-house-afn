// Raahbar — USD/AFN live (single-file build)
// Parsing of Telegram web-preview pages and rate posts from @kabul_dollar.
const PARSER_VERSION = 1;

const CITIES = [
  { key: "kabul", fa: "کابل", words: ["کابل"] },
  { key: "mazar", fa: "مزارشریف", words: ["مزار", "بلخ"] },
  { key: "kandahar", fa: "کندهار", words: ["کندهار", "قندهار"] },
  { key: "jalalabad", fa: "ننگرهار", words: ["ننگرهار", "جلال"] },
  { key: "ghazni", fa: "غزنی", words: ["غزنی"] },
  { key: "herat", fa: "هرات", words: ["هرات"] },
  { key: "khost", fa: "خوست", words: ["خوست"] },
];

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹", AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalize(s) {
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
function parsePost(raw, defaultCity = null) {
  const t = normalize(raw);
  const city = cityOf(t) || defaultCity;
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
function parsePage(html, channel) {
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

const PAGE = "<!doctype html>\n<html lang=\"fa\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>نرخ زنده‌ی دالر به افغانی | راهبر</title>\n<link rel=\"icon\" type=\"image/png\" href=\"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwQDAwQEBAQFBQQFBwsHBwYGBw4KCggLEA4RERAOEA8SFBoWEhMYEw8QFh8XGBsbHR0dERYgIh8cIhocHRz/2wBDAQUFBQcGBw0HBw0cEhASHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBz/wAARCABwAHADASIAAhEBAxEB/8QAHQAAAQQDAQEAAAAAAAAAAAAAAwIEBQcBBggACf/EADwQAAIBAwIFAgQDBAgHAAAAAAECAwAEEQUhBgcSMUFRYRMicYEIFKEVMlKRIzdidHWxssEXcoKS0dLw/8QAGwEAAQUBAQAAAAAAAAAAAAAAAQACBAUGAwf/xAAxEQABAwICBwcEAwEAAAAAAAABAAIRAwQFIRITMUFRYaEGFCJxscHwcoGR4TI0NcL/2gAMAwEAAhEDEQA/AOIVo0cgBpAjI38UQLkbCuBXVOAQwobAYrKxH1rzKo8ZoIpq7b1gtgUtkBGwwaF0s5CAEsTgADJJ9KIQSN858UpTirP4e/D3x7xDBHONLhsIJBlTqE4iYj16MFh9wKd69+G7j/QrR7mPTrbU4kGWGnTiSQD/AJCAx+wNQDitkH6s1mz5hSO6V9HS0DHkqp79qHITWWEkbOjKyspKsGGCCO4I8UqC2nupY4oY3lmlYKkcalmYnwANyfpVhzUdN+nIppIMZFb3r/K7jDhTQU1zWuH7zT9MkkWFZboKhLsCVHRnqGcHuK0hwAGPmm0q1OqNKm4EcjKTmluThCaAsjBh3FSVvMJkBHeo0nNFs2KS9Phq6kJoKmFYsTWY5GaToA7UtCASD/KvRqfilq5py9K7q+M4FDuGKKMMd6JOruw6c4FKttNu9UuoLS0gknupmCRxRjLMfQUpAEnJKCTAQktbi7eCC2SSa4mYIkca9TOx7AAdzXWPJjktDwj8HW9djSfiBhmKI4ZLL6eDJ6t47D1rPKflVbcGQx6hqAjuNekXBcbpbA91T39W89ht3uG27isBj2PmtNtbHw7zx5Dl6+W3S4fhmqirWHi3Dh+/RS9vUnB4qneavOLT+W1gbaD4d3xFcJmC1z8sQPaST0X0HdvpvR+SvOyy5i20em6iYrTiaJMtCNkulHd4/f1TuO4yO2bdhd0bbvYZ4PmccOanm6pa3Uz4vnVNed3IC249in17QI47bihF6pI9ljvwB2bwJPRvPY+CJ38P3Jiz5daBbarqNorcWX0YeeSQAtaKdxCn8JA/eI3JyOwFWzD4p5H4pj8Yu3Wnci7wdY4Tw5ey59zpCtrgM/mfmqF/GIVHKW2UkBm1a3x74SQ1wNNnON66h/FzzGXX+JLThCzEgtdDYyXTMpX4ly6gADPdVQ9+xLHHauapAOkr2969I7LWz7fDmCoILpP2Ozpms5idQVLglu7JRgHzVkkowYeDWWXpPf7ivE5BrRquWyRoBuTXpZY4e57+PNCll6VIGPvSNN06+4g1KKxsYDLcSnbwFA7knwB5NcSQ0FzjAC6gEkNaJJR7CO81jUYLDTrZ7i7nPTHGNyf/AAB5J7V2xyI5KaHpXD8l/fO8/ERcxzzxNhY1IBCICNh3ye5x6bVW/L3gWx4Nsv6PE+ozAfHuiN2/sr6KPTz3NXLwfxA+g3jMwL2sw6ZUHf2I9xXn/aDGH3TTQtjDerv1y/K1NhhmoGsqfz9P2tq1Hhu1sVJgeUEfxEH/AGqnObnNn/h1psVvYwGXWr1WEDyIfgwgbFyezEZ2X7nbvdtxrem60s406/trpoWKSpDKGeJv4WUHKn2NUPzt0BNd4U1KKSL+mt0NxCxX9x0Gf1GR96ocKFM3TBdCWzmPm5TbjWOou1Rzhc58I8I8T83eK5LPTviXuqXBM91eXDnojUneSR8bDwANz2ArqLh78I2g6KttdajxFrE2qwMsiTaey2qxONwUOGbY+Sa3H8LvBdtwtyl0u/Ea/tDXh+fuJMblSSIlz6BADj1Y+tW1cozAkKxHsKtMb7R3BuHW9q7QY3LLfGR+3ADcquyw+noCpVEk5rXnu59PgjjEpmaNQpllALOQO5xgZPsBUHfcaalaA/DW329Yyf8AepjUo33+R/8AtNaBrd1bxXVtaTXVvDc3kohgjmmWMyOxwFHURk1naLBUOyVdCAJK1njDgNuflxPBcrZ2Osafas9tqUcJBzkBYpd/mjJJ917jyDxrxhw3q3BWt3ei65ZyWeo2pw8b9iPDK3ZlPcEbGvp9wdwvHwzYurEPe3DdU7jtkdlHsN/uTWv83+TWh839B/KX6i21W2BNlqSLl4G9D/Eh8r9xg1ocF7S9yqairnS6t5jly+44GoxHD215qUsneq+X/wAUNse1e2Pati454E1jl5xLeaBrlusV9bYOUbqSRDurqfKkbjsfvWtqCrYr06nUZUYHsMg5grLOBaYcpWTLg47DzSbK9u7K/insZ5ILmI9SyxnBX/70r0823SowTsAKH8X8og6Rljvv5NKARBTpIMhW9pHOnWNPtlW/srO8ZRvL1GEn6gZH+VNuIOenEGqWz2unm20xHGGe2YtLj2c9vqBmqflkec9TuzuT2I2FFigUl1J7AHIquGD2QfrNWJ6fjZ0Ut2JXLm6BeY+b9qMs8trO8sc0sc7HJdXKsSfcb0eLU764kCPfXThu4aZiD9cmmUkbL8rEkAbH2o+mRM8pc5AQY38mrEtbtKhgncvoHwdxHqb8tOBuHtAuY7K6OjWz3epNEJDbKyfKkaHZpCN8t8qjBwSQKb8weVGjW3L3ifXbjUeItQ1qz0+a4iu7vWJywkVSQehWVAM+AMVC8lpGm4Y0VmOT+ViGfYKAP0Aq1OZ39UXGf+E3H+g15HUrvoX+hSOjL842mXbztjlsWvdQb3cF2Zj2XzdvNb1UBj+078jGQTdSf+1QctxLcOZZpXkk/jkYsf5mpa7XrRhjuPc1Brs+D4PmvXGNaNgWQcSr34E/FPzD4UsorKaa01uxiHSn7URmkVR4EqkMf+rNT3EX4wuP9UtHt9OttI0csMGe3iaWVfoZCVH8q5vkkckhiQOn5VXahr8QYPUwycd6rXYHh76mtdRbPl7bOikC9rhugHmE+1XUbzVtQuL/AFG7mu7y5cvLcTuXkdj5LHc0ycY7dxWZCfmVu+d6wGBX6bVaAAAAKMTJUvDafDU5yzHfbYChNbKj5Jwe3Uxzn706D4b5v0pZw+SB/OmSU6Ex/Zys2Q/SD/arPwobfZp1+i7k0dos5GEwaE8EaAZ+w7UZShCzHK/UVYY8k08tI8xrgnoySM7ZoMdoZ8Fvlj/U0+2UADIAG2KBKQXZPJPbhbRf7tH/AJVa3M7+qHjP/Cbj/Qaqjkkc8K6L/do/8qtTmpKkPJ7jR3YKv7JnGSfJXA/UivH7n/SH1/8AS2lT+sPp9l83ZgPuagp1KTMCMVPydQGdxjv3qIvIiJifJ7V7C0rFFKZEmROo4Pg9qG0JiIYlmA7bV6EjpKMoZSf1pZhbf4bsMeCaKCayEn60hTjNEeNxuw/maEOxpwQU+wIOSfalq69XSe/pSG3IGwA2wKGO5wDuc7VzT04Mg3AXf3oYiDP1Sb47DFZRWwDsPel5Cjzj27UEUQtnbf6GsFSe5796wr7ZOAPAoUtx1AhT980ISXZnJueGy4O0ee5mjggS1QtLMwRQMdyTtWkfiF596fxHpB4O4Yn/ADFg7q1/fJsk3ScrFGfK5AJbscADbJrmV7qeZEieWWSJP3Udyyj6AnArysGPzZrPW3ZyjTuzd1XaRmQIgA+8K0uMUdVpCkwQIhOeoMpwN6YXWGQ7binySKMj1prdBQCT6VogqopnDIPIyB+lOTiRTgfemEb4296dhsqcd6cQgEG4SQkAAkUkwBUA2J7k0WRukY6tqC0nUO+wohBSGSwxnbvmjK2AMAE57U0Rwx+tHO236UE5FVw2x71hmIBx39qEzdjSTL69x5oQlKRcyMfkHn0obAxMqn0zmnMSh2DkZx2ok9us6jOzDsaUwlCaNdpBgd/pQWv1Y7KQKMbEknqcfYUOSxUDanCEIKw10QNqbSStIdzXnjYHA70PHQdxv70Qglk9OPenEJBFMiSxpzA2NqJCQS5RtvTdiBtTiQimrtk0gkV//9k=\">\n<meta name=\"description\" content=\"چارت کندل‌استیک زنده‌ی نرخ دالر به افغانی در کابل، مزارشریف، هرات و قندهار، با میانگین بازار و ابزار تحلیل — راهبر (Raahbar)\">\n<meta property=\"og:title\" content=\"نرخ زنده‌ی دالر به افغانی — راهبر\">\n<meta property=\"og:description\" content=\"اولین چارت کندل‌استیک زنده‌ی بازار ارز افغانستان، به تفکیک ولایت، با ابزار تحلیل\">\n<meta name=\"theme-color\" content=\"#0E1220\">\n<script>try{var t=JSON.parse(localStorage.getItem(\"th-theme\"));if(t===\"dark\"||t===\"light\")document.documentElement.setAttribute(\"data-theme\",t)}catch(e){}</script>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=swap\">\n<style>\n/* Layout: trading desk — brand bar, market-average panel beside four city panels, selected-series header, tool rows, chart with RSI pane */\n:root{\n  --bg:#F3F1EC; --surface:#FFFFFF; --ink:#151A26; --muted:#5D6475; --line:#E2DED4;\n  --gold:#A57C12; --gold-soft:#F4E8C6; --up:#138A63; --down:#C93A52; --grid:#ECE8DF;\n  --ind1:#A57C12; --ind2:#3B6FD8; --ind3:#8A5CC7;\n  --f-display:\"Lalezar\",\"Vazirmatn\",system-ui,sans-serif;\n  --f-body:\"Vazirmatn\",Tahoma,system-ui,sans-serif;\n  --f-mono:\"JetBrains Mono\",ui-monospace,Menlo,monospace;\n  color-scheme:light;\n}\n@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){\n  --bg:#0E1220; --surface:#151B2D; --ink:#EDEBE4; --muted:#9AA2B5; --line:#252D44;\n  --gold:#E2B847; --gold-soft:#2A2614; --up:#2BC08F; --down:#F0607A; --grid:#1C2338;\n  --ind1:#E2B847; --ind2:#6EA0FF; --ind3:#C49BFF; color-scheme:dark}}\n:root[data-theme=\"dark\"]{\n  --bg:#0E1220; --surface:#151B2D; --ink:#EDEBE4; --muted:#9AA2B5; --line:#252D44;\n  --gold:#E2B847; --gold-soft:#2A2614; --up:#2BC08F; --down:#F0607A; --grid:#1C2338;\n  --ind1:#E2B847; --ind2:#6EA0FF; --ind3:#C49BFF; color-scheme:dark}\n*{box-sizing:border-box}\n[hidden]{display:none!important}\nhtml,body{margin:0}\nbody{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.6;\n  padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\n.wrap{max-width:1120px;margin:0 auto;padding-block:18px 40px;\n  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));\n  display:flex;flex-direction:column;gap:14px}\n.brand{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.logo{display:flex;align-items:center;gap:10px}\n.logo img{width:46px;height:46px;flex:none;display:block;border-radius:11px;box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 35%,transparent)}\n.logo b{font-family:var(--f-mono);font-size:16px;letter-spacing:.14em;color:var(--gold)}\n.logo small{display:block;font-size:12px;color:var(--muted)}\n.live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 12px;background:var(--surface)}\n.live i{width:8px;height:8px;border-radius:50%;background:var(--up);animation:pulse 2s infinite}\n.live.stale i{background:var(--muted);animation:none}\n@keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--up) 60%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}\n@media (prefers-reduced-motion:reduce){.live i{animation:none}}\n\n/* Panels */\n.panels{display:grid;grid-template-columns:1.35fr repeat(4,minmax(0,1fr));gap:10px}\n.card{font:inherit;color:inherit;text-align:right;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px 8px;cursor:pointer;display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}\n.card[aria-pressed=\"true\"]{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}\n.card .top{display:flex;justify-content:space-between;align-items:baseline;gap:6px}\n.card .n{font-weight:700;font-size:14px;white-space:nowrap}\n.card .tm{font-family:var(--f-mono);font-size:11px;color:var(--muted);direction:ltr}\n.card .p{font-family:var(--f-mono);font-weight:700;font-size:20px;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;line-height:1.25}\n.card .row{display:flex;justify-content:space-between;flex-wrap:wrap;gap:0 8px;font-family:var(--f-mono);font-size:11.5px;direction:ltr}\n.card .row span{white-space:nowrap}\n.up{color:var(--up)} .down{color:var(--down)} .flat{color:var(--muted)}\n.card canvas{width:100%;height:34px;display:block;margin-top:4px}\n.card.avg{background:linear-gradient(160deg,var(--gold-soft),var(--surface) 70%);border-color:color-mix(in srgb,var(--gold) 45%,var(--line))}\n.card.avg .n{color:var(--gold);font-family:var(--f-display);font-weight:400;font-size:18px}\n.card.avg .p{font-size:26px}\n.card .sub{font-size:11.5px;color:var(--muted)}\n.card .wait{font-size:12.5px;color:var(--muted);padding-block:6px}\n.others{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted)}\n.chip{display:inline-flex;align-items:center;gap:6px;font:500 13px var(--f-body);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:3px 12px;cursor:pointer}\n.chip b{font-family:var(--f-mono);direction:ltr}\n.chip[aria-pressed=\"true\"]{border-color:var(--gold);color:var(--gold)}\n\n.hero{display:grid;grid-template-columns:1fr auto;gap:10px 20px;align-items:end}\n.pair{font-family:var(--f-display);font-weight:400;font-size:clamp(26px,5.5vw,40px);line-height:1.1;margin:0;text-wrap:balance}\n.pair span{color:var(--gold)}\n.subt{color:var(--muted);font-size:13px;margin:4px 0 0}\n.price{direction:ltr;text-align:left}\n.now{font-family:var(--f-mono);font-weight:700;font-size:clamp(30px,7vw,46px);line-height:1;font-variant-numeric:tabular-nums}\n.unit{font-size:14px;color:var(--muted);margin-left:6px}\n.chg{display:inline-block;margin-top:6px;font-family:var(--f-mono);font-size:14px;padding:2px 10px;border-radius:6px;background:var(--grid)}\n.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);border-radius:12px;background:var(--surface);margin:0}\n.stat{padding:8px 14px;border-inline-start:1px solid var(--line);min-width:0}\n.stat:first-child{border-inline-start:0}\n.stat dt{font-size:12px;color:var(--muted)}\n.stat dd{margin:0;font-family:var(--f-mono);font-weight:700;font-size:16px;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\n/* Tool rows */\n.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;background:var(--surface);max-width:100%;overflow-x:auto;scrollbar-width:none}\n.seg::-webkit-scrollbar{display:none}\n.seg button{font:500 13.5px var(--f-body);color:var(--muted);background:none;border:0;padding:6px 12px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}\n.seg button+button{border-inline-start:1px solid var(--line)}\n.seg button[aria-pressed=\"true\"]{background:var(--gold-soft);color:var(--gold);font-weight:700}\n.seg button:disabled{opacity:.4;cursor:default}\n.seg svg{width:18px;height:18px;flex:none}\n.lbl{font-size:12px;color:var(--muted);margin-inline-end:2px}\n.spacer{flex:1}\nbutton:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n.tools .t{padding:6px 10px}\n@media (max-width:720px){.tools .t span{display:none}}\n\n.chartbox{position:relative;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden}\n#chart{direction:ltr;height:min(62vh,540px);min-height:340px;width:100%}\n#ov{position:absolute;left:0;top:0;pointer-events:none;touch-action:none}\n#ov.on{pointer-events:auto;cursor:crosshair}\n#rsiBox{direction:ltr;border-top:1px solid var(--line);position:relative}\n#rsi{height:130px;width:100%}\n.paneTag{position:absolute;top:4px;left:10px;font-family:var(--f-mono);font-size:11px;color:var(--muted);z-index:2;pointer-events:none}\n.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:24px;color:var(--muted);background:var(--surface);z-index:3}\n.empty strong{font-family:var(--f-display);font-weight:400;font-size:24px;color:var(--ink)}\n.watermark{position:absolute;bottom:34px;left:18px;font-family:var(--f-mono);font-size:12px;letter-spacing:.12em;color:var(--muted);opacity:.5;pointer-events:none;direction:ltr}\n.hint{position:absolute;top:8px;right:50%;transform:translateX(50%);background:var(--ink);color:var(--bg);font-size:12.5px;padding:4px 12px;border-radius:999px;z-index:4;pointer-events:none;white-space:nowrap}\n.legend{position:absolute;top:6px;left:10px;font-family:var(--f-mono);font-size:11.5px;color:var(--muted);z-index:2;pointer-events:none;direction:ltr;display:flex;gap:10px;flex-wrap:wrap}\n.legend i{display:inline-block;width:10px;height:2px;vertical-align:middle;margin-right:4px}\n.hdr-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.themeBtn{display:inline-flex;align-items:center;gap:6px;font:500 13px var(--f-body);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer}\n.themeBtn svg{width:16px;height:16px}\n.themeBtn .sun{display:none}\n.is-dark .themeBtn .sun{display:inline}.is-dark .themeBtn .moon{display:none}\n/* News */\n.news{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:10px}\n.news h2{margin:0;font-family:var(--f-display);font-weight:400;font-size:22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.news h2 small{font-family:var(--f-body);font-size:12.5px;color:var(--muted)}\n.auction{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--gold-soft);border-radius:10px;padding:8px 12px;font-size:14px}\n.auction b{color:var(--gold)}\n.nlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}\n.nlist li{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line);min-width:0}\n.nlist li:first-child{border-top:0}\n.nsrc{font-size:11.5px;color:var(--gold);border:1px solid color-mix(in srgb,var(--gold) 40%,var(--line));border-radius:999px;padding:0 8px;white-space:nowrap}\n.nlist a{color:var(--ink);text-decoration:none;min-width:0;overflow-wrap:anywhere}\n.nlist a:hover{color:var(--gold);text-decoration:underline}\n.ntime{font-size:12px;color:var(--muted);white-space:nowrap}\n.nempty{color:var(--muted);font-size:13.5px;margin:0}\n@media (max-width:640px){.nlist li{grid-template-columns:auto 1fr}.ntime{grid-column:2}}\n.note{font-size:13px;color:var(--muted);margin:0;max-width:78ch}\n.note a,footer a{color:var(--gold)}\nfooter{font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px}\n@media (max-width:900px){.panels{grid-template-columns:repeat(2,minmax(0,1fr))}.card.avg{grid-column:1/-1}}\n@media (max-width:640px){\n  .hero{grid-template-columns:1fr}.price{text-align:right}\n  .stats{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .stat:nth-child(3){border-inline-start:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}\n  .spacer{display:none}\n}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <header class=\"brand\">\n    <div class=\"logo\">\n      <img src=\"data:image/jpeg;base64,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\" alt=\"\" width=\"44\" height=\"44\">\n      <div><b>RAAHBAR</b><small>راهبر · چارت زنده‌ی بازار ارز افغانستان</small></div>\n    </div>\n    <div class=\"hdr-r\">\n      <span class=\"live stale\" id=\"live\"><i></i><span id=\"updated\">در حال بارگذاری…</span></span>\n      <button type=\"button\" class=\"themeBtn\" id=\"themeBtn\" title=\"حالت روز / شب\" aria-label=\"تغییر حالت روز و شب\">\n        <svg class=\"moon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z\"/></svg>\n        <svg class=\"sun\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/></svg>\n        <span id=\"themeLbl\">حالت شب</span>\n      </button>\n    </div>\n  </header>\n\n  <section class=\"panels\" id=\"panels\" aria-label=\"نرخ ولایات\"></section>\n  <div class=\"others\" id=\"others\" hidden></div>\n\n  <section class=\"hero\">\n    <div>\n      <h1 class=\"pair\">دالر <span>/</span> افغانی</h1>\n      <p class=\"subt\" id=\"subt\">—</p>\n    </div>\n    <div class=\"price\">\n      <div><span class=\"now\" id=\"now\">—</span><span class=\"unit\">AFN</span></div>\n      <span class=\"chg\" id=\"chg\">—</span>\n    </div>\n  </section>\n\n  <dl class=\"stats\">\n    <div class=\"stat\"><dt>بلندترین امروز</dt><dd id=\"hi\">—</dd></div>\n    <div class=\"stat\"><dt>پایین‌ترین امروز</dt><dd id=\"lo\">—</dd></div>\n    <div class=\"stat\"><dt>بسته‌شدن دیروز</dt><dd id=\"prev\">—</dd></div>\n    <div class=\"stat\"><dt>نرخ‌های امروز</dt><dd id=\"count\">—</dd></div>\n  </dl>\n\n  <div class=\"bar\">\n    <div class=\"seg\" role=\"group\" aria-label=\"تایم‌فریم\" id=\"tfs\">\n      <button type=\"button\" data-tf=\"300\">۵ دقیقه</button>\n      <button type=\"button\" data-tf=\"900\">۱۵ دقیقه</button>\n      <button type=\"button\" data-tf=\"3600\">۱ ساعت</button>\n      <button type=\"button\" data-tf=\"14400\">۴ ساعت</button>\n      <button type=\"button\" data-tf=\"86400\">روزانه</button>\n    </div>\n    <span class=\"spacer\"></span>\n    <div class=\"seg\" role=\"group\" aria-label=\"اندیکاتورها\" id=\"inds\">\n      <button type=\"button\" data-ind=\"ma20\">MA 20</button>\n      <button type=\"button\" data-ind=\"ma50\">MA 50</button>\n      <button type=\"button\" data-ind=\"bb\">بولینگر</button>\n      <button type=\"button\" data-ind=\"rsi\">RSI</button>\n      <button type=\"button\" data-ind=\"deals\" id=\"dealsBtn\">فقط معاملات</button>\n    </div>\n  </div>\n\n  <div class=\"bar\">\n    <div class=\"seg tools\" role=\"group\" aria-label=\"ابزار ترسیم\" id=\"tools\">\n      <button type=\"button\" class=\"t\" data-tool=\"cursor\" title=\"اشاره‌گر و انتخاب\" aria-label=\"اشاره‌گر\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M5 3l14 8-6 2-2 6z\"/></svg><span>اشاره‌گر</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"trend\" title=\"خط روند\" aria-label=\"خط روند\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 19L20 5\"/><circle cx=\"4\" cy=\"19\" r=\"2\" fill=\"currentColor\"/><circle cx=\"20\" cy=\"5\" r=\"2\" fill=\"currentColor\"/></svg><span>خط روند</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"ray\" title=\"خط امتداددار\" aria-label=\"خط امتداددار\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 18L22 7\"/><circle cx=\"4\" cy=\"18\" r=\"2\" fill=\"currentColor\"/><path d=\"M18 5l4 2-2 4\"/></svg><span>امتداددار</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"hline\" title=\"خط افقی (حمایت/مقاومت)\" aria-label=\"خط افقی\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M2 12h20\"/><circle cx=\"12\" cy=\"12\" r=\"2\" fill=\"currentColor\"/></svg><span>افقی</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"vline\" title=\"خط عمودی\" aria-label=\"خط عمودی\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M12 2v20\"/><circle cx=\"12\" cy=\"12\" r=\"2\" fill=\"currentColor\"/></svg><span>عمودی</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"rect\" title=\"مستطیل (ناحیه)\" aria-label=\"مستطیل\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><rect x=\"4\" y=\"6\" width=\"16\" height=\"12\" rx=\"1\"/></svg><span>مستطیل</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"fib\" title=\"فیبوناچی اصلاحی\" aria-label=\"فیبوناچی\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\"><path d=\"M3 4h18M3 9h18M3 13h18M3 20h18\"/><path d=\"M5 20L19 4\" stroke-dasharray=\"2 2\"/></svg><span>فیبوناچی</span></button>\n      <button type=\"button\" class=\"t\" data-tool=\"measure\" title=\"اندازه‌گیری تغییر قیمت\" aria-label=\"اندازه‌گیری\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4\"/></svg><span>اندازه‌گیری</span></button>\n    </div>\n    <div class=\"seg\" role=\"group\" aria-label=\"ویرایش ترسیم‌ها\">\n      <button type=\"button\" id=\"undoBtn\" title=\"برگشت آخرین ترسیم\" aria-label=\"برگشت\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M9 7L4 12l5 5\"/><path d=\"M4 12h10a6 6 0 010 12\" transform=\"translate(0 -6)\"/></svg></button>\n      <button type=\"button\" id=\"delBtn\" title=\"حذف ترسیمِ انتخاب‌شده\" aria-label=\"حذف انتخاب‌شده\" disabled><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3\"/></svg></button>\n      <button type=\"button\" id=\"clearBtn\" title=\"پاک کردن همه‌ی ترسیم‌ها\" aria-label=\"پاک کردن همه\">پاک کردن همه</button>\n    </div>\n  </div>\n\n  <div class=\"chartbox\" id=\"box\">\n    <div style=\"position:relative\">\n      <div id=\"chart\"></div>\n      <canvas id=\"ov\"></canvas>\n      <div class=\"legend\" id=\"legend\"></div>\n      <div class=\"hint\" id=\"hint\" hidden></div>\n      <div class=\"watermark\">RAAHBAR · USD/AFN</div>\n    </div>\n    <div id=\"rsiBox\" hidden><span class=\"paneTag\">RSI 14</span><div id=\"rsi\"></div></div>\n    <div class=\"empty\" id=\"empty\"><strong>در حال بارگذاری نرخ‌ها</strong><span id=\"emptyMsg\">چند لحظه صبر کنید.</span></div>\n  </div>\n\n  <section class=\"news\" aria-labelledby=\"newsH\">\n    <h2 id=\"newsH\">د افغانستان بانک و اخبار ارز <small>لیلام دالر، تصمیم‌های بانک مرکزی و خبرهای افغانی</small></h2>\n    <div class=\"auction\" id=\"auction\" hidden></div>\n    <ul class=\"nlist\" id=\"nlist\"></ul>\n    <p class=\"nempty\" id=\"nempty\">خبرهای د افغانستان بانک و افغانی از رسانه‌های افغانستان (Bing News، آمو، آریانا نیوز، کابل‌نو، هشت صبح) و کانال‌های صرافی جمع می‌شوند و هر ۳۰ دقیقه به‌روز می‌شوند.</p>\n  </section>\n\n  <p class=\"note\">هر کندل از نرخ‌های اعلام‌شده و معاملات انجام‌شده در همان بازه ساخته می‌شود (میانه‌ی خرید و فروش). «میانگین بازار» میانگین آخرین نرخ کابل، مزارشریف، هرات و قندهار است (نرخ‌های قدیمی‌تر از ۶ ساعت حساب نمی‌شوند). ترسیم‌های شما فقط در همین مرورگر ذخیره می‌شوند. صفحه هر ۳۰ ثانیه خودکار به‌روز می‌شود. منبع اخبار: Bing News و رسانه‌های افغانستان. منبع نرخ‌ها: کانال‌های تلگرام <a href=\"https://t.me/kabul_dollar\" target=\"_blank\" rel=\"noopener\">@kabul_dollar</a> و <a href=\"https://t.me/Mazar_Nerkh\" target=\"_blank\" rel=\"noopener\">@Mazar_Nerkh</a>.</p>\n\n  <footer><span>تحلیل و چارت: راهبر · Raahbar</span><span id=\"foot\">—</span></footer>\n</div>\n\n<script src=\"https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js\"></script>\n<script>\n(function(){\n  /* ---------- config ---------- */\n  const MAIN=[[\"kabul\",\"کابل\",\"سرای شهزاده‌ی کابل\"],[\"mazar\",\"مزارشریف\",\"بازار مزارشریف\"],[\"herat\",\"هرات\",\"بازار هرات\"],[\"kandahar\",\"قندهار\",\"بازار قندهار\"]];\n  const OTHER=[[\"jalalabad\",\"ننگرهار\"],[\"ghazni\",\"غزنی\"],[\"khost\",\"خوست\"]];\n  const NAMES=Object.fromEntries([...MAIN.map(m=>[m[0],m[1]]),...OTHER,[\"avg\",\"میانگین بازار\"]]);\n  const KABUL=16200, STALE=6*3600;\n  const $=id=>document.getElementById(id);\n  const en=n=>Number(n).toFixed(2);\n  const fa=n=>Number(n).toLocaleString('fa-IR');\n  const tfmt=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Kabul',hour:'2-digit',minute:'2-digit'});\n  const dfmt=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Kabul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});\n  const dayKey=t=>Math.floor((t+KABUL)/86400);\n  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};\n\n  /* ---------- state ---------- */\n  let raf=0;function schedule(){if(!raf)raf=requestAnimationFrame(draw)}\n  const raw={};        // city -> [[ts,price,deal]]\n  const seen={};       // city -> Set of \"ts|price\"\n  let series={};       // key -> cleaned ticks, incl. avg\n  let lastRun=null, loaded=false, failed=false;\n  let sel=store.get('th-sel','avg'), tf=store.get('th-tf',3600);\n  const ind=Object.assign({ma20:false,ma50:false,bb:false,rsi:false,deals:false},store.get('th-ind',{}));\n  if(!NAMES[sel])sel='avg';\n\n  function addTicks(city,list){\n    const r=raw[city]||(raw[city]=[]), s=seen[city]||(seen[city]=new Set());\n    let added=false;\n    for(const x of list){const k=x[0]+'|'+x[1];if(s.has(k))continue;s.add(k);r.push(x);added=true}\n    if(added)r.sort((a,b)=>a[0]-b[0]);\n    return added;\n  }\n  // Drop single bad prints: more than 1.2% away from the median of the last 9 accepted ticks.\n  function clean(t){\n    const out=[],win=[];\n    for(const x of t){\n      if(win.length>=5){const s=[...win].sort((a,b)=>a-b),m=s[s.length>>1];if(Math.abs(x[1]-m)/m>0.012)continue}\n      out.push(x);win.push(x[1]);if(win.length>9)win.shift();\n    }\n    return out;\n  }\n  function buildAvg(){\n    const ev=[];\n    for(const [k] of MAIN)for(const x of series[k]||[])ev.push([x[0],k,x[1]]);\n    ev.sort((a,b)=>a[0]-b[0]);\n    const last={},out=[];\n    for(const [t,k,p] of ev){\n      last[k]=[t,p];let s=0,n=0;\n      for(const kk in last)if(t-last[kk][0]<=STALE){s+=last[kk][1];n++}\n      out.push([t,+(s/n).toFixed(3),0,n]);\n    }\n    return out;\n  }\n  function recompute(){\n    series={};\n    for(const c in raw)series[c]=clean(raw[c]);\n    series.avg=buildAvg();\n  }\n\n  /* ---------- chart ---------- */\n  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();\n  let chart,candles,ma20s,ma50s,bbU,bbM,bbL,rsiChart,rsiS,bars=[];\n  function theme(){return{layout:{background:{type:'solid',color:css('--surface')},textColor:css('--muted'),fontFamily:'JetBrains Mono, monospace'},\n    grid:{vertLines:{color:css('--grid')},horzLines:{color:css('--grid')}},rightPriceScale:{borderColor:css('--line'),minimumWidth:66},\n    timeScale:{borderColor:css('--line'),timeVisible:true,secondsVisible:false},crosshair:{mode:0}}}\n  function colors(){const u=css('--up'),d=css('--down');return{upColor:u,downColor:d,wickUpColor:u,wickDownColor:d,borderVisible:false}}\n  const lineOpt=(c,extra)=>Object.assign({color:c,lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},extra||{});\n  function retheme(){\n    if(!chart)return;\n    chart.applyOptions(theme());candles.applyOptions(colors());\n    ma20s.applyOptions({color:css('--ind1')});ma50s.applyOptions({color:css('--ind2')});\n    [bbU,bbM,bbL].forEach(s=>s.applyOptions({color:css('--ind3')}));\n    rsiChart.applyOptions(theme());rsiS.applyOptions({color:css('--ind3')});\n    schedule();\n  }\n  if(window.LightweightCharts){\n    chart=LightweightCharts.createChart($('chart'),Object.assign({autoSize:true},theme()));\n    candles=chart.addCandlestickSeries(Object.assign({priceFormat:{type:'price',precision:2,minMove:0.01}},colors()));\n    ma20s=chart.addLineSeries(lineOpt(css('--ind1')));\n    ma50s=chart.addLineSeries(lineOpt(css('--ind2')));\n    bbU=chart.addLineSeries(lineOpt(css('--ind3'),{lineWidth:1,lineStyle:2}));\n    bbM=chart.addLineSeries(lineOpt(css('--ind3'),{lineWidth:1}));\n    bbL=chart.addLineSeries(lineOpt(css('--ind3'),{lineWidth:1,lineStyle:2}));\n    rsiChart=LightweightCharts.createChart($('rsi'),Object.assign({autoSize:true},theme(),{handleScale:{axisPressedMouseMove:{time:true,price:false}}}));\n    rsiS=rsiChart.addLineSeries(lineOpt(css('--ind3'),{lastValueVisible:true,priceFormat:{type:'price',precision:1,minMove:0.1}}));\n    rsiS.createPriceLine({price:70,color:css('--down'),lineWidth:1,lineStyle:2,axisLabelVisible:false});\n    rsiS.createPriceLine({price:30,color:css('--up'),lineWidth:1,lineStyle:2,axisLabelVisible:false});\n    let syncing=false;\n    chart.timeScale().subscribeVisibleLogicalRangeChange(r=>{schedule();if(syncing||!r||!ind.rsi)return;syncing=true;rsiChart.timeScale().setVisibleLogicalRange(r);syncing=false});\n    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(syncing||!r)return;syncing=true;chart.timeScale().setVisibleLogicalRange(r);syncing=false});\n    chart.subscribeCrosshairMove(schedule);\n    chart.subscribeClick(onChartClick);\n    try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',retheme)}catch(e){}\n  }\n\n  function buildBars(){\n    let t=series[sel]||[];\n    if(ind.deals&&sel!=='avg')t=t.filter(x=>x[2]);\n    const out=[];let last=null,cur=null;\n    for(const x of t){\n      const p=x[1],b=Math.floor((x[0]+KABUL)/tf)*tf;\n      if(!cur||cur.time!==b){if(cur){out.push(cur);last=cur.close}\n        const o=last==null?p:last;cur={time:b,open:o,high:Math.max(o,p),low:Math.min(o,p),close:p}}\n      else{cur.high=Math.max(cur.high,p);cur.low=Math.min(cur.low,p);cur.close=p}\n    }\n    if(cur)out.push(cur);return out;\n  }\n  function sma(d,n){const r=[];let s=0;for(let i=0;i<d.length;i++){s+=d[i].close;if(i>=n)s-=d[i-n].close;r.push(i>=n-1?{time:d[i].time,value:+(s/n).toFixed(3)}:{time:d[i].time})}return r}\n  function boll(d,n,k){const u=[],m=[],l=[];for(let i=0;i<d.length;i++){const t=d[i].time;if(i<n-1){u.push({time:t});m.push({time:t});l.push({time:t});continue}\n    let s=0;for(let j=i-n+1;j<=i;j++)s+=d[j].close;const mean=s/n;let v=0;for(let j=i-n+1;j<=i;j++)v+=(d[j].close-mean)**2;const sd=Math.sqrt(v/n);\n    u.push({time:t,value:+(mean+k*sd).toFixed(3)});m.push({time:t,value:+mean.toFixed(3)});l.push({time:t,value:+(mean-k*sd).toFixed(3)})}return[u,m,l]}\n  function rsi(d,n){const r=[];let g=0,l=0;for(let i=0;i<d.length;i++){const t=d[i].time;if(i===0){r.push({time:t});continue}\n    const ch=d[i].close-d[i-1].close,up=Math.max(ch,0),dn=Math.max(-ch,0);\n    if(i<=n){g+=up;l+=dn;if(i<n){r.push({time:t});continue}g/=n;l/=n}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n}\n    r.push({time:t,value:+(l===0?100:100-100/(1+g/l)).toFixed(2)})}return r}\n\n  function renderChart(fit){\n    if(!chart)return;\n    bars=buildBars();\n    candles.setData(bars);\n    ma20s.setData(ind.ma20?sma(bars,20):[]);\n    ma50s.setData(ind.ma50?sma(bars,50):[]);\n    const bb=ind.bb?boll(bars,20,2):[[],[],[]];bbU.setData(bb[0]);bbM.setData(bb[1]);bbL.setData(bb[2]);\n    $('rsiBox').hidden=!ind.rsi;\n    rsiS.setData(ind.rsi?rsi(bars,14):[]);\n    if(fit){chart.timeScale().fitContent();}\n    if(ind.rsi){const r=chart.timeScale().getVisibleLogicalRange();if(r)rsiChart.timeScale().setVisibleLogicalRange(r)}\n    renderLegend();\n    const e=$('empty');\n    if(bars.length){e.hidden=true}\n    else if(loaded||failed){e.hidden=false;e.querySelector('strong').textContent=failed&&!loaded?'اتصال برقرار نشد':'هنوز نرخی برای '+NAMES[sel]+' ثبت نشده';\n      $('emptyMsg').textContent=failed&&!loaded?'چند لحظه بعد دوباره امتحان می‌شود.':(sel==='herat'?'منبع نرخ هرات به‌زودی وصل می‌شود.':'به محض اعلام اولین نرخ، کندل‌ها اینجا ساخته می‌شوند.')}\n    schedule();\n  }\n  function renderLegend(){\n    const L=$('legend');L.textContent='';\n    const add=(on,txt,c)=>{if(!on)return;const s=document.createElement('span');const i=document.createElement('i');i.style.background=css(c);s.append(i,txt);L.appendChild(s)};\n    add(ind.ma20,'MA20','--ind1');add(ind.ma50,'MA50','--ind2');add(ind.bb,'BB 20,2','--ind3');\n  }\n\n  /* ---------- panels ---------- */\n  function statsOf(t){\n    if(!t||!t.length)return null;\n    const [lt,lp]=t[t.length-1],today=dayKey(lt);\n    let prev=null;for(let i=t.length-1;i>=0;i--){if(dayKey(t[i][0])<today){prev=t[i][1];break}}\n    const td=[];for(let i=t.length-1;i>=0&&dayKey(t[i][0])===today;i--)td.push(t[i][1]);\n    return{ts:lt,price:lp,prev,hi:Math.max(...td),lo:Math.min(...td),n:td.length,chg:prev==null?null:lp-prev};\n  }\n  const chgTxt=(d,p)=>(d>=0?'+':'')+d.toFixed(2)+' ('+(d>=0?'+':'')+(d/p*100).toFixed(2)+'%)';\n  const cls=d=>d>0?'up':d<0?'down':'flat';\n  function spark(cv,t){\n    const now=t.length?t[t.length-1][0]:0,pts=t.filter(x=>x[0]>=now-86400);\n    const dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;\n    cv.width=w*dpr;cv.height=h*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);g.clearRect(0,0,w,h);\n    if(pts.length<2)return;\n    let lo=Infinity,hi=-Infinity;for(const x of pts){lo=Math.min(lo,x[1]);hi=Math.max(hi,x[1])}\n    if(hi-lo<0.02){hi+=0.01;lo-=0.01}\n    const t0=pts[0][0],t1=pts[pts.length-1][0]||t0+1,X=t=>(t-t0)/(t1-t0||1)*(w-4)+2,Y=p=>h-3-(p-lo)/(hi-lo)*(h-6);\n    const c=pts[pts.length-1][1]>=pts[0][1]?css('--up'):css('--down');\n    g.beginPath();pts.forEach((x,i)=>i?g.lineTo(X(x[0]),Y(x[1])):g.moveTo(X(x[0]),Y(x[1])));\n    g.strokeStyle=c;g.lineWidth=1.5;g.stroke();\n    g.lineTo(X(t1),h);g.lineTo(X(t0),h);g.closePath();g.globalAlpha=.12;g.fillStyle=c;g.fill();g.globalAlpha=1;\n    g.beginPath();g.arc(X(pts[pts.length-1][0]),Y(pts[pts.length-1][1]),2.5,0,7);g.fillStyle=c;g.fill();\n  }\n  function card(key,name,isAvg){\n    const b=document.createElement('button');b.type='button';b.className='card'+(isAvg?' avg':'');b.dataset.key=key;\n    b.setAttribute('aria-pressed',String(key===sel));\n    const st=statsOf(series[key]),kab=statsOf(series.kabul);\n    const top=document.createElement('div');top.className='top';\n    const n=document.createElement('span');n.className='n';n.textContent=isAvg?'میانگین بازار':name;\n    const tm=document.createElement('span');tm.className='tm';tm.textContent=st?tfmt.format(new Date(st.ts*1000)):'';\n    top.append(n,tm);b.appendChild(top);\n    if(isAvg){const s=document.createElement('span');s.className='sub';const a=series.avg,c=a&&a.length?a[a.length-1][3]:0;s.textContent=c?'نرخ واقعی، میانگین '+fa(c)+' ولایت':'نرخ واقعی';b.appendChild(s)}\n    if(!st){const w=document.createElement('span');w.className='wait';w.textContent=key==='herat'?'منبع هرات به‌زودی وصل می‌شود':'در انتظار اولین نرخ';b.appendChild(w);return b}\n    const p=document.createElement('span');p.className='p';p.textContent=en(st.price);b.appendChild(p);\n    const row=document.createElement('div');row.className='row';\n    const c1=document.createElement('span');\n    if(st.chg!=null){c1.textContent=chgTxt(st.chg,st.prev);c1.className=cls(st.chg)}else{c1.textContent='—';c1.className='flat'}\n    row.appendChild(c1);\n    if(key!=='kabul'&&kab){const c2=document.createElement('span');const d=st.price-kab.price;c2.textContent=(d>=0?'+':'')+d.toFixed(2)+' vs KBL';c2.className=cls(d);row.appendChild(c2)}\n    b.appendChild(row);\n    const cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');b.appendChild(cv);\n    requestAnimationFrame(()=>spark(cv,series[key]));\n    return b;\n  }\n  function renderPanels(){\n    const P=$('panels');P.textContent='';\n    P.appendChild(card('avg','',true));\n    for(const [k,n] of MAIN)P.appendChild(card(k,n,false));\n    const O=$('others');O.textContent='';\n    const have=OTHER.filter(([k])=>series[k]&&series[k].length);\n    O.hidden=!have.length;\n    if(have.length){const l=document.createElement('span');l.textContent='ولایات دیگر:';O.appendChild(l);\n      for(const [k,n] of have){const st=statsOf(series[k]);const c=document.createElement('button');c.type='button';c.className='chip';c.dataset.key=k;c.setAttribute('aria-pressed',String(k===sel));\n        c.append(n);const b=document.createElement('b');b.textContent=en(st.price);c.appendChild(b);O.appendChild(c)}}\n  }\n  function select(k){if(k===sel)return;sel=k;store.set('th-sel',k);loadDraw();renderAll(true)}\n  $('panels').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(b)select(b.dataset.key)});\n  $('others').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(b)select(b.dataset.key)});\n\n  function renderHeader(){\n    const st=statsOf(series[sel]);\n    const where=sel==='avg'?'میانگین بازار (کابل، مزار، هرات، قندهار)':(MAIN.find(m=>m[0]===sel)||[])[2]||('بازار '+NAMES[sel]);\n    $('subt').textContent='USD/AFN · '+where+' · وقت کابل';\n    const c=$('chg');\n    if(!st){['now','hi','lo','prev','count'].forEach(i=>$(i).textContent='—');c.textContent='—';c.className='chg';return}\n    $('now').textContent=en(st.price);$('hi').textContent=en(st.hi);$('lo').textContent=en(st.lo);\n    $('prev').textContent=st.prev==null?'—':en(st.prev);$('count').textContent=fa(st.n);\n    if(st.chg!=null){c.textContent=chgTxt(st.chg,st.prev);c.className='chg '+cls(st.chg)}else{c.textContent='—';c.className='chg'}\n    $('dealsBtn').disabled=sel==='avg';\n  }\n  function renderLive(){\n    let newest=0;for(const k in series)if(series[k].length)newest=Math.max(newest,series[k][series[k].length-1][0]);\n    if(newest){$('updated').textContent='آخرین نرخ '+tfmt.format(new Date(newest*1000));$('foot').textContent='آخرین نرخ: '+dfmt.format(new Date(newest*1000))}\n    $('live').classList.toggle('stale',!lastRun||Date.now()/1000-lastRun>600);\n  }\n  function renderAll(fit){recompute();renderPanels();renderHeader();renderChart(fit);renderLive()}\n\n  /* ---------- toolbar state ---------- */\n  function syncButtons(){\n    document.querySelectorAll('#tfs button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.tf===tf)));\n    document.querySelectorAll('#inds button').forEach(b=>b.setAttribute('aria-pressed',String(!!ind[b.dataset.ind])));\n  }\n  $('tfs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;tf=+b.dataset.tf;store.set('th-tf',tf);syncButtons();renderChart(true)});\n  $('inds').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const k=b.dataset.ind;ind[k]=!ind[k];store.set('th-ind',ind);syncButtons();renderChart(k==='deals')});\n  syncButtons();\n\n  /* ---------- drawing tools ---------- */\n  const ov=$('ov'),og=ov.getContext('2d');\n  const D={tool:'cursor',items:[],pending:null,down:null,sel:-1};\n  const ONE={hline:1,vline:1};\n  const HINTS={trend:'نقطه‌ی اول را بزنید و بکشید',ray:'نقطه‌ی اول را بزنید و بکشید',hline:'روی سطح قیمت بزنید',vline:'روی زمان مورد نظر بزنید',rect:'گوشه‌ی اول را بزنید و بکشید',fib:'از کف به سقف (یا برعکس) بکشید',measure:'از نقطه‌ی شروع تا پایان بکشید'};\n  function loadDraw(){D.items=store.get('th-draw-'+sel,[]);D.sel=-1;D.pending=null;updDel()}\n  function saveDraw(){store.set('th-draw-'+sel,D.items)}\n  function setTool(t){D.tool=t;D.pending=null;D.down=null;ov.classList.toggle('on',t!=='cursor');\n    document.querySelectorAll('#tools button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t)));\n    const h=$('hint');h.hidden=t==='cursor';h.textContent=HINTS[t]||'';schedule()}\n  function updDel(){$('delBtn').disabled=D.sel<0}\n  $('tools').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTool(D.tool===b.dataset.tool&&b.dataset.tool!=='cursor'?'cursor':b.dataset.tool)});\n  $('undoBtn').addEventListener('click',()=>{if(D.pending){D.pending=null}else if(D.items.length){D.items.pop();saveDraw()}D.sel=-1;updDel();schedule()});\n  $('delBtn').addEventListener('click',()=>{if(D.sel<0)return;D.items.splice(D.sel,1);D.sel=-1;saveDraw();updDel();schedule()});\n  let clearArmed=false;\n  $('clearBtn').addEventListener('click',e=>{if(!D.items.length)return;if(!clearArmed){clearArmed=true;e.currentTarget.textContent='مطمئن؟ دوباره بزنید';setTimeout(()=>{clearArmed=false;$('clearBtn').textContent='پاک کردن همه'},3000);return}\n    clearArmed=false;$('clearBtn').textContent='پاک کردن همه';D.items=[];D.sel=-1;saveDraw();updDel();schedule()});\n  document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea'))return;\n    if(e.key==='Escape'){setTool('cursor');D.sel=-1;updDel()}\n    if((e.key==='Delete'||e.key==='Backspace')&&D.sel>=0){D.items.splice(D.sel,1);D.sel=-1;saveDraw();updDel();schedule()}});\n  setTool('cursor');loadDraw();\n\n  // time <-> logical index (works across timeframes because drawings are stored as time and price)\n  function t2l(t){const b=bars,n=b.length;if(!n)return null;if(n===1||t<=b[0].time)return(t-b[0].time)/tf;\n    if(t>=b[n-1].time)return n-1+(t-b[n-1].time)/tf;let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(b[m].time<=t)lo=m;else hi=m}\n    return lo+(t-b[lo].time)/(b[hi].time-b[lo].time)}\n  function l2t(l){const b=bars,n=b.length;if(!n)return null;if(l<=0)return b[0].time+l*tf;if(l>=n-1)return b[n-1].time+(l-(n-1))*tf;\n    const i=Math.floor(l);return b[i].time+(l-i)*(b[i+1].time-b[i].time)}\n  function X(t){const l=t2l(t);return l==null?null:chart.timeScale().logicalToCoordinate(l)}\n  function Y(p){return candles.priceToCoordinate(p)}\n  function at(x,y){const l=chart.timeScale().coordinateToLogical(x),p=candles.coordinateToPrice(y);if(l==null||p==null)return null;return{t:l2t(l),p:+p.toFixed(3)}}\n\n  function size(){const c=$('chart'),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;\n    if(ov.width!==Math.round(w*dpr)||ov.height!==Math.round(h*dpr)){ov.width=Math.round(w*dpr);ov.height=Math.round(h*dpr);ov.style.width=w+'px';ov.style.height=h+'px'}\n    return{w,h,dpr}}\n  function label(g,txt,x,y,bg,fg){g.font='600 11px JetBrains Mono, monospace';const w=g.measureText(txt).width+10;g.fillStyle=bg;g.fillRect(x,y-9,w,18);g.fillStyle=fg;g.fillText(txt,x+5,y+4);return w}\n  const FIB=[0,.236,.382,.5,.618,.786,1];\n  function draw(){\n    raf=0;if(!chart)return;\n    const {w,h,dpr}=size();og.setTransform(dpr,0,0,dpr,0,0);og.clearRect(0,0,w,h);\n    const pw=w-chart.priceScale('right').width(),ph=h-chart.timeScale().height();\n    og.save();og.beginPath();og.rect(0,0,pw,ph);og.clip();\n    const gold=css('--gold'),ink=css('--ink'),bg=css('--surface'),up=css('--up'),dn=css('--down');\n    const list=D.items.slice();if(D.pending&&D.pending.b)list.push(D.pending);\n    list.forEach((it,i)=>{\n      const selected=i===D.sel||it===D.pending;\n      og.strokeStyle=gold;og.fillStyle=gold;og.lineWidth=selected?2.2:1.6;og.setLineDash([]);\n      const x1=X(it.a.t),y1=Y(it.a.p),x2=it.b?X(it.b.t):null,y2=it.b?Y(it.b.p):null;\n      if(it.type==='hline'){if(y1==null)return;og.beginPath();og.moveTo(0,y1);og.lineTo(pw,y1);og.stroke();label(og,en(it.a.p),pw-62,y1,gold,bg);return}\n      if(it.type==='vline'){if(x1==null)return;og.beginPath();og.moveTo(x1,0);og.lineTo(x1,ph);og.stroke();return}\n      if(x1==null||y1==null||x2==null||y2==null)return;\n      if(it.type==='trend'||it.type==='ray'){og.beginPath();og.moveTo(x1,y1);\n        if(it.type==='ray'&&(x2!==x1||y2!==y1)){const k=4000/Math.hypot(x2-x1,y2-y1);og.lineTo(x1+(x2-x1)*k,y1+(y2-y1)*k)}else og.lineTo(x2,y2);og.stroke();\n        if(selected){[[x1,y1],[x2,y2]].forEach(([x,y])=>{og.beginPath();og.arc(x,y,4,0,7);og.fillStyle=bg;og.fill();og.stroke()})}return}\n      if(it.type==='rect'){og.globalAlpha=.12;og.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));og.globalAlpha=1;og.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));return}\n      if(it.type==='fib'){const L=Math.min(x1,x2),hi=it.b.p,lo=it.a.p;\n        FIB.forEach(f=>{const p=hi-(hi-lo)*f,y=Y(p);if(y==null)return;og.globalAlpha=f===.5||f===.618?1:.75;og.beginPath();og.moveTo(L,y);og.lineTo(pw,y);og.stroke();og.globalAlpha=1;\n          og.font='600 11px JetBrains Mono, monospace';og.fillStyle=gold;og.fillText(f+' ('+en(p)+')',L+4,y-4)});\n        og.setLineDash([3,3]);og.globalAlpha=.6;og.beginPath();og.moveTo(x1,y1);og.lineTo(x2,y2);og.stroke();og.globalAlpha=1;og.setLineDash([]);return}\n      if(it.type==='measure'){const d=it.b.p-it.a.p,c=d>=0?up:dn;og.fillStyle=c;og.strokeStyle=c;og.globalAlpha=.14;\n        og.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));og.globalAlpha=1;og.lineWidth=1.4;\n        og.beginPath();og.moveTo((x1+x2)/2,y1);og.lineTo((x1+x2)/2,y2);og.stroke();\n        const nb=Math.round(Math.abs(t2l(it.b.t)-t2l(it.a.t)));\n        const txt=(d>=0?'+':'')+d.toFixed(2)+'  '+(d>=0?'+':'')+(d/it.a.p*100).toFixed(2)+'%  '+nb+' bars';\n        og.font='600 11px JetBrains Mono, monospace';const tw=og.measureText(txt).width+12;\n        const lx=Math.max(4,Math.min(pw-tw-4,(x1+x2)/2-tw/2)),ly=d>=0?Math.min(y1,y2)-14:Math.max(y1,y2)+14;\n        label(og,txt,lx,Math.max(12,Math.min(ph-12,ly)),c,bg);return}\n    });\n    og.restore();\n  }\n  function hit(x,y){\n    const near=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))};\n    for(let i=D.items.length-1;i>=0;i--){const it=D.items[i],x1=X(it.a.t),y1=Y(it.a.p),x2=it.b?X(it.b.t):null,y2=it.b?Y(it.b.p):null;\n      if(it.type==='hline'&&y1!=null&&Math.abs(y-y1)<7)return i;\n      if(it.type==='vline'&&x1!=null&&Math.abs(x-x1)<7)return i;\n      if(x1==null||y1==null||x2==null||y2==null)continue;\n      if(it.type==='trend'&&near(x,y,x1,y1,x2,y2)<7)return i;\n      if(it.type==='ray'){const k=4000/(Math.hypot(x2-x1,y2-y1)||1);if(near(x,y,x1,y1,x1+(x2-x1)*k,y1+(y2-y1)*k)<7)return i}\n      if((it.type==='rect'||it.type==='measure'||it.type==='fib')&&x>=Math.min(x1,x2)-5&&x<=(it.type==='fib'?99999:Math.max(x1,x2)+5)&&y>=Math.min(y1,y2)-5&&y<=Math.max(y1,y2)+5)return i}\n    return -1}\n  function onChartClick(p){if(D.tool!=='cursor'||!p.point)return;D.sel=hit(p.point.x,p.point.y);updDel();schedule()}\n  function commit(){const it=D.pending;D.pending=null;if(it&&it.b&&(it.a.t!==it.b.t||it.a.p!==it.b.p)){D.items.push({type:it.type,a:it.a,b:it.b});D.sel=D.items.length-1;saveDraw();updDel()}setTool('cursor')}\n  ov.addEventListener('pointerdown',e=>{\n    if(D.tool==='cursor')return;e.preventDefault();\n    const pt=at(e.offsetX,e.offsetY);if(!pt)return;\n    if(ONE[D.tool]){D.items.push({type:D.tool,a:pt});D.sel=D.items.length-1;saveDraw();updDel();setTool('cursor');return}\n    if(D.pending){D.pending.b=pt;commit();return}\n    D.pending={type:D.tool,a:pt,b:pt};D.down={x:e.offsetX,y:e.offsetY};\n    try{ov.setPointerCapture(e.pointerId)}catch(_){}schedule()});\n  ov.addEventListener('pointermove',e=>{if(!D.pending)return;const pt=at(e.offsetX,e.offsetY);if(pt){D.pending.b=pt;schedule()}});\n  ov.addEventListener('pointerup',e=>{if(!D.pending||!D.down)return;const moved=Math.hypot(e.offsetX-D.down.x,e.offsetY-D.down.y)>6;D.down=null;if(moved)commit();else $('hint').textContent='نقطه‌ی دوم را بزنید'});\n  ['pointermove','wheel','touchmove','pointerup'].forEach(ev=>$('box').addEventListener(ev,schedule,{passive:true}));\n  try{new ResizeObserver(schedule).observe($('chart'))}catch(e){window.addEventListener('resize',schedule)}\n\n  /* ---------- day / night ---------- */\n  function isDark(){const t=document.documentElement.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}\n  function syncTheme(){const d=isDark();document.documentElement.classList.toggle('is-dark',d);$('themeLbl').textContent=d?'حالت روز':'حالت شب';\n    const m=document.querySelector('meta[name=theme-color]');if(m)m.content=d?'#0E1220':'#F3F1EC'}\n  $('themeBtn').addEventListener('click',()=>{const t=isDark()?'light':'dark';document.documentElement.setAttribute('data-theme',t);store.set('th-theme',t);syncTheme();retheme();renderPanels()});\n  try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{syncTheme();renderPanels()})}catch(e){}\n  syncTheme();\n\n  /* ---------- news ---------- */\n  const ago=t=>{const s=Date.now()/1000-t;if(s<3600)return fa(Math.max(1,Math.round(s/60)))+' دقیقه پیش';if(s<86400)return fa(Math.round(s/3600))+' ساعت پیش';if(s<86400*30)return fa(Math.round(s/86400))+' روز پیش';return dfmt.format(new Date(t*1000))};\n  function auctionInfo(n){const t=n.title;\n    const m=t.match(/([\\d۰-۹.]+)\\s*(?:میلیون|million|mn|m\\b)/i);if(!m||!/(لیلام|مزایده|auction)/i.test(t))return null;\n    return fa(+m[1].replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))+' میلیون دالر'}\n  async function loadNews(){\n    try{const r=await getJSON('/api/news');const list=r.news||[];\n      const ul=$('nlist');ul.textContent='';\n      list.slice(0,12).forEach(n=>{const li=document.createElement('li');\n        const s=document.createElement('span');s.className='nsrc';s.textContent=n.src;\n        const a=document.createElement('a');a.href=n.link;a.target='_blank';a.rel='noopener';a.textContent=n.title;\n        const t=document.createElement('span');t.className='ntime';t.textContent=ago(n.ts);\n        li.append(s,a,t);ul.appendChild(li)});\n      $('nempty').hidden=list.length>0;\n      const au=list.find(auctionInfo),box=$('auction');\n      if(au){box.hidden=false;box.textContent='';const l=document.createElement('span');l.textContent='آخرین لیلام دالر د افغانستان بانک:';\n        const b=document.createElement('b');b.textContent=auctionInfo(au);const t=document.createElement('span');t.className='ntime';t.textContent=ago(au.ts);box.append(l,b,t)}\n      else box.hidden=true;\n    }catch(e){}\n  }\n\n  /* ---------- data loading ---------- */\n  async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json()}\n  function newestTs(){let n=0;for(const c in raw)if(raw[c].length)n=Math.max(n,raw[c][raw[c].length-1][0]);return n}\n  async function boot(){\n    try{\n      const h=await getJSON('/api/history');\n      for(const c in h.series)addTicks(c,h.series[c]);\n      lastRun=h.lastRun;loaded=true;failed=false;\n    }catch(e){failed=true;$('updated').textContent='اتصال برقرار نشد؛ دوباره تلاش می‌شود'}\n    renderAll(true);\n  }\n  async function poll(){\n    if(!loaded){return boot()}\n    try{\n      const since=Math.max(0,newestTs()-600);\n      const u=await getJSON('/api/updates?since='+since);\n      lastRun=u.lastRun;const changed={};\n      for(const [c,t,p,d] of u.ticks)if(addTicks(c,[[t,p,d]]))changed[c]=1;\n      if(Object.keys(changed).length){const r=chart&&chart.timeScale().getVisibleLogicalRange();recompute();renderPanels();renderHeader();renderChart(false);if(r)chart.timeScale().setVisibleLogicalRange(r)}\n      renderLive();\n    }catch(e){}\n  }\n  boot();loadNews();\n  setInterval(()=>{if(!document.hidden)poll()},30000);\n  setInterval(()=>{if(!document.hidden)loadNews()},300000);\n  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});\n})();\n</script>\n</body>\n</html>\n";

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
const BING = q => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
const FEEDS = [
  { src: "Bing News", search: true, url: BING('"Da Afghanistan Bank" OR "Afghan central bank" OR afghani') },
  { src: "Bing News", search: true, url: BING('"د افغانستان بانک"') },
  { src: "Bing News", search: true, url: BING('نرخ دالر افغانی') },
  { src: "Amu TV", url: "https://amu.tv/feed/" },
  { src: "Ariana News", url: "https://www.ariananews.af/feed/" },
  { src: "KabulNow", url: "https://kabulnow.com/feed/" },
  { src: "Hasht-e Subh", url: "https://8am.media/eng/feed/" },
  { src: "Hasht-e Subh", url: "https://8am.media/fa/feed/" },
];
// General outlet feeds must name the topic in the headline; targeted searches may match in the summary.
const NEWS_RE = /(Da Afghanistan Bank|\bDAB\b|central bank|afghani|\bAFN\b|auction|exchange rate|money ?changer|Sarai Shahzada|forex|د افغانستان بانک|افغانستان بانک|بانک مرکزی|لیلام|مزایده|افغانی|نرخ ارز|نرخ دالر|نرخ اسعار|اسعار|صرافی|صرافان|سرای شهزاده|ارزش پول)/i;
const TG_NEWS_RE = /(لیلام|ليلام|مزایده|بولی|بانک|بانك)/;
const NEWS_MAX = 40;

const unxml = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function parseFeed(xml, src, search = false) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const g = tag => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? unxml(m[1]) : ""; };
    const title = g("title");
    let link = g("link"); if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/); link = m ? m[1] : ""; }
    const ts = Math.floor(Date.parse(g("pubDate") || g("updated") || g("published") || g("dc:date")) / 1000);
    if (!title || !/^https?:\/\//.test(link) || !isFinite(ts)) continue;
    const desc = g("description") || g("summary");
    if (!NEWS_RE.test(search ? title + " " + desc.slice(0, 400) : title)) continue;
    const outlet = g("source") || g("News:Source");
    const clean = outlet && title.endsWith(" - " + outlet) ? title.slice(0, -(outlet.length + 3)) : title;
    out.push({ ts, src: outlet || src, title: clean.slice(0, 220), link });
  }
  return out;
}
async function saveNews(db, add) {
  if (!add.length) return;
  let list = []; try { list = JSON.parse((await meta(db, "news")) || "[]"); } catch (e) {}
  const key = n => n.title.replace(/\W+/g, "").slice(0, 60).toLowerCase();
  const have = new Set(list.map(n => n.link)), haveT = new Set(list.map(key));
  let changed = false;
  for (const n of add) if (!have.has(n.link) && !haveT.has(key(n))) { list.push(n); have.add(n.link); haveT.add(key(n)); changed = true; }
  if (!changed) return;
  list.sort((a, b) => b.ts - a.ts);
  await setMeta(db, "news", JSON.stringify(list.slice(0, NEWS_MAX)));
}
async function collectNews(db) {
  const found = [], status = [];
  await Promise.all(FEEDS.map(async f => {
    try {
      const r = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) { status.push(`${f.src} ${r.status}`); return; }
      const items = parseFeed(await r.text(), f.src, !!f.search);
      status.push(`${f.src} ok ${items.length}`);
      found.push(...items);
    } catch (e) { status.push(`${f.src} ${e && e.name || "error"}`); }
  }));
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
