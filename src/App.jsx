import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, MapPin, Heart, Home, Zap, ChevronRight,
  CheckCircle, AlertTriangle, XCircle, ArrowLeft,
  Shield, Users, Upload, Plus, List, Globe,
  Star, Clock, Search, BarChart3, Sparkles,
  BookOpen, RefreshCw, TrendingUp, Info, X, Award
} from "lucide-react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  safe:          "#1E8E5A",
  safeLight:     "#EAF6F0",
  safeMid:       "#D0EBE0",
  safeBorder:    "#B2DAC7",
  warning:       "#E6A700",
  warningLight:  "#FFF9E6",
  warningBorder: "#F5D98A",
  danger:        "#C44536",
  dangerLight:   "#FDECEA",
  dangerBorder:  "#F0A89E",
  bg:            "#F8FAF8",
  card:          "#FFFFFF",
  cardAlt:       "#F4F7F4",
  text:          "#1A1A1A",
  sub:           "#6B7280",
  border:        "#E8EDE8",
  nav:           "#FFFFFF",
};

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: "1", name: "Avena Quaker Instantánea", brand: "Quaker",
    barcode: "0030000010693", status: "warning", confidence: 72,
    scannedAt: "2 min ago", category: "Cereals",
    ingredients: [
      { name: "Avena",             risk: "warning", note: "Possible cross-contamination in shared facilities" },
      { name: "Azúcar",            risk: "safe"    },
      { name: "Sal",               risk: "safe"    },
      { name: "Almidón modificado",risk: "warning", note: "Source unknown — may be wheat-based"               },
    ],
    reason: "Oats are naturally gluten-free but often processed in wheat facilities. Cross-contamination risk is high.",
    alternatives: ["Avena Puro Sin Gluten (Bob's Red Mill)", "Quinoa Flakes Nature"],
    community: 89, verified: false,
  },
  {
    id: "2", name: "Pan de Molde Bimbo", brand: "Bimbo",
    barcode: "7501000601013", status: "danger", confidence: 99,
    scannedAt: "1h ago", category: "Bakery",
    ingredients: [
      { name: "Harina de Trigo",   risk: "danger",  note: "Primary gluten source"       },
      { name: "Agua",              risk: "safe"                                          },
      { name: "Gluten de Trigo",   risk: "danger",  note: "Concentrated gluten additive" },
      { name: "Levadura",          risk: "safe"                                          },
      { name: "Sal",               risk: "safe"                                          },
    ],
    reason: "Contains wheat flour and added wheat gluten. Absolutely not safe for celiac patients.",
    alternatives: ["Pan Sin Gluten Schär Ciabatta", "Pan BFree Multisemillas", "Pan Genius GF"],
    community: 314, verified: true,
  },
  {
    id: "3", name: "Arroz Brillante Integral", brand: "Brillante",
    barcode: "8410033000028", status: "safe", confidence: 98,
    scannedAt: "3h ago", category: "Grains",
    ingredients: [
      { name: "Arroz integral",    risk: "safe" },
    ],
    reason: "100% brown rice. Processed in a dedicated gluten-free facility. Certified by FACE.",
    alternatives: [],
    community: 512, verified: true,
  },
  {
    id: "4", name: "Galletas Digestive", brand: "McVitie's",
    barcode: "5000168002021", status: "danger", confidence: 96,
    scannedAt: "Yesterday",
    category: "Snacks",
    ingredients: [
      { name: "Harina de trigo integral", risk: "danger",  note: "Contains gluten"       },
      { name: "Azúcar",                  risk: "safe"                                   },
      { name: "Aceite de palma",         risk: "safe"                                   },
      { name: "Jarabe de malta",         risk: "danger",  note: "Barley malt — contains gluten" },
    ],
    reason: "Contains whole wheat flour and barley malt syrup. Classic hidden gluten double hit.",
    alternatives: ["Digestive GF Schär", "Galletas Nairn's Sin Gluten"],
    community: 201, verified: true,
  },
];

const RESTAURANTS = [
  {
    id: "r1", name: "Celiac Kitchen",
    cuisine: "Mediterranean", address: "Calle Mayor 14",
    distance: "0.3 km", rating: 4.9, reviews: 234,
    status: "safe", badge: "100% Certified Gluten-Free",
    tags: ["Dedicated kitchen", "Staff trained", "FACE certified"],
    verified: true, savedByMe: true,
  },
  {
    id: "r2", name: "Green Bowl",
    cuisine: "Healthy & Vegan", address: "Av. Diagonal 88",
    distance: "0.8 km", rating: 4.6, reviews: 187,
    status: "safe", badge: "Extensive GF Menu",
    tags: ["Allergen informed", "GF menu card", "No cross-contact policy"],
    verified: true, savedByMe: false,
  },
  {
    id: "r3", name: "Pasta Roma",
    cuisine: "Italian", address: "Via Napoli 3",
    distance: "1.2 km", rating: 4.2, reviews: 312,
    status: "warning", badge: "Risk of Cross-Contamination",
    tags: ["Shared kitchen", "GF pasta available", "Inform staff"],
    verified: false, savedByMe: false,
  },
  {
    id: "r4", name: "Sushi Zen",
    cuisine: "Japanese", address: "Carrer Balmes 55",
    distance: "1.5 km", rating: 4.7, reviews: 156,
    status: "warning", badge: "Caution Required",
    tags: ["Regular soy sauce has gluten", "Ask for tamari", "Alert chef"],
    verified: false, savedByMe: false,
  },
  {
    id: "r5", name: "Nomo Bakery",
    cuisine: "GF Bakery", address: "Rambla Catalunya 22",
    distance: "2.1 km", rating: 4.8, reviews: 98,
    status: "safe", badge: "100% Certified Gluten-Free",
    tags: ["Dedicated facility", "Certified", "Pastries & bread"],
    verified: true, savedByMe: true,
  },
];

const HIDDEN_GLUTEN_MARKERS = [
  "wheat","trigo","harina de trigo","gluten","gluten de trigo","gluten wheat",
  "barley","cebada","rye","centeno","triticale","spelt","kamut","durum",
  "semolina","hordeum vulgare","malt","malta","malt extract","extracto de malta",
  "maltodextrin","maltodextrina","maltose","maltosa",
  "modified starch","almidón modificado",
  "hydrolyzed vegetable protein","hvp","proteína vegetal hidrolizada",
  "wheat starch","almidón de trigo","wheat germ","germen de trigo",
  "brewer's yeast","levadura de cerveza",
  "bulgur","farro","freekeh","emmer","einkorn","avena","oat",
];

// ─── Utils ────────────────────────────────────────────────────────────────────
const statusColor  = (s) => s === "safe" ? C.safe   : s === "warning" ? C.warning   : C.danger;
const statusBg     = (s) => s === "safe" ? C.safeLight : s === "warning" ? C.warningLight : C.dangerLight;
const statusBorder = (s) => s === "safe" ? C.safeBorder : s === "warning" ? C.warningBorder : C.dangerBorder;
const statusLabel  = (s) => s === "safe" ? "SAFE"     : s === "warning" ? "CAUTION"    : "NOT SAFE";
const statusEmoji  = (s) => s === "safe" ? "✓"        : s === "warning" ? "!"           : "✕";

