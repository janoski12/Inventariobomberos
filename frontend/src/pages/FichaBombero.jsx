import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerBombero } from "../api/bomberos";
import { listarActasPendientes, abrirDocumento, cancelarActaEntrega } from "../api/actas";
import EntregaKitModal from "../components/EntregaKitModal";
import DevolverItemsModal from "../components/DevolverItemsModal";
import ConfirmarActaModal from "../components/ConfirmarActaModal";
import { useDialog } from "../context/DialogContext";

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
  const { toast, confirm } = useDialog();
  const [bombero, setBombero] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState("");
  const [actasPendientes, setActasPendientes] = useState([]);
  const [openEntrega, setOpenEntrega] = useState(false);
  const [openDevolver, setOpenDevolver] = useState(false);
  const [actaAConfirmar, setActaAConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const [b, actas] = await Promise.all([
        obtenerBombero(id),
        listarActasPendientes().catch(() => []),
      ]);
      setBombero(b);
      setActasPendientes(actas.filter((a) => a.bombero_id === Number(id)));
    } catch {
      setError("No se pudo cargar la ficha del bombero.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setOpenEntrega(true)}>
          Entregar equipo
        </button>
        {bombero.items.length > 0 && (
          <button className="btn" onClick={() => setOpenDevolver(true)}>
            Devolver ítems
          </button>
        )}
      </div>

      {/* Actas de entrega o devolución pendientes de firma */}
      {actasPendientes.length > 0 && (
        <div className="stack" style={{ marginBottom: 16 }}>
          {actasPendientes.map((a) => (
            <div key={a.id} className="card card--pendiente-firma">
              <div className="spread">
                <div>
                  <div className="card-title">⏳ Pendiente de firma</div>
                  <div className="card-detail">
                    {a.tipo === "DEVOLUCION" ? (
                      <>Devolución solicitada, vuelve a <b>{a.ubicacion_destino_nombre}</b></>
                    ) : (
                      <>Entrega solicitada</>
                    )}
                    <br />
                    Solicitada el {a.fecha_solicitud} por {a.solicitado_por}
                    <br />
                    Ítems: {a.items.map((it) => it.codigo).join(", ")}
                  </div>
                </div>
                <div className="row">
                  <button
                    className="btn-light"
                    onClick={async () => {
                      try { await abrirDocumento(a.id); }
                      catch { toast("No se pudo abrir el documento."); }
                    }}
                  >
                    Ver / imprimir acta
                  </button>
                  <button className="btn" onClick={() => setActaAConfirmar(a.id)}>
                    Subir documento firmado
                  </button>
                  <button
                    className="btn-danger"
                    disabled={procesando}
                    onClick={async () => {
                      const pregunta = a.tipo === "DEVOLUCION"
                        ? "¿Cancelar esta solicitud de devolución? Los ítems seguirán asignados al bombero."
                        : "¿Cancelar esta solicitud de entrega? Ningún ítem cambiará de dueño.";
                      if (!await confirm(pregunta)) return;
                      try {
                        setProcesando(true);
                        await cancelarActaEntrega(a.id);
                        await cargar();
                        toast("Solicitud cancelada", "success");
                      } catch (e) {
                        toast(e.message);
                      } finally {
                        setProcesando(false);
                      }
                    }}
                  >
                    Cancelar solicitud
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EntregaKitModal
        open={openEntrega}
        onClose={() => setOpenEntrega(false)}
        bomberoFijo={{ id: bombero.id, nombre: bombero.nombre }}
        onDone={cargar}
      />

      <DevolverItemsModal
        open={openDevolver}
        onClose={() => setOpenDevolver(false)}
        bombero={{ id: bombero.id, nombre: bombero.nombre }}
        onDone={cargar}
      />

      <ConfirmarActaModal
        open={actaAConfirmar != null}
        onClose={() => setActaAConfirmar(null)}
        actaId={actaAConfirmar}
        onDone={cargar}
      />

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
