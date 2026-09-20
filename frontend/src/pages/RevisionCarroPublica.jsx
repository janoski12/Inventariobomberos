import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { obtenerCarroPublico, enviarRevision } from "../api/carrosPublico";

const OPCIONES = [
  { valor: "OK",       label: "OK",       cls: "revision-btn revision-btn--ok" },
  { valor: "FALLA",    label: "Falla",    cls: "revision-btn revision-btn--falla" },
  { valor: "FALTANTE", label: "Faltante", cls: "revision-btn revision-btn--falla" },
];

// undefined: todavia no elige que revisar. null: eligio "todo el carro". string: una gaveta puntual.
const SIN_ELEGIR = undefined;
const TODO_EL_CARRO = null;

export default function RevisionCarroPublica() {
  const { id } = useParams();
  const [carro, setCarro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [gavetaElegida, setGavetaElegida] = useState(SIN_ELEGIR);
  const [nombre, setNombre] = useState("");
  const [observacionGeneral, setObservacionGeneral] = useState("");
  const [resultados, setResultados] = useState({}); // item_id -> { resultado, observacion }
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  useEffect(() => {
    obtenerCarroPublico(id)
      .then((data) => {
        setCarro(data);
        const inicial = {};
        for (const it of data.items) inicial[it.id] = { resultado: "OK", observacion: "" };
        setResultados(inicial);
      })
      .catch(() => setError("No se encontró este carro, o el enlace ya no es válido."))
      .finally(() => setCargando(false));
  }, [id]);

  // Gavetas presentes en este carro, en el orden en que aparecen. Si ningun
  // item tiene gaveta asignada, no tiene sentido ofrecer el paso de elegir.
  const gavetasPresentes = useMemo(
    () => [...new Set((carro?.items ?? []).map((it) => it.ubicacion_detalle).filter(Boolean))],
    [carro]
  );

  const itemsAMostrar = useMemo(() => {
    const items = carro?.items ?? [];
    if (gavetaElegida === TODO_EL_CARRO || gavetasPresentes.length === 0) return items;
    return items.filter((it) => it.ubicacion_detalle === gavetaElegida);
  }, [carro, gavetaElegida, gavetasPresentes]);

  function actualizar(itemId, campo, valor) {
    setResultados((p) => ({ ...p, [itemId]: { ...p[itemId], [campo]: valor } }));
  }

  const puedeEnviar = nombre.trim().length > 0 && !enviando;

  async function handleEnviar() {
    try {
      setEnviando(true);
      setErrorEnvio("");
      const idsAMostrar = new Set(itemsAMostrar.map((it) => it.id));
      await enviarRevision(id, {
        realizada_por: nombre.trim(),
        observacion_general: observacionGeneral.trim() || null,
        gaveta: gavetasPresentes.length === 0 ? null : gavetaElegida,
        items: Object.entries(resultados)
          .filter(([item_id]) => idsAMostrar.has(Number(item_id)))
          .map(([item_id, r]) => ({
            item_id: Number(item_id),
            resultado: r.resultado,
            observacion: r.observacion?.trim() || null,
          })),
      });
      setEnviado(true);
    } catch (e) {
      setErrorEnvio(e.message || "No se pudo enviar la revisión.");
    } finally {
      setEnviando(false);
    }
  }

  // Se pide elegir que revisar solo si hay mas de una gaveta entre las que optar
  const debeElegirGaveta = gavetasPresentes.length > 0 && gavetaElegida === SIN_ELEGIR;

  return (
    <div className="revision-publica">
      <header className="revision-publica-header">
        <span className="app-header-badge">CBT10</span>
        <span className="app-header-title">Revisión de carro</span>
      </header>

      <div className="container" style={{ maxWidth: 640 }}>
        {cargando && <p className="muted">Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {carro && carro.items.length === 0 && !enviado && (
          <>
            <h2 style={{ marginTop: 0 }}>{carro.nombre}</h2>
            <p className="muted">Este carro no tiene ítems asignados actualmente.</p>
          </>
        )}

        {carro && carro.items.length > 0 && debeElegirGaveta && !enviado && (
          <>
            <h2 style={{ marginTop: 0 }}>{carro.nombre}</h2>
            <p className="muted">¿Qué vas a revisar?</p>
            <div className="stack">
              {gavetasPresentes.map((g) => (
                <button key={g} type="button" className="btn-light" style={{ textAlign: "left" }} onClick={() => setGavetaElegida(g)}>
                  {g}
                </button>
              ))}
              <button type="button" className="btn-light" style={{ textAlign: "left" }} onClick={() => setGavetaElegida(TODO_EL_CARRO)}>
                Todo el carro ({carro.items.length} ítems)
              </button>
            </div>
          </>
        )}

        {carro && carro.items.length > 0 && !debeElegirGaveta && !enviado && (
          <>
            <h2 style={{ marginTop: 0 }}>{carro.nombre}</h2>
            <p className="muted">
              Marca el estado de cada ítem y agrega una observación si corresponde.
              Al guardar, esta revisión queda registrada para que el encargado de
              material la revise.
            </p>

            {gavetasPresentes.length > 0 && (
              <p className="card-detail" style={{ marginTop: -8 }}>
                Revisando: <strong>{gavetaElegida === TODO_EL_CARRO ? "Todo el carro" : gavetaElegida}</strong>
                {" · "}
                <button type="button" className="link-button" onClick={() => setGavetaElegida(SIN_ELEGIR)}>
                  Cambiar
                </button>
              </p>
            )}

            <label className="label">
              Tu nombre
              <input
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </label>

            <div className="stack" style={{ marginTop: 16 }}>
              {itemsAMostrar.length === 0 ? (
                <p className="muted">No hay ítems en esta gaveta.</p>
              ) : (
                itemsAMostrar.map((it) => (
                  <div key={it.id} className="card">
                    <div className="card-title">{it.descripcion}</div>
                    <div className="card-muted">
                      {it.codigo}
                      {it.ubicacion_detalle ? ` · ${it.ubicacion_detalle}` : ""}
                    </div>

                    <div className="row" style={{ marginTop: 10 }}>
                      {OPCIONES.map((op) => (
                        <button
                          key={op.valor}
                          type="button"
                          className={`${op.cls}${resultados[it.id]?.resultado === op.valor ? " revision-btn--activo" : ""}`}
                          onClick={() => actualizar(it.id, "resultado", op.valor)}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {resultados[it.id]?.resultado !== "OK" && (
                      <input
                        className="input"
                        style={{ marginTop: 8 }}
                        placeholder="Observación (ej: falta cinta adhesiva)"
                        value={resultados[it.id]?.observacion ?? ""}
                        onChange={(e) => actualizar(it.id, "observacion", e.target.value)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <label className="label" style={{ marginTop: 16 }}>
              Observación general (opcional)
              <input
                className="input"
                value={observacionGeneral}
                onChange={(e) => setObservacionGeneral(e.target.value)}
              />
            </label>

            {errorEnvio && <p className="error">{errorEnvio}</p>}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 40 }}>
              <button className="btn" disabled={!puedeEnviar} onClick={handleEnviar}>
                {enviando ? "Guardando..." : "Guardar revisión"}
              </button>
            </div>
          </>
        )}

        {enviado && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-title">Revisión guardada</div>
            <p className="card-detail">Gracias, {nombre}. Tu revisión de {carro.nombre} quedó registrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