function analyzeText(text) {
  const lower = text.toLowerCase();
  const found = HIDDEN_GLUTEN_MARKERS.filter(m => lower.includes(m));
  if (!found.length) return { status: "safe",    found: [], confidence: 93 };
  const hard = ["trigo","wheat","gluten","harina de trigo","gluten de trigo","barley","rye","cebada","centeno"];
  if (found.some(f => hard.includes(f))) return { status: "danger",  found, confidence: 98 };
  return { status: "warning", found, confidence: 71 };
}

// ─── CSS / Animations ─────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { display: none; }
  textarea:focus { outline: none; }
  button { font-family: inherit; }
  input:focus { outline: none; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes popIn    { from { opacity:0; transform:scale(.88); } to { opacity:1; transform:scale(1); } }
  @keyframes pulse    { 0%,100% { transform:scale(1); opacity:.7; } 50% { transform:scale(1.18); opacity:1; } }
  @keyframes scanLine { 0% { top:8%; } 50% { top:88%; } 100% { top:8%; } }
  @keyframes ring     { 0% { transform:scale(.5); opacity:.8; } 100% { transform:scale(2.2); opacity:0; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes shimmer  { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  @keyframes glow     { 0%,100% { box-shadow:0 0 0 0 rgba(30,142,90,.35); } 50% { box-shadow:0 0 0 12px rgba(30,142,90,0); } }
  @keyframes slideUp  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

  .screen-enter { animation: fadeUp .28s cubic-bezier(.22,.68,0,1.2) both; }
  .pop-in       { animation: popIn .32s cubic-bezier(.22,.68,0,1.3) both; }
  .slide-up     { animation: slideUp .3s ease both; }
  .scan-ring    { animation: ring 1.8s ease-out infinite; }
  .spinner      { animation: spin .9s linear infinite; }
  .pulse-anim   { animation: pulse 2s ease-in-out infinite; }
  .shimmer-bg   {
    background: linear-gradient(90deg, #f0f3f0 25%, #e4e9e4 50%, #f0f3f0 75%);
    background-size: 200% 100%; animation: shimmer 1.4s infinite;
  }
  .tap-active:active { transform: scale(.96); transition: transform .12s; }
`;

// ─── Shared Components ────────────────────────────────────────────────────────

function StatusIcon({ status, size = 22 }) {
  const col = statusColor(status);
  if (status === "safe")    return <CheckCircle  size={size} color={col} strokeWidth={2.5} />;
  if (status === "warning") return <AlertTriangle size={size} color={col} strokeWidth={2.5} />;
  return                           <XCircle       size={size} color={col} strokeWidth={2.5} />;
}

function SafetyPill({ status, size = "sm" }) {
  const col = statusColor(status);
  const bg  = statusBg(status);
  const bdr = statusBorder(status);
  const lbl = statusLabel(status);
  const pad = size === "lg" ? "7px 16px" : size === "md" ? "5px 12px" : "4px 9px";
  const fs  = size === "lg" ? 13 : size === "md" ? 12 : 10.5;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      backgroundColor: bg, color: col,
      border: `1.5px solid ${bdr}`, borderRadius: 100,
      padding: pad, fontSize: fs, fontWeight: 800, letterSpacing: .7,
      whiteSpace: "nowrap",
    }}>
      <StatusIcon status={status} size={fs + 2} />
      {lbl}
    </span>
  );
}

function ConfidenceRing({ score, status, size = 72 }) {
  const col  = statusColor(status);
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8EDE8" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.2s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: size * .22, fontWeight: 800, color: col, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: size * .13, color: C.sub, fontWeight: 600, marginTop: 1 }}>AI</span>
      </div>
    </div>
  );
}

function Card({ children, style = {}, onClick, className = "" }) {
  return (
    <div className={`${onClick ? "tap-active" : ""} ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: C.card, borderRadius: 22, padding: 20,
        boxShadow: "0 2px 20px rgba(0,0,0,.055)", border: `1px solid ${C.border}`,
        cursor: onClick ? "pointer" : "default", ...style,
      }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: -.3 }}>{children}</h2>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 13, fontWeight: 700, color: C.safe, background: "none",
          border: "none", cursor: "pointer", letterSpacing: -.1,
        }}>{action}</button>
      )}
    </div>
  );
}

function BackBtn({ onBack, dark = false }) {
  return (
    <button onClick={onBack} style={{
      display: "flex", alignItems: "center", gap: 5, color: dark ? "#fff" : C.safe,
      background: dark ? "rgba(255,255,255,.14)" : C.safeLight,
      border: dark ? "none" : `1px solid ${C.safeBorder}`,
      borderRadius: 100, padding: "7px 14px 7px 10px", cursor: "pointer",
      fontSize: 14, fontWeight: 700,
    }}>
      <ArrowLeft size={16} strokeWidth={2.5} /> Back
    </button>
  );
}

