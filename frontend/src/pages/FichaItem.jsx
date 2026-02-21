import { useEffect } from "react";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { obtenerItem, obtenerMovimientos } from "../api/itemDetalle";
import { listarBomberos } from "../api/bomberos";
import { listarUbicaciones } from "../api/ubicaciones";
import Modal from "../components/Modal";
import { asignarItem, cambiarEstadoItem, moverItem } from "../api/accionesItem";

export default function FichaItem() {
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [movs, setMovs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [bomberos, setBomberos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [openAsignar, setOpenAsignar] = useState(false);
  const [openMover, setOpenMover] = useState(false);
  const [openEstado, setOpenEstado] = useState(false);

  const [formAsignar, setFormAsignar] = useState({ bombero_id: "", responsable: "", observacion: "" });
  const [formMover, setFormMover] = useState({ ubicacion_id: "", responsable: "", observacion: "" });
  const [formEstado, setFormEstado] = useState({ estado: "OPERATIVO", responsable: "", observacion: "" });

  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");

  async function recargarFicha() {
    const [it, ms] = await Promise.all([
      obtenerItem(id),
      obtenerMovimientos(id).catch(() => []),
    ]);
    setItem(it);
    setMovs(ms);
  }

  useEffect(() => {
    let cancelado = false;

    async function run() {
      setError("");
      setCargando(true);

      try{
        const [it, ms, boms, ubs] = await Promise.all([
          obtenerItem(id),
          obtenerMovimientos(id).catch(() => []),
          listarBomberos().catch(() => []),
          listarUbicaciones().catch(() => []),
        ]);

        if (!cancelado) {
          setItem(it);
          setMovs(ms),
          setBomberos(boms);
          setUbicaciones(ubs);
        }
      } catch (e) {
        console.error(e);
        if (!cancelado) setError("No se pudo cargar la ficha del item.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    run();
    return () => (cancelado = true);
  }, [id]);

  function toast(texto) {
    setMsg(texto);
    setTimeout(() => setMsg(""), 2500);
  }

  if (cargando) {
    return (
      <div className="container">
        <Link to="/" style={{ textDecoration: "none" }}>
          Volver
        </Link>
        <p>Cargando...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container">
        <Link to="/" style={{ textDecoration: "none" }}>
          Volver
        </Link>
        <p style={{ color: "#b00020" }}>{error || "Item no encontrado"}</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Link to="/" style={{ textDecoration: "none" }}>
        Volver
      </Link>

      <h2 style={{ marginTop: 10 }}>
        {item.codigo} - {item.descripcion}
      </h2>

      {/* BARRA DE ACCIONES */}
      <div className="row">
        <button className="btn" onClick={() => { setOpenAsignar(true); }}>
          Asignar a bombero
        </button>
        <button className="btn" onClick={() => { setOpenMover(true); }}>
          Mover a ubicacion
        </button>
        <button className="btn" onClick={() => { setOpenEstado(true); }}>
          Cambiar Estado
        </button>
      </div>

      {msg && (
        <div className="muted" style={{ marginTop: 10 }}>
          {msg}
        </div>
      )}

      <div className="stack" style={{ marginTop: 10 }}>
        <InfoRow label="Categoria" value={item.categoria} />
        <InfoRow label="Estado" value={item.estado} />
        <InfoRow label="Criticidad" value={item.criticidad} />
        <InfoRow label="Asignado a" value={item.bombero_nombre ?? "-"} />
        <InfoRow
          label="Ubicacion actual"
          value={item.ubicacion_nombre ?? "-"}
        />
        <InfoRow
          label="Marca/Modelo"
          value={`${item.marca ?? "-"} / ${item.modelo ?? "-"}`}
        />
        <InfoRow label="Serie" value={item.serie ?? "-"} />
      </div>

      <h3 style={{ marginTop: 22 }}>Historial de movimientos</h3>

      {movs.length === 0 ? (
        <p className="muted">
          No hay movimientos registrados para este item.
        </p>
      ) : (
        <div className="stack">
          {movs.map((m) => (
            <div
              key={m.id}
              className="card"
            >
              <div className="spread">
                <div className="card-title">{m.tipo}</div>
                <div className="muted">{m.fecha}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#444" }}>
                <div>
                  <b>Desde:</b> {m.desde ?? "-"}
                </div>
                <div>
                  <b>Hacia:</b> {m.hacia ?? "-"}
                </div>
                <div>
                  <b>Responsable:</b> {m.responsable ?? "-"}
                </div>
                {m.observacion ? (
                  <div>
                    <b>Obs:</b> {m.observacion}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL ASIGNAR */}
      <Modal
        open={openAsignar}
        title= "Asignar a bombero"
        onClose={() => setOpenAsignar(false)}
      >
        <div className="stack">
          <label className="label">
            Bombero
            <select
              value={formAsignar.bombero_id}
              onChange={(e) => setFormAsignar((p) => ({ ...p, bombero_id: e.target.value }))}
              className="input"
            >
              <option value="">-- Selecciona --</option>
              {bomberos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} {b.cargo ? `(${b.cargo})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            Responsable
            <input
              value={formAsignar.responsable}
              onChange={(e) => setFormAsignar((p) => ({ ...p, responsable: e.target.value }))}
              className="input"
              placeholder="Ej: Encargado Inventario"
            />
          </label>

          <label className="label">
            Observacion
            <input
              value={formAsignar.observacion}
              onChange={(e) => setFormAsignar((p) => ({ ...p, observacion: e.target.value }))}
              className="input"
              placeholder="Ej: Entega EPP"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenAsignar(false)} className="btn-light">Cancelar</button>
            <button
              disabled={guardando || !formAsignar.bombero_id}
              className="btn"
              onClick={async () => {
                try {
                  setGuardando(true);
                  await asignarItem(id, {
                    bombero_id: Number(formAsignar.bombero_id),
                    responsable: formAsignar.responsable || "Sistema",
                    observacion: formAsignar.observacion || null,
                  });
                  await recargarFicha();
                  toast("Asignado");
                  setOpenAsignar(false);
                } catch (e) {
                  console.error(e);
                  alert("No se pudo asignar. Revisar Backend");
                } finally {
                  setGuardando(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL MOVER */}
      <Modal
        open={openMover}
        title="Mover a ubicacion"
        onClose={() => setOpenMover(false)}
      >
        <div className="stack">
          <label className="label"> 
            Ubicacion
            <select
              value={formMover.ubicacion_id}
              onChange={(e) => setFormMover((p) => ({ ...p, ubicacion_id: e.target.value }))}
              className="input"
            >
              <option value="">-- Seleciona --</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.tipo ? `(${u.tipo})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Responsable
            <input
              value={formMover.responsable}
              onChange={(e) => setFormMover((p) => ({ ...p, responsable: e.target.value }))}
              className="input"
              placeholder="Ej: Encargado Trauma"
            />
          </label>

          <label>
            Observacion
            <input
              value={formMover.observacion}
              onChange={(e) => setFormMover((p) => ({ ...p, observacion: e.target.value }))}
              className="input"
              placeholder="Ej: Se almacena en bodega"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenMover(false)} className="btn-light">Cancelar</button>
            <button
              className="btn"
              disabled={guardando || !formMover.ubicacion_id}
              onClick={async () => {
                try {
                  setGuardando(true);
                  await moverItem(id, {
                    ubicacion_id: Number(formMover.ubicacion_id),
                    responsable: formMover.responsable || "Sistema",
                    observacion: formMover.observacion || null,
                  });
                  await recargarFicha();
                  toast("Movido");
                  setOpenMover(false);
                } catch (e) {
                  console.error(e);
                  alert("No se pudo mover. Revisar Backend");
                } finally {
                  setGuardando(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>


      {/* MODAL ESTADO */}
      <Modal
        open={openEstado}
        title="Cambiar estado"
        onClose={() => setOpenEstado(false)}
      >
        <div className="stack">
          <label className="label">
            Estado
            <select
              className="input"
              value={formEstado.estado}
              onChange={(e) => setFormEstado((p) => ({ ...p, estado: e.target.value }))}
            >
              <option value="OPERTATIVO">OPERATIVO</option>
              <option value="MANTENCION">MANTENCION</option>
              <option value="FUERA_SERVICIO">FUERA_SERVICIO</option>
              <option value="BAJA">BAJA</option>
            </select>
          </label>

          <label className="label">
            Responsable
            <input
              className="input"
              value={formEstado.responsable}
              onChange={(e) => setFormEstado((p) => ({ ...p, responsable: e.target.value }))}
              placeholder="Ej: Encargado Material Menor"
            />
          </label>

          <label className="label">
            Observacion
            <input
              className="input"
              value={formEstado.observacion}
              onChange={(e) => setFormEstado((p) => ({ ...p, observacion: e.target.value }))}
              placeholder="Ej: Falla detectada en inspeccion"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenEstado(false)} className="btn-light">Cancelar</button>
            <button
              className="btn"
              disabled={guardando}
              onClick={async () => {
                try {
                  setGuardando(true);
                  await cambiarEstadoItem(id, {
                    estado: formEstado.estado,
                    responsable: formEstado.responsable || "Sistema",
                    observacion: formEstado.observacion || null,
                  });
                  await recargarFicha();
                  toast("Estado Actualizado");
                  setOpenEstado(false);
                } catch (e) {
                  console.error(e);
                  alert("No se pudo cambiar estado. Revisar Backend");
                } finally {
                  setGuardando(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="inforow">
      <div className="inforow-label">{label}</div>
      <div className="inforow-value">{value}</div>
    </div>
  );
}
