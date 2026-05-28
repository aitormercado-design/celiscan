export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate"); // cache 30 min

  try {
    const query = encodeURIComponent("celiaquía celíaco gluten España");
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=es&gl=ES&ceid=ES:es`;

    const response = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CeliScan/1.0)" },
    });

    if (!response.ok) throw new Error(`RSS error: ${response.status}`);

    const xml = await response.text();
    const items = parseRSS(xml).slice(0, 5);

    if (!items.length) throw new Error("No items parsed");

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── RSS parser ────────────────────────────────────────────────
function parseRSS(xml) {
  const results = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title   = cdata(block, "title")   || tag(block, "title")   || "";
    const link    = tag(block, "link")       || "";
    const pubDate = tag(block, "pubDate")    || "";
    const source  = cdata(block, "source")   || tag(block, "source")  || "Google News";
    const desc    = cdata(block, "description") || tag(block, "description") || "";

    const cleanTitle = decode(title);
    const cleanDesc  = stripHtml(desc).slice(0, 220) || "Haz clic para leer la noticia completa.";

    if (cleanTitle && link) {
      results.push({
        title:   cleanTitle,
        url:     link,
        source:  decode(source),
        date:    relativeDate(pubDate),
        summary: cleanDesc,
      });
    }
  }

  return results;
}

function cdata(text, tag) {
  const m = text.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  return m?.[1]?.trim() || null;
}

function tag(text, t) {
  const m = text.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i"));
  return m?.[1]?.trim() || null;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decode(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .trim();
}

function relativeDate(dateStr) {
  if (!dateStr) return "Reciente";
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 3600000; // hours
    if (diff < 1)  return "Hace menos de 1h";
    if (diff < 24) return `Hace ${Math.floor(diff)}h`;
    const d = Math.floor(diff / 24);
    if (d === 1) return "Ayer";
    if (d < 7)  return `Hace ${d} días`;
    return "Esta semana";
  } catch {
    return "Reciente";
  }
}
