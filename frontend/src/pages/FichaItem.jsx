import { useEffect } from "react";
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { obtenerItem, obtenerMovimientos, asignarItem, cambiarEstadoItem, moverItem, actualizarItem, eliminarItem, obtenerSubcategorias, obtenerMarcas, obtenerModelos } from "../api/items";
import CreatableSelect from "../components/CreatableSelect";
import { useDialog } from "../context/DialogContext";
import { listarBomberos } from "../api/bomberos";
import { listarUbicaciones } from "../api/ubicaciones";
import Modal from "../components/Modal";
import { obtenerControles, crearControl, completarControl } from "../api/controles";

export default function FichaItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useDialog();

  const [item, setItem] = useState(null);
  const [movs, setMovs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [bomberos, setBomberos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [openAsignar, setOpenAsignar] = useState(false);
  const [openMover, setOpenMover] = useState(false);
  const [openEstado, setOpenEstado] = useState(false);

  const [formAsignar, setFormAsignar] = useState({
    bombero_id: "",
    responsable: "",
    observacion: "",
  });
  const [formMover, setFormMover] = useState({
    ubicacion_id: "",
    responsable: "",
    observacion: "",
  });
  const [formEstado, setFormEstado] = useState({
    estado: "OPERATIVO",
    responsable: "",
    observacion: "",
  });

  const [guardando, setGuardando] = useState(false);

  const [openEditDatos, setOpenEditDatos] = useState(false);
  const [editDatos, setEditDatos] = useState(null);

  const [optsSubcat, setOptsSubcat] = useState([]);
  const [optsMarca, setOptsMarca]   = useState([]);
  const [optsModelo, setOptsModelo] = useState([]);

  useEffect(() => {
    obtenerMarcas().catch(() => []).then(setOptsMarca);
  }, []);

  const editCategoria = editDatos?.categoria;
  useEffect(() => {
    if (!editCategoria) return;
    obtenerSubcategorias(editCategoria).catch(() => []).then(setOptsSubcat);
  }, [editCategoria]);

  const editMarca = editDatos?.marca;
  useEffect(() => {
    obtenerModelos(editMarca ?? "").catch(() => []).then(setOptsModelo);
  }, [editMarca]);

  const [controles, setControles] = useState([]);
  const [openNuevoControl, setOpenNuevoControl] = useState(false);
  const [openCompletarControl, setOpenCompletarControl] = useState(false);
  const [controlSeleccionado, setControlSeleccionado] = useState(null);
  const [formControl, setFormControl] = useState({ tipo: "INSPECCION", fecha_objetivo: "", observacion: "" });
  const [formCompletar, setFormCompletar] = useState({ fecha_real: "", resultado: "APROBADO", observacion: "" });

  async function recargarFicha() {
    const [it, ms, cs] = await Promise.all([
      obtenerItem(id),
      obtenerMovimientos(id).catch(() => []),
      obtenerControles(id).catch(() => []),
    ]);
    setItem(it);
    setMovs(ms);
    setControles(cs);
  }

  useEffect(() => {
    let cancelado = false;

    async function run() {
      setError("");
      setCargando(true);

      try {
        const [it, ms, boms, ubs, cs] = await Promise.all([
          obtenerItem(id),
          obtenerMovimientos(id).catch(() => []),
          listarBomberos().catch(() => []),
          listarUbicaciones().catch(() => []),
          obtenerControles(id).catch(() => []),
        ]);

        if (!cancelado) {
          setItem(it);
          setMovs(ms);
          setBomberos(boms);
          setUbicaciones(ubs);
          setControles(cs);
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
        <p className="error">{error || "Item no encontrado"}</p>
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
        <button
          className="btn"
          onClick={() => {
            setOpenAsignar(true);
          }}
        >
          Asignar a bombero
        </button>
        <button
          className="btn"
          onClick={() => {
            setOpenMover(true);
          }}
        >
          Mover a ubicacion
        </button>
        <button
          className="btn"
          onClick={() => {
            setOpenEstado(true);
          }}
        >
          Cambiar Estado
        </button>

        <button
          className="btn-danger"
          onClick={async () => {
            if (!await confirm(`¿Eliminar "${item.codigo} - ${item.descripcion}"? Se borrarán también sus movimientos y controles. Esta acción no se puede deshacer.`)) return;
            try {
              await eliminarItem(id);
              navigate("/");
            } catch (e) {
              toast(e.message);
            }
          }}
        >
          Eliminar ítem
        </button>

        <button
          className="btn-light"
          onClick={() => {
            setEditDatos({
              codigo: item.codigo ?? "",
              categoria: item.categoria ?? "OTRO",
              subcategoria: item.subcategoria ?? "",
              descripcion: item.descripcion ?? "",
              marca: item.marca ?? "",
              modelo: item.modelo ?? "",
              serie: item.serie ?? "",
              criticidad: item.criticidad ?? "MEDIA",
            });
            setOpenEditDatos(true);
          }}
        >
          Editar datos
        </button>
      </div>


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
        {item.fecha_fabricacion && (
          <>
            <InfoRow label="Fabricación"       value={item.fecha_fabricacion} />
            <InfoRow label="Tiempo en servicio" value={tiempoEnServicio(item.fecha_fabricacion)} />
          </>
        )}
      </div>

      <h3 style={{ marginTop: 22 }}>Historial de movimientos</h3>

      {movs.length === 0 ? (
        <p className="muted">No hay movimientos registrados para este item.</p>
      ) : (
        <div className="stack">
          {movs.map((m) => (
            <div key={m.id} className="card">
              <div className="spread">
                <div className="card-title">{m.tipo}</div>
                <div className="muted">{m.fecha}</div>
              </div>
              <div className="card-detail">
                <div><b>Desde:</b> {m.desde ?? "-"}</div>
                <div><b>Hacia:</b> {m.hacia ?? "-"}</div>
                <div><b>Responsable:</b> {m.responsable ?? "-"}</div>
                {m.observacion ? <div><b>Obs:</b> {m.observacion}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECCIÓN CONTROLES */}
      <div className="spread" style={{ marginTop: 22 }}>
        <h3>Controles / Revisiones</h3>
        <button className="btn" onClick={() => {
          setFormControl({ tipo: "INSPECCION", fecha_objetivo: "", observacion: "" });
          setOpenNuevoControl(true);
        }}>
          + Agregar control
        </button>
      </div>

      {controles.length === 0 ? (
        <p className="muted">No hay controles registrados para este item.</p>
      ) : (
        <div className="stack">
          {controles.map((c) => {
            const vencido = !c.fecha_real && c.fecha_objetivo < new Date().toISOString().slice(0, 10);
            return (
              <div key={c.id} className={`card${vencido ? " card--vencido" : ""}`}>
                <div className="spread">
                  <div className="card-title">{c.tipo}</div>
                  <div className="muted">
                    {c.fecha_objetivo}
                    {vencido && <span className="badge-vencido">VENCIDO</span>}
                  </div>
                </div>
                <div className="card-detail">
                  <div>
                    <b>Resultado:</b>{" "}
                    <span className={c.resultado === "APROBADO" ? "resultado-aprobado" : c.resultado === "RECHAZADO" ? "resultado-rechazado" : "resultado-pendiente"}>
                      {c.resultado ?? "PENDIENTE"}
                    </span>
                  </div>
                  {c.fecha_real && <div><b>Realizado:</b> {c.fecha_real}</div>}
                  {c.observacion && <div><b>Obs:</b> {c.observacion}</div>}
                </div>
                {!c.fecha_real && (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn-light" onClick={() => {
                      setControlSeleccionado(c);
                      setFormCompletar({ fecha_real: "", resultado: "APROBADO", observacion: c.observacion ?? "" });
                      setOpenCompletarControl(true);
                    }}>
                      Registrar resultado
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NUEVO CONTROL */}
      <Modal open={openNuevoControl} title="Agregar control" onClose={() => setOpenNuevoControl(false)}>
        <div className="stack">
          <label className="label">
            Tipo
            <select className="input" value={formControl.tipo}
              onChange={(e) => setFormControl((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="INSPECCION">INSPECCION</option>
              <option value="MANTENCION">MANTENCION</option>
              <option value="CERTIFICACION">CERTIFICACION</option>
              <option value="OTRO">OTRO</option>
            </select>
          </label>
          <label className="label">
            Fecha objetivo
            <input type="date" className="input" value={formControl.fecha_objetivo}
              onChange={(e) => setFormControl((p) => ({ ...p, fecha_objetivo: e.target.value }))} />
          </label>
          <label className="label">
            Observación
            <input className="input" value={formControl.observacion}
              onChange={(e) => setFormControl((p) => ({ ...p, observacion: e.target.value }))}
              placeholder="Ej: Revisión anual EPP" />
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn-light" onClick={() => setOpenNuevoControl(false)}>Cancelar</button>
            <button className="btn" disabled={guardando || !formControl.fecha_objetivo}
              onClick={async () => {
                try {
                  setGuardando(true);
                  await crearControl(id, {
                    tipo: formControl.tipo,
                    fecha_objetivo: formControl.fecha_objetivo,
                    observacion: formControl.observacion || null,
                  });
                  await recargarFicha();
                  toast("Control agregado", "success");
                  setOpenNuevoControl(false);
                } catch (e) {
                  console.error(e);
                  toast("No se pudo agregar el control.");
                } finally {
                  setGuardando(false);
                }
              }}>
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL COMPLETAR CONTROL */}
      <Modal open={openCompletarControl} title="Registrar resultado" onClose={() => setOpenCompletarControl(false)}>
        <div className="stack">
          {controlSeleccionado && (
            <div className="muted" style={{ fontSize: 13 }}>
              {controlSeleccionado.tipo} — Fecha objetivo: {controlSeleccionado.fecha_objetivo}
            </div>
          )}
          <label className="label">
            Fecha realizado
            <input type="date" className="input" value={formCompletar.fecha_real}
              onChange={(e) => setFormCompletar((p) => ({ ...p, fecha_real: e.target.value }))} />
          </label>
          <label className="label">
            Resultado
            <select className="input" value={formCompletar.resultado}
              onChange={(e) => setFormCompletar((p) => ({ ...p, resultado: e.target.value }))}>
              <option value="APROBADO">APROBADO</option>
              <option value="RECHAZADO">RECHAZADO</option>
              <option value="PENDIENTE">PENDIENTE</option>
            </select>
          </label>
          <label className="label">
            Observación
            <input className="input" value={formCompletar.observacion}
              onChange={(e) => setFormCompletar((p) => ({ ...p, observacion: e.target.value }))}
              placeholder="Ej: Sin observaciones" />
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn-light" onClick={() => setOpenCompletarControl(false)}>Cancelar</button>
            <button className="btn" disabled={guardando || !formCompletar.fecha_real}
              onClick={async () => {
                try {
                  setGuardando(true);
                  await completarControl(controlSeleccionado.id, {
                    fecha_real: formCompletar.fecha_real,
                    resultado: formCompletar.resultado,
                    observacion: formCompletar.observacion || null,
                  });
                  await recargarFicha();
                  toast("Resultado registrado", "success");
                  setOpenCompletarControl(false);
                } catch (e) {
                  console.error(e);
                  toast("No se pudo registrar el resultado.");
                } finally {
                  setGuardando(false);
                }
              }}>
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL ASIGNAR */}
      <Modal
        open={openAsignar}
        title="Asignar a bombero"
        onClose={() => setOpenAsignar(false)}
      >
        <div className="stack">
          <label className="label">
            Bombero
            <select
              value={formAsignar.bombero_id}
              onChange={(e) =>
                setFormAsignar((p) => ({ ...p, bombero_id: e.target.value }))
              }
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
              onChange={(e) =>
                setFormAsignar((p) => ({ ...p, responsable: e.target.value }))
              }
              className="input"
              placeholder="Ej: Encargado Inventario"
            />
          </label>

          <label className="label">
            Observacion
            <input
              value={formAsignar.observacion}
              onChange={(e) =>
                setFormAsignar((p) => ({ ...p, observacion: e.target.value }))
              }
              className="input"
              placeholder="Ej: Entega EPP"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenAsignar(false)} className="btn-light">
              Cancelar
            </button>
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
                  toast("Asignado", "success");
                  setOpenAsignar(false);
                } catch (e) {
                  console.error(e);
                  toast("No se pudo asignar. Revisar Backend");
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
              onChange={(e) =>
                setFormMover((p) => ({ ...p, ubicacion_id: e.target.value }))
              }
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
              onChange={(e) =>
                setFormMover((p) => ({ ...p, responsable: e.target.value }))
              }
              className="input"
              placeholder="Ej: Encargado Trauma"
            />
          </label>

          <label>
            Observacion
            <input
              value={formMover.observacion}
              onChange={(e) =>
                setFormMover((p) => ({ ...p, observacion: e.target.value }))
              }
              className="input"
              placeholder="Ej: Se almacena en bodega"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenMover(false)} className="btn-light">
              Cancelar
            </button>
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
                  toast("Movido", "success");
                  setOpenMover(false);
                } catch (e) {
                  console.error(e);
                  toast("No se pudo mover. Revisar Backend");
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
              onChange={(e) =>
                setFormEstado((p) => ({ ...p, estado: e.target.value }))
              }
            >
              <option value="OPERATIVO">OPERATIVO</option>
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
              onChange={(e) =>
                setFormEstado((p) => ({ ...p, responsable: e.target.value }))
              }
              placeholder="Ej: Encargado Material Menor"
            />
          </label>

          <label className="label">
            Observacion
            <input
              className="input"
              value={formEstado.observacion}
              onChange={(e) =>
                setFormEstado((p) => ({ ...p, observacion: e.target.value }))
              }
              placeholder="Ej: Falla detectada en inspeccion"
            />
          </label>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => setOpenEstado(false)} className="btn-light">
              Cancelar
            </button>
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
                  toast("Estado Actualizado", "success");
                  setOpenEstado(false);
                } catch (e) {
                  console.error(e);
                  toast("No se pudo cambiar estado. Revisar Backend");
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

      <Modal
        open={openEditDatos}
        title="Editar datos del ítem"
        onClose={() => setOpenEditDatos(false)}
      >
        {editDatos ? (
          <div className="stack">
            <label className="label">
              Código
              <input
                className="input"
                value={editDatos.codigo}
                onChange={(e) =>
                  setEditDatos((p) => ({ ...p, codigo: e.target.value }))
                }
              />
            </label>

            <label className="label">
              Categoría
              <select
                className="input"
                value={editDatos.categoria}
                onChange={(e) =>
                  setEditDatos((p) => ({ ...p, categoria: e.target.value }))
                }
              >
                <option value="EPP">EPP</option>
                <option value="TRAUMA">TRAUMA</option>
                <option value="HERRAMIENTA">HERRAMIENTA</option>
                <option value="COMUNICACION">COMUNICACION</option>
                <option value="OTRO">OTRO</option>
              </select>
            </label>

            <label className="label">
              Subcategoría
              <CreatableSelect
                value={editDatos.subcategoria}
                onChange={(v) => setEditDatos((p) => ({ ...p, subcategoria: v }))}
                options={optsSubcat}
                placeholder={`Subcategorías de ${editDatos.categoria}`}
              />
            </label>

            <label className="label">
              Descripción
              <input
                className="input"
                value={editDatos.descripcion}
                onChange={(e) =>
                  setEditDatos((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </label>

            <label className="label">
              Marca
              <CreatableSelect
                value={editDatos.marca}
                onChange={(v) => setEditDatos((p) => ({ ...p, marca: v, modelo: "" }))}
                options={optsMarca}
                placeholder="Ej: 3M, MSA, Zoll"
              />
            </label>

            <label className="label">
              Modelo
              <CreatableSelect
                value={editDatos.modelo}
                onChange={(v) => setEditDatos((p) => ({ ...p, modelo: v }))}
                options={optsModelo}
                placeholder={editDatos.marca ? `Modelos de ${editDatos.marca}` : "Selecciona una marca primero"}
              />
            </label>

            <label className="label">
              Serie
              <input
                className="input"
                value={editDatos.serie}
                onChange={(e) =>
                  setEditDatos((p) => ({ ...p, serie: e.target.value }))
                }
              />
            </label>

            <label className="label">
              Criticidad
              <select
                className="input"
                value={editDatos.criticidad}
                onChange={(e) =>
                  setEditDatos((p) => ({ ...p, criticidad: e.target.value }))
                }
              >
                <option value="ALTA">ALTA</option>
                <option value="MEDIA">MEDIA</option>
                <option value="BAJA">BAJA</option>
              </select>
            </label>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn-light"
                onClick={() => setOpenEditDatos(false)}
              >
                Cancelar
              </button>

              <button
                className="btn"
                disabled={
                  guardando ||
                  !editDatos.codigo.trim() ||
                  !editDatos.descripcion.trim()
                }
                onClick={async () => {
                  try {
                    setGuardando(true);

                    await actualizarItem(id, {
                      codigo: editDatos.codigo.trim(),
                      categoria: editDatos.categoria,
                      subcategoria: editDatos.subcategoria.trim() || null,
                      descripcion: editDatos.descripcion.trim(),
                      marca: editDatos.marca.trim() || null,
                      modelo: editDatos.modelo.trim() || null,
                      serie: editDatos.serie.trim() || null,
                      criticidad: editDatos.criticidad,
                    });

                    await recargarFicha();
                    toast("Datos actualizados", "success");
                    setOpenEditDatos(false);
                  } catch (e) {
                    console.error(e);
                    toast("No se pudo actualizar el ítem.");
                  } finally {
                    setGuardando(false);
                  }
                }}
              >
                Guardar cambios
              </button>
            </div>

            <div className="muted">
              Nota: asignación, ubicación y estado se gestionan con los botones
              (para dejar registro en movimientos).
            </div>
          </div>
        ) : null}
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

function tiempoEnServicio(fechaStr) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const inicio = new Date(y, m - 1, d);
  const hoy    = new Date();
  let años  = hoy.getFullYear() - inicio.getFullYear();
  let meses = hoy.getMonth()    - inicio.getMonth();
  if (meses < 0) { años--; meses += 12; }
  const partes = [];
  if (años  > 0) partes.push(`${años} año${años  !== 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? "es" : ""}`);
  return partes.length ? partes.join(", ") : "Menos de 1 mes";
}
