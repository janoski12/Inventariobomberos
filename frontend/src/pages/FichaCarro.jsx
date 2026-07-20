import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerCarro, obtenerRevision, descargarQRRevision } from "../api/carros";
import { useDialog } from "../context/DialogContext";

const CHIP_ESTADO = {
  OPERATIVO:      "chip chip--operativo",
  MANTENCION:     "chip chip--mantencion",
  FUERA_SERVICIO: "chip chip--fuera_servicio",
  BAJA:           "chip chip--baja",
};

const CHIP_RESULTADO = {
  OK:       "chip chip--operativo",
  FALLA:    "chip chip--fuera_servicio",
  FALTANTE: "chip chip--fuera_servicio",
};

export default function FichaCarro() {
  const { id } = useParams();
  const { toast } = useDialog();
  const [carro, setCarro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  const [revisionAbierta, setRevisionAbierta] = useState(null);
  const [detalleRevision, setDetalleRevision] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    setCargando(true);
    setError("");
    obtenerCarro(id)
      .then(setCarro)
      .catch(() => setError("No se pudo cargar la ficha del carro."))
      .finally(() => setCargando(false));
  }, [id]);

  async function toggleRevision(revisionId) {
    if (revisionAbierta === revisionId) {
      setRevisionAbierta(null);
      setDetalleRevision(null);
      return;
    }
    setRevisionAbierta(revisionId);
    setDetalleRevision(null);
    setCargandoDetalle(true);
    try {
      const data = await obtenerRevision(id, revisionId);
      setDetalleRevision(data);
    } catch {
      toast("No se pudo cargar el detalle de la revisión.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error || !carro) return <div className="container"><Link to="/carros">← Volver</Link><p className="error">{error}</p></div>;

  return (
    <div className="container">
      <Link to="/carros" style={{ textDecoration: "none" }}>← Volver a Carros</Link>

      <div className="spread" style={{ margin: "12px 0" }}>
        <h2 style={{ margin: 0 }}>{carro.nombre}</h2>
        <button
          className="btn-light"
          disabled={descargando}
          onClick={async () => {
            try {
              setDescargando(true);
              await descargarQRRevision(carro.id, carro.nombre);
            } catch { toast("No se pudo descargar el QR de revisión."); }
            finally { setDescargando(false); }
          }}
        >
          {descargando ? "Generando..." : "QR de revisión"}
        </button>
      </div>

      {carro.responsable && <p className="muted">Responsable: {carro.responsable}</p>}

      <h3 style={{ marginTop: 22 }}>Ítems en este carro</h3>
      {carro.items.length === 0 ? (
        <p className="muted">No hay ítems asignados a este carro.</p>
      ) : (
        <div className="stack">
          {carro.items.map((it) => (
            <Link key={it.id} to={`/items/${it.id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable">
                <div className="spread">
                  <div>
                    <span className="item-code">{it.codigo}</span>
                    <span className="item-desc">{it.descripcion}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={CHIP_ESTADO[it.estado] ?? "chip"}>{it.estado.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="card-detail">
                  {it.ubicacion_detalle ? <b>{it.ubicacion_detalle}</b> : <span className="muted">Sin gaveta/compartimiento indicado</span>}
                  {(it.marca || it.modelo) ? ` · ${[it.marca, it.modelo].filter(Boolean).join(" / ")}` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 22 }}>Historial de revisiones</h3>
      {carro.revisiones.length === 0 ? (
        <p className="muted">Este carro todavía no tiene revisiones registradas.</p>
      ) : (
        <div className="stack">
          {carro.revisiones.map((r) => (
            <div key={r.id} className="card">
              <div className="spread clickable" onClick={() => toggleRevision(r.id)}>
                <div>
                  <div className="card-title">{r.fecha}</div>
                  <div className="card-muted">
                    Realizada por {r.realizada_por} · {r.total_items} ítem{r.total_items !== 1 ? "s" : ""} revisado{r.total_items !== 1 ? "s" : ""}
                  </div>
                </div>
                {r.fallas > 0 ? (
                  <span className="badge-warning">{r.fallas} observación{r.fallas !== 1 ? "es" : ""}</span>
                ) : (
                  <span className="badge-neutral">Todo OK</span>
                )}
              </div>

              {r.observacion_general && <div className="card-detail">Obs: {r.observacion_general}</div>}

              {revisionAbierta === r.id && (
                <div className="stack" style={{ marginTop: 10, gap: 4 }}>
                  {cargandoDetalle ? (
                    <p className="muted">Cargando...</p>
                  ) : (
                    detalleRevision?.items.map((it) => (
                      <div key={it.item_id} className="spread" style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                        <div>
                          <span className="item-code">{it.codigo}</span>
                          <span className="item-desc">{it.descripcion}</span>
                          {it.observacion && <div className="card-detail">Obs: {it.observacion}</div>}
                        </div>
                        <span className={CHIP_RESULTADO[it.resultado] ?? "chip"}>{it.resultado}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
