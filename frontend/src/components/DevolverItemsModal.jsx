import { useEffect, useState } from "react";
import Modal from "./Modal";
import { buscarItems } from "../api/items";
import { listarUbicaciones } from "../api/ubicaciones";
import { solicitarActaDevolucion, abrirDocumento } from "../api/actas";
import { useDialog } from "../context/DialogContext";

// Modal reutilizable para devolver uno o varios items que un bombero tiene
// asignados (kit): genera el acta de devolución con todos los items en la
// tabla. A diferencia de la entrega, el bombero siempre es conocido de
// antemano (viene de la ficha del bombero, o del item que se está
// devolviendo) — acá no se elige.
//
// - bombero: { id, nombre } — de quien se devuelven los items.
// - itemFijo: { id, codigo, descripcion } — item precargado (ej. desde la
//   ficha de un item); se puede agregar el resto del equipo del mismo bombero.
export default function DevolverItemsModal({ open, onClose, bombero, itemFijo, onDone }) {
  const { toast } = useDialog();

  const [itemsDelBombero, setItemsDelBombero] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionId, setUbicacionId] = useState("");
  const [ubicacionDetalle, setUbicacionDetalle] = useState("");
  const [observacion, setObservacion] = useState("");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open || !bombero) return;
    setSeleccion(itemFijo ? [itemFijo] : []);
    setUbicacionId("");
    setUbicacionDetalle("");
    setObservacion("");
    buscarItems({ bombero_id: bombero.id }).catch(() => []).then(setItemsDelBombero);
    listarUbicaciones().catch(() => []).then(setUbicaciones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bombero?.id]);

  function agregar(item) {
    setSeleccion((p) => [...p, item]);
  }

  function quitar(id) {
    setSeleccion((p) => p.filter((i) => i.id !== id));
  }

  const disponibles = itemsDelBombero.filter((it) => !seleccion.some((s) => s.id === it.id));
  const ubicacionSeleccionada = ubicaciones.find((u) => String(u.id) === String(ubicacionId));
  const esCarro = ubicacionSeleccionada?.tipo === "CARRO";
  const puedeGenerar = seleccion.length > 0 && ubicacionId && !generando;

  async function handleGenerar() {
    try {
      setGenerando(true);
      const { id } = await solicitarActaDevolucion({
        item_ids: seleccion.map((i) => i.id),
        ubicacion_id: Number(ubicacionId),
        ubicacion_detalle: esCarro ? (ubicacionDetalle.trim() || null) : null,
        observacion: observacion.trim() || null,
      });
      onClose();
      toast("Acta generada. Imprímela, fírmala y súbela para confirmar la devolución.", "success");
      await abrirDocumento(id);
      onDone?.();
    } catch (e) {
      toast(e.message || "No se pudo generar el acta de devolución.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Modal open={open} title="Devolver ítems" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Se generará un acta de devolución en PDF con todos los ítems seleccionados.
          Debe imprimirse, firmarse por quien devuelve el equipo, y luego subirse
          (foto o escaneo) para confirmar que volvieron a su ubicación.
        </p>

        <div className="card">
          <b>Bombero:</b> {bombero?.nombre}
        </div>

        <div>
          <div className="label">Ítems a devolver ({seleccion.length})</div>
          {seleccion.length === 0 ? (
            <p className="muted">Aún no has seleccionado ítems.</p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {seleccion.map((it) => (
                <div key={it.id} className="card" style={{ padding: "8px 12px" }}>
                  <div className="spread">
                    <div>
                      <span className="item-code">{it.codigo}</span>
                      <span className="item-desc">{it.descripcion}</span>
                    </div>
                    <button className="btn-light" type="button" onClick={() => quitar(it.id)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {disponibles.length > 0 && (
          <div>
            <div className="label">Otros ítems asignados a {bombero?.nombre}</div>
            <div className="stack" style={{ gap: 4, maxHeight: 160, overflowY: "auto" }}>
              {disponibles.map((it) => (
                <div key={it.id} className="card clickable" style={{ padding: "6px 12px" }} onClick={() => agregar(it)}>
                  <span className="item-code">{it.codigo}</span>
                  <span className="item-desc">{it.descripcion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="label">
          Ubicación de destino
          <select className="input" value={ubicacionId}
            onChange={(e) => { setUbicacionId(e.target.value); setUbicacionDetalle(""); }}>
            <option value="">-- Selecciona --</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} {u.tipo ? `(${u.tipo})` : ""}</option>
            ))}
          </select>
        </label>

        {esCarro && (
          <label className="label">
            Gaveta / compartimiento (opcional)
            <input className="input" value={ubicacionDetalle} onChange={(e) => setUbicacionDetalle(e.target.value)}
              placeholder="Ej: Gaveta 3, compartimiento lateral" />
          </label>
        )}

        <label className="label">
          Observación
          <input className="input" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" />
        </label>

        <div className="row row--end">
          <button className="btn-light" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn" type="button" disabled={!puedeGenerar} onClick={handleGenerar}>
            {generando ? "Generando..." : "Generar acta de devolución"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
