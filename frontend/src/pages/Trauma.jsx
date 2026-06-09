import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerTrauma, actualizarFechasTrauma, obtenerUsosTrauma, registrarUso, eliminarUso } from "../api/trauma";
import Modal from "../components/Modal";
import { useDialog } from "../context/DialogContext";

const CHIP_ESTADO = {
  OPERATIVO:     "chip chip--operativo",
  MANTENCION:    "chip chip--mantencion",
  FUERA_SERVICIO:"chip chip--fuera_servicio",
  BAJA:          "chip chip--baja",
};

function formatFecha(iso) {
  if (!iso) return "—";
  const parts = iso.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}


function estadoVenc(fecha) {
  if (!fecha) return { label: "Sin fecha", cls: "venc-sin-fecha" };
  const hoy  = new Date().toISOString().slice(0, 10);
  const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (fecha < hoy)   return { label: "VENCIDO",    cls: "venc-vencido" };
  if (fecha <= en30) return { label: "POR VENCER", cls: "venc-proximo" };
  return               { label: "VIGENTE",     cls: "venc-vigente" };
}

function computarStats(items) {
  const hoy  = new Date().toISOString().slice(0, 10);
  const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let vencidos = 0, proximos = 0, sinFecha = 0;
  for (const it of items) {
    if (!it.fecha_vencimiento)             sinFecha++;
    else if (it.fecha_vencimiento < hoy)   vencidos++;
    else if (it.fecha_vencimiento <= en30) proximos++;
  }
  return { total: items.length, vencidos, proximos, sinFecha };
}

