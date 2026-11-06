// Search-engine pages: the same app, with today's rates written into the HTML so Google and Bing
// can read them (title, description, a visible summary, structured data, sitemap).
export const SITE = "https://nirkh.com";

const AF_MONTHS = ["حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله", "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"];
const faNum = s => String(s).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f2 = n => Number(n).toFixed(2);
const f0 = n => Math.round(n).toLocaleString("en-US");

function afDate(ts) {
  try {
    const pt = {};
    new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { timeZone: "Asia/Kabul", year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(new Date(ts * 1000)).forEach(x => (pt[x.type] = x.value));
    return faNum(+pt.day) + " " + AF_MONTHS[+pt.month - 1] + " " + faNum(parseInt(pt.year));
  } catch (e) { return ""; }
}
function kabulTime(ts) {
  try { return faNum(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kabul", hour: "2-digit", minute: "2-digit" }).format(new Date(ts * 1000))); }
  catch (e) { return ""; }
}
const last = s => (s && s.length ? s[s.length - 1] : null);

const MARKETS = [["kabul", "سرای شهزاده‌ی کابل"], ["mazar", "مزارشریف"], ["herat", "هرات"], ["kandahar", "قندهار"], ["jalalabad", "ننگرهار"]];
const KARATS = [["۲۴", 0.999], ["۲۲", 0.916], ["۲۱", 0.875], ["۱۸", 0.75]];

export function seoPage(PAGE, h, kind) {
  const S = (h && h.series) || {};
  const now = Math.floor(Date.now() / 1000);
  const k = last(S.kabul), oz = last(S.xau), fx = k ? k[1] : null;
  const date = afDate(now), time = k ? kabulTime(k[0]) : "";
  const rates = MARKETS.map(([c, n]) => [n, last(S[c])]).filter(x => x[1] && now - x[1][0] < 7 * 86400);
  const karats = oz && fx ? KARATS.map(([n, p]) => [n, oz[1] / 31.1035 * p * fx]) : [];
  const g18 = karats.length ? karats[3][1] : null;

  const isGold = kind === "gold";
  const title = isGold
    ? "نرخ طلا امروز در افغانستان — قیمت طلای ۱۸ و ۲۴ عیار و اونس جهانی | راهبر"
    : "نرخ دالر امروز به افغانی — سرای شهزاده کابل، مزار، هرات و قندهار | راهبر";
  const desc = isGold
    ? `نرخ طلا امروز ${date}: اونس جهانی ${oz ? "$" + f2(oz[1]) : "—"}${g18 ? "، طلای ۱۸ عیار هر گرام " + f0(g18) + " افغانی" : ""}. چارت زنده‌ی طلا، جدول عیارها و ماشین حساب زیورات — راهبر.`
    : `نرخ دالر امروز ${date}${fx ? " در سرای شهزاده‌ی کابل: " + f2(fx) + " افغانی" : ""}. نرخ زنده‌ی مزارشریف، هرات و قندهار، بازار بولی، چارت کندل‌استیک و ماشین حساب صرافی — راهبر.`;
  const url = SITE + (isGold ? "/gold" : "/");

  // Visible summary of today's rates (also what search engines read).
  const usdBlock = rates.length ? `<h2>نرخ دالر امروز به افغانی <small>${esc(date)}${time ? " · ساعت " + esc(time) + " کابل" : ""}</small></h2>
<table class="btable"><thead><tr><th>بازار</th><th>۱ دالر (افغانی)</th></tr></thead><tbody>${rates.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="num">${f2(x[1])}</td></tr>`).join("")}</tbody></table>` : "";
  const goldBlock = karats.length ? `<h2>نرخ طلا امروز در افغانستان <small>اونس جهانی $${f2(oz[1])}</small></h2>
<table class="btable"><thead><tr><th>عیار</th><th>هر گرام (افغانی)</th><th>هر مثقال (افغانی)</th></tr></thead><tbody>${karats.map(([n, g]) => `<tr><td>${n} عیار</td><td class="num">${f0(g)}</td><td class="num">${f0(g * 4.608)}</td></tr>`).join("")}</tbody></table>` : "";
  const about = `<p>راهبر (nirkh.com) نرخ زنده‌ی دالر به افغانی را از بازار سرای شهزاده‌ی کابل، کفایت مارکیت مزارشریف، هرات، قندهار و ننگرهار هر دقیقه جمع می‌کند و به شکل چارت کندل‌استیک نشان می‌دهد؛ همراه با نرخ طلا، اونس جهانی، نرخ عیارهای ۱۸ و ۲۴، بازار بولی، اخبار د افغانستان بانک و لیلام دالر، ماشین حساب صرافی و حساب دیمو برای تمرین معامله.</p>`;
  const summary = `<section class="seo" aria-label="خلاصه‌ی نرخ‌های امروز">${isGold ? goldBlock + usdBlock : usdBlock + goldBlock}${about}</section>`;

  const faq = [];
  if (fx) faq.push(["نرخ دالر امروز در کابل چند است؟", `امروز ${date} نرخ هر دالر امریکایی در سرای شهزاده‌ی کابل ${f2(fx)} افغانی است. نرخ زنده در nirkh.com هر دقیقه به‌روز می‌شود.`]);
  if (g18) faq.push(["نرخ طلای ۱۸ عیار امروز چند است؟", `امروز ${date} هر گرام طلای ۱۸ عیار حدود ${f0(g18)} افغانی است (اونس جهانی $${f2(oz[1])}، با نرخ دالر کابل).`]);
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "راهبر — نرخ", alternateName: ["Raahbar", "nirkh.com", "نرخ دالر"], url: SITE + "/", inLanguage: "fa-AF" },
    { "@context": "https://schema.org", "@type": "Organization", name: "Raahbar راهبر", url: SITE + "/", logo: SITE + "/logo.jpg" },
  ];
  if (faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

  const head = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="fa" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="keywords" content="نرخ دالر, نرخ دالر امروز, نرخ دالر به افغانی, نرخ اسعار, سرای شهزاده, قیمت طلا, نرخ طلا امروز, طلای ۱۸ عیار, افغانی, صرافی, dollar afghani rate, USD AFN, gold price Afghanistan">
<meta property="og:type" content="website">
<meta property="og:site_name" content="راهبر · nirkh.com">
<meta property="og:locale" content="fa_AF">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/logo.jpg">
<meta name="twitter:card" content="summary">
<link rel="apple-touch-icon" href="/logo.jpg">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;

  return PAGE
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace(/<meta property="og:title"[^>]*>/, "")
    .replace(/<meta property="og:description"[^>]*>/, "")
    .replace('<meta name="theme-color"', head + '\n<meta name="theme-color"')
    .replace("<!--SEO-->", summary);
}

export function sitemap() {
  const d = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}/</loc><lastmod>${d}</lastmod><changefreq>always</changefreq><priority>1.0</priority></url>
<url><loc>${SITE}/gold</loc><lastmod>${d}</lastmod><changefreq>always</changefreq><priority>0.9</priority></url>
</urlset>`;
}