function EmptyState({ emoji, title, sub, cta, onCta }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }} className="pop-in">
      <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>{emoji}</div>
      <p style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: cta ? 24 : 0 }}>{sub}</p>
      {cta && (
        <button onClick={onCta} style={{
          backgroundColor: C.safe, color: "#fff", border: "none",
          borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>{cta}</button>
      )}
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ nav, setActiveProduct }) {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  });

  const actions = [
    { id:"scanner",     icon:Camera,   label:"Scan Product",        sub:"Barcode & label scan", accent:"#1E8E5A" },
    { id:"ingredients", icon:Zap,      label:"Analyze Ingredients", sub:"Paste or photograph",  accent:"#5C63C8" },
    { id:"restaurants", icon:MapPin,   label:"Safe Restaurants",    sub:"Verified nearby",      accent:"#E68900" },
    { id:"favorites",   icon:Heart,    label:"My Pantry",           sub:"Saved & trusted",      accent:"#D4306A" },
  ];

  const stats = [
    { label:"Scanned", value:"12", sub:"this week" },
    { label:"Safe",    value:"9",  sub:"confirmed",  color: C.safe   },
    { label:"Avoided", value:"3",  sub:"dangerous",  color: C.danger },
  ];

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"0 0 16px" }}>
      {/* Hero header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.safeLight} 0%, ${C.bg} 100%)`,
        padding: "24px 22px 28px",
        borderBottom: `1px solid ${C.safeBorder}`,
        marginBottom: 8,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize:13, color:C.sub, fontWeight:600, marginBottom:5, letterSpacing:.3 }}>
              {greeting} 👋
            </p>
            <h1 style={{ fontSize:30, fontWeight:800, color:C.text, lineHeight:1.15, letterSpacing:-.5 }}>
              Stay safely<br />
              <span style={{ color:C.safe }}>gluten-free</span>
            </h1>
          </div>
          <div className="pulse-anim" style={{
            width:50, height:50, borderRadius:17, backgroundColor:C.safe,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 6px 20px ${C.safe}50`,
          }}>
            <Shield size={24} color="#fff" strokeWidth={2.5} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"flex", gap:10 }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              flex:1, backgroundColor: i === 0 ? "rgba(255,255,255,.8)" : C.card,
              borderRadius:16, padding:"14px 12px", textAlign:"center",
              border:`1px solid ${C.border}`,
              boxShadow:"0 2px 10px rgba(0,0,0,.05)",
            }}>
              <p style={{ fontSize:23, fontWeight:900, color:s.color || C.text, lineHeight:1, marginBottom:3 }}>
                {s.value}
              </p>
              <p style={{ fontSize:11, color:C.text, fontWeight:700, marginBottom:1 }}>{s.label}</p>
              <p style={{ fontSize:10, color:C.sub }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:"8px 20px 0" }}>
        {/* Action grid */}
        <SectionTitle>Quick Actions</SectionTitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:8 }}>
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} className="tap-active" onClick={() => nav(a.id)} style={{
                backgroundColor:C.card, borderRadius:22, padding:"20px 18px",
                boxShadow:"0 3px 18px rgba(0,0,0,.07)", border:`1px solid ${C.border}`,
                cursor:"pointer", transition:"transform .15s, box-shadow .15s",
              }}>
                <div style={{
                  width:46, height:46, borderRadius:15, marginBottom:14,
                  backgroundColor: a.accent + "18",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <Icon size={23} color={a.accent} strokeWidth={2} />
                </div>
                <p style={{ fontSize:14, fontWeight:800, color:C.text, marginBottom:4, lineHeight:1.3, letterSpacing:-.2 }}>
                  {a.label}
                </p>
                <p style={{ fontSize:12, color:C.sub, fontWeight:500 }}>{a.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Recent scans */}
        <SectionTitle action="See all" onAction={() => nav("favorites")}>
          Recent Scans
        </SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
          {PRODUCTS.slice(0, 3).map((p, idx) => (
            <div key={p.id} className="tap-active slide-up" onClick={() => { setActiveProduct(p); nav("result"); }}
              style={{
                backgroundColor:C.card, borderRadius:18, padding:"15px 18px",
                boxShadow:"0 2px 14px rgba(0,0,0,.05)", border:`1px solid ${C.border}`,
                display:"flex", alignItems:"center", gap:14, cursor:"pointer",
                animationDelay: `${idx * .06}s`,
              }}>
              <div style={{
                width:46, height:46, borderRadius:15, backgroundColor:statusBg(p.status),
                border:`1.5px solid ${statusBorder(p.status)}`,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }}>
                <StatusIcon status={p.status} size={22} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{
                  fontSize:14, fontWeight:700, color:C.text, marginBottom:3,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", letterSpacing:-.1,
                }}>
                  {p.name}
                </p>
                <p style={{ fontSize:12, color:C.sub }}>{p.brand} · {p.scannedAt}</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7, flexShrink:0 }}>
                <SafetyPill status={p.status} />
                <ChevronRight size={15} color={C.sub} />
              </div>
            </div>
          ))}
        </div>

        {/* Safe tip card */}
        <div style={{
          marginTop:20, backgroundColor:C.safeMid, borderRadius:20, padding:"16px 18px",
          border:`1px solid ${C.safeBorder}`, display:"flex", gap:14, alignItems:"center",
        }}>
          <div style={{
            width:42, height:42, borderRadius:14, backgroundColor:C.safe,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <Sparkles size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:800, color:C.safe, marginBottom:3 }}>Did you know?</p>
            <p style={{ fontSize:12, color:"#2D6B4E", lineHeight:1.5 }}>
              "Almidón modificado" can be wheat-based. Always check the origin!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCANNER SCREEN ───────────────────────────────────────────────────────────
