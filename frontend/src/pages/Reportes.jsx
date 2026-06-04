import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerReportes, descargarPlantilla } from "../api/reportes";
import { useDialog } from "../context/DialogContext";

const CLASE_ESTADO = {
  OPERATIVO: "text-operativo",
  MANTENCION: "text-mantencion",
  FUERA_SERVICIO: "text-fuera-servicio",
  BAJA: "text-baja-estado",
};

const CLASE_CRITICIDAD = {
  ALTA: "text-alta",
  MEDIA: "text-media",
  BAJA: "text-baja-crit",
};

export default function Reportes() {
  const { toast } = useDialog();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    obtenerReportes()
      .then((d) => setData(d))
      .catch(() => setError("No se pudieron cargar los reportes."))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="container"><p>Cargando...</p></div>;
  if (error) return <div className="container"><p className="error">{error}</p></div>;

  const totalItems = data.porEstado.reduce((s, r) => s + r.total, 0);

  return (
    <div className="container">
      <div className="spread" style={{ marginBottom: 20 }}>
        <h2>Reportes</h2>
        <button
          className="btn-light"
          disabled={descargando}
          onClick={async () => {
            try {
              setDescargando(true);
              await descargarPlantilla();
            } catch {
              toast("No se pudo descargar la plantilla. Revisa que el backend esté activo.");
            } finally {
              setDescargando(false);
            }
          }}
        >
          {descargando ? "Descargando..." : "Descargar plantilla Excel"}
        </button>
      </div>

      {/* ESTADOS */}
      <h3 style={{ marginBottom: 10 }}>Estado del inventario</h3>
      <div className="row" style={{ marginBottom: 20 }}>
        {data.porEstado.map((r) => (
          <div key={r.estado} className="card" style={{ flex: 1, minWidth: 120 }}>
            <div className={`stat-number ${CLASE_ESTADO[r.estado] ?? "text-total"}`}>{r.total}</div>
            <div className="stat-label">{r.estado}</div>
          </div>
        ))}
        <div className="card" style={{ flex: 1, minWidth: 120 }}>
          <div className="stat-number text-total">{totalItems}</div>
          <div className="stat-label">TOTAL</div>
        </div>
      </div>

      {/* CRITICIDAD Y CATEGORÍA */}
      <div className="reporte-grid" style={{ marginBottom: 20 }}>
        <div>
          <h3 style={{ marginBottom: 10 }}>Por criticidad</h3>
          <div className="stack">
            {data.porCriticidad.map((r) => (
              <div key={r.criticidad} className="card">
                <div className="spread">
                  <span className={CLASE_CRITICIDAD[r.criticidad] ?? ""}>{r.criticidad}</span>
                  <span className="text-total">{r.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 10 }}>Por categoría</h3>
          <div className="stack">
            {data.porCategoria.map((r) => (
              <div key={r.categoria} className="card">
                <div className="spread">
                  <span className="card-muted">{r.categoria}</span>
                  <span className="text-total">{r.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTROLES VENCIDOS */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Controles vencidos</h3>
        {data.controlesVencidos.length > 0 && (
          <span className="badge-danger">{data.controlesVencidos.length} pendiente{data.controlesVencidos.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {data.controlesVencidos.length === 0 ? (
        <p className="muted" style={{ marginBottom: 20 }}>Sin controles vencidos.</p>
      ) : (
        <div className="stack" style={{ marginBottom: 20 }}>
          {data.controlesVencidos.map((c) => (
            <Link key={c.id} to={`/items/${c.item_id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable card--vencido">
                <div className="spread">
                  <div>
                    <span className="item-code">{c.codigo}</span>
                    <span className="item-desc">{c.descripcion}</span>
                  </div>
                  <span className="item-fecha-danger">{c.fecha_objetivo}</span>
                </div>
                <div className="item-tipo">{c.tipo}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* PRÓXIMOS CONTROLES */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Próximos controles (30 días)</h3>
        {data.proximosControles.length > 0 && (
          <span className="badge-warning">{data.proximosControles.length} próximo{data.proximosControles.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {data.proximosControles.length === 0 ? (
        <p className="muted" style={{ marginBottom: 20 }}>Sin controles próximos.</p>
      ) : (
        <div className="stack" style={{ marginBottom: 20 }}>
          {data.proximosControles.map((c) => (
            <Link key={c.id} to={`/items/${c.item_id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable card--proximo">
                <div className="spread">
                  <div>
                    <span className="item-code">{c.codigo}</span>
                    <span className="item-desc">{c.descripcion}</span>
                  </div>
                  <span className="item-fecha-warning">{c.fecha_objetivo}</span>
                </div>
                <div className="item-tipo">{c.tipo}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ITEMS SIN UBICAR */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Items sin ubicar</h3>
        {data.sinUbicar.length > 0 && (
          <span className="badge-neutral">{data.sinUbicar.length} item{data.sinUbicar.length !== 1 ? "s" : ""}</span>
        )}
      </div>
      {data.sinUbicar.length === 0 ? (
        <p className="muted">Todos los items tienen ubicación asignada.</p>
      ) : (
        <div className="stack">
          {data.sinUbicar.map((i) => (
            <Link key={i.id} to={`/items/${i.id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable">
                <div className="spread">
                  <div>
                    <span className="item-code">{i.codigo}</span>
                    <span className="item-desc">{i.descripcion}</span>
                  </div>
                  <div className="row">
                    <span className={CLASE_CRITICIDAD[i.criticidad] ?? ""}>{i.criticidad}</span>
                    <span className={CLASE_ESTADO[i.estado] ?? ""}>{i.estado}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
