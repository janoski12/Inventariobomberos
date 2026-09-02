import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { actualizarUbicacion, crearUbicacion, eliminarUbicacion, listarUbicaciones, descargarQR } from "../api/ubicaciones";
import Modal from "../components/Modal";
import { useDialog } from "../context/DialogContext";
import { useAuth } from "../context/AuthContext";

const TIPOS = ["BODEGA", "SALA", "SALON", "CONTAINER", "CARRO", "CASILLERO", "OTRO"];
const FORM_VACIO = { nombre: "", tipo: "BODEGA", responsable: "", activo: 1 };

function UbicacionCard({ ubicacion: u, esAdmin, deshabilitado, onQR, onEditar, onEliminar }) {
  return (
    <div className="card">
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
          <button className="btn-light" onClick={onQR}>QR</button>
          <button className="btn-light" onClick={onEditar}>Editar</button>
          {esAdmin && (
            <button className="btn-danger" disabled={deshabilitado} onClick={onEliminar}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Ubicaciones() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const { toast, confirm } = useDialog();
  const { esAdmin } = useAuth();
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit] = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try {
      setLista(await listarUbicaciones({ todas: true }));
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar ubicaciones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // Centraliza el ciclo guardando/errores de las acciones contra la API
  async function conGuardando(accion, mensajeError) {
    try {
      setGuardando(true);
      await accion();
    } catch (e) {
      console.error(e);
      toast(mensajeError);
    } finally {
      setGuardando(false);
    }
  }

  const campoForm = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));
  const campoEdit = (campo) => (e) => setEdit((p) => ({ ...p, [campo]: e.target.value }));

  function crear() {
    return conGuardando(async () => {
      await crearUbicacion({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        responsable: form.responsable.trim() || null,
        activo: form.activo,
      });
      setForm(FORM_VACIO);
      await cargar();
      toast("Ubicación creada", "success");
    }, "No se pudo crear ubicación (revisa backend).");
  }

  function abrirEdicion(u) {
    setEdit({
      id: u.id,
      nombre: u.nombre ?? "",
      tipo: u.tipo ?? "BODEGA",
      responsable: u.responsable ?? "",
      codigo_qr: u.codigo_qr ?? "",
      activo: u.activo ? 1 : 0,
    });
    setOpenEdit(true);
  }

  function guardarEdicion() {
    return conGuardando(async () => {
      await actualizarUbicacion(edit.id, {
        nombre: edit.nombre.trim(),
        tipo: edit.tipo,
        responsable: edit.responsable.trim() || null,
        activo: Number(edit.activo),
      });
      await cargar();
      setOpenEdit(false);
    }, "No se pudo actualizar ubicación.");
  }

  function eliminar(u) {
    return conGuardando(async () => {
      if (!(await confirm(`¿Eliminar "${u.nombre}"? Esta acción no se puede deshacer.`))) return;
      await eliminarUbicacion(u.id);
      await cargar();
    }, "No se pudo eliminar la ubicación.");
  }

  async function descargarQrClick(u) {
    try { await descargarQR(u.id, u.nombre, u.codigo_qr); }
    catch { toast("No se pudo descargar el QR."); }
  }

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
              onChange={campoForm("nombre")}
              placeholder="Ej: Sala Trauma / Bodega / B-10"
            />
          </label>

          <label className="label">
            Tipo
            <select className="input" value={form.tipo} onChange={campoForm("tipo")}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="label">
            Responsable
            <input className="input" value={form.responsable} onChange={campoForm("responsable")} />
          </label>

          <label className="label">
            Activo
            <select
              className="input"
              value={String(form.activo)}
              onChange={(e) => setForm((p) => ({ ...p, activo: Number(e.target.value) }))}
            >
              <option value="1">Sí</option>
              <option value="0">No</option>
            </select>
          </label>

        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          El código QR se genera automáticamente (formato UBIC-0001) al guardar.
        </p>

        <div className="row row--end" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!puedeGuardar || guardando} type="button" onClick={crear}>
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
          <UbicacionCard key={u.id} ubicacion={u} esAdmin={esAdmin} deshabilitado={guardando}
            onQR={() => descargarQrClick(u)} onEditar={() => abrirEdicion(u)} onEliminar={() => eliminar(u)} />
        ))}
      </div>

      {/* Modal editar */}
      <Modal open={openEdit} title="Editar ubicación" onClose={() => setOpenEdit(false)}>
        {edit ? (
          <div className="stack">
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre} onChange={campoEdit("nombre")} />
            </label>

            <label className="label">
              Tipo
              <select className="input" value={edit.tipo} onChange={campoEdit("tipo")}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="label">
              Responsable
              <input className="input" value={edit.responsable} onChange={campoEdit("responsable")} />
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

            <div className="row row--end">
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn" disabled={!edit.nombre.trim() || guardando} onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
