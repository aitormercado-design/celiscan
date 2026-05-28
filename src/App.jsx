import { useState, useEffect, useRef, useCallback } from "react";
import { Home, Camera, MapPin, ArrowLeft, RefreshCw, ChevronRight } from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const T = {
  primary:"#0A0A0A", secondary:"#6B6B6B", tertiary:"#9E9E9E",
  bg:"#FAFAF8", surface:"#FFFFFF", line:"#EFEFED", border:"#E0E0DE",
  safe:"#15803D", safeBg:"#F0FDF4",
  warning:"#B45309", warningBg:"#FFFBEB",
  danger:"#B91C1C", dangerBg:"#FEF2F2",
};
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif";

const S = {
  safe:    { color:T.safe,    bg:T.safeBg,    label:"APTO",    symbol:"✓" },
  warning: { color:T.warning, bg:T.warningBg, label:"TRAZAS",  symbol:"!" },
  danger:  { color:T.danger,  bg:T.dangerBg,  label:"NO APTO", symbol:"✕" },
};

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{display:none;} button,input,textarea{font-family:inherit;} a{text-decoration:none;}

  @keyframes fadeIn  {from{opacity:0}to{opacity:1}}
  @keyframes riseUp  {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideUp {from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes blink   {0%,100%{opacity:.25}50%{opacity:.85}}
  @keyframes shimmer {0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes spin    {to{transform:rotate(360deg)}}

  .fade   {animation:fadeIn .22s ease both}
  .rise   {animation:riseUp .32s cubic-bezier(.22,.68,0,1.15) both}
  .sheet  {animation:slideUp .34s cubic-bezier(.32,.72,0,1) both}
  .blink  {animation:blink 1.3s ease infinite}
  .shimmer{background:linear-gradient(90deg,#F4F4F2 25%,#EAEAE8 50%,#F4F4F2 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
  .spin   {animation:spin .75s linear infinite}
  .tap:active{opacity:.5;transition:opacity .07s}
  .press:active{transform:scale(.97);transition:transform .09s}
`;

// ── Gemini ────────────────────────────────────────────────────
const callGemini = async (parts) => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("Falta VITE_GEMINI_API_KEY");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ contents:[{parts}], generationConfig:{temperature:.1,maxOutputTokens:1200} }) }
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
};
const safeJSON = t => JSON.parse(t.replace(/```json|```/g,"").trim());
const toB64 = f => new Promise((ok,rej)=>{
  const r=new FileReader(); r.onload=()=>ok({data:r.result.split(",")[1],type:f.type}); r.onerror=rej; r.readAsDataURL(f);
});

// ── Leaflet ───────────────────────────────────────────────────
let _L = null;
const getL = () => _L || (_L = new Promise(ok=>{
  if (window.L){ok(window.L);return;}
  const l=document.createElement("link"); l.rel="stylesheet";
  l.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  document.head.appendChild(l);
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
  s.onload=()=>ok(window.L); document.head.appendChild(s);
}));

// ── Overpass fetch ────────────────────────────────────────────
const parseElements = (elements) =>
  (elements || []).filter(e => e.tags?.name).map(e => ({
    id: String(e.id), name: e.tags.name, lat: e.lat, lng: e.lon,
    cuisine: (e.tags.cuisine || "Restaurante").replace(/_/g, " "),
    address: [e.tags["addr:street"], e.tags["addr:housenumber"]].filter(Boolean).join(" "),
    glutenFree: e.tags["diet:gluten_free"] === "yes",
    website: e.tags.website || e.tags["contact:website"] || "",
    phone: e.tags.phone || e.tags["contact:phone"] || "",
    tags: e.tags,
  }));

// Initial load: radius around a point (reliable, no bounds needed)
const fetchByRadius = async (lat, lng, radius = 1000) => {
  const q = `[out:json][timeout:15];(node["amenity"~"restaurant|cafe|bar|fast_food"](around:${radius},${lat},${lng}););out 50;`;
  const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
  const d = await r.json();
  return parseElements(d.elements);
};

// On map move: load by current bounding box
const fetchByBbox = async ({ south, north, west, east }) => {
  const q = `[out:json][timeout:15];(node["amenity"~"restaurant|cafe|bar|fast_food"](${south},${west},${north},${east}););out 60;`;
  const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
  const d = await r.json();
  return parseElements(d.elements);
};

// Restaurant info via Gemini 2.0 Flash + Google Search (gratis en free tier) ──
const getRestaurantInfo = async (rest) => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("Falta VITE_GEMINI_API_KEY");

  const prompt = `Busca en internet información real y actualizada sobre el restaurante "${rest.name}" \
(cocina: ${rest.cuisine}${rest.address ? `, ubicado en ${rest.address}` : ""}, España) \
para una persona celíaca o con intolerancia al gluten.

Responde ÚNICAMENTE con JSON sin backticks ni texto extra:
{"safety":"safe/warning/danger","safetyReason":"razón breve del nivel","description":"descripción del restaurante en 2 frases","celiacInfo":"info real sobre opciones sin gluten, alergenos y contaminación cruzada en este restaurante","menuOptions":["opción habitualmente segura 1","opción 2"],"warnings":["advertencia concreta si la hay"],"advice":"consejo práctico directo para entrar a este restaurante siendo celíaco"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 900 },
      }),
    }
  );

  const d = await res.json();
  if (d.error) throw new Error(d.error.message);

  const text = (d.candidates?.[0]?.content?.parts || [])
    .filter(p => p.text).map(p => p.text).join("");

  try {
    return safeJSON(text);
  } catch {
    // Si Gemini responde en prosa en lugar de JSON, lo mostramos como texto
    return { rawText: text };
  }
};

