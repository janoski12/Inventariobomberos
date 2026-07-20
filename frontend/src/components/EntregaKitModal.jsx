import { useEffect, useState } from "react";
import Modal from "./Modal";
import { listarBomberos } from "../api/bomberos";
import { buscarItems } from "../api/items";
import { solicitarActaEntrega, abrirDocumento } from "../api/actas";
import { useDialog } from "../context/DialogContext";

// Modal reutilizable para entregar uno o varios items a un bombero de una sola
// vez (kit de EPP): genera el acta de recepción con todos los items en la tabla.
//
// - bomberoFijo: { id, nombre } — si se da, el bombero queda fijo (ej. desde la
//   ficha del bombero); si no, se muestra un selector.
// - itemFijo: { id, codigo, descripcion, marca } — item precargado en la
//   selección (ej. desde la ficha de un item), removible igual que el resto.
export default function EntregaKitModal({ open, onClose, bomberoFijo, itemFijo, onDone }) {
  const { toast } = useDialog();

  const [bomberos, setBomberos] = useState([]);
  const [bomberoId, setBomberoId] = useState("");
  const [seleccion, setSeleccion] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [observacion, setObservacion] = useState("");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBomberoId(bomberoFijo?.id ? String(bomberoFijo.id) : "");
    setSeleccion(itemFijo ? [itemFijo] : []);
    setBusqueda("");
    setResultados([]);
    setObservacion("");
    if (!bomberoFijo) listarBomberos().catch(() => []).then(setBomberos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !busqueda.trim()) { setResultados([]); return; }
    let cancelado = false;
    const t = setTimeout(() => {
      buscarItems({ q: busqueda }).then((data) => {
        if (cancelado) return;
        const idsSeleccionados = new Set(seleccion.map((i) => i.id));
        setResultados(data.filter((i) => !idsSeleccionados.has(i.id)));
      }).catch(() => {});
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [busqueda, open, seleccion]);

  function agregar(item) {
    setSeleccion((p) => [...p, item]);
    setResultados((p) => p.filter((i) => i.id !== item.id));
  }

  function quitar(id) {
    setSeleccion((p) => p.filter((i) => i.id !== id));
  }

  const puedeGenerar = bomberoId && seleccion.length > 0 && !generando;

  async function handleGenerar() {
    try {
      setGenerando(true);
      const { id } = await solicitarActaEntrega({
        bombero_id: Number(bomberoId),
        item_ids: seleccion.map((i) => i.id),
        observacion: observacion.trim() || null,
      });
      onClose();
      toast("Acta generada. Imprímela, fírmala y súbela para confirmar la entrega.", "success");
      await abrirDocumento(id);
      onDone?.();
    } catch (e) {
      toast(e.message || "No se pudo generar el acta de entrega.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Modal open={open} title="Entregar ítems a bombero" onClose={onClose}>
      <div className="stack">
        <p className="muted">
          Se generará un acta de entrega en PDF con todos los ítems seleccionados.
          Debe imprimirse, firmarse por quien recibe el equipo, y luego subirse
          (foto o escaneo) para confirmar la entrega de todo el kit.
        </p>

        {bomberoFijo ? (
          <div className="card">
            <b>Bombero:</b> {bomberoFijo.nombre}
          </div>
        ) : (
          <label className="label">
            Bombero
            <select className="input" value={bomberoId} onChange={(e) => setBomberoId(e.target.value)}>
              <option value="">-- Selecciona --</option>
              {bomberos.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre} {b.cargo ? `(${b.cargo})` : ""}</option>
              ))}
            </select>
          </label>
        )}

        <div>
          <div className="label">Ítems a entregar ({seleccion.length})</div>
          {seleccion.length === 0 ? (
            <p className="muted">Aún no has agregado ítems.</p>
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

        <label className="label">
          Agregar ítem
          <input
            className="input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o descripción..."
          />
        </label>

        {resultados.length > 0 && (
          <div className="stack" style={{ gap: 4, maxHeight: 200, overflowY: "auto" }}>
            {resultados.map((it) => (
              <div key={it.id} className="card clickable" style={{ padding: "6px 12px" }} onClick={() => agregar(it)}>
                <span className="item-code">{it.codigo}</span>
                <span className="item-desc">{it.descripcion}</span>
                {(it.bombero_nombre || it.ubicacion_nombre) && (
                  <span className="item-tipo"> · actualmente: {it.bombero_nombre ?? it.ubicacion_nombre}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <label className="label">
          Observación
          <input
            className="input"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn-light" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn" type="button" disabled={!puedeGenerar} onClick={handleGenerar}>
            {generando ? "Generando..." : "Generar acta de entrega"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
