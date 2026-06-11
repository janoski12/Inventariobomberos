import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { actualizarUbicacion, crearUbicacion, eliminarUbicacion, listarUbicaciones, descargarQR } from "../api/ubicaciones";
import Modal from "../components/Modal";
import { useDialog } from "../context/DialogContext";

const TIPOS = ["BODEGA", "SALA", "SALON", "CONTAINER", "CARRO", "CASILLERO", "OTRO"];

export default function Ubicaciones() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "BODEGA",
    responsable: "",
    activo: 1,
  });

  const { toast, confirm } = useDialog();
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit] = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try {
      const data = await listarUbicaciones();
      setLista(data);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar ubicaciones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const puedeGuardar = form.nombre.trim().length > 0;

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Ubicaciones</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agregar ubicación</h3>

        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="label">
            Nombre
            <input
              className="input"
              value={form.nombre}
              onChange={(e) =>
                setForm((p) => ({ ...p, nombre: e.target.value }))
              }
              placeholder="Ej: Sala Trauma / Bodega / B-10"
            />
          </label>

          <label className="label">
            Tipo
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
            >
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="label">
            Responsable
            <input
              className="input"
              value={form.responsable}
              onChange={(e) =>
                setForm((p) => ({ ...p, responsable: e.target.value }))
              }
            />
          </label>

          <label className="label">
            Activo
            <select
              className="input"
              value={String(form.activo)}
              onChange={(e) =>
                setForm((p) => ({ ...p, activo: Number(e.target.value) }))
              }
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>

        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          El código QR se genera automáticamente (formato UBIC-0001) al guardar.
        </p>

        <div
          className="row"
          style={{ justifyContent: "flex-end", marginTop: 12 }}
        >
          <button
            className="btn"
            disabled={!puedeGuardar || guardando}
            type="button"
            onClick={async () => {
              try {
                setGuardando(true);
                await crearUbicacion({
                  nombre: form.nombre.trim(),
                  tipo: form.tipo,
                  responsable: form.responsable.trim() || null,
                  activo: form.activo,
                });

                setForm({
                  nombre: "",
                  tipo: "BODEGA",
                  responsable: "",
                  activo: 1,
                });
                await cargar();
                toast("Ubicación creada", "success");
              } catch (e) {
                console.error(e);
                toast("No se pudo crear ubicación (revisa backend).");
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar
          </button>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Tip: define nombres claros (ej: “Carro RX-1 – Gaveta 3”) para ubicar
          rápido.
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Listado</h3>
      {cargando ? <p className="muted">Cargando…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="stack">
        {lista.map((u) => (
          <div key={u.id} className="card">
            <div className="spread">
              <div>
                <div className="spread" style={{ gap: 10, justifyContent: "flex-start" }}>
                  <Link to={`/ubicaciones/${u.id}`} className="bombero-link">{u.nombre}</Link>
                  <span className={u.activo ? "chip chip--operativo" : "chip chip--baja"}>
                    {u.activo ? "ACTIVA" : "INACTIVA"}
                  </span>
                </div>
                <div className="card-muted" style={{ marginTop: 4 }}>
                  {u.tipo ?? "-"}
                  {u.responsable ? ` · Resp: ${u.responsable}` : ""}
                  {u.codigo_qr ? ` · QR: ${u.codigo_qr}` : ""}
                </div>
              </div>

              <div className="row">
                <button
                  className="btn-light"
                  onClick={async () => {
                    try { await descargarQR(u.id, u.nombre, u.codigo_qr); }
                    catch { toast("No se pudo descargar el QR."); }
                  }}
                >
                  QR
                </button>
                <button
                  className="btn-light"
                  onClick={() => {
                    setEdit({
                      id: u.id,
                      nombre: u.nombre ?? "",
                      tipo: u.tipo ?? "BODEGA",
                      responsable: u.responsable ?? "",
                      codigo_qr: u.codigo_qr ?? "",
                      activo: u.activo ? 1 : 0,
                    });
                    setOpenEdit(true);
                  }}
                >
                  Editar
                </button>
                <button
                  className="btn-danger"
                  disabled={guardando}
                  onClick={async () => {
                    if (!await confirm(`¿Eliminar "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
                    try {
                      setGuardando(true);
                      await eliminarUbicacion(u.id);
                      await cargar();
                    } catch (e) {
                      toast(e.message);
                    } finally {
                      setGuardando(false);
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      <Modal open={openEdit} title="Editar ubicación" onClose={() => setOpenEdit(false)}>
        {edit ? (
          <div className="stack">
            <label className="label">
              Nombre
              <input
                className="input"
                value={edit.nombre}
                onChange={(e) => setEdit((p) => ({ ...p, nombre: e.target.value }))}
              />
            </label>

            <label className="label">
              Tipo
              <select
                className="input"
                value={edit.tipo}
                onChange={(e) => setEdit((p) => ({ ...p, tipo: e.target.value }))}
              >
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="label">
              Responsable
              <input
                className="input"
                value={edit.responsable}
                onChange={(e) => setEdit((p) => ({ ...p, responsable: e.target.value }))}
              />
            </label>

            <label className="label">
              Activo
              <select
                className="input"
                value={String(edit.activo)}
                onChange={(e) => setEdit((p) => ({ ...p, activo: Number(e.target.value) }))}
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </label>

            {edit.codigo_qr && (
              <p className="muted">Código QR: {edit.codigo_qr} (generado automáticamente, no editable)</p>
            )}

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button
                className="btn"
                disabled={!edit.nombre.trim() || guardando}
                onClick={async () => {
                  try {
                    setGuardando(true);
                    await actualizarUbicacion(edit.id, {
                      nombre: edit.nombre.trim(),
                      tipo: edit.tipo,
                      responsable: edit.responsable.trim() || null,
                      activo: Number(edit.activo),
                    });
                    await cargar();
                    setOpenEdit(false);
                  } catch (e) {
                    console.error(e);
                    toast("No se pudo actualizar ubicación.");
                  } finally {
                    setGuardando(false);
                  }
                }}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}


