export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
  try {
    const q = encodeURIComponent("celiaquía celíaco gluten España");
    const xml = await (await fetch(
      `https://news.google.com/rss/search?q=${q}&hl=es&gl=ES&ceid=ES:es`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )).text();
    const items = parseRSS(xml).slice(0, 5);
    if (!items.length) throw new Error("empty");
    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function parseRSS(xml) {
  const out = [], re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const title  = clean(cdata(b,"title")  || tag(b,"title")  || "");
    const link   = tag(b,"link") || "";
    const date   = tag(b,"pubDate") || "";
    const source = clean(cdata(b,"source") || tag(b,"source") || "Google News");
    const desc   = strip(cdata(b,"description") || tag(b,"description") || "");
    if (title && link) out.push({
      title, url: link, source,
      date: relDate(date),
      summary: desc.slice(0, 200) || "Haz clic para leer la noticia.",
      category: getCategory(title),
    });
  }
  return out;
}

function getCategory(title) {
  const t = title.toLowerCase();
  if (/investigaci|estudio|científ|laborator|universid|ensayo|hallazgo/.test(t))
    return { label:"Investigación", color:"#7C3AED" };
  if (/receta|cocin|gastronom|nutrici|alimento/.test(t))
    return { label:"Gastronomía", color:"#0891B2" };
  if (/restauran|hostelería|carta|menú|bar|cafet/.test(t))
    return { label:"Hostelería", color:"#D97706" };
  if (/ley|etiquet|norma|regulaci|europa|legisl|oblig/.test(t))
    return { label:"Normativa", color:"#2563EB" };
  if (/diagnóst|síntoma|tratamient|salud|médic|clínic|doctor/.test(t))
    return { label:"Salud", color:"#DC2626" };
  if (/product|supermercad|compra|tiend|lanzamient/.test(t))
    return { label:"Productos", color:"#0D9488" };
  if (/event|congres|jornada|feria|asociaci/.test(t))
    return { label:"Eventos", color:"#9333EA" };
  return { label:"Actualidad", color:"#525252" };
}

function cdata(t, tag) {
  return t.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))?.[1]?.trim() || null;
}
function tag(t, k) {
  return t.match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)<\\/${k}>`, "i"))?.[1]?.trim() || null;
}
function clean(s) {
  return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").trim();
}
function strip(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;[^&]*&gt;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "")
    .replace(/&gt;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/href="[^"]*"/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function relDate(d) {
  if (!d) return "Reciente";
  try {
    const h = (Date.now() - new Date(d).getTime()) / 3600000;
    if (h < 1) return "Hace menos de 1h";
    if (h < 24) return `Hace ${Math.floor(h)}h`;
    const days = Math.floor(h/24);
    return days === 1 ? "Ayer" : days < 7 ? `Hace ${days} días` : "Esta semana";
  } catch { return "Reciente"; }
}
