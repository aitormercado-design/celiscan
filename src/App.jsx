import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Camera, MapPin, ArrowLeft,
  RefreshCw, ExternalLink, X, ChevronRight,
  CheckCircle, AlertTriangle, XCircle,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  primary:   "#0A0A0A",
  secondary: "#6B6B6B",
  tertiary:  "#9E9E9E",
  bg:        "#FAFAF8",
  surface:   "#FFFFFF",
  line:      "#EFEFED",
  border:    "#E0E0DE",
  safe:      "#15803D",  safeBg:    "#F0FDF4",
  warning:   "#B45309",  warningBg: "#FFFBEB",
  danger:    "#B91C1C",  dangerBg:  "#FEF2F2",
};
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";

// ── Status config ─────────────────────────────────────────────
const S = {
  safe:    { color:T.safe,    bg:T.safeBg,    label:"APTO",     short:"Apto",    symbol:"✓" },
  warning: { color:T.warning, bg:T.warningBg, label:"TRAZAS",   short:"Trazas",  symbol:"!" },
  danger:  { color:T.danger,  bg:T.dangerBg,  label:"NO APTO",  short:"No Apto", symbol:"✕" },
};

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  ::-webkit-scrollbar{display:none;}
  button,input,textarea{font-family:inherit;}
  a{text-decoration:none;-webkit-tap-highlight-color:transparent;}

  @keyframes fadeIn   {from{opacity:0}to{opacity:1}}
  @keyframes riseUp   {from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideUp  {from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes pulse    {0%,100%{opacity:.3}50%{opacity:1}}
  @keyframes shimmer  {0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes spin     {to{transform:rotate(360deg)}}

  .fade    {animation:fadeIn .22s ease both}
  .rise    {animation:riseUp .32s cubic-bezier(.22,.68,0,1.15) both}
  .sheet   {animation:slideUp .36s cubic-bezier(.32,.72,0,1) both}
  .pulse   {animation:pulse 1.4s ease infinite}
  .shimmer {background:linear-gradient(90deg,#F4F4F2 25%,#EAEAE8 50%,#F4F4F2 75%);
            background-size:200% 100%;animation:shimmer 1.5s infinite}
  .spin    {animation:spin .8s linear infinite}

  .tap:active{opacity:.55;transition:opacity .08s}
  .press:active{transform:scale(.97);transition:transform .1s}
`;

// ── API (Gemini Flash — free tier) ────────────────────────────
const callGemini = async (parts) => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("Sin clave API. Añade VITE_GEMINI_API_KEY en Vercel.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        contents:[{parts}],
        generationConfig:{temperature:.1, maxOutputTokens:1200},
      }) }
  );
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
};
const safeJSON = (t) => JSON.parse(t.replace(/```json|```/g,"").trim());
const toB64 = (f) => new Promise((res,rej) => {
  const r = new FileReader();
  r.onload = () => res({data:r.result.split(",")[1], type:f.type});
  r.onerror = rej;
  r.readAsDataURL(f);
});

// ── Leaflet ───────────────────────────────────────────────────
let _L = null;
const getL = () => _L || (_L = new Promise(ok => {
  if (window.L){ok(window.L);return;}
  const l=document.createElement("link");
  l.rel="stylesheet";l.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  document.head.appendChild(l);
  const s=document.createElement("script");
  s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
  s.onload=()=>ok(window.L);document.head.appendChild(s);
}));

// ── Mock restaurants (positioned around user) ─────────────────
const mockRests = (lat,lng) => [
  {id:"1",name:"La Huerta Sana",      cuisine:"Mediterránea",lat:lat+.0022,lng:lng-.0015,safety:"safe",    note:"Cocina 100% libre de gluten. Carta certificada FACE."},
  {id:"2",name:"Sushi Nakama",        cuisine:"Japonesa",    lat:lat-.0014,lng:lng+.0024,safety:"warning", note:"Usan tamari, pero cocina compartida. Avisar al entrar."},
  {id:"3",name:"Burger Lab",          cuisine:"Americana",   lat:lat+.0011,lng:lng+.0031,safety:"safe",    note:"Protocolo estricto SG. Pan sin gluten disponible."},
  {id:"4",name:"Trattoria Nonna",     cuisine:"Italiana",    lat:lat-.0024,lng:lng-.0018,safety:"danger",  note:"Sin alternativas sin gluten. Cocina con mucha harina."},
  {id:"5",name:"Mercado de Abastos",  cuisine:"Variada",     lat:lat+.0033,lng:lng+.0009,safety:"warning", note:"Algunos puestos tienen opciones SG. Preguntar en cada uno."},
  {id:"6",name:"Green Roots",         cuisine:"Vegana",      lat:lat-.0009,lng:lng-.0032,safety:"safe",    note:"Menú íntegramente sin gluten. Recomendado por FACE."},
];

// ── HOME — editorial news list ────────────────────────────────
function HomeScreen2() {
  const [news,setNews]     = useState([]);
  const [state,setState]   = useState("loading"); // loading|ok|error

  const h = new Date().getHours();
  const greeting = h<12?"Buenos días":h<20?"Buenas tardes":"Buenas noches";

  const load = useCallback(async()=>{
    setState("loading");
    try{
      const r = await fetch("/api/news");
      if(!r.ok) throw 0;
      const d = await r.json();
      if(!Array.isArray(d)||!d.length) throw 0;
      setNews(d.slice(0,5));
      setState("ok");
    } catch{ setState("error"); }
  },[]);
  useEffect(()=>{load();},[load]);

  return (
    <div style={{height:"100%",overflowY:"auto",backgroundColor:T.bg}}>
      {/* Header */}
      <div style={{padding:"40px 24px 20px"}}>
        <p style={{fontSize:12,color:T.tertiary,fontWeight:500,letterSpacing:.5,
          textTransform:"uppercase",marginBottom:10}}>{greeting}</p>
        <h1 style={{fontSize:28,fontWeight:800,color:T.primary,letterSpacing:"-1px",lineHeight:1.08}}>
          Celiaquía<br/>en España
        </h1>
      </div>
      <div style={{height:1,backgroundColor:T.line,margin:"0 24px"}}/>

      {/* List */}
      <div style={{padding:"0 24px 100px"}}>
        {state==="loading" && [0,1,2,3,4].map(i=>(
          <div key={i} style={{paddingTop:20,paddingBottom:20,borderBottom:`1px solid ${T.line}`}}>
            <div className="shimmer" style={{height:10,width:"55%",borderRadius:5,marginBottom:12}}/>
            <div className="shimmer" style={{height:16,width:"95%",borderRadius:5,marginBottom:7}}/>
            <div className="shimmer" style={{height:16,width:"78%",borderRadius:5}}/>
          </div>
        ))}

        {state==="error" && (
          <div style={{paddingTop:56,textAlign:"center"}}>
            <p style={{fontSize:15,color:T.secondary,marginBottom:20,lineHeight:1.6}}>
              No se pudieron cargar las noticias.<br/>Comprueba tu conexión.
            </p>
            <button onClick={load} style={{fontSize:14,fontWeight:600,color:T.primary,
              background:"none",border:`1px solid ${T.border}`,borderRadius:10,
              padding:"11px 24px",cursor:"pointer"}}>
              Reintentar
            </button>
          </div>
        )}

        {state==="ok" && news.map((n,i)=>(
          <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="tap">
            <div className="rise" style={{paddingTop:20,paddingBottom:20,
              borderBottom:`1px solid ${T.line}`,animationDelay:`${i*.06}s`}}>
              {/* Meta */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:.9,
                  color:T.tertiary,textTransform:"uppercase"}}>{n.source}</span>
                <span style={{width:2,height:2,borderRadius:"50%",backgroundColor:T.border,flexShrink:0}}/>
                <span style={{fontSize:10,color:T.tertiary}}>{n.date}</span>
                <span style={{marginLeft:"auto",fontSize:9,fontWeight:800,letterSpacing:.8,
                  textTransform:"uppercase",color:T.safe,backgroundColor:"#F0FDF4",
                  border:"1px solid #BBF7D0",padding:"2px 8px",borderRadius:4}}>
                  Celiaquía
                </span>
              </div>
              {/* Title */}
              <p style={{fontSize:15,fontWeight:600,color:T.primary,
                lineHeight:1.45,letterSpacing:-.25,marginBottom:6}}>{n.title}</p>
              {/* Summary */}
              {n.summary && (
                <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                  {n.summary}
                </p>
              )}
            </div>
          </a>
        ))}

        {state==="ok" && (
          <button onClick={load} style={{marginTop:20,width:"100%",padding:"14px 0",
            background:"none",border:"none",cursor:"pointer",display:"flex",
            alignItems:"center",justifyContent:"center",gap:7,
            fontSize:12,fontWeight:500,color:T.tertiary,letterSpacing:.2}}>
            <RefreshCw size={13} color={T.tertiary}/> Actualizar
          </button>
        )}
      </div>
    </div>
  );
}

// ── SCAN — full screen camera + result ───────────────────────
function Scan() {
  const [phase,setPhase]   = useState("ready"); // ready|analyzing|result|error|detail
  const [result,setResult] = useState(null);
  const [errMsg,setErrMsg] = useState("");
  const [preview,setPreview] = useState(null);
  const inputRef = useRef(null);

  const shoot = async(e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    if(inputRef.current) inputRef.current.value="";
    setPreview(URL.createObjectURL(f));
    setPhase("analyzing");
    try{
      const {data,type} = await toB64(f);
      const txt = await callGemini([
        {inline_data:{mime_type:type,data}},
        {text:`Experto en celiaquía. Analiza esta imagen de etiqueta o producto.

JSON sin backticks ni texto extra:
{"status":"safe/warning/danger","confidence":0-100,"productName":"nombre o null","brand":"marca o null","verdict":"Una frase de veredicto directo","explanation":["frase 1 de explicación","frase 2","frase 3"],"ingredients":[{"name":"...","risk":"safe/warning/danger"}],"alternatives":["alternativa segura..."]}
Sin etiqueta visible: {"error":"No se detecta etiqueta de ingredientes"}`}
      ]);
      const p = safeJSON(txt);
      if(p.error){setErrMsg(p.error);setPhase("error");}
      else{setResult(p);setPhase("result");}
    }catch(e){
      setErrMsg("No se pudo analizar. Inténtalo de nuevo.");
      setPhase("error");
    }
  };

  const reset=()=>{setPhase("ready");setResult(null);setPreview(null);setErrMsg("");};

  // READY
  if(phase==="ready") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",position:"relative",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={shoot} style={{display:"none"}}/>

      {/* Logo */}
      <img src="/logo.png" alt="CeliScan"
        style={{width:72,height:72,borderRadius:20,objectFit:"cover",marginBottom:36,
          boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}/>

      {/* Frame */}
      <div style={{position:"relative",width:210,height:210,marginBottom:52}}>
        {[{top:0,left:0,bTop:"1.5px solid rgba(255,255,255,.7)",bLeft:"1.5px solid rgba(255,255,255,.7)"},
          {top:0,right:0,bTop:"1.5px solid rgba(255,255,255,.7)",bRight:"1.5px solid rgba(255,255,255,.7)"},
          {bottom:0,left:0,bBottom:"1.5px solid rgba(255,255,255,.7)",bLeft:"1.5px solid rgba(255,255,255,.7)"},
          {bottom:0,right:0,bBottom:"1.5px solid rgba(255,255,255,.7)",bRight:"1.5px solid rgba(255,255,255,.7)"},
        ].map(({top,left,right,bottom,bTop,bLeft,bBottom,bRight},i)=>(
          <div key={i} style={{position:"absolute",width:22,height:22,top,left,right,bottom,
            borderTop:bTop,borderLeft:bLeft,borderBottom:bBottom,borderRight:bRight}}/>
        ))}
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:12}}>
          <Camera size={32} color="rgba(255,255,255,.18)" strokeWidth={1.5}/>
          <p style={{color:"rgba(255,255,255,.25)",fontSize:10,fontWeight:600,
            letterSpacing:1.5,textTransform:"uppercase"}}>Apunta al producto</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,
        padding:"0 28px 48px",
        background:"linear-gradient(transparent,rgba(10,10,10,.95) 40%)"}}>
        <button onClick={()=>inputRef.current?.click()} className="press"
          style={{width:"100%",height:56,borderRadius:16,backgroundColor:"#FFFFFF",
            border:"none",cursor:"pointer",fontSize:16,fontWeight:700,
            color:"#0A0A0A",letterSpacing:"-.3px"}}>
          Escanear producto
        </button>
        <p style={{color:"rgba(255,255,255,.28)",fontSize:12,textAlign:"center",
          marginTop:12,letterSpacing:.3}}>Etiqueta de ingredientes o código de barras</p>
      </div>
    </div>
  );

  // ANALYZING
  if(phase==="analyzing") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",gap:28}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={shoot} style={{display:"none"}}/>
      {preview && (
        <div style={{width:120,height:120,borderRadius:12,overflow:"hidden",opacity:.5}}>
          <img src={preview} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
        <div style={{width:1,height:48,backgroundColor:"rgba(255,255,255,.08)",
          position:"relative",overflow:"hidden"}}>
          <div className="pulse" style={{position:"absolute",top:0,left:0,right:0,
            height:"60%",backgroundColor:"rgba(255,255,255,.7)"}}/>
        </div>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,
          letterSpacing:2,textTransform:"uppercase"}}>Analizando</p>
      </div>
    </div>
  );

  // ERROR
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
        color:T.tertiary,fontSize:14,cursor:"pointer"}}>Cancelar</button>
    </div>
  );

  // RESULT
  if(phase==="result"&&result){
    const st = S[result.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:st.bg,display:"flex",
        flexDirection:"column",overflow:"hidden"}}>
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={shoot} style={{display:"none"}}/>

        {/* Main result area */}
        <div style={{flex:1,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",padding:"32px 32px 16px"}}
          className="rise">

          {/* Status mark */}
          <div style={{width:64,height:64,borderRadius:32,backgroundColor:st.color,
            display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
            <span style={{fontSize:22,color:"#fff",fontWeight:900}}>{st.symbol}</span>
          </div>

          {/* Label */}
          <p style={{fontSize:11,fontWeight:800,letterSpacing:2.5,
            color:st.color,textTransform:"uppercase",marginBottom:16}}>{st.label}</p>

          {/* Product */}
          {result.productName && (
            <p style={{fontSize:19,fontWeight:700,color:T.primary,
              textAlign:"center",letterSpacing:"-.5px",marginBottom:4}}>{result.productName}</p>
          )}
          {result.brand && (
            <p style={{fontSize:13,color:T.secondary,marginBottom:16}}>{result.brand}</p>
          )}

          {/* Verdict */}
          {result.verdict && (
            <p style={{fontSize:15,fontWeight:600,color:st.color,
              textAlign:"center",lineHeight:1.45,marginBottom:24,
              letterSpacing:"-.2px",maxWidth:260}}>{result.verdict}</p>
          )}

          {/* 3 explanation lines */}
          {result.explanation?.slice(0,3).map((line,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",
              marginBottom:10,width:"100%",maxWidth:290}}>
              <span style={{width:20,height:20,borderRadius:10,flexShrink:0,
                backgroundColor:st.color+"1A",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:700,
                color:st.color,marginTop:1}}>{i+1}</span>
              <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,flex:1}}>{line}</p>
            </div>
          ))}
        </div>

        {/* Confidence */}
        <div style={{padding:"0 32px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:1.2,
              color:T.tertiary,textTransform:"uppercase"}}>Confianza IA</span>
            <span style={{fontSize:11,fontWeight:700,color:st.color}}>{result.confidence}%</span>
          </div>
          <div style={{height:2,backgroundColor:"rgba(0,0,0,.08)",borderRadius:1}}>
            <div style={{height:"100%",width:`${result.confidence}%`,
              backgroundColor:st.color,borderRadius:1,transition:"width 1.2s ease"}}/>
          </div>
        </div>

        {/* Actions */}
        <div style={{padding:"0 24px 36px",display:"flex",gap:10}}>
          <button onClick={reset} className="press"
            style={{flex:1,height:48,borderRadius:12,
              backgroundColor:"rgba(0,0,0,.07)",border:"none",
              cursor:"pointer",fontSize:14,fontWeight:600,color:T.primary}}>
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

  // DETAIL sheet
  if(phase==="detail"&&result){
    const st = S[result.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:T.bg,overflowY:"auto"}} className="fade">
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={shoot} style={{display:"none"}}/>
        {/* Header */}
        <div style={{padding:"28px 24px 0",display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:24}}>
          <button onClick={()=>setPhase("result")} style={{display:"flex",
            alignItems:"center",gap:6,background:"none",border:"none",
            cursor:"pointer",fontSize:14,fontWeight:600,color:T.secondary}}>
            <ArrowLeft size={16}/> Resultado
          </button>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:1.5,
            color:st.color,textTransform:"uppercase"}}>{st.label}</span>
        </div>

        <div style={{height:1,backgroundColor:T.line,margin:"0 24px 24px"}}/>

        <div style={{padding:"0 24px 100px"}}>
          {result.ingredients?.length>0 && (
            <>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:1.2,color:T.tertiary,
                textTransform:"uppercase",marginBottom:14}}>Ingredientes</p>
              {result.ingredients.map((ing,i)=>{
                const ist = S[ing.risk]||S.safe;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",
                    justifyContent:"space-between",paddingTop:14,paddingBottom:14,
                    borderTop:`1px solid ${T.line}`}}>
                    <span style={{fontSize:15,color:T.primary,fontWeight:500}}>{ing.name}</span>
                    <span style={{fontSize:10,fontWeight:700,letterSpacing:.8,
                      textTransform:"uppercase",color:ist.color,
                      backgroundColor:ist.bg,padding:"4px 10px",borderRadius:100}}>
                      {ist.label}
                    </span>
                  </div>
                );
              })}
            </>
          )}

          {result.alternatives?.length>0 && (
            <>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:1.2,color:T.tertiary,
                textTransform:"uppercase",marginTop:28,marginBottom:14}}>Alternativas seguras</p>
              {result.alternatives.map((alt,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  paddingTop:14,paddingBottom:14,borderTop:`1px solid ${T.line}`}}>
                  <span style={{fontSize:15,color:T.primary,fontWeight:500}}>{alt}</span>
                  <ChevronRight size={16} color={T.tertiary}/>
                </div>
              ))}
            </>
          )}

          <button onClick={()=>inputRef.current?.click()} className="press"
            style={{marginTop:32,width:"100%",height:52,borderRadius:14,
              backgroundColor:T.primary,border:"none",cursor:"pointer",
              fontSize:15,fontWeight:700,color:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <Camera size={16} color="#fff" strokeWidth={2}/> Escanear otro
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ── MAP — clean with bottom sheet ─────────────────────────────
function MapScreen() {
  const [loc,setLoc]         = useState(null);
  const [rests,setRests]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [sel,setSel]         = useState(null);
  const [phase,setPhase]     = useState("map"); // map|analyzing|result|error
  const [result,setResult]   = useState(null);

  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{
    const fallback=(lat=40.4168,lng=-3.7038)=>{
      setLoc({lat,lng});setRests(mockRests(lat,lng));setLoading(false);
    };
    navigator.geolocation?.getCurrentPosition(
      ({coords:{latitude:lat,longitude:lng}})=>{setLoc({lat,lng});setRests(mockRests(lat,lng));setLoading(false);},
      ()=>fallback(),{timeout:9000,enableHighAccuracy:true}
    )||fallback();
  },[]);

  useEffect(()=>{
    if(!loc||!mapRef.current||loading) return;
    let dead=false;
    getL().then(L=>{
      if(dead||!mapRef.current) return;
      if(mapInst.current){mapInst.current.remove();mapInst.current=null;}

      const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false})
        .setView([loc.lat,loc.lng],16);

      // Apple Maps-style tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {subdomains:"abcd",maxZoom:20}).addTo(map);

      // User
      L.circleMarker([loc.lat,loc.lng],
        {radius:7,fillColor:"#2563EB",color:"#fff",weight:3,fillOpacity:1}).addTo(map);

      // Restaurants
      rests.forEach(r=>{
        const col=r.safety==="safe"?T.safe:r.safety==="warning"?T.warning:T.danger;
        const icon=L.divIcon({
          html:`<div style="width:12px;height:12px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.22)"></div>`,
          iconSize:[12,12],iconAnchor:[6,6],className:""
        });
        L.marker([r.lat,r.lng],{icon}).addTo(map).on("click",()=>setSel(r));
      });
      mapInst.current=map;
    });
    return()=>{dead=true;if(mapInst.current){mapInst.current.remove();mapInst.current=null;}};
  },[loc,rests,loading]);

  const analyze=async(e,rest)=>{
    const f=e.target.files?.[0];
    if(!f) return;
    if(inputRef.current) inputRef.current.value="";
    setSel(null);setPhase("analyzing");
    try{
      const {data,type}=await toB64(f);
      const ctx=rest?`Restaurante: "${rest.name}", cocina ${rest.cuisine}.`:"";
      const txt=await callGemini([
        {inline_data:{mime_type:type,data}},
        {text:`Analiza esta imagen de restaurante para celíacos. ${ctx}

JSON sin backticks:
{"restaurantName":"nombre o null","status":"safe/warning/danger","verdict":"Una frase directa","explanation":["frase 1","frase 2","frase 3"],"questionsToAsk":["pregunta concreta para el camarero"]}`}
      ]);
      setResult(safeJSON(txt));setPhase("result");
    }catch{setPhase("error");}
  };

  const haversine=(a,b)=>{
    const R=6371000,r=x=>x*Math.PI/180;
    const dLa=r(b.lat-a.lat),dLo=r(b.lng-a.lng);
    const d=R*2*Math.atan2(Math.sqrt(Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2),
      Math.sqrt(1-(Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2)));
    return d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`;
  };

  // ANALYZING
  if(phase==="analyzing") return(
    <div style={{height:"100%",backgroundColor:"#0A0A0A",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={e=>analyze(e,sel)} style={{display:"none"}}/>
      <p style={{color:"rgba(255,255,255,.35)",fontSize:11,fontWeight:600,
        letterSpacing:2,textTransform:"uppercase"}}>Analizando restaurante</p>
    </div>
  );

  // RESULT
  if(phase==="result"&&result){
    const st=S[result.status]||S.safe;
    return(
      <div style={{height:"100%",backgroundColor:st.bg,display:"flex",
        flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"32px 28px"}} className="rise">
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          onChange={e=>analyze(e,null)} style={{display:"none"}}/>
        <button onClick={()=>{setPhase("map");setResult(null);}}
          style={{position:"absolute",top:24,left:24,background:"none",border:"none",
            cursor:"pointer",fontSize:13,fontWeight:600,color:T.secondary,
            display:"flex",alignItems:"center",gap:6}}>
          <ArrowLeft size={16}/> Mapa
        </button>

        <div style={{width:60,height:60,borderRadius:30,backgroundColor:st.color,
          display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <span style={{fontSize:20,color:"#fff",fontWeight:900}}>{st.symbol}</span>
        </div>
        <p style={{fontSize:11,fontWeight:800,letterSpacing:2.5,color:st.color,
          textTransform:"uppercase",marginBottom:12}}>{st.label}</p>
        {result.restaurantName && (
          <p style={{fontSize:18,fontWeight:700,color:T.primary,textAlign:"center",
            letterSpacing:"-.4px",marginBottom:6}}>{result.restaurantName}</p>
        )}
        <p style={{fontSize:15,fontWeight:600,color:st.color,textAlign:"center",
          marginBottom:28,letterSpacing:"-.2px",maxWidth:260,lineHeight:1.45}}>
          {result.verdict}
        </p>

        {result.explanation?.slice(0,3).map((l,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",
            marginBottom:10,width:"100%",maxWidth:290}}>
            <span style={{width:20,height:20,borderRadius:10,flexShrink:0,
              backgroundColor:st.color+"1A",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,color:st.color,marginTop:1}}>
              {i+1}
            </span>
            <p style={{fontSize:13,color:T.secondary,lineHeight:1.55,flex:1}}>{l}</p>
          </div>
        ))}

        {result.questionsToAsk?.length>0 && (
          <div style={{marginTop:24,width:"100%",maxWidth:290}}>
            <p style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:T.tertiary,
              textTransform:"uppercase",marginBottom:12}}>Pregunta al camarero</p>
            {result.questionsToAsk.slice(0,2).map((q,i)=>(
              <div key={i} style={{backgroundColor:"rgba(0,0,0,.05)",borderRadius:10,
                padding:"11px 14px",marginBottom:8}}>
                <p style={{fontSize:13,color:T.primary,fontWeight:500,lineHeight:1.5}}>
                  "{q}"
                </p>
              </div>
            ))}
          </div>
        )}

        <button onClick={()=>{setPhase("map");setResult(null);}} className="press"
          style={{marginTop:32,width:"100%",maxWidth:290,height:50,
            borderRadius:14,backgroundColor:T.primary,border:"none",
            cursor:"pointer",fontSize:15,fontWeight:700,color:"#fff"}}>
          Volver al mapa
        </button>
      </div>
    );
  }

  // MAP
  return(
    <div style={{height:"100%",position:"relative"}}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={e=>analyze(e,sel)} style={{display:"none"}}/>

      {/* Map container */}
      <div ref={mapRef} style={{width:"100%",height:"100%"}}>
        {loading && <div className="shimmer" style={{width:"100%",height:"100%"}}/>}
      </div>

      {/* Top-right: analyze button */}
      <div style={{position:"absolute",top:18,right:16,zIndex:1000}}>
        <button onClick={()=>inputRef.current?.click()} className="press"
          style={{backgroundColor:"rgba(255,255,255,.95)",backdropFilter:"blur(10px)",
            border:"none",borderRadius:12,padding:"9px 14px",cursor:"pointer",
            boxShadow:"0 2px 14px rgba(0,0,0,.1)",display:"flex",
            alignItems:"center",gap:7}}>
          <Camera size={15} color={T.primary} strokeWidth={2}/>
          <span style={{fontSize:13,fontWeight:700,color:T.primary}}>Analizar</span>
        </button>
      </div>

      {/* Legend */}
      <div style={{position:"absolute",top:18,left:16,zIndex:1000,
        backgroundColor:"rgba(255,255,255,.92)",backdropFilter:"blur(10px)",
        borderRadius:12,padding:"10px 14px",boxShadow:"0 2px 12px rgba(0,0,0,.07)"}}>
        {[{l:"Seguro",c:T.safe},{l:"Precaución",c:T.warning},{l:"Dudoso",c:T.danger}].map(x=>(
          <div key={x.l} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,
            "&:lastChild":{marginBottom:0}}}>
            <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:x.c,flexShrink:0}}/>
            <span style={{fontSize:11,fontWeight:500,color:T.primary}}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Restaurant bottom sheet */}
      {sel && (
        <div onClick={()=>setSel(null)}
          style={{position:"absolute",inset:0,zIndex:2000,
            background:"transparent"}}>
          <div onClick={e=>e.stopPropagation()}
            style={{position:"absolute",bottom:88,left:0,right:0,
              backgroundColor:"#fff",borderRadius:"18px 18px 0 0",
              padding:"16px 24px 24px",
              boxShadow:"0 -2px 24px rgba(0,0,0,.09)"}}
            className="sheet">
            {/* Grab bar */}
            <div style={{width:32,height:3,backgroundColor:T.border,
              borderRadius:2,margin:"0 auto 18px"}}/>

            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1,paddingRight:12}}>
                <h3 style={{fontSize:17,fontWeight:700,color:T.primary,
                  letterSpacing:"-.4px",marginBottom:3}}>{sel.name}</h3>
                <p style={{fontSize:13,color:T.secondary}}>{sel.cuisine}</p>
              </div>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:.8,
                textTransform:"uppercase",color:S[sel.safety]?.color,
                backgroundColor:S[sel.safety]?.bg,padding:"5px 12px",borderRadius:100}}>
                {S[sel.safety]?.label}
              </span>
            </div>

            <p style={{fontSize:14,color:T.secondary,lineHeight:1.55,
              marginBottom:20,letterSpacing:"-.1px"}}>{sel.note}</p>

            {loc && (
              <p style={{fontSize:12,color:T.tertiary,marginBottom:20}}>
                📍 {haversine(loc,sel)} de tu ubicación
              </p>
            )}

            <button onClick={()=>inputRef.current?.click()} className="press"
              style={{width:"100%",height:48,borderRadius:13,backgroundColor:T.primary,
                border:"none",cursor:"pointer",fontSize:14,fontWeight:700,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <Camera size={15} color="#fff" strokeWidth={2}/> Analizar con foto
            </button>
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
      backgroundColor:"rgba(250,250,248,.95)",backdropFilter:"blur(20px) saturate(180%)",
      borderTop:`1px solid ${T.line}`,
      display:"flex",alignItems:"flex-start",justifyContent:"space-around",paddingTop:14}}>
      {[{id:"home",Icon:Home,label:"Inicio"},
        {id:"scan",Icon:Camera,label:"Escanear"},
        {id:"map",Icon:MapPin,label:"Mapa"}].map(({id,Icon,label})=>{
        const on=active===id;
        return(
          <button key={id} onClick={()=>go(id)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              background:"none",border:"none",cursor:"pointer",minWidth:70,padding:0}}>
            <div style={{width:38,height:28,display:"flex",alignItems:"center",
              justifyContent:"center",borderRadius:9,
              backgroundColor:on?"#0A0A0A14":"transparent",
              transition:"background .18s"}}>
              <Icon size={21} color={on?T.primary:T.tertiary}
                strokeWidth={on?2.2:1.6}/>
            </div>
            <span style={{fontSize:10,fontWeight:on?700:400,
              color:on?T.primary:T.tertiary,letterSpacing:.15,
              transition:"color .18s"}}>{label}</span>
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

  const screens = { home:<HomeScreen2/>, scan:<Scan/>, map:<MapScreen/> };

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