export default function Trauma() {
  const { toast, confirm } = useDialog();
  const [items, setItems]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState("");

  const [openFechas, setOpenFechas]           = useState(false);
  const [itemFechas, setItemFechas]           = useState(null);
  const [formFechas, setFormFechas]           = useState({ fecha_recepcion: "", fecha_vencimiento: "" });
  const [guardandoFechas, setGuardandoFechas] = useState(false);

  const [openUsos, setOpenUsos]           = useState(false);
  const [itemUsos, setItemUsos]           = useState(null);
  const [usos, setUsos]                   = useState([]);
  const [cargandoUsos, setCargandoUsos]   = useState(false);
  const [formUso, setFormUso]             = useState({ fecha: "", cantidad: 1, motivo: "", responsable: "", observacion: "" });
  const [guardandoUso, setGuardandoUso]   = useState(false);

  async function cargar() {
    setCargando(true);
    setError("");
    try { setItems(await obtenerTrauma()); }
    catch { setError("No se pudo cargar el material de trauma."); }
    finally { setCargando(false); }
  }

  async function cargarUsos(id) {
    setCargandoUsos(true);
    try { setUsos(await obtenerUsosTrauma(id)); }
    catch { setUsos([]); }
    finally { setCargandoUsos(false); }
  }

  useEffect(() => { cargar(); }, []);

  function abrirFechas(item) {
    setItemFechas(item);
    setFormFechas({ fecha_recepcion: item.fecha_recepcion ?? "", fecha_vencimiento: item.fecha_vencimiento ?? "" });
    setOpenFechas(true);
  }

  function abrirUsos(item) {
    setItemUsos(item);
    setFormUso({ fecha: new Date().toISOString().slice(0, 10), cantidad: 1, motivo: "", responsable: "", observacion: "" });
    setUsos([]);
    setOpenUsos(true);
    cargarUsos(item.id);
  }

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error)    return <div className="container"><p className="error">{error}</p></div>;

  const stats = computarStats(items);

  return (
    <div className="container">
      <h2>Material de Trauma</h2>
      <p className="muted">Ítems de categoría TRAUMA con control de fechas y registro de uso.</p>

      <div className="trauma-stats">
        <div className="card trauma-stat">
          <div className="stat-number text-total">{stats.total}</div>
          <div className="stat-label">Total ítems</div>
        </div>
        <div className="card trauma-stat">
          <div className="stat-number text-fuera-servicio">{stats.vencidos}</div>
          <div className="stat-label">Vencidos</div>
        </div>
        <div className="card trauma-stat">
          <div className="stat-number text-mantencion">{stats.proximos}</div>
          <div className="stat-label">Por vencer</div>
        </div>
        <div className="card trauma-stat">
          <div className="stat-number text-baja-estado">{stats.sinFecha}</div>
          <div className="stat-label">Sin fecha</div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted">No hay ítems de categoría TRAUMA. <Link to="/items/nuevo">Crear uno</Link>.</p>
      ) : (
        <div className="stack">
          {items.map((it) => {
            const venc = estadoVenc(it.fecha_vencimiento);
            const cardClass = `card${venc.cls === "venc-vencido" ? " card--vencido" : venc.cls === "venc-proximo" ? " card--proximo" : ""}`;
            return (
              <div key={it.id} className={cardClass}>
                <div className="spread">
                  <div>
                    <Link to={`/items/${it.id}`} className="item-code">{it.codigo}</Link>
                    <span className="item-desc">{it.descripcion}</span>
                  </div>
                  <span className={CHIP_ESTADO[it.estado] ?? "chip"}>
                    {it.estado.replace("_", " ")}
                  </span>
                </div>

                <div className="trauma-fechas">
                  <div className="trauma-fecha-item">
                    <span className="trauma-fecha-label">Recepción</span>
                    <span className="trauma-fecha-valor">{formatFecha(it.fecha_recepcion)}</span>
                  </div>
                  <div className="trauma-fecha-item">
                    <span className="trauma-fecha-label">Vencimiento</span>
                    <span className={`trauma-fecha-valor ${venc.cls}`}>{formatFecha(it.fecha_vencimiento)}</span>
                  </div>
                  <div className="trauma-fecha-item">
                    <span className="trauma-fecha-label">Estado venc.</span>
                    <span className={venc.cls}>{venc.label}</span>
                  </div>
                  <div className="trauma-fecha-item">
                    <span className="trauma-fecha-label">Ubicación</span>
                    <span className="trauma-fecha-valor">{it.ubicacion_nombre ?? it.bombero_nombre ?? "—"}</span>
                  </div>
                </div>

                <div className="row trauma-acciones">
                  <button className="btn-light" onClick={() => abrirFechas(it)}>Editar fechas</button>
                  <button className="btn" onClick={() => abrirUsos(it)}>
                    Usos{it.total_usos > 0 ? ` (${it.total_usos})` : ""}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Fechas */}
      <Modal open={openFechas} title="Fechas del ítem" onClose={() => setOpenFechas(false)}>
        {itemFechas && (
          <div className="stack">
            <p className="muted">{itemFechas.codigo} — {itemFechas.descripcion}</p>
            <label className="label">
              Fecha de recepción
              <input type="date" className="input" value={formFechas.fecha_recepcion}
                onChange={(e) => setFormFechas((p) => ({ ...p, fecha_recepcion: e.target.value }))} />
            </label>
            <label className="label">
              Fecha de vencimiento
              <input type="date" className="input" value={formFechas.fecha_vencimiento}
                onChange={(e) => setFormFechas((p) => ({ ...p, fecha_vencimiento: e.target.value }))} />
            </label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn-light" onClick={() => setOpenFechas(false)}>Cancelar</button>
              <button className="btn" disabled={guardandoFechas}
                onClick={async () => {
                  try {
                    setGuardandoFechas(true);
                    await actualizarFechasTrauma(itemFechas.id, {
                      fecha_recepcion:   formFechas.fecha_recepcion   || null,
                      fecha_vencimiento: formFechas.fecha_vencimiento || null,
                    });
                    await cargar();
                    setOpenFechas(false);
                  } catch (e) { toast(e.message); }
                  finally { setGuardandoFechas(false); }
                }}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Usos */}
      <Modal open={openUsos} title="Registro de uso" onClose={() => setOpenUsos(false)}>
        {itemUsos && (
          <div className="stack">
            <p className="muted">{itemUsos.codigo} — {itemUsos.descripcion}</p>

            <div className="card">
              <div className="card-title">Registrar uso</div>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <label className="label">
                  Fecha
                  <input type="date" className="input" value={formUso.fecha}
                    onChange={(e) => setFormUso((p) => ({ ...p, fecha: e.target.value }))} />
                </label>
                <label className="label">
                  Cantidad
                  <input type="number" min="1" className="input" value={formUso.cantidad}
                    onChange={(e) => setFormUso((p) => ({ ...p, cantidad: Number(e.target.value) }))} />
                </label>
                <label className="label">
                  Motivo / Llamado
                  <input className="input" placeholder="Ej: Accidente Ruta 5" value={formUso.motivo}
                    onChange={(e) => setFormUso((p) => ({ ...p, motivo: e.target.value }))} />
                </label>
                <label className="label">
                  Responsable
                  <input className="input" placeholder="Ej: Juan Pérez" value={formUso.responsable}
                    onChange={(e) => setFormUso((p) => ({ ...p, responsable: e.target.value }))} />
                </label>
              </div>
              <label className="label" style={{ marginTop: 8 }}>
                Observación
                <input className="input" placeholder="Ej: Se consumieron 3 vendas" value={formUso.observacion}
                  onChange={(e) => setFormUso((p) => ({ ...p, observacion: e.target.value }))} />
              </label>
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn" disabled={guardandoUso || !formUso.fecha}
                  onClick={async () => {
                    try {
                      setGuardandoUso(true);
                      await registrarUso(itemUsos.id, {
                        fecha:       formUso.fecha,
                        cantidad:    formUso.cantidad,
                        motivo:      formUso.motivo      || null,
                        responsable: formUso.responsable || null,
                        observacion: formUso.observacion || null,
                      });
                      await cargar();
                      await cargarUsos(itemUsos.id);
                      setFormUso({ fecha: new Date().toISOString().slice(0, 10), cantidad: 1, motivo: "", responsable: "", observacion: "" });
                    } catch (e) { toast(e.message); }
                    finally { setGuardandoUso(false); }
                  }}>
                  Registrar
                </button>
              </div>
            </div>

            <div>
              <p className="card-title">Historial ({usos.length})</p>
              {cargandoUsos ? (
                <p className="muted">Cargando...</p>
              ) : usos.length === 0 ? (
                <p className="muted">Sin registros de uso.</p>
              ) : (
                <div className="stack" style={{ marginTop: 8 }}>
                  {usos.map((u) => (
                    <div key={u.id} className="inforow">
                      <div>
                        <span className="item-code">{formatFecha(u.fecha)}</span>
                        {u.motivo && <span className="item-desc">{u.motivo}</span>}
                        <div className="card-detail">
                          {u.cantidad} unidad{u.cantidad !== 1 ? "es" : ""}
                          {u.responsable ? ` · ${u.responsable}` : ""}
                          {u.observacion ? ` · ${u.observacion}` : ""}
                        </div>
                      </div>
                      <button className="btn-danger" onClick={async () => {
                        if (!await confirm("¿Eliminar este registro?")) return;
                        try { await eliminarUso(u.id); await cargar(); await cargarUsos(itemUsos.id); }
                        catch (e) { toast(e.message); }
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
