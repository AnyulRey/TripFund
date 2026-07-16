import { useEffect, useMemo, useState } from "react";
import { db, auth } from "./firebase";
import { doc, setDoc, onSnapshot, getDoc, deleteDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

/*
  ── CONFIGURACIÓN DE CUENTAS ──
  Cada familia entra eligiendo su nombre; por debajo se autentica con este correo.
  👉 Pon aquí el correo REAL de cada familia. Así "Olvidé mi contraseña" envía el
     enlace de recuperación al correo correcto.
  Pasos en la consola de Firebase (gratis), ver SETUP-AUTH.md:
    1. Authentication → Sign-in method → habilitar "Correo electrónico/contraseña".
    2. Authentication → Users → "Agregar usuario" con cada correo y una contraseña
       temporal. Luego cada familia la cambia desde la app o con "Olvidé mi contraseña".
*/
// Cada familia puede tener uno o varios correos (varios miembros con su propio
// acceso). Todos los correos de una familia editan los mismos datos.
const FAMILY_EMAILS = {
  admin: ["anyulrey@gmail.com"],
  "Espinel Rey": ["juanfespinel@gmail.com"],
  "Espinel Gomez": ["diegomaximus@gmail.com", "psicologacarolinagomez@gmail.com"],
  "Espinel Lopez": ["amparolopez009@gmail.com", "franciscoespinel1@hotmail.com"],
  "Alfonso Espinel": ["mariapaulaespinel@gmail.com", "fabuitrago92@gmail.com"],
};

// correo → clave de familia (para identificar quién entró tras autenticarse)
const EMAIL_TO_KEY = Object.fromEntries(
  Object.entries(FAMILY_EMAILS).flatMap(([k, list]) =>
    list.map(e => [e.toLowerCase(), k])
  )
);

// Todos los correos registrados (para la lista desplegable del login).
const EMAILS_REGISTRADOS = Object.values(FAMILY_EMAILS).flat();

const familias = ["Espinel Rey", "Espinel Gomez", "Espinel Lopez", "Alfonso Espinel"];
const LABELS = {
  "Espinel Rey": "Espinel Rey",
  "Espinel Gomez": "Espinel Gómez",
  "Espinel Lopez": "Espinel López",
  "Alfonso Espinel": "Alfonso Espinel",
};
const meses = ["Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CUOTA = 100000; // meta mensual por familia
const imagenes = ["/foto-1.jpeg", "/foto-2.jpeg", "/foto-3.jpeg", "/foto-4.jpeg", "/foto-5.jpeg", "/foto-6.jpeg"];

/* Colores por familia — tierra y naturales */
const COLORS = {
  "Espinel Rey": { from: "#c8956c", to: "#a0694a", glow: "rgba(200,149,108,0.35)" },
  "Espinel Gomez": { from: "#7a9e7e", to: "#4e7c54", glow: "rgba(122,158,126,0.35)" },
  "Espinel Lopez": { from: "#8fa8c8", to: "#5b7fa6", glow: "rgba(143,168,200,0.35)" },
  "Alfonso Espinel": { from: "#c4a882", to: "#9e7d52", glow: "rgba(196,168,130,0.35)" },
  admin: { from: "#c4a882", to: "#9e7d52", glow: "rgba(196,168,130,0.35)" },
};

/*
  Modelo de datos:
  tripfund/pagos = { [familia]: [ { mes, abonos: [ {id, valor, fecha, comprobanteId} ] } ] }
  comprobantes/{id} = { img: base64, familia, mes }   ← la foto, se carga solo al verla
*/
const crearPagosIniciales = () => {
  const d = {};
  familias.forEach(f => { d[f] = meses.map(mes => ({ mes, abonos: [] })); });
  return d;
};

// Convierte cualquier dato guardado (incluido el formato viejo) al modelo nuevo.
const normalizar = data => {
  const d = {};
  familias.forEach(f => {
    const arr = Array.isArray(data?.[f]) ? data[f] : [];
    d[f] = meses.map(mes => {
      const prev = arr.find(p => p?.mes === mes) || {};
      if (Array.isArray(prev.abonos)) return { mes, abonos: prev.abonos };
      // Formato viejo: un único valorAbonado → lo migramos a un abono.
      const v = Number(prev.valorAbonado);
      const abonos = v > 0
        ? [{ id: "legacy-" + mes, valor: v, fecha: null, comprobanteId: null }]
        : [];
      return { mes, abonos };
    });
  });
  return d;
};

const nuevoId = () =>
  (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2));

const fmtFecha = iso => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
};

