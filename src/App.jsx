import { useEffect, useMemo, useState } from "react";

function App() {
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);
  const [imagenActual, setImagenActual] = useState(0);
  const [autoplayActivo, setAutoplayActivo] = useState(true);
  const [imagenAbierta, setImagenAbierta] = useState(null);

  const familias = [
    "Espinel Rey",
    "Espinel Gomez",
    "Espinel Lopez",
    "Alfonso Espinel",
  ];

  const meses = [
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const imagenes = [
    "/foto-1.jpeg",
    "/foto-2.jpeg",
    "/foto-3.jpeg",
    "/foto-4.jpeg",
    "/foto-5.jpeg",
    "/foto-6.jpeg",
  ];

  const crearPagosIniciales = () => {
    const data = {};

    familias.forEach((familia) => {
      data[familia] = meses.map((mes) => ({
        mes,
        valorEsperado: 100000,
        valorAbonado: "",
        numeroAutorizacion: "",
      }));
    });

    return data;
  };

  const [pagosPorFamilia, setPagosPorFamilia] = useState(crearPagosIniciales);

  useEffect(() => {
    if (!autoplayActivo) return;

    const intervalo = setInterval(() => {
      setImagenActual((prev) => (prev + 1) % imagenes.length);
    }, 2500);

    return () => clearInterval(intervalo);
  }, [imagenes.length, autoplayActivo]);

  const siguienteImagen = () => {
    setImagenActual((prev) => (prev + 1) % imagenes.length);
    setAutoplayActivo(false);
  };

  const anteriorImagen = () => {
    setImagenActual((prev) => (prev - 1 + imagenes.length) % imagenes.length);
    setAutoplayActivo(false);
  };

  const abrirImagen = () => {
    setImagenAbierta(imagenes[imagenActual]);
    setAutoplayActivo(false);
  };

  const cerrarImagen = () => {
    setImagenAbierta(null);
  };

  const actualizarCampo = (familia, indexMes, campo, valor) => {
    setPagosPorFamilia((prev) => ({
      ...prev,
      [familia]: prev[familia].map((item, index) =>
        index === indexMes ? { ...item, [campo]: valor } : item
      ),
    }));
  };

  const numerosRegistrados = useMemo(() => {
    const mapa = {};

    Object.values(pagosPorFamilia).forEach((pagos) => {
      pagos.forEach((pago) => {
        const numero = pago.numeroAutorizacion.trim();
        if (!numero) return;
        mapa[numero] = (mapa[numero] || 0) + 1;
      });
    });

    return mapa;
  }, [pagosPorFamilia]);

  const obtenerEstadoPago = (pago) => {
    const numero = pago.numeroAutorizacion.trim();
    const valor = Number(pago.valorAbonado);

    if (!numero && !pago.valorAbonado) {
      return { texto: "Pendiente", color: "#f59e0b", fondo: "#fef3c7" };
    }

    if (numero && numerosRegistrados[numero] > 1) {
      return { texto: "Número repetido", color: "#b91c1c", fondo: "#fee2e2" };
    }

    if (numero && valor >= 100000) {
      return { texto: "Pagado", color: "#047857", fondo: "#d1fae5" };
    }

    if (numero && valor > 0 && valor < 100000) {
      return { texto: "Incompleto", color: "#b45309", fondo: "#fed7aa" };
    }

    return { texto: "Pendiente", color: "#f59e0b", fondo: "#fef3c7" };
  };

  const totalGeneral = familias.reduce((acc, familia) => {
    const total = pagosPorFamilia[familia].reduce(
      (suma, pago) => suma + (Number(pago.valorAbonado) || 0),
      0
    );
    return acc + total;
  }, 0);

  const metaGeneral = 100000 * meses.length * familias.length;
  const progresoGeneral = Math.min((totalGeneral / metaGeneral) * 100, 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        fontFamily: "Inter, Poppins, system-ui, sans-serif",
        background:
          "linear-gradient(180deg, #fff7ed 0%, #fdf2f8 32%, #ecfeff 68%, #ecfdf5 100%)",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1
          style={{
            textAlign: "center",
            fontSize: "48px",
            marginBottom: "10px",
            color: "#0f172a",
            fontWeight: "800",
            letterSpacing: "-0.03em",
          }}
        >
          Nuestro Viaje Familiar ✈️🌴
        </h1>

        <p
          style={{
            textAlign: "center",
            fontSize: "19px",
            color: "#475569",
            fontWeight: "500",
          }}
        >
          Cada aporte nos acerca más a nuestro próximo viaje juntos ✨
        </p>

        <p
          style={{
            textAlign: "center",
            marginBottom: "35px",
            color: "#7c3aed",
            fontWeight: "700",
            letterSpacing: "0.04em",
          }}
        >
          Diciembre 2026
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            padding: "25px",
            borderRadius: "20px",
            marginBottom: "30px",
            border: "1px solid rgba(255,255,255,0.65)",
            textAlign: "center",
            boxShadow: "0 18px 45px rgba(124, 58, 237, 0.10)",
          }}
        >
          <h2 style={{ margin: 0 }}>Llave Bre Nubank</h2>
          <p
            style={{
              fontSize: "34px",
              fontWeight: "bold",
              marginTop: "12px",
              color: "#7c3aed",
            }}
          >
            1090368935
          </p>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            padding: "24px",
            borderRadius: "20px",
            marginBottom: "30px",
            boxShadow: "0 18px 45px rgba(124, 58, 237, 0.10)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "18px" }}>Avance del viaje</h2>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "24px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: "300px" }}>
              <p style={{ marginBottom: "10px", fontWeight: "600" }}>
                Total ahorrado: ${totalGeneral.toLocaleString("es-CO")}
              </p>
              <p style={{ marginBottom: "16px", color: "#64748b" }}>
                Meta total: ${metaGeneral.toLocaleString("es-CO")}
              </p>

              <div
                style={{
                  width: "100%",
                  height: "18px",
                  background: "#e2e8f0",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progresoGeneral}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #14b8a6, #7c3aed)",
                    borderRadius: "999px",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "220px",
                  height: "220px",
                  borderRadius: "50%",
                  background: `conic-gradient(#7c3aed 0% ${progresoGeneral}%, #e2e8f0 ${progresoGeneral}% 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px rgba(124, 58, 237, 0.12)",
                }}
              >
                <div
                  style={{
                    width: "150px",
                    height: "150px",
                    borderRadius: "50%",
                    background: "white",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    boxShadow: "inset 0 4px 14px rgba(124, 58, 237, 0.08)",
                  }}
                >
                  <span style={{ fontSize: "28px", lineHeight: 1 }}>✈️</span>
                  <span
                    style={{
                      fontSize: "34px",
                      fontWeight: "bold",
                      color: "#7c3aed",
                    }}
                  >
                    {progresoGeneral.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: "14px", color: "#64748b" }}>
                    de la meta
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            padding: "20px",
            borderRadius: "20px",
            marginBottom: "35px",
            boxShadow: "0 18px 45px rgba(124, 58, 237, 0.10)",
            textAlign: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              onClick={anteriorImagen}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2,
                border: "none",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.85)",
                cursor: "pointer",
                fontSize: "22px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
              }}
            >
              ‹
            </button>

            <img
              src={imagenes[imagenActual]}
              alt="Familia"
              onClick={abrirImagen}
              style={{
                width: "100%",
                maxWidth: "750px",
                height: "520px",
                objectFit: "contain",
                backgroundColor: "#fff7ed",
                borderRadius: "20px",
                cursor: "zoom-in",
              }}
            />

            <button
              onClick={siguienteImagen}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2,
                border: "none",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.85)",
                cursor: "pointer",
                fontSize: "22px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {imagenes.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setImagenActual(index);
                  setAutoplayActivo(false);
                }}
                style={{
                  width: imagenActual === index ? "26px" : "10px",
                  height: "10px",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  background:
                    imagenActual === index ? "#7c3aed" : "#d8b4fe",
                }}
              />
            ))}

            <button
              onClick={() => setAutoplayActivo((prev) => !prev)}
              style={{
                marginLeft: "10px",
                border: "none",
                borderRadius: "999px",
                padding: "8px 14px",
                background: autoplayActivo ? "#7c3aed" : "#e2e8f0",
                color: autoplayActivo ? "white" : "#334155",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {autoplayActivo ? "Pausar" : "Reanudar"}
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            padding: "25px",
            borderRadius: "20px",
            marginBottom: "30px",
            boxShadow: "0 18px 45px rgba(124, 58, 237, 0.10)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "20px",
              color: "#0f172a",
              fontSize: "28px",
              fontWeight: "800",
            }}
          >
            Selecciona tu familia
          </h2>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            {familias.map((familia) => (
              <button
                key={familia}
                onClick={() => setFamiliaSeleccionada(familia)}
                style={{
                  padding: "18px 34px",
                  borderRadius: "14px",
                  border: "1px solid #e9d5ff",
                  cursor: "pointer",
                  backgroundColor:
                    familiaSeleccionada === familia
                      ? "#ede9fe"
                      : "rgba(255,255,255,0.95)",
                  fontWeight: "700",
                  fontSize: "16px",
                  color: "#312e81",
                  boxShadow: "0 10px 22px rgba(236, 72, 153, 0.12)",
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                  e.currentTarget.style.boxShadow =
                    "0 16px 28px rgba(236, 72, 153, 0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 22px rgba(236, 72, 153, 0.12)";
                }}
              >
                {familia}
              </button>
            ))}
          </div>
        </div>

        {familiaSeleccionada && (
          <div
            style={{
              background: "rgba(255,255,255,0.78)",
              padding: "25px",
              borderRadius: "20px",
              boxShadow: "0 18px 45px rgba(124, 58, 237, 0.10)",
              overflowX: "auto",
            }}
          >
            <h2
              style={{
                marginBottom: "20px",
                color: "#0f172a",
                fontSize: "26px",
                fontWeight: "800",
              }}
            >
              Detalle de {familiaSeleccionada}
            </h2>

            <table
              cellPadding="10"
              style={{
                borderCollapse: "collapse",
                width: "100%",
                minWidth: "850px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "linear-gradient(90deg, #ede9fe 0%, #fae8ff 50%, #cffafe 100%)",
                  }}
                >
                  <th style={{ border: "1px solid #e9d5ff" }}>Mes</th>
                  <th style={{ border: "1px solid #e9d5ff" }}>Valor esperado</th>
                  <th style={{ border: "1px solid #e9d5ff" }}>Valor abonado</th>
                  <th style={{ border: "1px solid #e9d5ff" }}>
                    Número autorización
                  </th>
                  <th style={{ border: "1px solid #e9d5ff" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagosPorFamilia[familiaSeleccionada].map((pago, index) => {
                  const estado = obtenerEstadoPago(pago);

                  return (
                    <tr key={pago.mes}>
                      <td style={{ border: "1px solid #e9d5ff" }}>{pago.mes}</td>
                      <td style={{ border: "1px solid #e9d5ff" }}>$100.000</td>
                      <td style={{ border: "1px solid #e9d5ff" }}>
                        <input
                          type="number"
                          placeholder="Ej: 100000"
                          value={pago.valorAbonado}
                          onChange={(e) =>
                            actualizarCampo(
                              familiaSeleccionada,
                              index,
                              "valorAbonado",
                              e.target.value
                            )
                          }
                          style={{
                            width: "140px",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            border: "1px solid #e9d5ff",
                          }}
                        />
                      </td>
                      <td style={{ border: "1px solid #e9d5ff" }}>
                        <input
                          type="text"
                          placeholder="Número"
                          value={pago.numeroAutorizacion}
                          onChange={(e) =>
                            actualizarCampo(
                              familiaSeleccionada,
                              index,
                              "numeroAutorizacion",
                              e.target.value
                            )
                          }
                          style={{
                            width: "160px",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            border: "1px solid #e9d5ff",
                          }}
                        />
                      </td>
                      <td style={{ border: "1px solid #e9d5ff" }}>
                        <span
                          style={{
                            padding: "8px 12px",
                            borderRadius: "999px",
                            backgroundColor: estado.fondo,
                            color: estado.color,
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        >
                          {estado.texto}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {imagenAbierta && (
        <div
          onClick={cerrarImagen}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "950px",
              width: "100%",
              background: "white",
              borderRadius: "24px",
              padding: "18px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <button
              onClick={cerrarImagen}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                border: "none",
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                cursor: "pointer",
                fontSize: "22px",
              }}
            >
              ×
            </button>

            <img
              src={imagenAbierta}
              alt="Imagen ampliada"
              style={{
                width: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: "18px",
                backgroundColor: "#fff7ed",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


