// Trader House — USD/AFN live (single-file build)
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
function parsePost(raw) {
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

const PAGE = "<!doctype html>\n<html lang=\"fa\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>نرخ زنده‌ی دالر به افغانی | Trader House</title>\n<meta name=\"description\" content=\"چارت کندل‌استیک زنده‌ی نرخ دالر به افغانی در سرای شهزاده‌ی کابل، مزارشریف، کندهار، ننگرهار و غزنی — Trader House\">\n<meta property=\"og:title\" content=\"نرخ زنده‌ی دالر به افغانی — Trader House\">\n<meta property=\"og:description\" content=\"اولین چارت کندل‌استیک زنده‌ی بازار ارز افغانستان، به تفکیک ولایت\">\n<meta name=\"theme-color\" content=\"#0E1220\">\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=swap\">\n<style>\n/* Layout: trading desk — brand bar, city strip with live prices, price header, timeframe bar, chart */\n:root{\n  --bg:#F3F1EC; --surface:#FFFFFF; --ink:#151A26; --muted:#5D6475; --line:#E2DED4;\n  --gold:#A57C12; --gold-soft:#F4E8C6; --up:#138A63; --down:#C93A52; --grid:#ECE8DF;\n  --f-display:\"Lalezar\",\"Vazirmatn\",system-ui,sans-serif;\n  --f-body:\"Vazirmatn\",Tahoma,system-ui,sans-serif;\n  --f-mono:\"JetBrains Mono\",ui-monospace,Menlo,monospace;\n  color-scheme:light;\n}\n@media (prefers-color-scheme:dark){:root{\n  --bg:#0E1220; --surface:#151B2D; --ink:#EDEBE4; --muted:#9AA2B5; --line:#252D44;\n  --gold:#E2B847; --gold-soft:#2A2614; --up:#2BC08F; --down:#F0607A; --grid:#1C2338; color-scheme:dark}}\n*{box-sizing:border-box}\nhtml,body{margin:0}\nbody{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.6;\n  padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\n.wrap{max-width:1040px;margin:0 auto;padding-block:18px 40px;\n  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));\n  display:flex;flex-direction:column;gap:16px}\n.brand{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.logo{display:flex;align-items:center;gap:10px}\n.logo svg{width:38px;height:38px;flex:none}\n.logo b{font-family:var(--f-mono);font-size:15px;letter-spacing:.06em}\n.logo small{display:block;font-size:12px;color:var(--muted)}\n.live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 12px;background:var(--surface)}\n.live i{width:8px;height:8px;border-radius:50%;background:var(--up);animation:pulse 2s infinite}\n.live.stale i{background:var(--muted);animation:none}\n@keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--up) 60%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}\n@media (prefers-reduced-motion:reduce){.live i{animation:none}}\n.cities{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}\n.city{font:inherit;text-align:right;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:8px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;min-width:0}\n.city[aria-pressed=\"true\"]{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}\n.city .n{font-weight:700;font-size:14px}\n.city .p{font-family:var(--f-mono);font-weight:700;font-size:17px;direction:ltr;text-align:right;font-variant-numeric:tabular-nums}\n.city .d{font-family:var(--f-mono);font-size:12px;color:var(--muted);direction:ltr;text-align:right}\n.city .d.up{color:var(--up)} .city .d.down{color:var(--down)}\n.hero{display:grid;grid-template-columns:1fr auto;gap:12px 20px;align-items:end}\n.pair{font-family:var(--f-display);font-weight:400;font-size:clamp(28px,6vw,44px);line-height:1.1;margin:0;text-wrap:balance}\n.pair span{color:var(--gold)}\n.sub{color:var(--muted);font-size:13px;margin:4px 0 0}\n.price{direction:ltr;text-align:left}\n.now{font-family:var(--f-mono);font-weight:700;font-size:clamp(30px,7vw,48px);line-height:1;font-variant-numeric:tabular-nums}\n.unit{font-size:14px;color:var(--muted);margin-left:6px}\n.chg{display:inline-block;margin-top:6px;font-family:var(--f-mono);font-size:14px;padding:2px 10px;border-radius:6px;background:var(--grid)}\n.chg.up{color:var(--up)} .chg.down{color:var(--down)}\n.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);border-radius:12px;background:var(--surface);margin:0}\n.stat{padding:10px 14px;border-inline-start:1px solid var(--line);min-width:0}\n.stat:first-child{border-inline-start:0}\n.stat dt{font-size:12px;color:var(--muted)}\n.stat dd{margin:0;font-family:var(--f-mono);font-weight:700;font-size:16px;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}\n.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface);max-width:100%;overflow-x:auto}\n.seg button{font:500 14px var(--f-body);color:var(--muted);background:none;border:0;padding:7px 13px;cursor:pointer;white-space:nowrap}\n.seg button+button{border-inline-start:1px solid var(--line)}\n.seg button[aria-pressed=\"true\"]{background:var(--gold-soft);color:var(--gold);font-weight:700}\n.opts{display:flex;gap:8px;flex-wrap:wrap}\n.toggle{font:500 14px var(--f-body);color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:7px 13px;cursor:pointer}\n.toggle[aria-pressed=\"true\"]{color:var(--gold);border-color:var(--gold)}\nbutton:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n.chartbox{position:relative;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden}\n#chart{direction:ltr;height:min(62vh,540px);min-height:340px;width:100%}\n.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:24px;color:var(--muted);background:var(--surface)}\n.empty strong{font-family:var(--f-display);font-weight:400;font-size:24px;color:var(--ink)}\n.watermark{position:absolute;bottom:34px;left:18px;font-family:var(--f-mono);font-size:12px;letter-spacing:.12em;color:var(--muted);opacity:.55;pointer-events:none;direction:ltr}\n.note{font-size:13px;color:var(--muted);margin:0;max-width:72ch}\n.note a,footer a{color:var(--gold)}\nfooter{font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px}\n@media (max-width:640px){\n  .hero{grid-template-columns:1fr}.price{text-align:right}\n  .stats{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .stat:nth-child(3){border-inline-start:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}\n  .cities{grid-template-columns:repeat(2,minmax(0,1fr))}\n}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <header class=\"brand\">\n    <div class=\"logo\">\n      <svg viewBox=\"0 0 40 40\" aria-hidden=\"true\"><rect x=\"1\" y=\"1\" width=\"38\" height=\"38\" rx=\"9\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"2\"/><path d=\"M8 20 L20 9 L32 20\" fill=\"none\" stroke=\"var(--gold)\" stroke-width=\"2.4\" stroke-linejoin=\"round\"/><rect x=\"13\" y=\"22\" width=\"3\" height=\"9\" fill=\"var(--up)\"/><line x1=\"14.5\" y1=\"19\" x2=\"14.5\" y2=\"33\" stroke=\"var(--up)\" stroke-width=\"1.2\"/><rect x=\"18.5\" y=\"24\" width=\"3\" height=\"6\" fill=\"var(--down)\"/><line x1=\"20\" y1=\"21.5\" x2=\"20\" y2=\"32\" stroke=\"var(--down)\" stroke-width=\"1.2\"/><rect x=\"24\" y=\"19\" width=\"3\" height=\"10\" fill=\"var(--up)\"/><line x1=\"25.5\" y1=\"17\" x2=\"25.5\" y2=\"31\" stroke=\"var(--up)\" stroke-width=\"1.2\"/></svg>\n      <div><b>TRADER HOUSE</b><small>چارت زنده‌ی بازار ارز افغانستان</small></div>\n    </div>\n    <span class=\"live\" id=\"live\"><i></i><span id=\"updated\">در حال بارگذاری…</span></span>\n  </header>\n\n  <nav class=\"cities\" id=\"cities\" aria-label=\"ولایت\"></nav>\n\n  <section class=\"hero\">\n    <div>\n      <h1 class=\"pair\">دالر <span>/</span> افغانی</h1>\n      <p class=\"sub\" id=\"sub\">USD/AFN · سرای شهزاده‌ی کابل · وقت کابل</p>\n    </div>\n    <div class=\"price\">\n      <div><span class=\"now\" id=\"now\">—</span><span class=\"unit\">AFN</span></div>\n      <span class=\"chg\" id=\"chg\">—</span>\n    </div>\n  </section>\n\n  <dl class=\"stats\">\n    <div class=\"stat\"><dt>بلندترین امروز</dt><dd id=\"hi\">—</dd></div>\n    <div class=\"stat\"><dt>پایین‌ترین امروز</dt><dd id=\"lo\">—</dd></div>\n    <div class=\"stat\"><dt>بسته‌شدن دیروز</dt><dd id=\"prev\">—</dd></div>\n    <div class=\"stat\"><dt>نرخ‌های امروز</dt><dd id=\"count\">—</dd></div>\n  </dl>\n\n  <div class=\"toolbar\">\n    <div class=\"seg\" role=\"group\" aria-label=\"تایم‌فریم\" id=\"tfs\">\n      <button type=\"button\" data-tf=\"300\">۵ دقیقه</button>\n      <button type=\"button\" data-tf=\"900\">۱۵ دقیقه</button>\n      <button type=\"button\" data-tf=\"3600\" aria-pressed=\"true\">۱ ساعت</button>\n      <button type=\"button\" data-tf=\"14400\">۴ ساعت</button>\n      <button type=\"button\" data-tf=\"86400\">روزانه</button>\n    </div>\n    <div class=\"opts\">\n      <button type=\"button\" class=\"toggle\" id=\"dealBtn\" aria-pressed=\"false\">فقط معاملات انجام‌شده</button>\n      <button type=\"button\" class=\"toggle\" id=\"maBtn\" aria-pressed=\"false\">میانگین متحرک ۲۰</button>\n    </div>\n  </div>\n\n  <div class=\"chartbox\">\n    <div id=\"chart\"></div>\n    <div class=\"watermark\">TRADER HOUSE · USD/AFN</div>\n    <div class=\"empty\" id=\"empty\"><strong>در حال جمع‌آوری نرخ‌ها</strong><span>سیستم هر دقیقه نرخ‌های تازه را از بازار می‌خواند. چند دقیقه‌ی دیگر سر بزنید.</span></div>\n  </div>\n\n  <p class=\"note\">هر کندل از نرخ‌های اعلام‌شده و معاملات انجام‌شده در همان بازه ساخته می‌شود (میانه‌ی خرید و فروش). باز شدن هر کندل همان بسته شدن کندل قبلی است. صفحه هر ۳۰ ثانیه خودکار به‌روز می‌شود. منبع نرخ‌ها: کانال تلگرام <a href=\"https://t.me/kabul_dollar\" target=\"_blank\" rel=\"noopener\">@kabul_dollar</a>.</p>\n\n  <footer><span>تحلیل و چارت: Trader House</span><span id=\"foot\">—</span></footer>\n</div>\n\n<script src=\"https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js\"></script>\n<script>\n(function(){\n  const CITIES=[[\"kabul\",\"کابل\"],[\"mazar\",\"مزارشریف\"],[\"kandahar\",\"کندهار\"],[\"jalalabad\",\"ننگرهار\"],[\"ghazni\",\"غزنی\"],[\"herat\",\"هرات\"],[\"khost\",\"خوست\"]];\n  const KABUL=16200;\n  const $=id=>document.getElementById(id);\n  const en=n=>Number(n).toFixed(2);\n  const tfmt=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Kabul',hour:'2-digit',minute:'2-digit'});\n  const dfmt=new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Kabul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});\n  const fa=n=>Number(n).toLocaleString('fa-IR');\n  const dayKey=t=>Math.floor((t+KABUL)/86400);\n\n  let city='kabul', tf=3600, dealsOnly=false, showMA=false;\n  const data={};       // city -> [[ts,price,isDeal],...]\n  let summary=null;\n\n  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();\n  let chart,candles,ma;\n  function theme(){return{layout:{background:{type:'solid',color:css('--surface')},textColor:css('--muted'),fontFamily:'JetBrains Mono, monospace'},\n    grid:{vertLines:{color:css('--grid')},horzLines:{color:css('--grid')}},rightPriceScale:{borderColor:css('--line')},\n    timeScale:{borderColor:css('--line'),timeVisible:true,secondsVisible:false},crosshair:{mode:0}}}\n  function colors(){const u=css('--up'),d=css('--down');return{upColor:u,downColor:d,wickUpColor:u,wickDownColor:d,borderVisible:false}}\n  if(window.LightweightCharts){\n    chart=LightweightCharts.createChart($('chart'),Object.assign({autoSize:true},theme()));\n    candles=chart.addCandlestickSeries(Object.assign({priceFormat:{type:'price',precision:2,minMove:0.01}},colors()));\n    ma=chart.addLineSeries({color:css('--gold'),lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});\n    try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{chart.applyOptions(theme());candles.applyOptions(colors());ma.applyOptions({color:css('--gold')})})}catch(e){}\n  }\n\n  function series(){const t=data[city]||[];return dealsOnly?t.filter(x=>x[2]):t}\n  function build(){\n    const out=[];let last=null,cur=null;\n    for(const [t,p] of series()){\n      const b=Math.floor((t+KABUL)/tf)*tf;\n      if(!cur||cur.time!==b){if(cur){out.push(cur);last=cur.close}\n        const o=last==null?p:last;cur={time:b,open:o,high:Math.max(o,p),low:Math.min(o,p),close:p}}\n      else{cur.high=Math.max(cur.high,p);cur.low=Math.min(cur.low,p);cur.close=p}\n    }\n    if(cur)out.push(cur);return out;\n  }\n  function sma(d,n){const r=[];let s=0;for(let i=0;i<d.length;i++){s+=d[i].close;if(i>=n)s-=d[i-n].close;if(i>=n-1)r.push({time:d[i].time,value:+(s/n).toFixed(3)})}return r}\n\n  function renderChart(fit){\n    if(!chart)return;const d=build();\n    candles.setData(d);ma.setData(showMA?sma(d,20):[]);\n    if(fit)chart.timeScale().fitContent();\n    $('empty').hidden=d.length>0;\n  }\n  function renderStats(){\n    const t=data[city]||[];\n    const name=(CITIES.find(c=>c[0]===city)||[])[1];\n    $('sub').textContent='USD/AFN · '+(city==='kabul'?'سرای شهزاده‌ی کابل':'بازار '+name)+' · وقت کابل';\n    if(!t.length){['now','hi','lo','prev','count'].forEach(i=>$(i).textContent='—');$('chg').textContent='—';$('chg').className='chg';return}\n    const [lt,lp]=t[t.length-1];$('now').textContent=en(lp);\n    const today=dayKey(lt);const td=t.filter(x=>dayKey(x[0])===today).map(x=>x[1]);\n    const before=t.filter(x=>dayKey(x[0])<today);\n    $('hi').textContent=en(Math.max(...td));$('lo').textContent=en(Math.min(...td));$('count').textContent=fa(td.length);\n    const c=$('chg');\n    if(before.length){const pc=before[before.length-1][1];$('prev').textContent=en(pc);\n      const d=lp-pc,pct=d/pc*100;c.textContent=(d>=0?'+':'')+d.toFixed(2)+'  ('+(d>=0?'+':'')+pct.toFixed(2)+'%)';\n      c.className='chg '+(d>0?'up':d<0?'down':'')}\n    else{$('prev').textContent='—';c.textContent='—';c.className='chg'}\n  }\n  function renderCities(){\n    const nav=$('cities');nav.textContent='';\n    const latest={};(summary&&summary.latest||[]).forEach(r=>latest[r.city]=r);\n    const kab=latest.kabul&&latest.kabul.price;\n    CITIES.filter(([k])=>latest[k]||k==='kabul').forEach(([k,n])=>{\n      const b=document.createElement('button');b.type='button';b.className='city';b.setAttribute('aria-pressed',String(k===city));\n      const a=document.createElement('span');a.className='n';a.textContent=n;\n      const p=document.createElement('span');p.className='p';p.textContent=latest[k]?en(latest[k].price):'—';\n      const d=document.createElement('span');d.className='d';\n      if(k==='kabul'||!latest[k]||!kab)d.textContent=latest[k]?tfmt.format(new Date(latest[k].ts*1000)):'';\n      else{const x=latest[k].price-kab;d.textContent=(x>=0?'+':'')+x.toFixed(2)+' با کابل';d.classList.add(x>0?'up':x<0?'down':'x')}\n      b.append(a,p,d);b.addEventListener('click',()=>{city=k;renderCities();load(true)});nav.appendChild(b);\n    });\n  }\n  function renderLive(){\n    const last=summary&&summary.lastRun;const live=$('live');\n    const t=(data[city]||[]).slice(-1)[0];\n    if(t){$('updated').textContent='آخرین نرخ '+tfmt.format(new Date(t[0]*1000));$('foot').textContent='آخرین نرخ: '+dfmt.format(new Date(t[0]*1000))}\n    live.classList.toggle('stale',!last||Date.now()/1000-last>600);\n  }\n\n  async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json()}\n  async function load(fit){\n    try{\n      const have=data[city];const since=have&&have.length?have[have.length-1][0]+1:0;\n      const res=await getJSON('/api/ticks?city='+city+'&since='+since);\n      data[city]=(have&&since?have:[]).concat(res.ticks);\n      renderStats();renderChart(fit||!have);renderLive();\n    }catch(e){$('updated').textContent='اتصال برقرار نشد؛ دوباره تلاش می‌شود'}\n  }\n  async function loadSummary(){try{summary=await getJSON('/api/summary');renderCities();renderLive()}catch(e){}}\n\n  $('tfs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;\n    document.querySelectorAll('#tfs button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));tf=+b.dataset.tf;renderChart(true)});\n  $('dealBtn').addEventListener('click',()=>{dealsOnly=!dealsOnly;$('dealBtn').setAttribute('aria-pressed',String(dealsOnly));renderChart(true)});\n  $('maBtn').addEventListener('click',()=>{showMA=!showMA;$('maBtn').setAttribute('aria-pressed',String(showMA));renderChart(false)});\n\n  renderCities();loadSummary();load(true);\n  setInterval(()=>{if(!document.hidden){load(false);loadSummary()}},30000);\n  document.addEventListener('visibilitychange',()=>{if(!document.hidden){load(false);loadSummary()}});\n})();\n</script>\n</body>\n</html>\n";

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