// Distance ────────────────────────────────────────────────────
const dist = (a, b) => {
  const R=6371000, r=x=>x*Math.PI/180, dLa=r(b.lat-a.lat), dLo=r(b.lng-a.lng);
  const d=R*2*Math.atan2(Math.sqrt(Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2),1);
  return d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`;
};

// ── HOME ──────────────────────────────────────────────────────
function HomeScreen() {
  const [news,setNews]   = useState([]);
  const [phase,setPhase] = useState("loading"); // loading|ok|error
  const h = new Date().getHours();
  const greeting = h<12?"Buenos días":h<20?"Buenas tardes":"Buenas noches";

  const load = useCallback(async()=>{
    setPhase("loading");
    try{
      const r=await fetch("/api/news");
      if(!r.ok) throw 0;
      const d=await r.json();
      if(!Array.isArray(d)||!d.length) throw 0;
      setNews(d); setPhase("ok");
    }catch{ setPhase("error"); }
  },[]);
  useEffect(()=>{load();},[load]);

  return(
    <div style={{height:"100%",overflowY:"auto",backgroundColor:T.bg}}>
      {/* Branded header with gradient */}
      <div style={{
        background:"linear-gradient(160deg, #C8E6F5 0%, #D4EDE0 55%, #FAFAF8 100%)",
        padding:"36px 28px 28px",
        borderBottom:"1px solid rgba(0,0,0,.06)",
        display:"flex", flexDirection:"column", alignItems:"center",
        textAlign:"center",
      }}>
        <img src="/logo.png" alt="Marisinglu"
          style={{width:110, height:110, objectFit:"contain", marginBottom:4,
            filter:"drop-shadow(0 4px 16px rgba(0,0,0,.15))"}}/>
        <p style={{fontSize:12, color:"#5A7A6A", fontWeight:600,
          letterSpacing:.6, textTransform:"uppercase"}}>Tu vida sin gluten</p>
      </div>

      {/* Section title */}
      <div style={{padding:"22px 24px 0"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <h2 style={{fontSize:20, fontWeight:800, color:T.primary, letterSpacing:"-.5px"}}>
            Noticias de hoy
          </h2>
          <span style={{fontSize:11, color:T.tertiary, fontWeight:500}}>España</span>
        </div>
      </div>

      {/* List */}
      <div style={{padding:"0 24px 100px"}}>
        {phase==="loading" && [0,1,2,3,4].map(i=>(
          <div key={i} style={{paddingTop:20,paddingBottom:20,borderBottom:`1px solid ${T.line}`}}>
            <div className="shimmer" style={{height:10,width:"52%",borderRadius:5,marginBottom:12}}/>
            <div className="shimmer" style={{height:16,width:"94%",borderRadius:5,marginBottom:7}}/>
            <div className="shimmer" style={{height:16,width:"76%",borderRadius:5}}/>
          </div>
        ))}

        {phase==="error" && (
          <div style={{paddingTop:56,textAlign:"center"}}>
            <p style={{fontSize:15,color:T.secondary,lineHeight:1.6,marginBottom:20}}>
              No se pudieron cargar las noticias.
            </p>
            <button onClick={load} style={{fontSize:14,fontWeight:600,color:T.primary,
              background:"none",border:`1px solid ${T.border}`,borderRadius:10,
              padding:"11px 24px",cursor:"pointer"}}>Reintentar</button>
          </div>
        )}

        {phase==="ok" && news.map((n,i)=>(
          <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="tap">
            <div className="rise" style={{paddingTop:20,paddingBottom:20,
              borderBottom:`1px solid ${T.line}`,animationDelay:`${i*.06}s`}}>
              {/* Meta */}
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:9,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:.8,
                  color:T.tertiary,textTransform:"uppercase"}}>{n.source}</span>
                <span style={{width:2,height:2,borderRadius:"50%",backgroundColor:T.border}}/>
                <span style={{fontSize:10,color:T.tertiary}}>{n.date}</span>
                {n.category && (
                  <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,letterSpacing:.7,
                    textTransform:"uppercase",color:n.category.color,
                    backgroundColor:n.category.color+"14",
                    border:`1px solid ${n.category.color}33`,
                    padding:"2px 9px",borderRadius:4,flexShrink:0}}>
                    {n.category.label}
                  </span>
                )}
              </div>
              {/* Title */}
              <p style={{fontSize:15,fontWeight:600,color:T.primary,
                lineHeight:1.45,letterSpacing:"-.25px",marginBottom: n.summary?6:0}}>
                {n.title}
              </p>
              {n.summary && (
                <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,
                  display:"-webkit-box",WebkitLineClamp:2,
                  WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                  {n.summary}
                </p>
              )}
            </div>
          </a>
        ))}

        {phase==="ok" && (
          <button onClick={load} style={{marginTop:18,width:"100%",padding:"14px 0",
            background:"none",border:"none",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",gap:7,
            fontSize:12,fontWeight:500,color:T.tertiary,letterSpacing:.2}}>
            <RefreshCw size={13} color={T.tertiary}/> Actualizar noticias
          </button>
        )}
      </div>
    </div>
  );
}

// ── SCAN ──────────────────────────────────────────────────────
function ScanScreen() {
  const [phase,setPhase]   = useState("ready"); // ready|analyzing|result|error|detail
  const [result,setResult] = useState(null);
  const [errMsg,setErrMsg] = useState("");
  const [preview,setPrev]  = useState(null);
  const inputRef = useRef(null);

  const shoot = async(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    if(inputRef.current) inputRef.current.value="";
    setPrev(URL.createObjectURL(f)); setPhase("analyzing");
    try{
      const {data,type}=await toB64(f);
      const txt=await callGemini([
        {inline_data:{mime_type:type,data}},
        {text:`Experto en celiaquía. Analiza la etiqueta o producto.

JSON sin backticks:
{"status":"safe/warning/danger","confidence":0-100,"productName":"nombre o null","brand":"marca o null","verdict":"una frase de veredicto","explanation":["frase 1","frase 2","frase 3"],"ingredients":[{"name":"...","risk":"safe/warning/danger"}],"alternatives":["alternativa segura..."]}
Sin etiqueta visible: {"error":"No se detecta etiqueta"}`}
      ]);
      const p=safeJSON(txt);
      if(p.error){setErrMsg(p.error);setPhase("error");}
      else{setResult(p);setPhase("result");}
    }catch(e){setErrMsg("No se pudo analizar. Inténtalo de nuevo.");setPhase("error");}
  };

  const reset=()=>{setPhase("ready");setResult(null);setPrev(null);setErrMsg("");};

  if(phase==="ready") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",position:"relative",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={shoot} style={{display:"none"}}/>
      <img src="/logo.png" alt="Marisinglu"
        style={{width:100, height:100, objectFit:"contain", marginBottom:36,
          filter:"drop-shadow(0 6px 20px rgba(0,0,0,.5))"}}/>
      <div style={{position:"relative",width:200,height:200,marginBottom:48}}>
        {[{t:0,l:0,bt:"1.5px solid rgba(255,255,255,.65)",bl:"1.5px solid rgba(255,255,255,.65)"},
          {t:0,r:0,bt:"1.5px solid rgba(255,255,255,.65)",br:"1.5px solid rgba(255,255,255,.65)"},
          {b:0,l:0,bb:"1.5px solid rgba(255,255,255,.65)",bl:"1.5px solid rgba(255,255,255,.65)"},
          {b:0,r:0,bb:"1.5px solid rgba(255,255,255,.65)",br:"1.5px solid rgba(255,255,255,.65)"},
        ].map(({t,l,r,b,bt,bl,bb,br},i)=>(
          <div key={i} style={{position:"absolute",width:20,height:20,
            top:t,left:l,right:r,bottom:b,
            borderTop:bt,borderLeft:bl,borderBottom:bb,borderRight:br}}/>
        ))}
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:10}}>
          <Camera size={30} color="rgba(255,255,255,.15)" strokeWidth={1.5}/>
          <p style={{color:"rgba(255,255,255,.2)",fontSize:9,fontWeight:600,
            letterSpacing:1.8,textTransform:"uppercase"}}>Apunta al producto</p>
        </div>
      </div>
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 28px 48px",
        background:"linear-gradient(transparent,rgba(10,10,10,.96) 40%)"}}>
        <button onClick={()=>inputRef.current?.click()} className="press"
          style={{width:"100%",height:54,borderRadius:16,backgroundColor:"#fff",
            border:"none",cursor:"pointer",fontSize:16,fontWeight:700,
            color:"#0A0A0A",letterSpacing:"-.3px"}}>
          Escanear producto
        </button>
        <p style={{color:"rgba(255,255,255,.22)",fontSize:11,textAlign:"center",
          marginTop:11,letterSpacing:.3}}>Etiqueta de ingredientes o código de barras</p>
      </div>
    </div>
  );

  if(phase==="analyzing") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={shoot} style={{display:"none"}}/>
      {preview&&<div style={{width:110,height:110,borderRadius:12,overflow:"hidden",opacity:.45}}>
        <img src={preview} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{width:1,height:44,backgroundColor:"rgba(255,255,255,.06)",position:"relative",overflow:"hidden"}}>
          <div className="blink" style={{position:"absolute",top:0,left:0,right:0,height:"55%",backgroundColor:"rgba(255,255,255,.65)"}}/>
        </div>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:10,fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>
          Analizando
        </p>
      </div>
    </div>
  );

  if(phase==="error") return(
    <div style={{height:"100%",backgroundColor:T.bg,display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 28px"}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={shoot} style={{display:"none"}}/>
      <p style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:T.danger,
        textTransform:"uppercase",marginBottom:8}}>Error</p>
      <p style={{fontSize:17,fontWeight:600,color:T.primary,textAlign:"center",
        letterSpacing:"-.4px",marginBottom:8}}>No se pudo analizar</p>
      <p style={{fontSize:14,color:T.secondary,textAlign:"center",
        lineHeight:1.6,marginBottom:40}}>{errMsg}</p>
      <button onClick={reset} className="press" style={{width:"100%",height:52,
        borderRadius:14,backgroundColor:T.primary,border:"none",
        cursor:"pointer",fontSize:15,fontWeight:700,color:"#fff",marginBottom:12}}>
        Intentar de nuevo
      </button>
      <button onClick={reset} style={{background:"none",border:"none",
        color:T.tertiary,fontSize:14,cursor:"pointer",fontWeight:500}}>Cancelar</button>
    </div>
  );

  if(phase==="result"&&result){
    const st=S[result.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:st.bg,display:"flex",
        flexDirection:"column",overflow:"hidden"}}>
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={shoot} style={{display:"none"}}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",padding:"32px 32px 16px"}} className="rise">
          <div style={{width:62,height:62,borderRadius:31,backgroundColor:st.color,
            display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18}}>
            <span style={{fontSize:20,color:"#fff",fontWeight:900}}>{st.symbol}</span>
          </div>
          <p style={{fontSize:11,fontWeight:800,letterSpacing:2.5,color:st.color,
            textTransform:"uppercase",marginBottom:14}}>{st.label}</p>
          {result.productName&&<p style={{fontSize:19,fontWeight:700,color:T.primary,
            textAlign:"center",letterSpacing:"-.5px",marginBottom:4}}>{result.productName}</p>}
          {result.brand&&<p style={{fontSize:13,color:T.secondary,marginBottom:14}}>{result.brand}</p>}
          {result.verdict&&<p style={{fontSize:15,fontWeight:600,color:st.color,textAlign:"center",
            lineHeight:1.45,marginBottom:22,letterSpacing:"-.2px",maxWidth:256}}>{result.verdict}</p>}
          {result.explanation?.slice(0,3).map((l,i)=>(
            <div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",
              marginBottom:10,width:"100%",maxWidth:285}}>
              <span style={{width:19,height:19,borderRadius:10,flexShrink:0,
                backgroundColor:st.color+"18",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:700,color:st.color,marginTop:1}}>
                {i+1}
              </span>
              <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,flex:1}}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{padding:"0 32px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,color:T.tertiary,textTransform:"uppercase"}}>
              Confianza IA
            </span>
            <span style={{fontSize:11,fontWeight:700,color:st.color}}>{result.confidence}%</span>
          </div>
          <div style={{height:2,backgroundColor:"rgba(0,0,0,.07)",borderRadius:1}}>
            <div style={{height:"100%",width:`${result.confidence}%`,backgroundColor:st.color,
              borderRadius:1,transition:"width 1.2s ease"}}/>
          </div>
        </div>
        <div style={{padding:"0 24px 36px",display:"flex",gap:10}}>
          <button onClick={reset} className="press"
            style={{flex:1,height:48,borderRadius:12,backgroundColor:"rgba(0,0,0,.07)",
              border:"none",cursor:"pointer",fontSize:14,fontWeight:600,color:T.primary}}>
            Reescanear
          </button>
          <button onClick={()=>setPhase("detail")} className="press"
            style={{flex:1,height:48,borderRadius:12,backgroundColor:st.color,
              border:"none",cursor:"pointer",fontSize:14,fontWeight:700,color:"#fff"}}>
            Ver detalle
          </button>
        </div>
      </div>
    );
  }

  if(phase==="detail"&&result){
    const st=S[result.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:T.bg,overflowY:"auto"}} className="fade">
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={shoot} style={{display:"none"}}/>
        <div style={{padding:"28px 24px 0",display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:22}}>
          <button onClick={()=>setPhase("result")} style={{display:"flex",alignItems:"center",
            gap:6,background:"none",border:"none",cursor:"pointer",
            fontSize:14,fontWeight:600,color:T.secondary}}>
            <ArrowLeft size={16}/> Resultado
          </button>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:1.5,
            color:st.color,textTransform:"uppercase"}}>{st.label}</span>
        </div>
        <div style={{height:1,backgroundColor:T.line,margin:"0 24px 22px"}}/>
        <div style={{padding:"0 24px 100px"}}>
          {result.ingredients?.length>0&&(
            <>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:1.2,color:T.tertiary,
                textTransform:"uppercase",marginBottom:14}}>Ingredientes</p>
              {result.ingredients.map((ing,i)=>{
                const ist=S[ing.risk]||S.safe;
                return(<div key={i} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",paddingTop:13,paddingBottom:13,
                  borderTop:`1px solid ${T.line}`}}>
                  <span style={{fontSize:15,color:T.primary,fontWeight:500}}>{ing.name}</span>
                  <span style={{fontSize:9,fontWeight:800,letterSpacing:.8,textTransform:"uppercase",
                    color:ist.color,backgroundColor:ist.bg,padding:"4px 11px",borderRadius:100}}>
                    {ist.label}
                  </span>
                </div>);
              })}
            </>
          )}
          {result.alternatives?.length>0&&(
            <>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:1.2,color:T.tertiary,
                textTransform:"uppercase",marginTop:26,marginBottom:14}}>Alternativas</p>
              {result.alternatives.map((alt,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  paddingTop:13,paddingBottom:13,borderTop:`1px solid ${T.line}`}}>
                  <span style={{fontSize:15,color:T.primary,fontWeight:500}}>{alt}</span>
                  <ChevronRight size={16} color={T.tertiary}/>
                </div>
              ))}
            </>
          )}
          <button onClick={()=>inputRef.current?.click()} className="press"
            style={{marginTop:30,width:"100%",height:50,borderRadius:14,
              backgroundColor:T.primary,border:"none",cursor:"pointer",
              fontSize:15,fontWeight:700,color:"#fff",display:"flex",
              alignItems:"center",justifyContent:"center",gap:8}}>
            <Camera size={15} color="#fff" strokeWidth={2}/> Escanear otro
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ── MAP / RESTAURANTES ────────────────────────────────────────
function RestaurantesScreen() {
  const [loc,setLoc]     = useState(null);
  const [sel,setSel]     = useState(null);
  const [selInfo,setSelInfo] = useState(null); // null | "loading" | {...}
  const [photoPhase,setPhotoPhase] = useState("idle"); // idle|analyzing|result|error
  const [photoResult,setPhotoResult] = useState(null);

  const mapRef    = useRef(null);
  const mapInst   = useRef(null);
  const markersRef = useRef([]);
  const inputRef  = useRef(null);
  const selRef    = useRef(null); // keep sel in ref for async handlers

  selRef.current = sel;

  // Geolocation
  useEffect(()=>{
    const fb=()=>setLoc({lat:40.4168,lng:-3.7038});
    navigator.geolocation?.getCurrentPosition(
      ({coords:{latitude:lat,longitude:lng}})=>setLoc({lat,lng}),
      fb,{timeout:9000,enableHighAccuracy:true}
    )||fb();
  },[]);

  // Init map
  useEffect(()=>{
    if(!loc||!mapRef.current) return;
    let dead=false;
    getL().then(L=>{
      if(dead||!mapRef.current) return;
      if(mapInst.current){mapInst.current.remove();mapInst.current=null;}

      const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false})
        .setView([loc.lat,loc.lng],16);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {subdomains:"abcd",maxZoom:20}).addTo(map);

      // User marker
      L.circleMarker([loc.lat,loc.lng],
        {radius:8,fillColor:"#2563EB",color:"#fff",weight:3,fillOpacity:1}).addTo(map);

      // Helper: render markers from a restaurant list
      const renderMarkers = (rests) => {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        rests.forEach(r => {
          const col = r.glutenFree ? "#15803D" : "#525252";
          const icon = L.divIcon({
            html: `<div style="width:13px;height:13px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 1px 8px rgba(0,0,0,.25)"></div>`,
            iconSize: [13,13], iconAnchor: [6,6], className: ""
          });
          const m = L.marker([r.lat, r.lng], { icon }).addTo(map)
            .on("click", () => { setSel(r); setSelInfo(null); });
          markersRef.current.push(m);
        });
      };

      // Initial load: radius around user location (reliable, no bounds needed)
      fetchByRadius(loc.lat, loc.lng, 1000)
        .then(rests => { if (rests.length > 0) renderMarkers(rests); })
        .catch(e => console.warn("Overpass initial load error", e));

      // On map move: reload visible area
      map.on("moveend", () => {
        const b = map.getBounds();
        fetchByBbox({
          south: b.getSouth(), north: b.getNorth(),
          west: b.getWest(), east: b.getEast(),
        })
          .then(rests => { if (rests.length > 0) renderMarkers(rests); })
          .catch(e => console.warn("Overpass bbox error", e));
      });

      mapInst.current = map;
    });
    return()=>{dead=true;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[loc]);

  // Load restaurant info when selected
  useEffect(()=>{
    if(!sel) return;
    setSelInfo("loading");
    getRestaurantInfo(sel)
      .then(d=>setSelInfo(d))
      .catch(()=>setSelInfo({error:true}));
  },[sel]);

  // Photo analysis
  const analyzePhoto = async(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    if(inputRef.current) inputRef.current.value="";
    setSel(null); setPhotoPhase("analyzing");
    try{
      const {data,type}=await toB64(f);
      const ctx=selRef.current?`Restaurante: "${selRef.current.name}".`:"";
      const txt=await callGemini([
        {inline_data:{mime_type:type,data}},
        {text:`Analiza esta imagen de restaurante para celíacos. ${ctx}
JSON sin backticks:
{"restaurantName":"nombre o null","status":"safe/warning/danger","verdict":"una frase directa","explanation":["frase 1","frase 2","frase 3"],"questionsToAsk":["pregunta concreta para el camarero"]}`}
      ]);
      setPhotoResult(safeJSON(txt)); setPhotoPhase("result");
    }catch{ setPhotoPhase("error"); }
  };

  // Photo result screen
  if(photoPhase==="result"&&photoResult){
    const r=photoResult, st=S[r.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:st.bg,display:"flex",
        flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"32px 28px"}} className="rise">
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={analyzePhoto} style={{display:"none"}}/>
        <button onClick={()=>{setPhotoPhase("idle");setPhotoResult(null);}}
          style={{position:"absolute",top:24,left:24,background:"none",border:"none",
            cursor:"pointer",fontSize:13,fontWeight:600,color:T.secondary,
            display:"flex",alignItems:"center",gap:6}}>
          <ArrowLeft size={16}/> Mapa
        </button>
        <div style={{width:58,height:58,borderRadius:29,backgroundColor:st.color,
          display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
          <span style={{fontSize:18,color:"#fff",fontWeight:900}}>{st.symbol}</span>
        </div>
        <p style={{fontSize:11,fontWeight:800,letterSpacing:2.5,color:st.color,
          textTransform:"uppercase",marginBottom:10}}>{st.label}</p>
        {r.restaurantName&&<p style={{fontSize:18,fontWeight:700,color:T.primary,
          textAlign:"center",letterSpacing:"-.4px",marginBottom:6}}>{r.restaurantName}</p>}
        <p style={{fontSize:15,fontWeight:600,color:st.color,textAlign:"center",
          marginBottom:24,letterSpacing:"-.2px",maxWidth:256,lineHeight:1.45}}>
          {r.verdict}
        </p>
        {r.explanation?.slice(0,3).map((l,i)=>(
          <div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",
            marginBottom:10,width:"100%",maxWidth:285}}>
            <span style={{width:19,height:19,borderRadius:10,flexShrink:0,
              backgroundColor:st.color+"18",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,color:st.color,marginTop:1}}>
              {i+1}
            </span>
            <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,flex:1}}>{l}</p>
          </div>
        ))}
        {r.questionsToAsk?.length>0&&(
          <div style={{marginTop:22,width:"100%",maxWidth:285}}>
            <p style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:T.tertiary,
              textTransform:"uppercase",marginBottom:10}}>Pregunta al camarero</p>
            {r.questionsToAsk.slice(0,2).map((q,i)=>(
              <div key={i} style={{backgroundColor:"rgba(0,0,0,.05)",borderRadius:10,
                padding:"10px 14px",marginBottom:7}}>
                <p style={{fontSize:13,color:T.primary,fontWeight:500,lineHeight:1.5}}>"{q}"</p>
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>{setPhotoPhase("idle");setPhotoResult(null);}} className="press"
          style={{marginTop:28,width:"100%",maxWidth:285,height:50,
            borderRadius:14,backgroundColor:T.primary,border:"none",
            cursor:"pointer",fontSize:15,fontWeight:700,color:"#fff"}}>
          Volver al mapa
        </button>
      </div>
    );
  }

  if(photoPhase==="analyzing") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={analyzePhoto} style={{display:"none"}}/>
      <p style={{color:"rgba(255,255,255,.32)",fontSize:10,fontWeight:600,
        letterSpacing:2,textTransform:"uppercase"}}>Analizando restaurante</p>
    </div>
  );

  // Main map view
  return(
    <div style={{height:"100%",position:"relative"}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={analyzePhoto} style={{display:"none"}}/>

      {/* Map */}
      <div ref={mapRef} style={{width:"100%",height:"100%"}}>
        {!loc&&<div className="shimmer" style={{width:"100%",height:"100%"}}/>}
      </div>

      {/* Analyze photo button — bottom right */}
      <div style={{position:"absolute",bottom:104,right:16,zIndex:1000}}>
        <button onClick={()=>inputRef.current?.click()} className="press"
          style={{backgroundColor:"rgba(10,10,10,.85)",backdropFilter:"blur(10px)",
            border:"none",borderRadius:12,padding:"10px 14px",cursor:"pointer",
            boxShadow:"0 2px 14px rgba(0,0,0,.2)",display:"flex",
            alignItems:"center",gap:7}}>
          <Camera size={15} color="#fff" strokeWidth={2}/>
          <span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:"-.1px"}}>
            Analizar foto restaurante
          </span>
        </button>
      </div>

      {/* Legend — top left, more distinct */}
      <div style={{position:"absolute",top:18,left:16,zIndex:1000,
        backgroundColor:"rgba(255,255,255,.96)",backdropFilter:"blur(10px)",
        borderRadius:12,padding:"11px 14px",boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
        {[
          {label:"Sin gluten verificado", color:"#15803D", dot:10},
          {label:"Sin verificar",          color:"#525252", dot:10},
        ].map(x=>(
          <div key={x.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <div style={{width:x.dot,height:x.dot,borderRadius:"50%",
              backgroundColor:x.color,flexShrink:0,
              border:`2px solid ${x.color}33`}}/>
            <span style={{fontSize:11,fontWeight:500,color:T.primary}}>{x.label}</span>
          </div>
        ))}
        <div style={{height:1,backgroundColor:T.line,margin:"6px 0"}}/>
        <p style={{fontSize:10,color:T.tertiary,letterSpacing:.2}}>
          Toca un punto para ver información
        </p>
      </div>

      {/* Restaurant bottom sheet */}
      {sel&&(
        <div onClick={()=>{setSel(null);setSelInfo(null);}}
          style={{position:"absolute",inset:0,zIndex:2000}}>
          <div onClick={e=>e.stopPropagation()}
            style={{position:"absolute",bottom:88,left:0,right:0,
              backgroundColor:"#fff",borderRadius:"20px 20px 0 0",
              maxHeight:"72%",overflowY:"auto",
              boxShadow:"0 -3px 28px rgba(0,0,0,.1)"}}
            className="sheet">
            {/* Handle + close */}
            <div style={{position:"sticky",top:0,backgroundColor:"#fff",
              padding:"14px 20px 10px",borderBottom:`1px solid ${T.line}`,zIndex:1}}>
              <div style={{width:32,height:3,backgroundColor:T.border,
                borderRadius:2,margin:"0 auto 12px"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,paddingRight:12}}>
                  <h3 style={{fontSize:17,fontWeight:700,color:T.primary,
                    letterSpacing:"-.4px",marginBottom:2}}>{sel.name}</h3>
                  <p style={{fontSize:13,color:T.secondary,fontWeight:500,
                    textTransform:"capitalize"}}>{sel.cuisine}</p>
                </div>
                <button onClick={()=>{setSel(null);setSelInfo(null);}}
                  style={{background:"none",border:"none",cursor:"pointer",
                    color:T.tertiary,padding:4,marginTop:-2}}>✕</button>
              </div>
            </div>

            <div style={{padding:"16px 20px 24px"}}>
              {/* Loading state */}
              {selInfo==="loading"&&(
                <div style={{paddingTop:12}}>
                  {[1,2,3].map(i=><div key={i} className="shimmer"
                    style={{height:14,borderRadius:6,marginBottom:10,
                      width:i===1?"90%":i===2?"75%":"60%"}}/>)}
                  <p style={{fontSize:12,color:T.tertiary,marginTop:12,textAlign:"center"}}>
                    Consultando información del restaurante...
                  </p>
                </div>
              )}

              {/* Info loaded */}
              {selInfo&&selInfo!=="loading"&&!selInfo.error&&(()=>{
                // Fallback: Gemini responded in prose instead of JSON
                if (selInfo.rawText) return (
                  <p style={{fontSize:14,color:T.secondary,lineHeight:1.7,paddingTop:4}}>
                    {selInfo.rawText}
                  </p>
                );

                const st=S[selInfo.safety]||S.warning;
                return(
                  <>
                    {/* Safety badge */}
                    <div style={{display:"inline-flex",alignItems:"center",gap:7,
                      backgroundColor:st.bg,borderRadius:10,padding:"8px 14px",
                      marginBottom:14,border:`1px solid ${st.color}22`}}>
                      <span style={{width:8,height:8,borderRadius:"50%",
                        backgroundColor:st.color,flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:st.color,
                        letterSpacing:.3}}>{selInfo.safetyReason}</span>
                    </div>

                    {/* Description */}
                    <p style={{fontSize:14,color:T.secondary,lineHeight:1.6,marginBottom:16}}>
                      {selInfo.description}
                    </p>

                    {/* Celiac info */}
                    {selInfo.celiacInfo&&(
                      <div style={{borderLeft:`3px solid ${st.color}`,
                        paddingLeft:14,marginBottom:16}}>
                        <p style={{fontSize:12,fontWeight:600,color:st.color,
                          letterSpacing:.3,marginBottom:5,textTransform:"uppercase",fontSize:10}}>
                          Celiaquía
                        </p>
                        <p style={{fontSize:14,color:T.primary,lineHeight:1.6,fontWeight:500}}>
                          {selInfo.celiacInfo}
                        </p>
                      </div>
                    )}

                    {/* Menu options */}
                    {selInfo.menuOptions?.length>0&&(
                      <>
                        <p style={{fontSize:10,fontWeight:700,letterSpacing:1,
                          color:T.tertiary,textTransform:"uppercase",marginBottom:10}}>
                          Opciones habitualmente seguras
                        </p>
                        {selInfo.menuOptions.map((o,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:9,
                            paddingTop:10,paddingBottom:10,borderTop:`1px solid ${T.line}`}}>
                            <span style={{width:6,height:6,borderRadius:"50%",
                              backgroundColor:T.safe,flexShrink:0}}/>
                            <span style={{fontSize:14,color:T.primary}}>{o}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Warnings */}
                    {selInfo.warnings?.length>0&&(
                      <>
                        <p style={{fontSize:10,fontWeight:700,letterSpacing:1,
                          color:T.tertiary,textTransform:"uppercase",marginTop:16,marginBottom:10}}>
                          Advertencias
                        </p>
                        {selInfo.warnings.map((w,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:9,
                            paddingTop:10,paddingBottom:10,borderTop:`1px solid ${T.line}`}}>
                            <span style={{width:6,height:6,borderRadius:"50%",marginTop:5,
                              backgroundColor:T.danger,flexShrink:0}}/>
                            <span style={{fontSize:14,color:T.secondary,lineHeight:1.5}}>{w}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Advice */}
                    {selInfo.advice&&(
                      <div style={{backgroundColor:"#F8F8F6",borderRadius:12,
                        padding:"12px 14px",marginTop:16}}>
                        <p style={{fontSize:10,fontWeight:700,letterSpacing:1,
                          color:T.tertiary,textTransform:"uppercase",marginBottom:6}}>
                          Consejo
                        </p>
                        <p style={{fontSize:14,color:T.primary,lineHeight:1.6,fontWeight:500}}>
                          {selInfo.advice}
                        </p>
                      </div>
                    )}

                    {/* Distance + address */}
                    {loc&&(
                      <p style={{fontSize:12,color:T.tertiary,marginTop:14,
                        display:"flex",alignItems:"center",gap:5}}>
                        <MapPin size={12} color={T.tertiary}/> {dist(loc,sel)}
                        {sel.address&&` · ${sel.address}`}
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Error fallback */}
              {selInfo?.error&&(
                <p style={{fontSize:14,color:T.secondary,lineHeight:1.6,paddingTop:8}}>
                  No se pudo cargar información adicional. Comprueba la conexión y toca el restaurante de nuevo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────
function Nav({active,go}) {
  return(
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:88,
      backgroundColor:"rgba(250,250,248,.96)",backdropFilter:"blur(20px) saturate(180%)",
      borderTop:`1px solid ${T.line}`,display:"flex",alignItems:"flex-start",
      justifyContent:"space-around",paddingTop:13}}>
      {[{id:"home",Icon:Home,label:"Inicio"},
        {id:"scan",Icon:Camera,label:"Escanear"},
        {id:"map",Icon:MapPin,label:"Restaurantes"}].map(({id,Icon,label})=>{
        const on=active===id;
        return(
          <button key={id} onClick={()=>go(id)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              background:"none",border:"none",cursor:"pointer",minWidth:70,padding:0}}>
            <div style={{width:38,height:27,display:"flex",alignItems:"center",
              justifyContent:"center",borderRadius:9,
              backgroundColor:on?"rgba(10,10,10,.08)":"transparent",transition:"background .18s"}}>
              <Icon size={20} color={on?T.primary:T.tertiary} strokeWidth={on?2.2:1.6}/>
            </div>
            <span style={{fontSize:10,fontWeight:on?700:400,
              color:on?T.primary:T.tertiary,letterSpacing:.1,transition:"color .18s"}}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen] = useState("home");
  const go = useCallback(s=>setScreen(s),[]);
  const screens={home:<HomeScreen/>,scan:<ScanScreen/>,map:<RestaurantesScreen/>};

  return(
    <>
      <style>{CSS}</style>
      <div style={{position:"fixed",inset:0,backgroundColor:"#1A1A1A",
        display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
        <div style={{width:390,maxWidth:"100vw",
          height:Math.min(844,window.innerHeight-20),
          position:"relative",overflow:"hidden",fontFamily:FONT,
          borderRadius:52,backgroundColor:T.bg,
          boxShadow:"0 40px 120px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.1) inset"}}>
          <div key={screen} className="fade"
            style={{position:"absolute",top:0,bottom:88,left:0,right:0,overflow:"hidden",
              backgroundColor:screen==="scan"?"#0A0A0A":T.bg}}>
            {screens[screen]}
          </div>
          <Nav active={screen} go={go}/>
        </div>
      </div>
    </>
  );
}
