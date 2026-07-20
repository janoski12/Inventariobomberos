import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { obtenerCarroPublico, enviarRevision } from "../api/carrosPublico";

const OPCIONES = [
  { valor: "OK",       label: "OK",       cls: "revision-btn revision-btn--ok" },
  { valor: "FALLA",    label: "Falla",    cls: "revision-btn revision-btn--falla" },
  { valor: "FALTANTE", label: "Faltante", cls: "revision-btn revision-btn--falla" },
];

export default function RevisionCarroPublica() {
  const { id } = useParams();
  const [carro, setCarro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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

  function actualizar(itemId, campo, valor) {
    setResultados((p) => ({ ...p, [itemId]: { ...p[itemId], [campo]: valor } }));
  }

  const puedeEnviar = nombre.trim().length > 0 && !enviando;

  async function handleEnviar() {
    try {
      setEnviando(true);
      setErrorEnvio("");
      await enviarRevision(id, {
        realizada_por: nombre.trim(),
        observacion_general: observacionGeneral.trim() || null,
        items: Object.entries(resultados).map(([item_id, r]) => ({
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

  return (
    <div className="revision-publica">
      <header className="revision-publica-header">
        <span className="app-header-badge">CBT10</span>
        <span className="app-header-title">Revisión de carro</span>
      </header>

      <div className="container" style={{ maxWidth: 640 }}>
        {cargando && <p className="muted">Cargando...</p>}
        {error && <p className="error">{error}</p>}

        {carro && !enviado && (
          <>
            <h2 style={{ marginTop: 0 }}>{carro.nombre}</h2>
            <p className="muted">
              Marca el estado de cada ítem y agrega una observación si corresponde.
              Al guardar, esta revisión queda registrada para que el encargado de
              material la revise.
            </p>

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
              {carro.items.length === 0 ? (
                <p className="muted">Este carro no tiene ítems asignados actualmente.</p>
              ) : (
                carro.items.map((it) => (
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
