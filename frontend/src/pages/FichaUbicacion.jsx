import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerUbicacion } from "../api/ubicaciones";

const CHIP_ESTADO = {
  OPERATIVO:      "chip chip--operativo",
  MANTENCION:     "chip chip--mantencion",
  FUERA_SERVICIO: "chip chip--fuera_servicio",
  BAJA:           "chip chip--baja",
};
const CHIP_CRIT = {
  ALTA:  "chip chip--alta",
  MEDIA: "chip chip--media",
  BAJA:  "chip chip--baja-crit",
};

export default function FichaUbicacion() {
  const { id } = useParams();
  const [ubicacion, setUbicacion] = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    setCargando(true);
    obtenerUbicacion(id)
      .then(setUbicacion)
      .catch(() => setError("No se pudo cargar la ficha de la ubicación."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error)    return <div className="container"><Link to="/ubicaciones">← Volver</Link><p className="error">{error}</p></div>;

  const porEstado = ubicacion.items.reduce((acc, it) => {
    acc[it.estado] = (acc[it.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container">
      <Link to="/ubicaciones" style={{ textDecoration: "none" }}>← Volver a Ubicaciones</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
        <h2 style={{ margin: 0 }}>{ubicacion.nombre}</h2>
        <span className={ubicacion.activo ? "chip chip--operativo" : "chip chip--baja"}>
          {ubicacion.activo ? "ACTIVA" : "INACTIVA"}
        </span>
      </div>

      {/* Datos de la ubicación */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <InfoRow label="Tipo"        value={ubicacion.tipo ?? "—"} />
          <InfoRow label="Responsable" value={ubicacion.responsable ?? "—"} />
          {ubicacion.codigo_qr && <InfoRow label="Código QR" value={ubicacion.codigo_qr} />}
        </div>
      </div>

      {/* Resumen de ítems */}
      {ubicacion.items.length > 0 && (
        <div className="dashboard-estados" style={{ marginBottom: 16 }}>
          <div className="dashboard-stat">
            <span className="dashboard-num text-total">{ubicacion.items.length}</span>
            <span className="dashboard-label">Total</span>
          </div>
          {Object.entries(porEstado).map(([estado, total]) => (
            <div key={estado} className="dashboard-stat">
              <span className={`dashboard-num ${estado === "OPERATIVO" ? "text-operativo" : estado === "MANTENCION" ? "text-mantencion" : "text-fuera-servicio"}`}>
                {total}
              </span>
              <span className="dashboard-label">{estado.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista de ítems */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Ítems almacenados</h3>
        <span className="muted">{ubicacion.items.length} ítem{ubicacion.items.length !== 1 ? "s" : ""}</span>
      </div>

      {ubicacion.items.length === 0 ? (
        <p className="muted">No hay ítems en esta ubicación actualmente.</p>
      ) : (
        <div className="stack">
          {ubicacion.items.map(it => (
            <Link key={it.id} to={`/items/${it.id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable">
                <div className="spread">
                  <div>
                    <span className="item-code">{it.codigo}</span>
                    <span className="item-desc">{it.descripcion}</span>
                    {it.subcategoria && (
                      <div className="item-tipo">{it.categoria} · {it.subcategoria}</div>
                    )}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={CHIP_CRIT[it.criticidad] ?? "chip"}>{it.criticidad}</span>
                    <span className={CHIP_ESTADO[it.estado] ?? "chip"}>{it.estado.replace("_", " ")}</span>
                  </div>
                </div>
                {(it.marca || it.modelo) && (
                  <div className="card-detail" style={{ marginTop: 4 }}>
                    {[it.marca, it.modelo].filter(Boolean).join(" / ")}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="inforow" style={{ padding: "8px 0" }}>
      <span className="inforow-label">{label}</span>
      <span className="inforow-value">{value}</span>
    </div>
  );
}
