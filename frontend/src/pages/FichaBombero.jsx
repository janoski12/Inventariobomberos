import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerBombero } from "../api/bomberos";

const CHIP_ESTADO_ITEM = {
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

export default function FichaBombero() {
  const { id } = useParams();
  const [bombero, setBombero] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError("");
      try { setBombero(await obtenerBombero(id)); }
      catch { setError("No se pudo cargar la ficha del bombero."); }
      finally { setCargando(false); }
    }
    cargar();
  }, [id]);

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error)    return <div className="container"><Link to="/bomberos">← Volver</Link><p className="error">{error}</p></div>;

  return (
    <div className="container">
      <Link to="/bomberos" style={{ textDecoration: "none" }}>← Volver a Bomberos</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
        <h2 style={{ margin: 0 }}>{bombero.nombre}</h2>
        <span className={bombero.estado === "ACTIVO" ? "chip chip--operativo" : "chip chip--baja"}>
          {bombero.estado ?? "ACTIVO"}
        </span>
      </div>

      {/* Datos del bombero */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <InfoRow label="Cargo"         value={bombero.cargo ?? "—"} />
          <InfoRow label="RUT"           value={bombero.rut ?? "—"} />
          <InfoRow label="N° Registro"   value={bombero.numero_registro ?? "—"} />
          <InfoRow label="Observaciones" value={bombero.observaciones ?? "—"} />
        </div>
      </div>

      {/* Ítems asignados */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Ítems asignados</h3>
        <span className="muted">{bombero.items.length} ítem{bombero.items.length !== 1 ? "s" : ""}</span>
      </div>

      {bombero.items.length === 0 ? (
        <p className="muted">No tiene ítems asignados actualmente.</p>
      ) : (
        <div className="stack">
          {bombero.items.map(it => (
            <Link key={it.id} to={`/items/${it.id}`} style={{ textDecoration: "none" }}>
              <div className="card clickable">
                <div className="spread">
                  <div>
                    <span className="item-code">{it.codigo}</span>
                    <span className="item-desc">{it.descripcion}</span>
                    {it.subcategoria && (
                      <span className="item-tipo">{it.categoria} · {it.subcategoria}</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={CHIP_CRIT[it.criticidad] ?? "chip"}>{it.criticidad}</span>
                    <span className={CHIP_ESTADO_ITEM[it.estado] ?? "chip"}>{it.estado.replace("_", " ")}</span>
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
