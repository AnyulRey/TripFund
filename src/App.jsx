import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const USERS = {
  admin: { password: "admin2026", role: "admin", label: "Admin" },
  "Espinel Rey": { password: "rey2026", role: "family", label: "Espinel Rey" },
  "Espinel Gomez": { password: "gomez2026", role: "family", label: "Espinel Gómez" },
  "Espinel Lopez": { password: "lopez2026", role: "family", label: "Espinel López" },
  "Alfonso Espinel": { password: "alfonso2026", role: "family", label: "Alfonso Espinel" },
};

const familias = ["Espinel Rey", "Espinel Gomez", "Espinel Lopez", "Alfonso Espinel"];
const LABELS = {
  "Espinel Rey": "Espinel Rey",
  "Espinel Gomez": "Espinel Gómez",
  "Espinel Lopez": "Espinel López",
  "Alfonso Espinel": "Alfonso Espinel",
};
const meses = ["Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const imagenes = ["/foto-1.jpeg", "/foto-2.jpeg", "/foto-3.jpeg", "/foto-4.jpeg", "/foto-5.jpeg", "/foto-6.jpeg"];

/* Colores por familia — tierra y naturales */
const COLORS = {
  "Espinel Rey": { from: "#c8956c", to: "#a0694a", glow: "rgba(200,149,108,0.35)" },
  "Espinel Gomez": { from: "#7a9e7e", to: "#4e7c54", glow: "rgba(122,158,126,0.35)" },
  "Espinel Lopez": { from: "#8fa8c8", to: "#5b7fa6", glow: "rgba(143,168,200,0.35)" },
  "Alfonso Espinel": { from: "#c4a882", to: "#9e7d52", glow: "rgba(196,168,130,0.35)" },
  admin: { from: "#c4a882", to: "#9e7d52", glow: "rgba(196,168,130,0.35)" },
};

const crearPagosIniciales = () => {
  const d = {};
  familias.forEach(f => { d[f] = meses.map(mes => ({ mes, valorEsperado: 100000, valorAbonado: "", numeroAutorizacion: "" })); });
  return d;
};

/* Fuentes: Cormorant Garamond (serifa elegante) + DM Sans (cuerpo limpio) */
if (!document.getElementById("gf-trip")) {
  const l = document.createElement("link");
  l.id = "gf-trip"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";
  document.head.appendChild(l);
}

/*
  Paleta boho chic:
  arena:   #f5ede0
  tierra:  #c4a882
  oliva:   #6b7c5c
  humo:    #3d3530
  crema:   #faf7f2
  verde:   #4a6741
*/
const T = {
  sand: "#f5ede0",
  earth: "#c4a882",
  earthD: "#9e7d52",
  olive: "#6b7c5c",
  smoke: "#3d3530",
  cream: "#faf7f2",
  muted: "#9e8e7e",
  white: "#ffffff",

  /* foto de fondo: palmeras reales desde unsplash CDN */
  bgPhoto: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80&auto=format&fit=crop",
  bgPhotoAlt: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1600&q=80&auto=format&fit=crop",

  card: {
    background: "rgba(250,247,242,0.18)",
    border: "1px solid rgba(250,247,242,0.35)",
    borderRadius: "16px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  cardSolid: {
    background: "#faf7f2",
    borderRadius: "16px",
    boxShadow: "0 8px 40px rgba(61,53,48,0.12)",
  },
  cardDark: {
    background: "rgba(61,53,48,0.55)",
    border: "1px solid rgba(250,247,242,0.15)",
    borderRadius: "16px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  fTitle: "'Cormorant Garamond', Georgia, serif",
  fBody: "'DM Sans', system-ui, sans-serif",
  input: {
    width: "100%", padding: "12px 16px", borderRadius: "10px",
    border: "1px solid rgba(61,53,48,0.18)",
    background: "rgba(250,247,242,0.9)",
    color: "#3d3530", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: "400",
  },
};

/* ── Fondo con foto real ── */
function PhotoBg({ url }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0,
      backgroundImage: `url(${url || T.bgPhoto})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}>
      {/* Overlay cálido para legibilidad */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, rgba(61,53,48,0.52) 0%, rgba(61,53,48,0.38) 50%, rgba(61,53,48,0.62) 100%)",
      }} />
    </div>
  );
}

/* ── Login ── */
function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const go = () => {
    setLoading(true);
    setTimeout(() => {
      const u = USERS[usuario];
      if (u && u.password === pw) onLogin({ username: usuario, role: u.role, label: u.label });
      else { setError("Usuario o contraseña incorrectos"); setLoading(false); }
    }, 650);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "20px",
      position: "relative", fontFamily: T.fBody,
    }}>
      <PhotoBg />

      <div style={{ width: "100%", maxWidth: "400px", position: "relative", zIndex: 1 }}>

        {/* Logo / Título */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          {/* Ícono palmera minimalista */}
          <svg width="44" height="50" viewBox="0 0 44 50" style={{ marginBottom: "16px", opacity: 0.9 }}>
            <line x1="22" y1="48" x2="22" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M22 20 Q10 14 4 6 Q14 12 22 20Z" fill="white" opacity="0.9" />
            <path d="M22 20 Q34 14 40 6 Q30 12 22 20Z" fill="white" opacity="0.9" />
            <path d="M22 20 Q8 18 2 14 Q12 18 22 20Z" fill="white" opacity="0.75" />
            <path d="M22 20 Q36 18 42 14 Q32 18 22 20Z" fill="white" opacity="0.75" />
            <path d="M22 20 Q18 10 18 2 Q20 12 22 20Z" fill="white" opacity="0.85" />
            <path d="M22 20 Q26 10 26 2 Q24 12 22 20Z" fill="white" opacity="0.85" />
          </svg>

          <h1 style={{
            margin: "0 0 8px",
            fontFamily: T.fTitle,
            fontSize: "56px",
            fontWeight: "300",
            fontStyle: "italic",
            color: T.white,
            letterSpacing: "0.04em",
            lineHeight: 1,
            textShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}>
            TripFund
          </h1>
          <p style={{
            margin: 0, color: "rgba(255,255,255,0.75)",
            fontSize: "11px", fontWeight: "500",
            letterSpacing: "0.22em", textTransform: "uppercase",
            fontFamily: T.fBody,
          }}>
            Viaje Familiar · Diciembre 2026
          </p>
        </div>

        {/* Card login */}
        <div style={{ ...T.cardSolid, padding: "32px" }}>
          <h2 style={{
            margin: "0 0 24px", fontFamily: T.fTitle,
            fontSize: "22px", fontWeight: "400", fontStyle: "italic",
            color: T.smoke, textAlign: "center", letterSpacing: "0.02em",
          }}>
            Bienvenido de vuelta
          </h2>

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              color: T.muted, fontSize: "10px", fontWeight: "600",
              letterSpacing: "0.14em", display: "block",
              marginBottom: "8px", textTransform: "uppercase",
              fontFamily: T.fBody,
            }}>Familia</label>
            <select value={usuario} onChange={e => { setUsuario(e.target.value); setError(""); }}
              style={{ ...T.input }}>
              <option value="">Selecciona…</option>
              <option value="admin">Admin</option>
              {familias.map(f => <option key={f} value={f}>{LABELS[f]}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: "26px" }}>
            <label style={{
              color: T.muted, fontSize: "10px", fontWeight: "600",
              letterSpacing: "0.14em", display: "block",
              marginBottom: "8px", textTransform: "uppercase",
              fontFamily: T.fBody,
            }}>Contraseña</label>
            <input type="password" placeholder="········" value={pw}
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && go()} style={{ ...T.input }} />
          </div>

          {error && (
            <div style={{
              background: "rgba(180,60,50,0.08)", border: "1px solid rgba(180,60,50,0.2)",
              borderRadius: "8px", padding: "10px 14px", color: "#8b3a32",
              fontSize: "13px", marginBottom: "16px", textAlign: "center",
              fontFamily: T.fBody,
            }}>{error}</div>
          )}

          <button onClick={go} disabled={!usuario || !pw || loading} style={{
            width: "100%", padding: "14px", borderRadius: "10px", border: "none",
            background: usuario && pw ? T.smoke : "rgba(61,53,48,0.1)",
            color: usuario && pw ? T.cream : T.muted,
            fontSize: "13px", fontWeight: "600",
            cursor: usuario && pw ? "pointer" : "default",
            fontFamily: T.fBody, letterSpacing: "0.12em",
            textTransform: "uppercase",
            transition: "all 0.3s",
            boxShadow: usuario && pw ? "0 6px 20px rgba(61,53,48,0.25)" : "none",
          }}>{loading ? "Entrando…" : "Entrar"}</button>
        </div>

        <p style={{
          textAlign: "center", color: "rgba(255,255,255,0.4)",
          fontSize: "11px", marginTop: "20px", fontFamily: T.fBody,
          letterSpacing: "0.1em",
        }}>
          ESPINEL FAMILY · 2026
        </p>
      </div>
    </div>
  );
}

/* ── Galería ── */
function Galeria() {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [modal, setModal] = useState(false);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    if (!auto || modal) return;
    const iv = setInterval(() => setIdx(p => (p + 1) % imagenes.length), 3500);
    return () => clearInterval(iv);
  }, [auto, modal]);

  const prev = () => { setIdx(p => (p - 1 + imagenes.length) % imagenes.length); setAuto(false); };
  const next = () => { setIdx(p => (p + 1) % imagenes.length); setAuto(false); };

  return (
    <>
      <div style={{ ...T.card, overflow: "hidden", marginBottom: "20px" }}>
        <div style={{
          position: "relative", overflow: "hidden",
          background: "rgba(61,53,48,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: portrait ? "380px" : "280px",
        }}>
          {[{ fn: prev, side: "left", icon: "‹" }, { fn: next, side: "right", icon: "›" }].map(({ fn, side, icon }) => (
            <button key={side} onClick={fn} style={{
              position: "absolute", [side]: "14px", top: "50%", transform: "translateY(-50%)",
              border: "1px solid rgba(255,255,255,0.3)", width: "36px", height: "36px",
              borderRadius: "50%", background: "rgba(61,53,48,0.5)",
              color: T.white, cursor: "pointer", fontSize: "22px",
              backdropFilter: "blur(8px)", zIndex: 2,
            }}>{icon}</button>
          ))}

          <img
            src={imagenes[idx]} alt="Familia"
            onLoad={e => setPortrait(e.target.naturalWidth / e.target.naturalHeight < 0.85)}
            onClick={() => { setModal(true); setAuto(false); }}
            style={{
              maxWidth: "100%",
              maxHeight: portrait ? "500px" : "380px",
              width: portrait ? "auto" : "100%",
              height: portrait ? "500px" : "380px",
              objectFit: portrait ? "contain" : "cover",
              display: "block", cursor: "zoom-in",
            }}
          />

          <div style={{
            position: "absolute", bottom: "12px", right: "14px",
            background: "rgba(61,53,48,0.6)", borderRadius: "20px",
            padding: "3px 12px", color: "rgba(255,255,255,0.8)",
            fontSize: "11px", fontFamily: T.fBody, letterSpacing: "0.08em",
            backdropFilter: "blur(4px)",
          }}>
            {idx + 1} / {imagenes.length}
          </div>
        </div>

        <div style={{
          display: "flex", justifyContent: "center", gap: "6px",
          padding: "12px 0 14px", alignItems: "center",
        }}>
          {imagenes.map((_, i) => (
            <button key={i} onClick={() => { setIdx(i); setAuto(false); }} style={{
              width: idx === i ? "20px" : "6px", height: "6px", borderRadius: "999px",
              border: "none", cursor: "pointer", transition: "all 0.3s",
              background: idx === i ? "rgba(250,247,242,0.9)" : "rgba(250,247,242,0.35)",
            }} />
          ))}
          <button onClick={() => setAuto(p => !p)} style={{
            marginLeft: "10px", border: "1px solid rgba(250,247,242,0.35)",
            borderRadius: "20px", padding: "3px 12px",
            background: "transparent", color: "rgba(250,247,242,0.7)",
            fontSize: "11px", cursor: "pointer", fontWeight: "500",
            fontFamily: T.fBody, letterSpacing: "0.06em",
          }}>{auto ? "pausa" : "play"}</button>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(30,24,20,0.96)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "relative", width: "min(96vw,900px)",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <button onClick={() => setModal(false)} style={{
              position: "absolute", top: "-46px", right: "0",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: T.white, width: "34px", height: "34px",
              borderRadius: "50%", cursor: "pointer", fontSize: "18px",
            }}>×</button>

            <div style={{
              position: "relative", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {[{ fn: prev, side: "left", icon: "‹" }, { fn: next, side: "right", icon: "›" }].map(({ fn, side, icon }) => (
                <button key={side} onClick={fn} style={{
                  position: "absolute", [side]: "0", zIndex: 2, border: "none",
                  width: "46px", height: "46px", borderRadius: "50%",
                  background: "rgba(61,53,48,0.7)", color: T.white,
                  cursor: "pointer", fontSize: "24px",
                }}>{icon}</button>
              ))}
              <img src={imagenes[idx]} alt="Ampliada" style={{
                maxWidth: "100%", maxHeight: "82vh",
                objectFit: "contain", borderRadius: "12px", display: "block",
              }} />
            </div>

            <div style={{ display: "flex", gap: "7px", marginTop: "14px" }}>
              {imagenes.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} style={{
                  width: idx === i ? "18px" : "6px", height: "6px", borderRadius: "999px",
                  border: "none", cursor: "pointer", transition: "all 0.3s",
                  background: idx === i ? "white" : "rgba(255,255,255,0.3)",
                }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Dashboard ── */
function Dashboard({ pagos, isAdmin }) {
  const total = familias.reduce((a, f) => a + pagos[f].reduce((s, p) => s + (Number(p.valorAbonado) || 0), 0), 0);
  const meta = 100000 * meses.length * familias.length;
  const pct = Math.min((total / meta) * 100, 100);
  const r = 66, sw = 7, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;

  return (
    <div style={{ ...T.card, padding: "24px", marginBottom: "20px" }}>
      <p style={{
        margin: "0 0 20px", fontSize: "10px", fontWeight: "500",
        color: "rgba(250,247,242,0.6)", textTransform: "uppercase",
        letterSpacing: "0.16em", fontFamily: T.fBody,
      }}>Avance del viaje</p>

      <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Anillo */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
            <defs>
              <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={T.earth} />
                <stop offset="100%" stopColor={T.white} />
              </linearGradient>
            </defs>
            <circle cx="80" cy="80" r={r} fill="none"
              stroke="rgba(250,247,242,0.15)" strokeWidth={sw} />
            <circle cx="80" cy="80" r={r} fill="none"
              stroke="url(#rg)" strokeWidth={sw}
              strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
              style={{ transition: "stroke-dasharray 1.2s ease" }} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "30px", fontWeight: "300",
              color: T.white, fontFamily: T.fTitle,
              fontStyle: "italic", lineHeight: 1,
            }}>{pct.toFixed(0)}%</span>
            <span style={{
              fontSize: "10px", color: "rgba(250,247,242,0.55)",
              fontFamily: T.fBody, letterSpacing: "0.1em",
              textTransform: "uppercase", marginTop: "4px",
            }}>completado</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ flex: 1, minWidth: "150px" }}>
          <p style={{
            margin: "0 0 2px",
            fontSize: "26px", fontWeight: "300", fontStyle: "italic",
            fontFamily: T.fTitle, color: T.white, lineHeight: 1.1,
          }}>
            ${total.toLocaleString("es-CO")}
          </p>
          <p style={{
            margin: "0 0 20px",
            color: "rgba(250,247,242,0.5)", fontSize: "12px",
            fontFamily: T.fBody,
          }}>
            meta ${meta.toLocaleString("es-CO")}
          </p>

          {isAdmin && familias.map(f => {
            const c = COLORS[f];
            const tf = pagos[f].reduce((s, p) => s + (Number(p.valorAbonado) || 0), 0);
            const pf = Math.min((tf / (100000 * meses.length)) * 100, 100);
            return (
              <div key={f} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "rgba(250,247,242,0.7)", fontSize: "11px", fontFamily: T.fBody }}>
                    {LABELS[f]}
                  </span>
                  <span style={{ color: T.white, fontSize: "11px", fontWeight: "500", fontFamily: T.fBody }}>
                    {pf.toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: "3px", background: "rgba(250,247,242,0.15)", borderRadius: "999px" }}>
                  <div style={{
                    width: `${pf}%`, height: "100%", borderRadius: "999px",
                    background: `linear-gradient(90deg,${c.from},${c.to})`,
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Botón familia ── */
function FamiliaBtn({ familia, activa, onClick }) {
  const c = COLORS[familia];
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px", borderRadius: "8px", cursor: "pointer",
      background: activa
        ? `linear-gradient(135deg,${c.from},${c.to})`
        : "rgba(250,247,242,0.12)",
      color: activa ? T.smoke : "rgba(250,247,242,0.7)",
      fontWeight: activa ? "600" : "400",
      fontSize: "13px", fontFamily: T.fBody,
      border: activa ? "none" : "1px solid rgba(250,247,242,0.2)",
      boxShadow: activa ? `0 4px 16px ${c.glow}` : "none",
      transform: activa ? "translateY(-1px)" : "none",
      transition: "all 0.2s ease",
      letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>{LABELS[familia]}</button>
  );
}

/* ── Toast ── */
function Toast({ visible }) {
  return (
    <div style={{
      position: "fixed", bottom: "24px", left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0" : "80px"})`,
      background: T.smoke,
      borderRadius: "8px", padding: "10px 24px",
      color: T.cream, fontSize: "12px", fontWeight: "500",
      zIndex: 9999, transition: "transform 0.3s ease",
      fontFamily: T.fBody, letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>✓ Guardado</div>
  );
}

/* ── App ── */
export default function App() {
  const [session, setSession] = useState(null);
  const [familia, setFamilia] = useState(null);
  const [pagos, setPagos] = useState(crearPagosIniciales);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tripfund", "pagos"), snap => {
      if (snap.exists()) setPagos(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const save = async nuevo => {
    setSaving(true);
    try {
      await setDoc(doc(db, "tripfund", "pagos"), nuevo);
      setToast(true); setTimeout(() => setToast(false), 2200);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const update = (fam, i, campo, val) => {
    if (!isAdmin && fam !== session?.username) return;
    const n = { ...pagos, [fam]: pagos[fam].map((p, j) => j === i ? { ...p, [campo]: val } : p) };
    setPagos(n); save(n);
  };

  const numReg = useMemo(() => {
    const m = {};
    Object.values(pagos).forEach(ps => ps.forEach(p => {
      const n = p.numeroAutorizacion.trim(); if (n) m[n] = (m[n] || 0) + 1;
    }));
    return m;
  }, [pagos]);

  const getEstado = p => {
    const n = p.numeroAutorizacion.trim(), v = Number(p.valorAbonado);
    if (!n && !p.valorAbonado) return { texto: "Pendiente", color: "#8a6a3a", fondo: "rgba(196,168,130,0.15)" };
    if (n && numReg[n] > 1) return { texto: "Repetido", color: "#8b3a32", fondo: "rgba(180,60,50,0.12)" };
    if (n && v >= 100000) return { texto: "✓ Pagado", color: "#3a6b45", fondo: "rgba(90,150,100,0.15)" };
    if (n && v > 0) return { texto: "Incompleto", color: "#7a5a2a", fondo: "rgba(180,140,60,0.12)" };
    return { texto: "Pendiente", color: "#8a6a3a", fondo: "rgba(196,168,130,0.15)" };
  };

  if (!session) return (
    <LoginScreen onLogin={s => { setSession(s); if (s.role === "family") setFamilia(s.username); }} />
  );

  if (loading) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", position: "relative"
    }}>
      <PhotoBg />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%",
          border: "2px solid rgba(250,247,242,0.2)",
          borderTop: "2px solid rgba(250,247,242,0.8)",
          animation: "spin 1s linear infinite",
          margin: "0 auto 14px",
        }} />
        <p style={{
          color: "rgba(250,247,242,0.6)", fontSize: "12px",
          fontFamily: T.fBody, letterSpacing: "0.14em", textTransform: "uppercase"
        }}>
          Cargando
        </p>
      </div>
    </div>
  );

  const sc = COLORS[session.username] || COLORS.admin;

  return (
    <div style={{ minHeight: "100vh", fontFamily: T.fBody, position: "relative" }}>
      <PhotoBg />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        input::placeholder{color:rgba(61,53,48,0.35)}
        select option{background:#faf7f2; color:#3d3530}
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <header style={{
        background: "rgba(30,24,20,0.6)",
        borderBottom: "1px solid rgba(250,247,242,0.12)",
        padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100, marginBottom: "24px",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Palmera mini */}
          <svg width="22" height="26" viewBox="0 0 44 50" style={{ opacity: 0.85 }}>
            <line x1="22" y1="48" x2="22" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M22 20 Q10 14 4 6 Q14 12 22 20Z" fill="white" />
            <path d="M22 20 Q34 14 40 6 Q30 12 22 20Z" fill="white" />
            <path d="M22 20 Q8 18 2 14 Q12 18 22 20Z" fill="white" opacity="0.7" />
            <path d="M22 20 Q36 18 42 14 Q32 18 22 20Z" fill="white" opacity="0.7" />
          </svg>
          <div>
            <h1 style={{
              margin: 0, fontFamily: T.fTitle, fontStyle: "italic",
              fontSize: "clamp(18px,3.5vw,24px)", fontWeight: "300",
              color: T.white, letterSpacing: "0.04em",
            }}>TripFund</h1>
            <p style={{
              margin: 0, fontSize: "10px", color: "rgba(250,247,242,0.5)",
              fontFamily: T.fBody, letterSpacing: "0.12em", textTransform: "uppercase"
            }}>
              {isAdmin ? "Admin" : LABELS[session.username] || session.label}
              {saving && <span style={{ marginLeft: "8px", color: T.earth }}>· guardando</span>}
            </p>
          </div>
        </div>
        <button onClick={() => { setSession(null); setFamilia(null); }} style={{
          padding: "7px 16px", borderRadius: "6px",
          border: "1px solid rgba(250,247,242,0.2)",
          background: "transparent", color: "rgba(250,247,242,0.6)",
          cursor: "pointer", fontSize: "11px", fontWeight: "500",
          fontFamily: T.fBody, letterSpacing: "0.1em", textTransform: "uppercase",
        }}>Salir</button>
      </header>

      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "0 16px 60px", position: "relative", zIndex: 1 }}>

        {/* Nubank key */}
        <div style={{ ...T.card, padding: "18px 24px", marginBottom: "20px", textAlign: "center" }}>
          <p style={{
            margin: "0 0 6px", color: "rgba(250,247,242,0.5)",
            fontSize: "10px", letterSpacing: "0.16em",
            textTransform: "uppercase", fontFamily: T.fBody,
          }}>Llave Bre · Nubank</p>
          <p style={{
            margin: 0, fontFamily: T.fTitle, fontStyle: "italic",
            fontSize: "clamp(22px,5vw,32px)", fontWeight: "300",
            color: T.white, letterSpacing: "0.06em",
          }}>1090368935</p>
        </div>

        <Dashboard pagos={pagos} isAdmin={isAdmin} />
        <Galeria />

        {/* Selector familia admin */}
        {isAdmin && (
          <div style={{ ...T.card, padding: "22px", marginBottom: "20px" }}>
            <p style={{
              margin: "0 0 16px", fontSize: "10px", fontWeight: "500",
              color: "rgba(250,247,242,0.5)", textTransform: "uppercase",
              letterSpacing: "0.14em", fontFamily: T.fBody,
            }}>Familia</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {familias.map(f => (
                <FamiliaBtn key={f} familia={f} activa={familia === f}
                  onClick={() => setFamilia(familia === f ? null : f)} />
              ))}
            </div>
          </div>
        )}

        {/* Pagos */}
        {familia && (() => {
          const c = COLORS[familia];
          const canEdit = isAdmin || session?.username === familia;
          return (
            <div style={{ ...T.cardSolid, padding: "24px" }}>
              {/* Encabezado */}
              <div style={{
                display: "flex", alignItems: "center",
                gap: "12px", marginBottom: "22px",
                paddingBottom: "16px",
                borderBottom: "1px solid rgba(61,53,48,0.1)",
              }}>
                <div style={{
                  width: "6px", height: "36px", borderRadius: "3px",
                  background: `linear-gradient(180deg,${c.from},${c.to})`,
                }} />
                <div>
                  <h2 style={{
                    margin: 0, fontSize: "22px", fontWeight: "400",
                    fontStyle: "italic", fontFamily: T.fTitle, color: T.smoke,
                    letterSpacing: "0.02em",
                  }}>{LABELS[familia]}</h2>
                  <p style={{
                    margin: 0, fontSize: "11px", color: T.muted,
                    fontFamily: T.fBody, letterSpacing: "0.08em"
                  }}>
                    {meses.length} cuotas · $100.000 c/u
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pagos[familia].map((pago, i) => {
                  const est = getEstado(pago), ok = est.texto === "✓ Pagado";
                  return (
                    <div key={pago.mes} style={{
                      background: ok ? "rgba(90,150,100,0.06)" : "rgba(61,53,48,0.03)",
                      border: ok
                        ? "1px solid rgba(90,150,100,0.2)"
                        : "1px solid rgba(61,53,48,0.09)",
                      borderRadius: "10px", padding: "14px 16px",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: "10px",
                      }}>
                        <span style={{
                          fontWeight: "500", fontSize: "14px",
                          fontFamily: T.fBody, color: T.smoke,
                          letterSpacing: "0.02em",
                        }}>{pago.mes}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            color: T.muted, fontSize: "11px",
                            fontFamily: T.fBody,
                          }}>$100.000</span>
                          <span style={{
                            padding: "3px 10px", borderRadius: "4px",
                            background: est.fondo, color: est.color,
                            fontWeight: "500", fontSize: "10px",
                            whiteSpace: "nowrap", fontFamily: T.fBody,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                          }}>{est.texto}</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {[
                          { lbl: "Valor abonado", campo: "valorAbonado", type: "number", ph: "100000" },
                          { lbl: "N° autorización", campo: "numeroAutorizacion", type: "text", ph: "Número" },
                        ].map(({ lbl, campo, type, ph }) => (
                          <div key={campo}>
                            <label style={{
                              color: T.muted, fontSize: "9px", display: "block",
                              marginBottom: "4px", textTransform: "uppercase",
                              letterSpacing: "0.1em", fontFamily: T.fBody,
                            }}>{lbl}</label>
                            <input type={type} placeholder={ph}
                              value={pago[campo]} disabled={!canEdit}
                              onChange={e => update(familia, i, campo, e.target.value)}
                              style={{
                                ...T.input, padding: "10px 12px",
                                fontSize: "13px", opacity: canEdit ? 1 : 0.4
                              }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <Toast visible={toast} />
    </div>
  );
}