function ScannerScreen({ nav, setActiveProduct }) {
  const [phase, setPhase] = useState("ready"); // ready | scanning | done
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  const doScan = () => {
    setPhase("scanning");
    setProgress(0);
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += Math.random() * 14 + 4;
      setProgress(Math.min(p, 96));
      if (p >= 96) {
        clearInterval(intervalRef.current);
        setTimeout(() => {
          const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
          setActiveProduct(product);
          nav("result");
        }, 350);
      }
    }, 110);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", backgroundColor:"#0C0C0E" }}>
      {/* Viewfinder area */}
      <div style={{ flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {/* Subtle grid overlay */}
        <div style={{
          position:"absolute", inset:0, opacity:.05,
          backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize:"40px 40px",
        }} />

        <div style={{ position:"absolute", top:20, left:20 }}>
          <BackBtn onBack={() => nav("home")} dark />
        </div>

        <div style={{ position:"absolute", top:20, right:20 }}>
          <button style={{
            backgroundColor:"rgba(255,255,255,.12)", border:"none", borderRadius:12,
            padding:"9px 14px", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
          }}>
            💡 Torch
          </button>
        </div>

        {/* Scanner box */}
        <div style={{ position:"relative", width:230, height:230 }}>
          {/* Animated rings (scanning only) */}
          {phase === "scanning" && [0, .5, 1].map(delay => (
            <div key={delay} className="scan-ring" style={{
              position:"absolute", inset:-20, borderRadius:"50%",
              border:`2px solid ${C.safe}`, animationDelay:`${delay}s`,
            }} />
          ))}

          {/* Corner brackets */}
          {[
            {top:0,left:0,   bw:"3px 0 0 3px", br:"4px 0 0 4px"},
            {top:0,right:0,  bw:"3px 3px 0 0", br:"0 4px 0 0"},
            {bottom:0,left:0,bw:"0 0 3px 3px", br:"0 0 4px 4px"},
            {bottom:0,right:0,bw:"0 3px 3px 0",br:"0 0 4px 0"},
          ].map((c, i) => (
            <div key={i} style={{
              position:"absolute", width:32, height:32,
              border:`3px solid ${phase === "scanning" ? C.safe : "rgba(255,255,255,.7)"}`,
              borderWidth: c.bw, borderRadius: c.br,
              transition:"border-color .4s",
              top:c.top, left:c.left, bottom:c.bottom, right:c.right,
            }} />
          ))}

          {/* Scan line */}
          {phase === "scanning" && (
            <div style={{
              position:"absolute", left:0, right:0, height:2,
              backgroundColor:C.safe,
              boxShadow:`0 0 12px ${C.safe}, 0 0 4px ${C.safe}`,
              animation:"scanLine 1.6s ease-in-out infinite",
            }} />
          )}

          {/* Center content */}
          <div style={{
            position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center",
          }}>
            {phase === "ready" && <Camera size={38} color="rgba(255,255,255,.25)" />}
          </div>
        </div>

        {/* Progress bar */}
        {phase === "scanning" && (
          <div style={{ position:"absolute", bottom:32, left:40, right:40 }}>
            <p style={{ color:"rgba(255,255,255,.7)", fontSize:13, fontWeight:600, textAlign:"center", marginBottom:10 }}>
              Analyzing ingredients...
            </p>
            <div style={{ height:5, backgroundColor:"rgba(255,255,255,.1)", borderRadius:100, overflow:"hidden" }}>
              <div style={{
                height:"100%", width:`${progress}%`, borderRadius:100,
                background:`linear-gradient(90deg, ${C.safe}, #34D399)`,
                transition:"width .12s ease",
              }} />
            </div>
            <p style={{ color:"rgba(255,255,255,.4)", fontSize:11, textAlign:"center", marginTop:6 }}>
              {Math.round(progress)}% — checking 1,200+ gluten markers
            </p>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{
        backgroundColor:"#161619", borderTopLeftRadius:36, borderTopRightRadius:36,
        padding:"28px 28px 48px",
        borderTop:"1px solid rgba(255,255,255,.07)",
      }}>
        <p style={{ color:"#fff", fontSize:21, fontWeight:800, textAlign:"center", marginBottom:7, letterSpacing:-.3 }}>
          {phase === "ready" ? "Point at a product label" : "Hold still…"}
        </p>
        <p style={{ color:"rgba(255,255,255,.4)", fontSize:13, textAlign:"center", marginBottom:28 }}>
          {phase === "ready" ? "Barcode, ingredient list, or packaging" : "AI is reading every ingredient"}
        </p>

        <button onClick={phase === "ready" ? doScan : undefined}
          disabled={phase === "scanning"}
          style={{
            width:"100%", height:60, borderRadius:20, fontSize:17, fontWeight:800,
            backgroundColor: phase === "scanning" ? "rgba(255,255,255,.08)" : C.safe,
            border:"none", cursor: phase === "scanning" ? "default" : "pointer",
            color: phase === "scanning" ? "rgba(255,255,255,.4)" : "#fff",
            transition:"all .3s", letterSpacing:-.2,
            boxShadow: phase === "scanning" ? "none" : `0 6px 28px ${C.safe}60`,
          }}>
          {phase === "scanning" ? "🔍 Analyzing…" : "📸 Tap to Scan"}
        </button>

        {/* Quick demo chips */}
        {phase === "ready" && (
          <div style={{ marginTop:18 }}>
            <p style={{ color:"rgba(255,255,255,.3)", fontSize:11, fontWeight:600, textAlign:"center", marginBottom:10, letterSpacing:.5, textTransform:"uppercase" }}>
              Demo — try a product
            </p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
              {PRODUCTS.map(p => (
                <button key={p.id} onClick={() => { setActiveProduct(p); nav("result"); }} style={{
                  fontSize:12, padding:"7px 14px", borderRadius:100,
                  backgroundColor:"rgba(255,255,255,.08)",
                  border:"1px solid rgba(255,255,255,.12)",
                  color:"rgba(255,255,255,.65)", cursor:"pointer", fontWeight:600,
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <span style={{ fontSize:10 }}>{statusEmoji(p.status)}</span>
                  {p.name.split(" ").slice(0,2).join(" ")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────
function ResultScreen({ nav, product }) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [reported, setReported] = useState(false);

  if (!product) return (
    <EmptyState emoji="🔍" title="No product selected"
      sub="Go back and scan a product first" cta="Scan Product" onCta={() => nav("scanner")} />
  );

  const col = statusColor(product.status);
  const bg  = statusBg(product.status);
  const bdr = statusBorder(product.status);

  return (
    <div style={{ height:"100%", overflowY:"auto" }}>
      {/* Hero */}
      <div style={{
        background:`linear-gradient(175deg, ${bg} 0%, ${C.bg} 100%)`,
        padding:"20px 22px 32px",
        borderBottom:`1px solid ${bdr}`,
        position:"relative",
      }}>
        <div style={{ marginBottom:20 }}>
          <BackBtn onBack={() => nav("home")} />
        </div>

        {/* Big status */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
          <div className="pop-in" style={{
            width:100, height:100, borderRadius:50,
            backgroundColor: col + "20",
            border:`3px solid ${col + "35"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            marginBottom:20,
            boxShadow: product.status === "safe" ? `0 0 0 0 ${col}40` : "none",
            animation: product.status === "safe" ? "glow 2.5s ease infinite" : "popIn .35s ease both",
          }}>
            <StatusIcon status={product.status} size={50} />
          </div>

          <SafetyPill status={product.status} size="lg" />

          <h1 style={{
            fontSize:21, fontWeight:800, color:C.text, marginTop:14, marginBottom:5,
            lineHeight:1.25, letterSpacing:-.3, maxWidth:260,
          }}>
            {product.name}
          </h1>
          <p style={{ fontSize:14, color:C.sub, marginBottom:18, fontWeight:500 }}>{product.brand}</p>

          {/* Reason badge */}
          <div style={{
            backgroundColor:"rgba(255,255,255,.75)", backdropFilter:"blur(6px)",
            border:`1px solid ${bdr}`, borderRadius:16, padding:"12px 18px",
            fontSize:13, color:C.text, lineHeight:1.6, maxWidth:290, fontWeight:500,
          }}>
            {product.reason}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"22px 20px 100px" }}>
        {/* Confidence + community */}
        <Card style={{ marginBottom:14 }} className="slide-up">
          <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:16 }}>
            <ConfidenceRing score={product.confidence} status={product.status} />
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:5, letterSpacing:-.2 }}>
                AI Confidence Score
              </p>
              <p style={{ fontSize:12, color:C.sub, lineHeight:1.5 }}>
                Based on ingredient database analysis and community reports
              </p>
            </div>
          </div>
          <div style={{
            backgroundColor:C.cardAlt, borderRadius:14, padding:"12px 14px",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Users size={15} color={C.sub} />
              <span style={{ fontSize:13, color:C.sub, fontWeight:600 }}>
                {product.community} community verifications
              </span>
            </div>
            {product.verified && (
              <span style={{
                fontSize:11, fontWeight:800, color:C.safe,
                backgroundColor:C.safeLight, border:`1px solid ${C.safeBorder}`,
                borderRadius:100, padding:"3px 10px",
              }}>✓ VERIFIED</span>
            )}
          </div>
        </Card>

        {/* Ingredient breakdown */}
        <Card style={{ marginBottom:14 }} className="slide-up">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ fontSize:16, fontWeight:800, color:C.text, letterSpacing:-.2 }}>
              Ingredient Breakdown
            </h3>
            {product.ingredients.length > 3 && (
              <button onClick={() => setExpanded(!expanded)} style={{
                fontSize:13, fontWeight:700, color:C.safe, background:"none", border:"none", cursor:"pointer",
              }}>
                {expanded ? "Collapse" : `+${product.ingredients.length - 3} more`}
              </button>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {(expanded ? product.ingredients : product.ingredients.slice(0, 3)).map((ing, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"flex-start", justifyContent:"space-between",
                paddingTop: i > 0 ? 13 : 0, paddingBottom:13,
                borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                gap:12,
              }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom: ing.note ? 3 : 0 }}>
                    {ing.name}
                  </p>
                  {ing.note && (
                    <p style={{ fontSize:12, color:C.sub, lineHeight:1.4 }}>{ing.note}</p>
                  )}
                </div>
                <SafetyPill status={ing.risk} />
              </div>
            ))}
          </div>
        </Card>

        {/* Alternatives */}
        {product.alternatives?.length > 0 && (
          <Card style={{
            marginBottom:14,
            backgroundColor:C.safeLight,
            borderColor:C.safeBorder,
          }} className="slide-up">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{
                width:34, height:34, borderRadius:11, backgroundColor:C.safe,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Shield size={17} color="#fff" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize:15, fontWeight:800, color:C.safe, letterSpacing:-.2 }}>
                Safe Alternatives
              </h3>
            </div>
            {product.alternatives.map((alt, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                paddingTop: i > 0 ? 11 : 0, borderTop: i > 0 ? `1px solid ${C.safeBorder}` : "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <CheckCircle size={15} color={C.safe} strokeWidth={2.5} />
                  <span style={{ fontSize:14, color:"#1A4030", fontWeight:600 }}>{alt}</span>
                </div>
                <ChevronRight size={15} color={C.safe} />
              </div>
            ))}
          </Card>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <button onClick={() => setSaved(!saved)} style={{
            flex:1, height:54, borderRadius:17,
            backgroundColor: saved ? C.dangerLight : C.cardAlt,
            border:`1.5px solid ${saved ? C.dangerBorder : C.border}`,
            cursor:"pointer", fontSize:14, fontWeight:700,
            color: saved ? C.danger : C.text,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            transition:"all .2s",
          }}>
            <Heart size={17} color={saved ? C.danger : C.sub}
              fill={saved ? C.danger : "none"} strokeWidth={2.5} />
            {saved ? "Saved!" : "Save"}
          </button>
          <button onClick={() => nav("scanner")} style={{
            flex:2, height:54, borderRadius:17, backgroundColor:C.safe,
            border:"none", cursor:"pointer", fontSize:15, fontWeight:800,
            color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            boxShadow:`0 5px 20px ${C.safe}50`, letterSpacing:-.2,
          }}>
            <Camera size={17} color="#fff" strokeWidth={2.5} />
            Scan another
          </button>
        </div>

        {/* Report */}
        <button onClick={() => setReported(true)} style={{
          width:"100%", padding:"13px 0", borderRadius:14,
          backgroundColor: "transparent", border:`1px solid ${C.border}`,
          cursor:"pointer", fontSize:13, fontWeight:600, color:C.sub,
          display:"flex", alignItems:"center", justifyContent:"center", gap:7,
        }}>
          <Info size={15} color={C.sub} />
          {reported ? "Thanks for your report! ✓" : "Report incorrect info"}
        </button>
      </div>
    </div>
  );
}

// ─── INGREDIENTS SCREEN ───────────────────────────────────────────────────────
function IngredientsScreen({ nav }) {
  const [text, setText]     = useState("");
  const [phase, setPhase]   = useState("input");   // input | analyzing | result
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("paste");

  const examples = [
    { label:"🚨 Dangerous", text:"Agua, harina de trigo (62%), aceite de girasol, gluten de trigo, sal, levadura, azúcar" },
    { label:"⚠️ Risky",     text:"Avena, azúcar, sal, almidón modificado, extracto de malta, jarabe de glucosa" },
    { label:"✅ Safe",      text:"Arroz integral, agua, sal, aceite de oliva virgen extra, ajo en polvo, especias naturales" },
  ];

  const doAnalyze = () => {
    if (!text.trim()) return;
    setPhase("analyzing");
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5;
      setProgress(Math.min(p, 97));
      if (p >= 97) {
        clearInterval(iv);
        const r = analyzeText(text);
        setResult(r);
        setPhase("result");
      }
    }, 90);
  };

  const reset = () => { setText(""); setPhase("input"); setResult(null); setProgress(0); };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"20px 20px 0", flexShrink:0 }}>
        <BackBtn onBack={() => nav("home")} />
        <h1 style={{ fontSize:26, fontWeight:800, color:C.text, marginTop:14, marginBottom:5, letterSpacing:-.4 }}>
          Ingredient Analyzer
        </h1>
        <p style={{ fontSize:14, color:C.sub, marginBottom:18, fontWeight:500 }}>
          Detect hidden gluten in any ingredient list
        </p>

        {/* Tabs */}
        {phase === "input" && (
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {[
              { id:"paste",  icon:Zap,    label:"Paste text" },
              { id:"camera", icon:Camera, label:"Camera"     },
              { id:"upload", icon:Upload, label:"Upload"     },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  flex:1, padding:"10px 6px", borderRadius:14, fontSize:12, fontWeight:700,
                  backgroundColor: activeTab === t.id ? C.safeLight : C.cardAlt,
                  border:`1.5px solid ${activeTab === t.id ? C.safe : C.border}`,
                  color: activeTab === t.id ? C.safe : C.sub, cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                }}>
                  <Icon size={17} color={activeTab === t.id ? C.safe : C.sub} strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 100px" }}>
        {/* INPUT */}
        {phase === "input" && (
          <div className="screen-enter">
            {activeTab === "paste" ? (
              <>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder={"Paste ingredient list here…\n\ne.g. Agua, Harina de trigo, Azúcar, Sal…"}
                  style={{
                    width:"100%", minHeight:158, borderRadius:20, padding:"16px 18px",
                    border:`2px solid ${text ? C.safeBorder : C.border}`,
                    fontSize:14, color:C.text, backgroundColor:C.card,
                    resize:"none", fontFamily:FONT, lineHeight:1.65,
                    transition:"border-color .25s", boxShadow:"0 2px 14px rgba(0,0,0,.05)",
                    marginBottom:14,
                  }} />

                {/* Examples */}
                <p style={{ fontSize:12, color:C.sub, marginBottom:10, fontWeight:600, letterSpacing:.3, textTransform:"uppercase" }}>
                  Quick examples
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                  {examples.map((ex, i) => (
                    <button key={i} onClick={() => setText(ex.text)} style={{
                      textAlign:"left", padding:"11px 16px", borderRadius:14,
                      backgroundColor:C.cardAlt, border:`1px solid ${C.border}`,
                      cursor:"pointer", fontSize:13, fontWeight:600, color:C.text,
                    }}>
                      {ex.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                backgroundColor:C.cardAlt, border:`2px dashed ${C.border}`,
                borderRadius:22, padding:"48px 24px", textAlign:"center", marginBottom:20,
              }}>
                <div style={{ fontSize:36, marginBottom:12 }}>
                  {activeTab === "camera" ? "📷" : "📁"}
                </div>
                <p style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:6 }}>
                  {activeTab === "camera" ? "Take a photo" : "Upload label image"}
                </p>
                <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>
                  OCR will extract and analyze the ingredients automatically
                </p>
                <button onClick={() => setActiveTab("paste")} style={{
                  backgroundColor:C.safe, color:"#fff", border:"none",
                  borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer",
                }}>
                  Use text paste instead
                </button>
              </div>
            )}

            <button onClick={doAnalyze} disabled={!text.trim()} style={{
              width:"100%", height:58, borderRadius:20, fontSize:16, fontWeight:800,
              backgroundColor: text.trim() ? C.safe : "#D1D8D1", color:"#fff",
              border:"none", cursor: text.trim() ? "pointer" : "default",
              transition:"background .2s", letterSpacing:-.2,
              boxShadow: text.trim() ? `0 6px 24px ${C.safe}50` : "none",
            }}>
              🔬 Analyze Ingredients
            </button>
          </div>
        )}

        {/* ANALYZING */}
        {phase === "analyzing" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:48 }}
            className="screen-enter">
            <div style={{
              width:90, height:90, borderRadius:45, backgroundColor:C.safeLight,
              border:`2px solid ${C.safeBorder}`,
              display:"flex", alignItems:"center", justifyContent:"center", marginBottom:24,
            }}>
              <Zap size={40} color={C.safe} strokeWidth={2} className="spinner" />
            </div>
            <p style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:8, letterSpacing:-.3 }}>
              AI Analyzing…
            </p>
            <p style={{ fontSize:14, color:C.sub, marginBottom:36, textAlign:"center" }}>
              Checking against 1,200+ gluten markers<br />and hidden ingredient aliases
            </p>
            <div style={{ width:"100%", maxWidth:280 }}>
              <div style={{ height:7, backgroundColor:"#E0E5E0", borderRadius:100, overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${progress}%`,
                  background:`linear-gradient(90deg, ${C.safe}, #34D399)`,
                  borderRadius:100, transition:"width .1s ease",
                }} />
              </div>
              <p style={{ fontSize:12, color:C.sub, textAlign:"center", marginTop:8, fontWeight:600 }}>
                {Math.round(progress)}%
              </p>
            </div>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <div className="screen-enter">
            {/* Big result */}
            <div style={{
              backgroundColor:statusBg(result.status),
              border:`2px solid ${statusBorder(result.status)}`,
              borderRadius:24, padding:24, marginBottom:18, textAlign:"center",
            }}>
              <div className="pop-in" style={{ marginBottom:14 }}>
                <StatusIcon status={result.status} size={48} />
              </div>
              <h2 style={{
                fontSize:26, fontWeight:900, color:statusColor(result.status),
                marginBottom:8, letterSpacing:-.4,
              }}>
                {result.status === "safe"    ? "Looks Safe!" :
                 result.status === "warning" ? "Caution Advised" : "Not Safe"}
              </h2>
              <p style={{ fontSize:14, color:C.sub, marginBottom:20, lineHeight:1.5 }}>
                {result.status === "safe"
                  ? "No gluten markers detected in this ingredient list."
                  : result.status === "warning"
                  ? "Possible gluten-related ingredients found. Check with manufacturer."
                  : "Confirmed gluten-containing ingredients detected. Avoid this product."}
              </p>
              <ConfidenceRing score={result.confidence} status={result.status} size={80} />
            </div>

            {/* Found markers */}
            {result.found.length > 0 && (
              <Card style={{ marginBottom:18, borderColor:statusBorder(result.status) }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:C.text, marginBottom:14, letterSpacing:-.2 }}>
                  ⚠️ Detected Gluten Markers ({result.found.length})
                </h3>
                {result.found.map((item, i) => (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:12,
                    paddingTop: i > 0 ? 11 : 0,
                    borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                    paddingBottom:11,
                  }}>
                    <div style={{
                      width:9, height:9, borderRadius:"50%", flexShrink:0,
                      backgroundColor:statusColor(result.status),
                    }} />
                    <span style={{ fontSize:14, color:C.text, fontWeight:700, textTransform:"capitalize" }}>
                      {item}
                    </span>
                  </div>
                ))}
              </Card>
            )}

            <div style={{ display:"flex", gap:12 }}>
              <button onClick={reset} style={{
                flex:1, height:54, borderRadius:17, backgroundColor:C.cardAlt,
                border:`1.5px solid ${C.border}`, cursor:"pointer",
                fontSize:14, fontWeight:700, color:C.text,
              }}>
                Analyze another
              </button>
              <button onClick={() => nav("home")} style={{
                flex:1, height:54, borderRadius:17, backgroundColor:C.safe,
                border:"none", cursor:"pointer", fontSize:14, fontWeight:800, color:"#fff",
                boxShadow:`0 5px 18px ${C.safe}50`,
              }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RESTAURANTS SCREEN ───────────────────────────────────────────────────────
function RestaurantsScreen({ nav }) {
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  const filtered = filter === "all"
    ? RESTAURANTS
    : RESTAURANTS.filter(r => r.status === filter);

  const filterCounts = {
    all:     RESTAURANTS.length,
    safe:    RESTAURANTS.filter(r => r.status === "safe").length,
    warning: RESTAURANTS.filter(r => r.status === "warning").length,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"20px 20px 0", flexShrink:0 }}>
        <BackBtn onBack={() => nav("home")} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", margin:"14px 0 6px" }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, color:C.text, letterSpacing:-.4, marginBottom:4 }}>
              Safe Restaurants
            </h1>
            <p style={{ fontSize:13, color:C.sub, fontWeight:500 }}>
              {filtered.length} verified places nearby
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[{id:"list", icon:List}, {id:"map", icon:Globe}].map(v => {
              const Icon = v.icon;
              return (
                <button key={v.id} onClick={() => setViewMode(v.id)} style={{
                  width:38, height:38, borderRadius:13,
                  backgroundColor: viewMode === v.id ? C.safe : C.cardAlt,
                  border:`1.5px solid ${viewMode === v.id ? C.safe : C.border}`,
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all .2s",
                }}>
                  <Icon size={17} color={viewMode === v.id ? "#fff" : C.sub} strokeWidth={2} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:8, paddingBottom:16, overflowX:"auto" }}>
          {[
            { id:"all",     label:"All" },
            { id:"safe",    label:"✓ Certified Safe" },
            { id:"warning", label:"⚠ With Caution"  },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              flexShrink:0, padding:"9px 16px", borderRadius:100, fontSize:13, fontWeight:700,
              backgroundColor: filter === f.id ? C.safe : C.cardAlt,
              border:`1.5px solid ${filter === f.id ? C.safe : C.border}`,
              color: filter === f.id ? "#fff" : C.sub, cursor:"pointer",
              transition:"all .2s",
            }}>
              {f.label} <span style={{ opacity:.7 }}>({filterCounts[f.id]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Map placeholder */}
      {viewMode === "map" && (
        <div style={{
          margin:"0 20px 16px", borderRadius:22, overflow:"hidden",
          backgroundColor:"#D8E8D8", height:190, position:"relative",
          border:`1px solid ${C.safeBorder}`, flexShrink:0,
        }}>
          {/* Fake map grid */}
          <div style={{
            position:"absolute", inset:0, opacity:.3,
            backgroundImage:"linear-gradient(#6B8F6B 1px,transparent 1px),linear-gradient(90deg,#6B8F6B 1px,transparent 1px)",
            backgroundSize:"30px 30px",
          }} />
          <div style={{
            position:"absolute", inset:0, display:"flex",
            alignItems:"center", justifyContent:"center", flexDirection:"column",
          }}>
            <Globe size={28} color={C.safe} strokeWidth={1.5} />
            <p style={{ fontSize:13, color:C.safe, marginTop:8, fontWeight:700 }}>
              Map view · {filtered.length} places
            </p>
          </div>
          {/* Fake pins */}
          {filtered.slice(0, 4).map((r, i) => (
            <div key={r.id} style={{
              position:"absolute",
              top:  `${22 + (i % 2) * 38}%`,
              left: `${18 + i * 19}%`,
              width:32, height:32, borderRadius:16,
              backgroundColor: statusColor(r.status),
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 3px 12px rgba(0,0,0,.25)",
              border:"2.5px solid #fff",
            }}>
              <MapPin size={15} color="#fff" strokeWidth={2.5} />
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 100px" }}>
        {filtered.length === 0 ? (
          <EmptyState emoji="🍽️" title="No restaurants found"
            sub="Try a different filter or check back later" />
        ) : filtered.map((r, idx) => (
          <div key={r.id} className="tap-active slide-up" style={{
            backgroundColor:C.card, borderRadius:22, padding:20, marginBottom:14,
            boxShadow:"0 2px 14px rgba(0,0,0,.06)", border:`1px solid ${C.border}`,
            cursor:"pointer", animationDelay:`${idx * .05}s`,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ flex:1, paddingRight:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <h3 style={{ fontSize:16, fontWeight:800, color:C.text, letterSpacing:-.2 }}>
                    {r.name}
                  </h3>
                  {r.verified && (
                    <div style={{
                      width:18, height:18, borderRadius:9, backgroundColor:C.safe,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <Shield size={11} color="#fff" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <p style={{ fontSize:13, color:C.sub, fontWeight:500 }}>{r.cuisine}</p>
              </div>
              <SafetyPill status={r.status} size="md" />
            </div>

            {/* Badge */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:7,
              backgroundColor:statusBg(r.status), border:`1px solid ${statusBorder(r.status)}`,
              borderRadius:12, padding:"8px 14px", marginBottom:14,
            }}>
              <StatusIcon status={r.status} size={13} />
              <span style={{ fontSize:12, color:statusColor(r.status), fontWeight:700 }}>
                {r.badge}
              </span>
            </div>

            {/* Tags */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
              {r.tags.map((tag, i) => (
                <span key={i} style={{
                  fontSize:11, padding:"5px 11px", borderRadius:100,
                  backgroundColor:C.cardAlt, color:C.sub, fontWeight:600,
                  border:`1px solid ${C.border}`,
                }}>
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
                  ★ {r.rating}
                  <span style={{ color:C.sub, fontWeight:500 }}> ({r.reviews})</span>
                </span>
                <span style={{ fontSize:13, color:C.sub, display:"flex", alignItems:"center", gap:4 }}>
                  <MapPin size={12} color={C.sub} /> {r.distance}
                </span>
              </div>
              <ChevronRight size={16} color={C.sub} />
            </div>
          </div>
        ))}

        {/* Add restaurant CTA */}
        <div style={{
          border:`2px dashed ${C.border}`, borderRadius:20, padding:20,
          display:"flex", alignItems:"center", gap:14, cursor:"pointer",
        }}>
          <div style={{
            width:44, height:44, borderRadius:15, backgroundColor:C.safeLight,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <Plus size={22} color={C.safe} strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>
              Add a restaurant
            </p>
            <p style={{ fontSize:12, color:C.sub }}>Help the community stay safe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FAVORITES SCREEN ─────────────────────────────────────────────────────────
function FavoritesScreen({ nav, setActiveProduct }) {
  const [tab, setTab] = useState("saved");

  const savedProducts    = PRODUCTS.filter(p => p.status === "safe");
  const savedRestaurants = RESTAURANTS.filter(r => r.savedByMe);
  const tabs = [
    { id:"saved",       label:"Saved",       count:savedProducts.length + savedRestaurants.length },
    { id:"history",     label:"History",     count:PRODUCTS.length   },
    { id:"restaurants", label:"Restaurants", count:savedRestaurants.length },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ padding:"20px 20px 0", flexShrink:0 }}>
        <BackBtn onBack={() => nav("home")} />
        <h1 style={{ fontSize:26, fontWeight:800, color:C.text, marginTop:14, marginBottom:18, letterSpacing:-.4 }}>
          My Pantry
        </h1>

        {/* Tab bar */}
        <div style={{
          display:"flex", backgroundColor:C.cardAlt, borderRadius:18,
          padding:5, marginBottom:20, border:`1px solid ${C.border}`,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, height:40, borderRadius:14, fontSize:12.5, fontWeight:700,
              backgroundColor: tab === t.id ? C.card : "transparent",
              border:"none", cursor:"pointer",
              color: tab === t.id ? C.text : C.sub,
              boxShadow: tab === t.id ? "0 1px 8px rgba(0,0,0,.09)" : "none",
              transition:"all .22s", letterSpacing:-.1,
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft:5, backgroundColor: tab === t.id ? C.safeLight : "transparent",
                  color: tab === t.id ? C.safe : C.sub,
                  borderRadius:100, padding:"1px 6px", fontSize:11, fontWeight:800,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 100px" }}>
        {tab === "saved" && (
          <div className="screen-enter">
            {savedProducts.length + savedRestaurants.length === 0 ? (
              <EmptyState emoji="❤️" title="Nothing saved yet"
                sub="Scan products or find restaurants and save them here for quick access."
                cta="Start scanning" onCta={() => nav("scanner")} />
            ) : (
              <>
                {savedProducts.length > 0 && (
                  <>
                    <p style={{ fontSize:12, color:C.sub, fontWeight:700, letterSpacing:.4,
                      textTransform:"uppercase", marginBottom:12 }}>Products</p>
                    {savedProducts.map((p, i) => (
                      <div key={p.id} className="tap-active" onClick={() => { setActiveProduct(p); nav("result"); }}
                        style={{
                          backgroundColor:C.card, borderRadius:18, padding:"15px 18px", marginBottom:11,
                          boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:`1px solid ${C.border}`,
                          display:"flex", alignItems:"center", gap:14, cursor:"pointer",
                        }}>
                        <div style={{
                          width:46, height:46, borderRadius:15, backgroundColor:C.safeLight,
                          border:`1.5px solid ${C.safeBorder}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          <StatusIcon status="safe" size={22} />
                        </div>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3, letterSpacing:-.1 }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize:12, color:C.sub }}>{p.brand}</p>
                        </div>
                        <SafetyPill status="safe" />
                      </div>
                    ))}
                  </>
                )}

                {savedRestaurants.length > 0 && (
                  <>
                    <p style={{ fontSize:12, color:C.sub, fontWeight:700, letterSpacing:.4,
                      textTransform:"uppercase", marginBottom:12, marginTop:20 }}>Restaurants</p>
                    {savedRestaurants.map(r => (
                      <div key={r.id} style={{
                        backgroundColor:C.card, borderRadius:18, padding:"15px 18px", marginBottom:11,
                        boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:`1px solid ${C.border}`,
                        display:"flex", alignItems:"center", gap:14,
                      }}>
                        <div style={{
                          width:46, height:46, borderRadius:15, backgroundColor:C.safeLight,
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                          <MapPin size={22} color={C.safe} strokeWidth={2} />
                        </div>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>{r.name}</p>
                          <p style={{ fontSize:12, color:C.sub }}>{r.cuisine} · {r.distance}</p>
                        </div>
                        <SafetyPill status={r.status} />
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="screen-enter" style={{ display:"flex", flexDirection:"column", gap:11 }}>
            {PRODUCTS.map((p, idx) => (
              <div key={p.id} className="tap-active slide-up" onClick={() => { setActiveProduct(p); nav("result"); }}
                style={{
                  backgroundColor:C.card, borderRadius:18, padding:"15px 18px",
                  boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:`1px solid ${C.border}`,
                  display:"flex", alignItems:"center", gap:14, cursor:"pointer",
                  animationDelay:`${idx * .06}s`,
                }}>
                <div style={{
                  width:46, height:46, borderRadius:15, backgroundColor:statusBg(p.status),
                  border:`1.5px solid ${statusBorder(p.status)}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <StatusIcon status={p.status} size={22} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{
                    fontSize:14, fontWeight:700, color:C.text, marginBottom:3, letterSpacing:-.1,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                  }}>
                    {p.name}
                  </p>
                  <p style={{ fontSize:12, color:C.sub }}>
                    {p.brand} · <Clock size={10} style={{ verticalAlign:"middle" }} /> {p.scannedAt}
                  </p>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7 }}>
                  <SafetyPill status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "restaurants" && (
          <div className="screen-enter">
            {savedRestaurants.length === 0 ? (
              <EmptyState emoji="🍴" title="No saved restaurants"
                sub="Explore safe restaurants near you and save your favorites."
                cta="Explore restaurants" onCta={() => nav("restaurants")} />
            ) : (
              <>
                {savedRestaurants.map(r => (
                  <div key={r.id} style={{
                    backgroundColor:C.card, borderRadius:20, padding:18, marginBottom:14,
                    boxShadow:"0 2px 12px rgba(0,0,0,.06)", border:`1px solid ${C.border}`,
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <div>
                        <p style={{ fontSize:15, fontWeight:800, color:C.text, letterSpacing:-.2 }}>{r.name}</p>
                        <p style={{ fontSize:12, color:C.sub, marginTop:3 }}>{r.cuisine} · {r.distance}</p>
                      </div>
                      <SafetyPill status={r.status} size="md" />
                    </div>
                    <p style={{ fontSize:12, color:statusColor(r.status), fontWeight:700 }}>{r.badge}</p>
                  </div>
                ))}
                <button onClick={() => nav("restaurants")} style={{
                  width:"100%", height:54, borderRadius:18,
                  backgroundColor:C.safeLight, border:`2px dashed ${C.safeBorder}`,
                  cursor:"pointer", fontSize:14, fontWeight:800, color:C.safe,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}>
                  <Plus size={18} color={C.safe} strokeWidth={2.5} />
                  Explore more restaurants
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ active, nav }) {
  const items = [
    { id:"home",        icon:Home,    label:"Home"       },
    { id:"ingredients", icon:Zap,     label:"Analyze"    },
    { id:"scanner",     icon:Camera,  label:"Scan",  center:true },
    { id:"restaurants", icon:MapPin,  label:"Nearby"     },
    { id:"favorites",   icon:Heart,   label:"Pantry"     },
  ];

  const isActive = (id) => {
    if (id === "home") return active === "home" || active === "result";
    return active === id;
  };

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0,
      backgroundColor:"rgba(255,255,255,.94)", backdropFilter:"blur(14px)",
      borderTop:`1px solid ${C.border}`,
      padding:"10px 6px 28px",
      display:"flex", justifyContent:"space-around", alignItems:"flex-end",
    }}>
      {items.map(item => {
        const Icon = item.icon;
        const active_ = isActive(item.id);

        if (item.center) return (
          <button key={item.id} onClick={() => nav("scanner")} style={{
            display:"flex", flexDirection:"column", alignItems:"center",
            background:"none", border:"none", cursor:"pointer", marginTop:-22,
          }}>
            <div className={active_ ? "pulse-anim" : ""} style={{
              width:60, height:60, borderRadius:22,
              backgroundColor:C.safe,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 6px 24px ${C.safe}60`,
              border:"3px solid #fff",
            }}>
              <Camera size={26} color="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize:10, color:C.safe, marginTop:5, fontWeight:800 }}>Scan</span>
          </button>
        );

        return (
          <button key={item.id} onClick={() => nav(item.id)} style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            background:"none", border:"none", cursor:"pointer", minWidth:50, padding:"4px 0",
          }}>
            <div style={{
              width:36, height:36, borderRadius:13,
              backgroundColor: active_ ? C.safeLight : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"background .2s",
            }}>
              <Icon size={21} color={active_ ? C.safe : C.sub}
                strokeWidth={active_ ? 2.5 : 1.8}
                fill={active_ && item.id === "favorites" ? C.safeLight : "none"} />
            </div>
            <span style={{
              fontSize:10, fontWeight: active_ ? 800 : 500,
              color: active_ ? C.safe : C.sub, transition:"color .2s",
              letterSpacing:.1,
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function CeliScan() {
  const [screen, setScreen]               = useState("home");
  const [activeProduct, setActiveProduct] = useState(null);

  const nav = useCallback((s) => setScreen(s), []);

  const screenProps = { nav, setActiveProduct, activeProduct };

  const renderScreen = () => {
    switch (screen) {
      case "home":        return <HomeScreen        {...screenProps} />;
      case "scanner":     return <ScannerScreen     {...screenProps} />;
      case "result":      return <ResultScreen      nav={nav} product={activeProduct} />;
      case "ingredients": return <IngredientsScreen nav={nav} />;
      case "restaurants": return <RestaurantsScreen nav={nav} />;
      case "favorites":   return <FavoritesScreen   {...screenProps} />;
      default:            return <HomeScreen        {...screenProps} />;
    }
  };

  const isScanner = screen === "scanner";

  return (
    <>
      <style>{CSS}</style>

      {/* Page background */}
      <div style={{
        position:"fixed", inset:0,
        background:"linear-gradient(145deg, #B8CEBA 0%, #CAD9C8 40%, #B0C4B2 100%)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:FONT,
      }}>
        {/* Decorative circles */}
        <div style={{
          position:"absolute", width:500, height:500, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(30,142,90,.15) 0%, transparent 70%)",
          top:-80, right:-80, pointerEvents:"none",
        }} />
        <div style={{
          position:"absolute", width:400, height:400, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(255,255,255,.12) 0%, transparent 70%)",
          bottom:-60, left:-60, pointerEvents:"none",
        }} />

        {/* Phone frame */}
        <div style={{
          width:390, maxWidth:"100vw",
          height:Math.min(844, window.innerHeight - 20),
          backgroundColor:C.bg, borderRadius:54, overflow:"hidden",
          position:"relative",
          boxShadow:"0 50px 130px rgba(0,0,0,.45), 0 0 0 1.5px rgba(255,255,255,.5) inset, 0 0 0 10px rgba(0,0,0,.12)",
          fontFamily:FONT,
        }}>
          {/* Status bar */}
          <div style={{
            height:52, flexShrink:0,
            backgroundColor: isScanner ? "#0C0C0E" : C.bg,
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"0 26px",
            borderBottom: isScanner ? "none" : `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize:15, fontWeight:800, color: isScanner ? "#fff" : C.text, letterSpacing:-.3 }}>
              9:41
            </span>
            {/* Dynamic island */}
            <div style={{
              width:118, height:32, borderRadius:16,
              backgroundColor: "#0A0A0A",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            }}>
              {!isScanner && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{
                    width:24, height:24, borderRadius:8, backgroundColor:C.safe,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Shield size={13} color="#fff" strokeWidth={2.5} />
                  </div>
                  <span style={{ color:"#fff", fontSize:12, fontWeight:800, letterSpacing:-.2 }}>CeliScan</span>
                </div>
              )}
              <div style={{ width:10, height:10, borderRadius:5, backgroundColor:"#1A1A1A", border:"1.5px solid #2A2A2A" }} />
            </div>
            <span style={{ fontSize:13, color: isScanner ? "rgba(255,255,255,.7)" : C.text, fontWeight:600 }}>
              ▪▪▪
            </span>
          </div>

          {/* Screen content */}
          <div key={screen} className="screen-enter" style={{
            position:"absolute",
            top:52,
            bottom: isScanner ? 0 : 88,
            left:0, right:0,
            overflowY:"hidden",
            backgroundColor: isScanner ? "#0C0C0E" : C.bg,
          }}>
            {renderScreen()}
          </div>

          {/* Bottom nav */}
          {!isScanner && <BottomNav active={screen} nav={nav} />}
        </div>
      </div>
    </>
  );
}