const totalMes = abonos => (abonos || []).reduce((s, a) => s + (Number(a.valor) || 0), 0);
const totalFamilia = arr => (arr || []).reduce((s, m) => s + totalMes(m.abonos), 0);

// Estado de un mes según lo abonado vs la cuota.
const estadoMes = abonos => {
  const total = totalMes(abonos);
  if (total <= 0) return { total, falta: CUOTA, texto: "Pendiente", color: "#8a6a3a", fondo: "rgba(196,168,130,0.15)" };
  if (total < CUOTA) return { total, falta: CUOTA - total, texto: "En mora", color: "#8b3a32", fondo: "rgba(180,60,50,0.12)" };
  return { total, falta: 0, texto: "Al día ✓", color: "#3a6b45", fondo: "rgba(90,150,100,0.15)" };
};

// Comprime una imagen en el navegador y devuelve un data URL JPEG liviano (gratis).
const comprimirImagen = (file, maxLado = 1100, calidad = 0.6) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) { height = Math.round(height * maxLado / width); width = maxLado; }
        else if (height > maxLado) { width = Math.round(width * maxLado / height); height = maxLado; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        let q = calidad, out = canvas.toDataURL("image/jpeg", q);
        // Si quedó muy pesada, baja la calidad hasta ~600 KB.
        while (out.length > 600 * 1024 && q > 0.3) { q -= 0.1; out = canvas.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

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

/* ── Campo de contraseña con ojo para mostrar/ocultar ── */
function PasswordInput({ value, onChange, onKeyDown, placeholder = "Contraseña", autoComplete, wrapStyle }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", ...wrapStyle }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{ ...T.input, paddingRight: "44px" }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        style={{
          position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
          width: "30px", height: "30px", display: "flex", alignItems: "center",
          justifyContent: "center", border: "none", background: "none",
          cursor: "pointer", color: T.muted, padding: 0,
        }}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ── Login ── */
function LoginScreen() {
  const [correo, setCorreo] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const email = correo.trim().toLowerCase();

  const go = async () => {
    if (!email) { setError("Escribe tu correo"); return; }
    setLoading(true); setError(""); setInfo("");
    try {
      // onAuthStateChanged en App detecta la sesión y muestra el panel.
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      const msg = {
        "auth/invalid-credential": "Correo o contraseña incorrectos",
        "auth/wrong-password": "Correo o contraseña incorrectos",
        "auth/user-not-found": "Ese correo aún no tiene cuenta creada",
        "auth/invalid-email": "Correo inválido",
        "auth/too-many-requests": "Demasiados intentos, espera un momento",
        "auth/network-request-failed": "Sin conexión a internet",
      }[e.code] || "No se pudo iniciar sesión";
      setError(msg);
      setLoading(false);
    }
  };

  const recuperar = async () => {
    if (!email) { setError("Primero escribe tu correo"); return; }
    setError(""); setInfo("");
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("📩 Te enviamos un enlace a tu correo para crear tu contraseña. Revisa tu bandeja de entrada (y la carpeta de spam).");
    } catch {
      setInfo("📩 Te enviamos un enlace a tu correo (si la cuenta existe). Revisa tu bandeja de entrada y el spam.");
    }
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
            }}>Correo</label>
            <input type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com"
              list="emails-registrados"
              value={correo}
              onChange={e => { setCorreo(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && go()}
              style={{ ...T.input }} />
            <datalist id="emails-registrados">
              {EMAILS_REGISTRADOS.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          <div style={{ marginBottom: "26px" }}>
            <label style={{
              color: T.muted, fontSize: "10px", fontWeight: "600",
              letterSpacing: "0.14em", display: "block",
              marginBottom: "8px", textTransform: "uppercase",
              fontFamily: T.fBody,
            }}>Contraseña</label>
            <PasswordInput placeholder="········" value={pw}
              autoComplete="current-password"
              onChange={e => { setPw(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && go()} />
          </div>

          {error && (
            <div style={{
              background: "rgba(180,60,50,0.08)", border: "1px solid rgba(180,60,50,0.2)",
              borderRadius: "8px", padding: "10px 14px", color: "#8b3a32",
              fontSize: "13px", marginBottom: "16px", textAlign: "center",
              fontFamily: T.fBody,
            }}>{error}</div>
          )}

          {info && (
            <div style={{
              background: "rgba(90,150,100,0.1)", border: "1px solid rgba(90,150,100,0.25)",
              borderRadius: "8px", padding: "10px 14px", color: "#3a6b45",
              fontSize: "13px", marginBottom: "16px", textAlign: "center",
              fontFamily: T.fBody,
            }}>{info}</div>
          )}

          <button onClick={go} disabled={!correo || !pw || loading} style={{
            width: "100%", padding: "14px", borderRadius: "10px", border: "none",
            background: correo && pw ? T.smoke : "rgba(61,53,48,0.1)",
            color: correo && pw ? T.cream : T.muted,
            fontSize: "13px", fontWeight: "600",
            cursor: correo && pw ? "pointer" : "default",
            fontFamily: T.fBody, letterSpacing: "0.12em",
            textTransform: "uppercase",
            transition: "all 0.3s",
            boxShadow: correo && pw ? "0 6px 20px rgba(61,53,48,0.25)" : "none",
          }}>{loading ? "Entrando…" : "Entrar"}</button>

          <button onClick={recuperar} disabled={!correo || loading} style={{
            width: "100%", marginTop: "14px", padding: "4px",
            background: "none", border: "none",
            color: correo ? T.muted : "rgba(61,53,48,0.25)",
            cursor: correo ? "pointer" : "default",
            fontSize: "12px", fontFamily: T.fBody, letterSpacing: "0.04em",
            textDecoration: "underline", textUnderlineOffset: "3px",
          }}>Crear o restablecer contraseña</button>
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
  const total = familias.reduce((a, f) => a + totalFamilia(pagos[f]), 0);
  const meta = CUOTA * meses.length * familias.length;
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
            const tf = totalFamilia(pagos[f]);
            const pf = Math.min((tf / (CUOTA * meses.length)) * 100, 100);
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

/* ── Cambiar contraseña ── */
function ChangePassword({ onClose }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
    if (nueva.length < 6) { setError("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    setLoading(true); setError("");
    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, actual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, nueva);
      setOk(true);
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(
        e.code === "auth/invalid-credential" || e.code === "auth/wrong-password"
          ? "La contraseña actual no es correcta"
          : "No se pudo cambiar la contraseña"
      );
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(30,24,20,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{ ...T.cardSolid, padding: "28px", width: "100%", maxWidth: "360px" }}>
        <h2 style={{
          margin: "0 0 20px", fontFamily: T.fTitle, fontSize: "20px",
          fontWeight: "400", fontStyle: "italic", color: T.smoke, textAlign: "center",
        }}>Cambiar contraseña</h2>

        {ok ? (
          <p style={{ textAlign: "center", color: "#3a6b45", fontFamily: T.fBody, fontSize: "14px" }}>
            ✓ Contraseña actualizada
          </p>
        ) : (
          <>
            <PasswordInput placeholder="Contraseña actual" value={actual}
              autoComplete="current-password"
              onChange={e => { setActual(e.target.value); setError(""); }}
              wrapStyle={{ marginBottom: "12px" }} />
            <PasswordInput placeholder="Nueva contraseña" value={nueva}
              autoComplete="new-password"
              onChange={e => { setNueva(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && guardar()}
              wrapStyle={{ marginBottom: "16px" }} />

            {error && (
              <div style={{
                background: "rgba(180,60,50,0.08)", border: "1px solid rgba(180,60,50,0.2)",
                borderRadius: "8px", padding: "10px 14px", color: "#8b3a32",
                fontSize: "13px", marginBottom: "16px", textAlign: "center", fontFamily: T.fBody,
              }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                border: "1px solid rgba(61,53,48,0.18)", background: "transparent",
                color: T.muted, cursor: "pointer", fontSize: "13px",
                fontFamily: T.fBody, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>Cancelar</button>
              <button onClick={guardar} disabled={!actual || !nueva || loading} style={{
                flex: 1, padding: "12px", borderRadius: "10px", border: "none",
                background: actual && nueva ? T.smoke : "rgba(61,53,48,0.1)",
                color: actual && nueva ? T.cream : T.muted,
                cursor: actual && nueva ? "pointer" : "default", fontSize: "13px",
                fontWeight: "600", fontFamily: T.fBody, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>{loading ? "…" : "Guardar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Ver comprobante (se descarga solo al abrir) ── */
function ComprobanteModal({ comprobanteId, onClose }) {
  const [img, setImg] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "comprobantes", comprobanteId));
        if (!activo) return;
        if (snap.exists()) setImg(snap.data().img); else setError(true);
      } catch { if (activo) setError(true); }
    })();
    return () => { activo = false; };
  }, [comprobanteId]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(30,24,20,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "min(94vw,640px)" }}>
        <button onClick={onClose} style={{
          position: "absolute", top: "-44px", right: "0",
          border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)",
          color: T.white, width: "34px", height: "34px", borderRadius: "50%",
          cursor: "pointer", fontSize: "18px",
        }}>×</button>
        {error ? (
          <p style={{ color: T.cream, fontFamily: T.fBody }}>No se pudo cargar el comprobante.</p>
        ) : img ? (
          <img src={img} alt="Comprobante" style={{
            maxWidth: "100%", maxHeight: "82vh", objectFit: "contain",
            borderRadius: "12px", display: "block",
          }} />
        ) : (
          <p style={{ color: "rgba(250,247,242,0.7)", fontFamily: T.fBody, letterSpacing: "0.1em" }}>Cargando…</p>
        )}
      </div>
    </div>
  );
}

/* ── Formulario para agregar un abono ── */
function AbonoForm({ color, onAgregar }) {
  const [valor, setValor] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // Vista previa de la foto elegida (para revisarla antes de guardar).
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const listo = valor && file;

  const enviar = async () => {
    if (!listo) return;
    setBusy(true);
    await onAgregar(valor, file);
    setValor(""); setFile(null); setBusy(false);
  };

  const req = <span style={{ color: "#c0392b", fontWeight: "700" }}> *</span>;

  return (
    <div style={{
      marginTop: "10px", padding: "12px",
      border: "1px dashed rgba(61,53,48,0.2)", borderRadius: "10px",
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "start" }}>
        <div>
          <label style={{
            color: T.muted, fontSize: "9px", display: "block", marginBottom: "4px",
            textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: T.fBody,
          }}>Valor{req}</label>
          <input type="number" inputMode="numeric" placeholder="Ej. 50000"
            value={valor} onChange={e => setValor(e.target.value)}
            style={{ ...T.input, padding: "10px 12px", fontSize: "13px" }} />
        </div>
        <div>
          <label style={{
            color: T.muted, fontSize: "9px", display: "block", marginBottom: "4px",
            textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: T.fBody,
          }}>Comprobante{req}</label>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
            border: file ? "1px solid rgba(58,107,69,0.5)" : "1.5px solid rgba(192,57,43,0.5)",
            background: file ? "rgba(90,150,100,0.12)" : "rgba(192,57,43,0.06)",
            color: file ? "#3a6b45" : "#c0392b", fontSize: "12px", fontWeight: "600",
            fontFamily: T.fBody, whiteSpace: "nowrap",
          }}>
            {file ? "✓ Foto lista" : "📎 Subir foto"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      </div>
      {file
        ? <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px", borderRadius: "8px", background: "rgba(61,53,48,0.04)",
          }}>
            {preview && (
              <img src={preview} alt="Vista previa" style={{
                width: "56px", height: "56px", objectFit: "cover",
                borderRadius: "6px", flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: "0 0 2px", fontSize: "11px", color: T.smoke, fontFamily: T.fBody,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{file.name}</p>
              <p style={{ margin: 0, fontSize: "10px", color: T.muted, fontFamily: T.fBody }}>
                ¿Es la foto correcta? Se comprimirá al guardar.
              </p>
            </div>
            <button type="button" onClick={() => setFile(null)} style={{
              flexShrink: 0, border: "1px solid rgba(192,57,43,0.45)",
              background: "rgba(192,57,43,0.1)", color: "#c0392b",
              borderRadius: "6px", padding: "6px 10px", cursor: "pointer",
              fontSize: "11px", fontWeight: "700", fontFamily: T.fBody,
            }}>✕ Quitar</button>
          </div>
        : <p style={{ margin: 0, fontSize: "11px", color: "#c0392b", fontFamily: T.fBody }}>
            El comprobante es obligatorio para registrar el abono.
          </p>}
      <button onClick={enviar} disabled={!listo || busy} style={{
        padding: "10px", borderRadius: "10px", border: "none",
        background: listo ? `linear-gradient(135deg,${color.from},${color.to})` : "rgba(61,53,48,0.1)",
        color: listo ? T.smoke : T.muted, fontWeight: "600", fontSize: "12px",
        cursor: listo && !busy ? "pointer" : "default", fontFamily: T.fBody,
        letterSpacing: "0.08em", textTransform: "uppercase",
      }}>{busy ? "Guardando…" : "+ Agregar abono"}</button>
    </div>
  );
}

/* ── Tarjeta de un mes ── */
function MesCard({ mesData, color, canEdit, onAgregar, onEliminar, onVer }) {
  const { mes, abonos } = mesData;
  const est = estadoMes(abonos);
  const ok = est.falta === 0 && est.total > 0;
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={{
      background: ok ? "rgba(90,150,100,0.06)" : "rgba(61,53,48,0.03)",
      border: ok ? "1px solid rgba(90,150,100,0.2)" : "1px solid rgba(61,53,48,0.09)",
      borderRadius: "10px", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontWeight: "500", fontSize: "14px", fontFamily: T.fBody, color: T.smoke }}>{mes}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ color: T.muted, fontSize: "11px", fontFamily: T.fBody }}>
            ${est.total.toLocaleString("es-CO")} / ${CUOTA.toLocaleString("es-CO")}
          </span>
          <span style={{
            padding: "3px 10px", borderRadius: "4px", background: est.fondo, color: est.color,
            fontWeight: "500", fontSize: "10px", whiteSpace: "nowrap", fontFamily: T.fBody,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            {est.texto}{est.falta > 0 && est.total > 0 ? ` · faltan $${est.falta.toLocaleString("es-CO")}` : ""}
          </span>
        </div>
      </div>

      {/* Lista de abonos */}
      {abonos.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {abonos.map(a => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "8px", padding: "8px 10px", borderRadius: "8px",
              background: "rgba(61,53,48,0.04)",
            }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "13px", fontWeight: "500", color: T.smoke, fontFamily: T.fBody }}>
                  ${(Number(a.valor) || 0).toLocaleString("es-CO")}
                </span>
                {a.fecha && (
                  <span style={{ fontSize: "10px", color: T.muted, fontFamily: T.fBody }}>{fmtFecha(a.fecha)}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {a.comprobanteId ? (
                  <button onClick={() => onVer(a.comprobanteId)} style={{
                    border: "1px solid rgba(61,53,48,0.18)", background: "transparent",
                    borderRadius: "6px", padding: "5px 10px", cursor: "pointer",
                    fontSize: "11px", color: T.smoke, fontFamily: T.fBody,
                  }}>Ver comprobante</button>
                ) : (
                  <span style={{ fontSize: "10px", color: T.muted, fontFamily: T.fBody, fontStyle: "italic" }}>sin comprobante</span>
                )}
                {canEdit && (
                  <button onClick={() => { if (confirm("¿Eliminar este abono?")) onEliminar(a); }} aria-label="Eliminar" style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    border: "1px solid rgba(192,57,43,0.45)", background: "rgba(192,57,43,0.1)",
                    color: "#c0392b", cursor: "pointer", borderRadius: "6px",
                    padding: "5px 9px", fontSize: "11px", fontWeight: "700",
                    fontFamily: T.fBody, lineHeight: 1,
                  }}>✕ Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agregar abono */}
      {canEdit && (
        abierto
          ? <AbonoForm color={color} onAgregar={async (v, f) => { await onAgregar(v, f); setAbierto(false); }} />
          : <button onClick={() => setAbierto(true)} style={{
              marginTop: "10px", width: "100%", padding: "9px",
              border: `1px solid ${color.from}55`, borderRadius: "10px",
              background: "transparent", color: color.to, cursor: "pointer",
              fontSize: "12px", fontWeight: "600", fontFamily: T.fBody,
              letterSpacing: "0.06em",
            }}>+ Agregar abono</button>
      )}
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [familia, setFamilia] = useState(null);
  const [pagos, setPagos] = useState(crearPagosIniciales);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verComprobante, setVerComprobante] = useState(null);

  const isAdmin = session?.role === "admin";

  // Detecta quién inició sesión (Firebase Auth) y arma la sesión.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user && user.email && EMAIL_TO_KEY[user.email.toLowerCase()]) {
        const username = EMAIL_TO_KEY[user.email.toLowerCase()];
        const role = username === "admin" ? "admin" : "family";
        setSession({ username, role, label: LABELS[username] || "Admin" });
        if (role === "family") setFamilia(username);
      } else {
        setSession(null);
        setFamilia(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // La base de datos solo se escucha tras iniciar sesión (lo exigen las reglas).
  useEffect(() => {
    if (!session) return;
    const unsub = onSnapshot(doc(db, "tripfund", "pagos"), snap => {
      setPagos(snap.exists() ? normalizar(snap.data()) : crearPagosIniciales());
      setLoading(false);
    });
    return () => unsub();
  }, [session]);

  const persistir = async nuevo => {
    setSaving(true);
    try {
      await setDoc(doc(db, "tripfund", "pagos"), nuevo);
      setToast(true); setTimeout(() => setToast(false), 2200);
    } catch (e) { console.error(e); alert("No se pudo guardar. Revisa tu conexión."); }
    setSaving(false);
  };

  const puedeEditar = fam => isAdmin || fam === session?.username;

  // Agrega un abono (valor + foto opcional) a un mes de una familia.
  const agregarAbono = async (fam, mesIndex, valor, file) => {
    if (!puedeEditar(fam)) return;
    setSaving(true);
    try {
      const id = nuevoId();
      let comprobanteId = null;
      if (file) {
        const img = await comprimirImagen(file);
        comprobanteId = id;
        await setDoc(doc(db, "comprobantes", id), { img, familia: fam, mes: meses[mesIndex] });
      }
      const abono = { id, valor: Number(valor) || 0, fecha: new Date().toISOString(), comprobanteId };
      const n = {
        ...pagos,
        [fam]: pagos[fam].map((m, j) => j === mesIndex ? { ...m, abonos: [...m.abonos, abono] } : m),
      };
      await persistir(n);
    } catch (e) {
      console.error(e); alert("No se pudo guardar el abono.");
      setSaving(false);
    }
  };

  // Elimina un abono y su comprobante.
  const eliminarAbono = async (fam, mesIndex, abono) => {
    if (!puedeEditar(fam)) return;
    const n = {
      ...pagos,
      [fam]: pagos[fam].map((m, j) => j === mesIndex ? { ...m, abonos: m.abonos.filter(a => a.id !== abono.id) } : m),
    };
    await persistir(n);
    if (abono.comprobanteId) {
      try { await deleteDoc(doc(db, "comprobantes", abono.comprobanteId)); } catch (e) { console.error(e); }
    }
  };

  // Descarga un resumen en CSV (se abre en Excel).
  const exportarResumen = () => {
    const sep = ";";
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const filas = [["Familia", "Mes", "Abonado", "Cuota", "Falta", "Estado", "N° abonos"]];
    familias.forEach(f => {
      pagos[f].forEach(m => {
        const e = estadoMes(m.abonos);
        filas.push([LABELS[f], m.mes, e.total, CUOTA, e.falta, e.texto.replace("✓", "").trim(), m.abonos.length]);
      });
    });
    filas.push([]);
    familias.forEach(f => {
      const tf = totalFamilia(pagos[f]);
      const metaF = CUOTA * meses.length;
      filas.push([`TOTAL ${LABELS[f]}`, "", tf, metaF, Math.max(metaF - tf, 0), "", ""]);
    });
    const granTotal = familias.reduce((a, f) => a + totalFamilia(pagos[f]), 0);
    filas.push(["TOTAL GENERAL", "", granTotal, CUOTA * meses.length * familias.length, "", "", ""]);

    const csv = "﻿" + filas.map(r => r.map(esc).join(sep)).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoy = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `tripfund-resumen-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authReady) return (
    <div style={{ minHeight: "100vh", position: "relative" }}><PhotoBg /></div>
  );

  if (!session) return <LoginScreen />;

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
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowPw(true)} style={{
            padding: "7px 16px", borderRadius: "6px",
            border: "1px solid rgba(250,247,242,0.2)",
            background: "transparent", color: "rgba(250,247,242,0.6)",
            cursor: "pointer", fontSize: "11px", fontWeight: "500",
            fontFamily: T.fBody, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>Contraseña</button>
          <button onClick={() => signOut(auth)} style={{
            padding: "7px 16px", borderRadius: "6px",
            border: "1px solid rgba(250,247,242,0.2)",
            background: "transparent", color: "rgba(250,247,242,0.6)",
            cursor: "pointer", fontSize: "11px", fontWeight: "500",
            fontFamily: T.fBody, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>Salir</button>
        </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
              <p style={{
                margin: 0, fontSize: "10px", fontWeight: "500",
                color: "rgba(250,247,242,0.5)", textTransform: "uppercase",
                letterSpacing: "0.14em", fontFamily: T.fBody,
              }}>Familia</p>
              <button onClick={exportarResumen} style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "8px",
                border: "1px solid rgba(250,247,242,0.25)", background: "rgba(250,247,242,0.08)",
                color: T.cream, cursor: "pointer", fontSize: "11px", fontWeight: "600",
                fontFamily: T.fBody, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>⬇ Exportar resumen</button>
            </div>
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
                    {meses.length} cuotas · ${CUOTA.toLocaleString("es-CO")} c/u · abonado ${totalFamilia(pagos[familia]).toLocaleString("es-CO")}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pagos[familia].map((mesData, i) => (
                  <MesCard
                    key={mesData.mes}
                    mesData={mesData}
                    color={c}
                    canEdit={canEdit}
                    onAgregar={(valor, file) => agregarAbono(familia, i, valor, file)}
                    onEliminar={abono => eliminarAbono(familia, i, abono)}
                    onVer={id => setVerComprobante(id)}
                  />
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      <Toast visible={toast} />
      {showPw && <ChangePassword onClose={() => setShowPw(false)} />}
      {verComprobante && <ComprobanteModal comprobanteId={verComprobante} onClose={() => setVerComprobante(null)} />}
    </div>
  );
}