import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, MapPin, Heart, Home, ChevronRight,
  CheckCircle, AlertTriangle, XCircle, ArrowLeft,
  Shield, RefreshCw, ExternalLink, Plus, Clock,
} from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const C = {
  safe:"#1E8E5A", safeLight:"#EAF6F0", safeMid:"#D0EBE0", safeBorder:"#B2DAC7",
  warning:"#E6A700", warningLight:"#FFF9E6", warningBorder:"#F5D98A",
  danger:"#C44536", dangerLight:"#FDECEA", dangerBorder:"#F0A89E",
  bg:"#F8FAF8", card:"#FFFFFF", cardAlt:"#F4F7F4",
  text:"#1A1A1A", sub:"#6B7280", border:"#E8EDE8",
};
const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{display:none;}
  textarea:focus,input:focus{outline:none;}
  button{font-family:inherit;}
  a{-webkit-tap-highlight-color:transparent;}

  @keyframes fadeUp  {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn   {from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
  @keyframes slideUp {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes ring    {0%{transform:scale(.5);opacity:.8}100%{transform:scale(2.2);opacity:0}}
  @keyframes spin    {to{transform:rotate(360deg)}}
  @keyframes glow    {0%,100%{box-shadow:0 0 0 0 rgba(30,142,90,.35)}50%{box-shadow:0 0 0 12px rgba(30,142,90,0)}}
  @keyframes shimmer {0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes pulse   {0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.15);opacity:1}}

  .screen-enter{animation:fadeUp .28s cubic-bezier(.22,.68,0,1.2) both;}
  .pop-in      {animation:popIn .32s cubic-bezier(.22,.68,0,1.3) both;}
  .slide-up    {animation:slideUp .3s ease both;}
  .spinner     {animation:spin .9s linear infinite;}
  .shimmer-bg  {background:linear-gradient(90deg,#f0f3f0 25%,#e4e9e4 50%,#f0f3f0 75%);
                background-size:200% 100%;animation:shimmer 1.4s infinite;}
  .tap-active:active{transform:scale(.97);transition:transform .1s;}
`;

// ── Gemini Flash (free tier: 1500 req/day) ───────────────────
const GEMINI_MODEL = "gemini-1.5-flash";

const callGemini = async (parts) => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("Falta VITE_GEMINI_API_KEY en las variables de entorno de Vercel");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const parseJSON = (text) => {
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ data: reader.result.split(",")[1], type: file.type });
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// ── Leaflet ───────────────────────────────────────────────────
let _leafletPromise = null;
const loadLeaflet = () => {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve) => {
    if (window.L) { resolve(window.L); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    document.head.appendChild(script);
  });
  return _leafletPromise;
};

// ── Overpass API ──────────────────────────────────────────────
const fetchNearby = async (lat, lng) => {
  const q = `[out:json][timeout:15];
(node["amenity"~"restaurant|cafe|bar|fast_food"](around:800,${lat},${lng}););
out 30;`;
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
  const data = await res.json();
  return (data.elements || [])
    .filter(e => e.tags?.name)
    .slice(0, 22)
    .map(e => ({
      id: String(e.id),
      name: e.tags.name,
      lat: e.lat,
      lng: e.lon,
      cuisine: e.tags.cuisine?.replace(/_/g, " ") || "Restaurante",
      address: [e.tags["addr:street"], e.tags["addr:housenumber"]].filter(Boolean).join(" "),
      glutenFree: e.tags["diet:gluten_free"] === "yes",
      website: e.tags.website || e.tags["contact:website"] || "",
    }));
};

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return d < 1000 ? `${Math.round(d)} m` : `${(d/1000).toFixed(1)} km`;
};

// ── Shared components ─────────────────────────────────────────
const sColor  = s => s==="safe"?C.safe    :s==="warning"?C.warning    :C.danger;
const sBg     = s => s==="safe"?C.safeLight:s==="warning"?C.warningLight:C.dangerLight;
const sBorder = s => s==="safe"?C.safeBorder:s==="warning"?C.warningBorder:C.dangerBorder;
const sLabel  = s => s==="safe"?"SEGURO"  :s==="warning"?"PRECAUCIÓN"  :"NO APTO";

function StatusIcon({ status, size=22 }) {
  const col = sColor(status);
  if (status==="safe")    return <CheckCircle  size={size} color={col} strokeWidth={2.5}/>;
  if (status==="warning") return <AlertTriangle size={size} color={col} strokeWidth={2.5}/>;
  return <XCircle size={size} color={col} strokeWidth={2.5}/>;
}

function SafetyPill({ status, size="sm" }) {
  const fs = size==="lg"?13:size==="md"?12:10.5;
  const pd = size==="lg"?"7px 16px":size==="md"?"5px 12px":"4px 9px";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, backgroundColor:sBg(status),
      color:sColor(status), border:`1.5px solid ${sBorder(status)}`, borderRadius:100,
      padding:pd, fontSize:fs, fontWeight:800, letterSpacing:.7, whiteSpace:"nowrap" }}>
      <StatusIcon status={status} size={fs+2}/>{sLabel(status)}
    </span>
  );
}

function Card({ children, style={}, onClick, className="" }) {
  return (
    <div className={`${onClick?"tap-active":""} ${className}`} onClick={onClick} style={{
      backgroundColor:C.card, borderRadius:20, padding:18,
      boxShadow:"0 2px 18px rgba(0,0,0,.055)", border:`1px solid ${C.border}`,
      cursor:onClick?"pointer":"default", ...style }}>
      {children}
    </div>
  );
}

function BackBtn({ onBack, label="Atrás" }) {
  return (
    <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:5, color:C.safe,
      background:C.safeLight, border:`1px solid ${C.safeBorder}`, borderRadius:100,
      padding:"7px 14px 7px 10px", cursor:"pointer", fontSize:14, fontWeight:700 }}>
      <ArrowLeft size={16} strokeWidth={2.5}/> {label}
    </button>
  );
}

function Skeleton() {
  return <div className="shimmer-bg" style={{ height:120, borderRadius:20, marginBottom:14 }}/>;
}

// ── HOME SCREEN ───────────────────────────────────────────────
function HomeScreen() {
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const greeting = (() => {
    const h = new Date().getHours();
    return h<12 ? "Buenos días" : h<18 ? "Buenas tardes" : "Buenas noches";
  })();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("RSS error");
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error("sin datos");
      setNews(data.slice(0, 5));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      {/* Header */}
      <div style={{ padding:"28px 22px 24px", background:`linear-gradient(160deg,${C.safeLight} 0%,${C.bg} 100%)`,
        borderBottom:`1px solid ${C.safeBorder}`, marginBottom:4 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:13, color:C.sub, fontWeight:600, marginBottom:5 }}>{greeting} 👋</p>
            <h1 style={{ fontSize:28, fontWeight:800, color:C.text, lineHeight:1.15, letterSpacing:-.5 }}>
              Sin gluten,<br/><span style={{ color:C.safe }}>sin preocupaciones</span>
            </h1>
          </div>
          <img src="/logo.png" alt="CeliScan"
            style={{ width:56, height:56, borderRadius:18, objectFit:"cover",
              boxShadow:`0 6px 20px rgba(0,0,0,.12)` }}/>
        </div>
      </div>

      {/* News */}
      <div style={{ padding:"16px 20px 100px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:800, color:C.text, letterSpacing:-.3 }}>Noticias del día</h2>
            <p style={{ fontSize:12, color:C.sub, marginTop:2 }}>Celiaquía en España</p>
          </div>
          <button onClick={load} disabled={loading} style={{ width:38, height:38, borderRadius:13,
            backgroundColor:C.cardAlt, border:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <RefreshCw size={16} color={loading ? C.safe : C.sub}
              className={loading ? "spinner" : ""}/>
          </button>
        </div>

        {loading && [1,2,3,4,5].map(i => <Skeleton key={i}/>)}

        {!loading && error && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <p style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>
              No se pudieron cargar las noticias
            </p>
            <p style={{ fontSize:13, color:C.sub, marginBottom:20, lineHeight:1.6 }}>
              Comprueba tu conexión e inténtalo de nuevo
            </p>
            <button onClick={load} style={{ backgroundColor:C.safe, color:"#fff", border:"none",
              borderRadius:14, padding:"13px 28px", fontSize:15, fontWeight:700, cursor:"pointer" }}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && news.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration:"none", display:"block", marginBottom:14 }}>
            <div className="tap-active slide-up" style={{ backgroundColor:C.card, borderRadius:20, padding:18,
              boxShadow:"0 2px 16px rgba(0,0,0,.06)", border:`1px solid ${C.border}`,
              animationDelay:`${i*.07}s` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <p style={{ fontSize:15, fontWeight:800, color:C.text, lineHeight:1.35,
                  letterSpacing:-.2, flex:1, paddingRight:10 }}>{item.title}</p>
                <ExternalLink size={15} color={C.safe} style={{ flexShrink:0, marginTop:2 }}/>
              </div>
              <p style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:12 }}>{item.summary}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.safe, backgroundColor:C.safeLight,
                  border:`1px solid ${C.safeBorder}`, borderRadius:100, padding:"3px 10px" }}>
                  {item.source}
                </span>
                <span style={{ fontSize:11, color:C.sub, display:"flex", alignItems:"center", gap:4 }}>
                  <Clock size={11} color={C.sub}/> {item.date}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── SCAN SCREEN ───────────────────────────────────────────────
function ScanScreen() {
  const [phase, setPhase]         = useState("ready"); // ready|analyzing|result|error
  const [result, setResult]       = useState(null);
  const [errMsg, setErrMsg]       = useState("");
  const [preview, setPreview]     = useState(null);
  const inputRef                  = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    setPreview(URL.createObjectURL(file));
    setPhase("analyzing");
    try {
      const { data, type } = await fileToBase64(file);
      const geminiText = await callGemini([
        { inline_data: { mime_type: type, data } },
        { text: `Eres un experto en celiaquía. Analiza esta imagen de etiqueta o producto alimentario.

Responde ÚNICAMENTE con JSON válido sin backticks:
{"status":"safe/warning/danger","confidence":0-100,"productName":"nombre o null","brand":"marca o null","ingredients":[{"name":"...","risk":"safe/warning/danger","note":"opcional"}],"reason":"Explicación en español","alternatives":["alternativa..."]}
Si no ves etiqueta: {"error":"No se detecta etiqueta en la imagen"}` }
      ]);
      const parsed = parseJSON(geminiText);
      if (parsed.error) { setErrMsg(parsed.error); setPhase("error"); }
      else { setResult(parsed); setPhase("result"); }
    } catch(err) {
      setErrMsg("Error al analizar. Inténtalo de nuevo.");
      setPhase("error");
    }
  };

  const reset = () => { setPhase("ready"); setResult(null); setPreview(null); setErrMsg(""); };

  // READY
  if (phase === "ready") return (
    <div style={{ flex:1, height:"100%", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"32px 28px", backgroundColor:"#0C0C0E", position:"relative" }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>
      <div style={{ position:"absolute", inset:0, opacity:.04,
        backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize:"40px 40px", pointerEvents:"none" }}/>
      <div style={{ textAlign:"center", position:"relative", zIndex:1 }}>
        <img src="/logo.png" alt="CeliScan"
            style={{ width:110, height:110, borderRadius:32, objectFit:"cover",
              margin:"0 auto 32px", display:"block",
              boxShadow:"0 8px 32px rgba(0,0,0,.35)" }}/>
        <h2 style={{ color:"#fff", fontSize:26, fontWeight:800, marginBottom:12, letterSpacing:-.4 }}>
          Escanear Producto
        </h2>
        <p style={{ color:"rgba(255,255,255,.45)", fontSize:14, lineHeight:1.65, marginBottom:44, maxWidth:260 }}>
          Haz una foto a la lista de ingredientes o al código de barras del producto
        </p>
        <button onClick={() => inputRef.current?.click()} style={{ width:"100%", height:64,
          borderRadius:22, fontSize:18, fontWeight:800, backgroundColor:C.safe,
          border:"none", cursor:"pointer", color:"#fff", letterSpacing:-.3,
          boxShadow:`0 8px 32px ${C.safe}60` }}>
          📸 Abrir cámara
        </button>
      </div>
    </div>
  );

  // ANALYZING
  if (phase === "analyzing") return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:28, backgroundColor:C.bg }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>
      {preview && (
        <div style={{ width:160, height:160, borderRadius:24, overflow:"hidden", marginBottom:28,
          boxShadow:"0 8px 32px rgba(0,0,0,.15)", border:`3px solid ${C.safe}` }}>
          <img src={preview} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        </div>
      )}
      <div style={{ width:68, height:68, borderRadius:34, backgroundColor:C.safeLight,
        border:`2px solid ${C.safeBorder}`, display:"flex", alignItems:"center",
        justifyContent:"center", marginBottom:20 }}>
        <Shield size={32} color={C.safe} strokeWidth={2} className="spinner"/>
      </div>
      <p style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:8, letterSpacing:-.3 }}>Analizando...</p>
      <p style={{ fontSize:14, color:C.sub, textAlign:"center", lineHeight:1.6 }}>
        La IA revisa cada ingrediente contra nuestra base de datos
      </p>
    </div>
  );

  // ERROR
  if (phase === "error") return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:28, backgroundColor:C.bg }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>
      {preview && (
        <div style={{ width:130, height:130, borderRadius:20, overflow:"hidden", marginBottom:20,
          opacity:.55, border:`2px solid ${C.border}` }}>
          <img src={preview} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        </div>
      )}
      <div style={{ width:64, height:64, borderRadius:32, backgroundColor:C.warningLight,
        border:`2px solid ${C.warningBorder}`, display:"flex", alignItems:"center",
        justifyContent:"center", marginBottom:18 }}>
        <AlertTriangle size={30} color={C.warning} strokeWidth={2}/>
      </div>
      <p style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:8, textAlign:"center" }}>
        No se pudo analizar
      </p>
      <p style={{ fontSize:14, color:C.sub, textAlign:"center", lineHeight:1.6, marginBottom:32 }}>{errMsg}</p>
      <button onClick={reset} style={{ width:"100%", height:56, borderRadius:18,
        fontSize:15, fontWeight:800, backgroundColor:C.safe, border:"none",
        cursor:"pointer", color:"#fff", marginBottom:12 }}>
        Intentar de nuevo
      </button>
      <button onClick={reset} style={{ background:"none", border:"none", color:C.sub,
        fontSize:14, fontWeight:600, cursor:"pointer" }}>Cancelar</button>
    </div>
  );

  // RESULT
  if (phase === "result" && result) return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>

      {/* Hero */}
      <div style={{ background:`linear-gradient(175deg,${sBg(result.status)} 0%,${C.bg} 100%)`,
        padding:"24px 22px 32px", borderBottom:`1px solid ${sBorder(result.status)}` }}>
        <div style={{ marginBottom:20 }}>
          <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:5,
            color:sColor(result.status), background:"rgba(255,255,255,.7)",
            border:`1px solid ${sBorder(result.status)}`, borderRadius:100,
            padding:"7px 14px 7px 10px", cursor:"pointer", fontSize:14, fontWeight:700 }}>
            <ArrowLeft size={16} strokeWidth={2.5}/> Nueva foto
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
          <div className="pop-in" style={{ width:96, height:96, borderRadius:48,
            backgroundColor:sColor(result.status)+"20", border:`3px solid ${sColor(result.status)+"35"}`,
            display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18,
            animation: result.status==="safe" ? "glow 2.5s ease infinite" : "popIn .35s ease both" }}>
            <StatusIcon status={result.status} size={48}/>
          </div>
          <SafetyPill status={result.status} size="lg"/>
          {result.productName && (
            <h1 style={{ fontSize:20, fontWeight:800, color:C.text, marginTop:14, marginBottom:4,
              lineHeight:1.25, letterSpacing:-.3 }}>{result.productName}</h1>
          )}
          {result.brand && <p style={{ fontSize:14, color:C.sub, marginBottom:14 }}>{result.brand}</p>}
          <div style={{ backgroundColor:"rgba(255,255,255,.75)", backdropFilter:"blur(6px)",
            border:`1px solid ${sBorder(result.status)}`, borderRadius:16, padding:"12px 18px",
            fontSize:13, color:C.text, lineHeight:1.6, maxWidth:290 }}>{result.reason}</div>
        </div>
      </div>

      <div style={{ padding:"20px 20px 100px" }}>
        {/* Confidence */}
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <p style={{ fontSize:15, fontWeight:800, color:C.text }}>Confianza IA</p>
            <span style={{ fontSize:24, fontWeight:900, color:sColor(result.status) }}>
              {result.confidence}%
            </span>
          </div>
          <div style={{ height:8, backgroundColor:"#E8EDE8", borderRadius:100, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${result.confidence}%`,
              background:`linear-gradient(90deg,${sColor(result.status)},${sColor(result.status)}99)`,
              borderRadius:100, transition:"width 1.2s ease" }}/>
          </div>
        </Card>

        {/* Ingredients */}
        {!!result.ingredients?.length && (
          <Card style={{ marginBottom:14 }}>
            <h3 style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:14, letterSpacing:-.2 }}>
              Análisis de Ingredientes
            </h3>
            {result.ingredients.map((ing, i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
                paddingTop:i>0?12:0, paddingBottom:12, borderTop:i>0?`1px solid ${C.border}`:"none", gap:12 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:ing.note?3:0 }}>{ing.name}</p>
                  {ing.note && <p style={{ fontSize:12, color:C.sub, lineHeight:1.4 }}>{ing.note}</p>}
                </div>
                <SafetyPill status={ing.risk}/>
              </div>
            ))}
          </Card>
        )}

        {/* Alternatives */}
        {!!result.alternatives?.length && (
          <Card style={{ marginBottom:14, backgroundColor:C.safeLight, borderColor:C.safeBorder }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:34, height:34, borderRadius:11, backgroundColor:C.safe,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Shield size={17} color="#fff" strokeWidth={2.5}/>
              </div>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.safe }}>Alternativas Seguras</h3>
            </div>
            {result.alternatives.map((alt, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                paddingTop:i>0?10:0, borderTop:i>0?`1px solid ${C.safeBorder}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <CheckCircle size={15} color={C.safe} strokeWidth={2.5}/>
                  <span style={{ fontSize:14, color:"#1A4030", fontWeight:600 }}>{alt}</span>
                </div>
                <ChevronRight size={15} color={C.safe}/>
              </div>
            ))}
          </Card>
        )}

        <button onClick={() => inputRef.current?.click()} style={{ width:"100%", height:56,
          borderRadius:18, fontSize:16, fontWeight:800, backgroundColor:C.safe, border:"none",
          cursor:"pointer", color:"#fff", boxShadow:`0 5px 20px ${C.safe}50`,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Camera size={18} color="#fff" strokeWidth={2.5}/> Escanear otro producto
        </button>
      </div>
    </div>
  );

  return null;
}

// ── RESTAURANTS SCREEN ────────────────────────────────────────
function RestaurantsScreen({ favorites, toggleFavorite }) {
  const [location, setLocation]             = useState(null);
  const [restaurants, setRestaurants]       = useState([]);
  const [loadingLoc, setLoadingLoc]         = useState(true);
  const [locError, setLocError]             = useState(false);
  const [viewMode, setViewMode]             = useState("list");
  const [filter, setFilter]                 = useState("all");
  const [analyzePhase, setAnalyzePhase]     = useState("idle"); // idle|analyzing|result|error
  const [analyzeResult, setAnalyzeResult]   = useState(null);
  const [selectedRest, setSelectedRest]     = useState(null);

  const mapRef      = useRef(null);
  const mapInst     = useRef(null);
  const inputRef    = useRef(null);

  // Geolocation + Overpass
  useEffect(() => {
    if (!navigator.geolocation) { setLocError(true); setLoadingLoc(false); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setLocation({ lat, lng });
        try { setRestaurants(await fetchNearby(lat, lng)); } catch {}
        setLoadingLoc(false);
      },
      () => { setLocError(true); setLoadingLoc(false); },
      { timeout:12000, enableHighAccuracy:true }
    );
  }, []);

  // Leaflet map
  useEffect(() => {
    if (viewMode !== "map" || !location) return;
    let destroyed = false;
    const init = async () => {
      const L = await loadLeaflet();
      if (destroyed || !mapRef.current) return;
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

      const map = L.map(mapRef.current, { zoomControl:false })
        .setView([location.lat, location.lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:"© OpenStreetMap"
      }).addTo(map);

      // User pin
      L.circleMarker([location.lat, location.lng], {
        radius:9, fillColor:C.safe, color:"#fff", weight:3, fillOpacity:1,
      }).addTo(map).bindPopup("📍 Estás aquí");

      // Restaurant pins
      const list = filter === "favorites"
        ? restaurants.filter(r => favorites.includes(r.id))
        : restaurants;

      list.forEach(r => {
        const isFav = favorites.includes(r.id);
        const col   = r.glutenFree ? C.safe : "#555";
        const icon  = L.divIcon({
          html: `<div style="width:34px;height:34px;border-radius:50%;background:${col};border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.3);font-size:15px;">${isFav?"❤️":"🍴"}</div>`,
          iconSize:[34,34], iconAnchor:[17,17], className:"",
        });
        L.marker([r.lat, r.lng], { icon }).addTo(map)
          .bindPopup(`<b style="font-family:sans-serif">${r.name}</b><br/><small>${r.cuisine}${r.glutenFree?" · ✓ Sin gluten":""}</small>`);
      });

      mapInst.current = map;
    };
    init();
    return () => { destroyed = true; if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [viewMode, location, restaurants, filter, favorites]);

  // Restaurant photo handler
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    setAnalyzePhase("analyzing");
    try {
      const { data, type } = await fileToBase64(file);
      const ctx = selectedRest
        ? `El restaurante se llama "${selectedRest.name}", cocina: ${selectedRest.cuisine}.` : "";
      const geminiText = await callGemini([
        { inline_data: { mime_type: type, data } },
        { text: `Analiza esta imagen de restaurante para una persona celíaca. ${ctx}
La imagen puede ser fachada, menú, carta, interior o platos.

Responde ÚNICAMENTE con JSON válido sin backticks:
{"restaurantName":"nombre o null","status":"safe/warning/danger","confidence":0-100,"summary":"2-3 frases sobre seguridad celíaca","positives":["..."],"warnings":["..."],"glutenFreeOptions":["..."],"questionsToAsk":["..."],"recommendations":["..."]}` }
      ]);
      const parsed = parseJSON(geminiText);
      setAnalyzeResult(parsed);
      setAnalyzePhase("result");
    } catch {
      setAnalyzePhase("error");
    }
    setSelectedRest(null);
  };

  const displayed = filter === "favorites"
    ? restaurants.filter(r => favorites.includes(r.id))
    : restaurants;

  // ── Restaurant analysis result ──
  if (analyzePhase === "result" && analyzeResult) {
    const r = analyzeResult;
    return (
      <div style={{ height:"100%", overflowY:"auto" }}>
        <div style={{ background:`linear-gradient(175deg,${sBg(r.status)} 0%,${C.bg} 100%)`,
          padding:"24px 22px 32px", borderBottom:`1px solid ${sBorder(r.status)}` }}>
          <div style={{ marginBottom:20 }}>
            <BackBtn onBack={() => { setAnalyzePhase("idle"); setAnalyzeResult(null); }}/>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
            <div className="pop-in" style={{ width:88, height:88, borderRadius:44,
              backgroundColor:sColor(r.status)+"20", border:`3px solid ${sColor(r.status)+"35"}`,
              display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
              <StatusIcon status={r.status} size={44}/>
            </div>
            <SafetyPill status={r.status} size="lg"/>
            {r.restaurantName && (
              <h1 style={{ fontSize:20, fontWeight:800, color:C.text, marginTop:14, marginBottom:4 }}>
                {r.restaurantName}
              </h1>
            )}
            <p style={{ fontSize:13, color:C.sub, marginTop:12, lineHeight:1.6, maxWidth:280 }}>{r.summary}</p>
          </div>
        </div>

        <div style={{ padding:"20px 20px 100px", display:"flex", flexDirection:"column", gap:14 }}>
          {!!r.positives?.length && (
            <Card style={{ borderColor:C.safeBorder, backgroundColor:C.safeLight }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.safe, marginBottom:12 }}>✅ Puntos positivos</h3>
              {r.positives.map((p,i) => <p key={i} style={{ fontSize:13, color:"#1A4030", marginBottom:6, lineHeight:1.5 }}>• {p}</p>)}
            </Card>
          )}
          {!!r.warnings?.length && (
            <Card style={{ borderColor:C.warningBorder, backgroundColor:C.warningLight }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.warning, marginBottom:12 }}>⚠️ Advertencias</h3>
              {r.warnings.map((w,i) => <p key={i} style={{ fontSize:13, color:"#6B4C00", marginBottom:6, lineHeight:1.5 }}>• {w}</p>)}
            </Card>
          )}
          {!!r.glutenFreeOptions?.length && (
            <Card>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:12 }}>🍽️ Opciones sin gluten</h3>
              {r.glutenFreeOptions.map((o,i) => <p key={i} style={{ fontSize:13, color:C.text, marginBottom:6, lineHeight:1.5 }}>• {o}</p>)}
            </Card>
          )}
          {!!r.questionsToAsk?.length && (
            <Card>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:12 }}>💬 Pregunta al camarero</h3>
              {r.questionsToAsk.map((q,i) => (
                <div key={i} style={{ backgroundColor:C.cardAlt, borderRadius:12, padding:"10px 14px", marginBottom:i<r.questionsToAsk.length-1?8:0 }}>
                  <p style={{ fontSize:13, color:C.text, fontWeight:600, lineHeight:1.5 }}>"{q}"</p>
                </div>
              ))}
            </Card>
          )}
          {!!r.recommendations?.length && (
            <Card>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:12 }}>💡 Recomendaciones</h3>
              {r.recommendations.map((rec,i) => <p key={i} style={{ fontSize:13, color:C.sub, marginBottom:6, lineHeight:1.5 }}>• {rec}</p>)}
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (analyzePhase === "analyzing") return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:28, backgroundColor:C.bg }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>
      <div style={{ width:72, height:72, borderRadius:36, backgroundColor:C.safeLight,
        border:`2px solid ${C.safeBorder}`, display:"flex", alignItems:"center",
        justifyContent:"center", marginBottom:20 }}>
        <MapPin size={34} color={C.safe} strokeWidth={2} className="spinner"/>
      </div>
      <p style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:8 }}>Analizando restaurante...</p>
      <p style={{ fontSize:14, color:C.sub, textAlign:"center", lineHeight:1.6 }}>
        Evaluando el nivel de seguridad para celíacos
      </p>
    </div>
  );

  // ── Main restaurants list/map ──
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={handlePhoto} style={{ display:"none" }}/>

      {/* Header */}
      <div style={{ padding:"20px 20px 0", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:C.text, letterSpacing:-.4 }}>Restaurantes</h1>
            <p style={{ fontSize:13, color:C.sub, marginTop:3 }}>
              {loadingLoc ? "Buscando cerca de ti..." : locError ? "Ubicación no disponible" : `${restaurants.length} encontrados`}
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[{id:"list",icon:"☰"},{id:"map",icon:"🗺️"}].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)} style={{ width:40, height:40,
                borderRadius:13, backgroundColor:viewMode===v.id?C.safe:C.cardAlt,
                border:`1.5px solid ${viewMode===v.id?C.safe:C.border}`,
                cursor:"pointer", fontSize:18, transition:"all .2s" }}>{v.icon}</button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[{id:"all",label:"Todos"},{id:"favorites",label:"❤️ Favoritos"}].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding:"8px 18px",
              borderRadius:100, fontSize:13, fontWeight:700,
              backgroundColor:filter===f.id?C.safe:C.cardAlt,
              border:`1.5px solid ${filter===f.id?C.safe:C.border}`,
              color:filter===f.id?"#fff":C.sub, cursor:"pointer", transition:"all .2s" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Photo CTA */}
        <button onClick={() => { setSelectedRest(null); inputRef.current?.click(); }}
          style={{ width:"100%", height:50, borderRadius:16, marginBottom:14,
            backgroundColor:"#111", border:"none", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            boxShadow:"0 4px 16px rgba(0,0,0,.18)" }}>
          <Camera size={18} color={C.safe} strokeWidth={2.5}/>
          <span style={{ fontSize:14, fontWeight:800, color:"#fff" }}>
            📷 Analizar restaurante con foto
          </span>
        </button>
      </div>

      {locError && (
        <div style={{ margin:"0 20px 12px", backgroundColor:C.warningLight,
          border:`1px solid ${C.warningBorder}`, borderRadius:14, padding:"12px 16px" }}>
          <p style={{ fontSize:13, color:C.warning, fontWeight:600 }}>
            Activa la localización para ver restaurantes cercanos
          </p>
        </div>
      )}

      {/* Map */}
      {viewMode === "map" && (
        <div style={{ margin:"0 20px 14px", height:230, borderRadius:20, overflow:"hidden",
          border:`1px solid ${C.border}`, flexShrink:0,
          backgroundColor:loadingLoc?"#E0E8E0":"transparent" }}>
          {loadingLoc
            ? <div className="shimmer-bg" style={{ width:"100%", height:"100%" }}/>
            : <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>
          }
        </div>
      )}

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 100px" }}>
        {loadingLoc
          ? [1,2,3,4].map(i => <Skeleton key={i}/>)
          : displayed.length === 0
          ? (
            <div style={{ textAlign:"center", padding:"48px 24px" }}>
              <div style={{ fontSize:40, marginBottom:14 }}>{filter==="favorites"?"❤️":"🗺️"}</div>
              <p style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:8 }}>
                {filter==="favorites" ? "Sin favoritos aún" : "Sin restaurantes cerca"}
              </p>
              <p style={{ fontSize:13, color:C.sub, lineHeight:1.6 }}>
                {filter==="favorites"
                  ? "Marca restaurantes con ❤️ para guardarlos aquí"
                  : "No se encontraron restaurantes en 800 m"}
              </p>
            </div>
          )
          : displayed.map((r, idx) => {
            const isFav = favorites.includes(r.id);
            const dist  = location ? haversine(location.lat, location.lng, r.lat, r.lng) : null;
            return (
              <div key={r.id} className="slide-up" style={{ backgroundColor:C.card, borderRadius:20,
                padding:18, marginBottom:14, boxShadow:"0 2px 14px rgba(0,0,0,.06)",
                border:`1.5px solid ${r.glutenFree?C.safeBorder:C.border}`,
                animationDelay:`${idx*.04}s` }}>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1, paddingRight:10 }}>
                    <h3 style={{ fontSize:15, fontWeight:800, color:C.text, letterSpacing:-.2, marginBottom:3 }}>
                      {r.name}
                    </h3>
                    <p style={{ fontSize:12, color:C.sub, fontWeight:500, textTransform:"capitalize" }}>
                      {r.cuisine}
                    </p>
                  </div>
                  <button onClick={() => toggleFavorite(r.id)} style={{ width:38, height:38,
                    borderRadius:12, backgroundColor:isFav?C.dangerLight:C.cardAlt,
                    border:`1.5px solid ${isFav?C.dangerBorder:C.border}`,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0, transition:"all .2s" }}>
                    <Heart size={17} color={isFav?C.danger:C.sub}
                      fill={isFav?C.danger:"none"} strokeWidth={2.5}/>
                  </button>
                </div>

                {r.glutenFree && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                    backgroundColor:C.safeLight, border:`1px solid ${C.safeBorder}`,
                    borderRadius:10, padding:"5px 12px", marginBottom:10 }}>
                    <CheckCircle size={13} color={C.safe} strokeWidth={2.5}/>
                    <span style={{ fontSize:11, color:C.safe, fontWeight:800 }}>Sin gluten verificado</span>
                  </div>
                )}

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    {dist && (
                      <span style={{ fontSize:12, color:C.sub, display:"flex", alignItems:"center", gap:4 }}>
                        <MapPin size={11} color={C.sub}/> {dist}
                      </span>
                    )}
                    {r.address && (
                      <p style={{ fontSize:11, color:C.sub, marginTop:2,
                        maxWidth:190, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {r.address}
                      </p>
                    )}
                  </div>
                  <button onClick={() => { setSelectedRest(r); inputRef.current?.click(); }}
                    style={{ padding:"8px 14px", borderRadius:12, backgroundColor:"#111",
                      border:"none", cursor:"pointer", fontSize:12, fontWeight:800,
                      color:C.safe, display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                    <Camera size={13} color={C.safe} strokeWidth={2.5}/> Analizar
                  </button>
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────
function BottomNav({ active, nav }) {
  const items = [
    { id:"home",        icon:Home,   label:"Inicio"      },
    { id:"scan",        icon:Camera, label:"Escanear", center:true },
    { id:"restaurants", icon:MapPin, label:"Restaurantes" },
  ];
  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0,
      backgroundColor:"rgba(255,255,255,.94)", backdropFilter:"blur(14px)",
      borderTop:`1px solid ${C.border}`, padding:"10px 6px 28px",
      display:"flex", justifyContent:"space-around", alignItems:"flex-end" }}>
      {items.map(item => {
        const Icon = item.icon;
        const on   = active === item.id;
        if (item.center) return (
          <button key={item.id} onClick={() => nav("scan")} style={{ display:"flex",
            flexDirection:"column", alignItems:"center", background:"none",
            border:"none", cursor:"pointer", marginTop:-22 }}>
            <div style={{ width:60, height:60, borderRadius:22, overflow:"hidden",
              boxShadow:`0 6px 24px ${C.safe}60`, border:"3px solid #fff", flexShrink:0 }}>
              <img src="/logo.png" alt="Escanear"
                style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            </div>
            <span style={{ fontSize:10, color:C.safe, marginTop:5, fontWeight:800 }}>Escanear</span>
          </button>
        );
        return (
          <button key={item.id} onClick={() => nav(item.id)} style={{ display:"flex",
            flexDirection:"column", alignItems:"center", gap:4, background:"none",
            border:"none", cursor:"pointer", minWidth:70, padding:"4px 0" }}>
            <div style={{ width:36, height:36, borderRadius:13,
              backgroundColor:on?C.safeLight:"transparent",
              display:"flex", alignItems:"center", justifyContent:"center", transition:"background .2s" }}>
              <Icon size={21} color={on?C.safe:C.sub} strokeWidth={on?2.5:1.8}/>
            </div>
            <span style={{ fontSize:10, fontWeight:on?800:500,
              color:on?C.safe:C.sub, transition:"color .2s" }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────
export default function CeliScan() {
  const [screen, setScreen]       = useState("home");
  const [favorites, setFavorites] = useState([]);

  const nav = useCallback(s => setScreen(s), []);
  const toggleFavorite = useCallback(id =>
    setFavorites(prev => prev.includes(id) ? prev.filter(f=>f!==id) : [...prev, id]), []);

  const renderScreen = () => {
    switch(screen) {
      case "home":        return <HomeScreen/>;
      case "scan":        return <ScanScreen/>;
      case "restaurants": return <RestaurantsScreen favorites={favorites} toggleFavorite={toggleFavorite}/>;
      default:            return <HomeScreen/>;
    }
  };

  const dark = screen === "scan";

  return (
    <>
      <style>{CSS}</style>
      <div style={{ position:"fixed", inset:0,
        background:"linear-gradient(145deg,#B8CEBA 0%,#CAD9C8 40%,#B0C4B2 100%)",
        display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT }}>
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(30,142,90,.15) 0%,transparent 70%)",
          top:-80, right:-80, pointerEvents:"none" }}/>

        {/* Phone frame — sin status bar */}
        <div style={{ width:390, maxWidth:"100vw",
          height:Math.min(844, window.innerHeight - 20),
          backgroundColor:dark?"#0C0C0E":C.bg, borderRadius:54, overflow:"hidden",
          position:"relative", fontFamily:FONT,
          boxShadow:"0 50px 130px rgba(0,0,0,.45),0 0 0 1.5px rgba(255,255,255,.5) inset" }}>

          <div key={screen} className="screen-enter" style={{ position:"absolute",
            top:0, bottom:88, left:0, right:0, overflowY:"hidden",
            backgroundColor:dark?"#0C0C0E":C.bg }}>
            {renderScreen()}
          </div>

          <BottomNav active={screen} nav={nav}/>
        </div>
      </div>
    </>
  );
}
