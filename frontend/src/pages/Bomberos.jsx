import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { actualizarBombero, crearBombero, eliminarBombero, listarBomberos } from "../api/bomberos";
import Modal from "../components/Modal";
import { useDialog } from "../context/DialogContext";
import { useAuth } from "../context/AuthContext";

const CARGOS = [
  "Comandante", "Director", "Capitan", "Secretario", "Prosecretario",
  "Tesorero", "Protesorero", "Teniente", "Teniente 2do", "Teniente 3ro",
  "Teniente 4to", "Ayudante", "Ayudante 2do", "Ayudante 3ro",
  "Jefe de Maquinas", "Conductor", "Honorario", "Voluntario",
];

const FORM_VACIO = { nombre: "", cargo: "", estado: "ACTIVO", observaciones: "", rut: "", numero_registro: "" };

function CampoCargo({ value, onChange }) {
  return (
    <select className="input" value={value} onChange={onChange}>
      <option value="">— Sin cargo —</option>
      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function BomberoCard({ bombero: b, esAdmin, deshabilitado, onEditar, onEliminar }) {
  return (
    <div className="card">
      <div className="spread">
        <div>
          <div className="spread" style={{ gap: 10, justifyContent: "flex-start" }}>
            <Link to={`/bomberos/${b.id}`} className="card-title bombero-link">{b.nombre}</Link>
            <span className={b.estado === "ACTIVO" ? "chip chip--operativo" : "chip chip--baja"}>
              {b.estado ?? "ACTIVO"}
            </span>
          </div>
          <div className="card-muted" style={{ marginTop: 4 }}>
            {b.cargo ?? "Sin cargo"}
            {b.rut             ? ` · RUT: ${b.rut}` : ""}
            {b.numero_registro ? ` · Reg: ${b.numero_registro}` : ""}
          </div>
        </div>

        <div className="row">
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

export default function Bomberos() {
  const [lista, setLista]       = useState([]);
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const { toast, confirm } = useDialog();
  const { esAdmin } = useAuth();
  const [form, setForm]         = useState(FORM_VACIO);
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit]         = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try { setLista(await listarBomberos()); }
    catch { setError("No se pudieron cargar bomberos."); }
    finally { setCargando(false); }
  }

  useEffect(() => { cargar(); }, []);

  // Centraliza el ciclo guardando/errores de las acciones contra la API
  async function conGuardando(accion) {
    try {
      setGuardando(true);
      await accion();
    } catch (e) {
      toast(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const campoForm = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));
  const campoEdit = (campo) => (e) => setEdit((p) => ({ ...p, [campo]: e.target.value }));

  function crear() {
    return conGuardando(async () => {
      await crearBombero({
        nombre:           form.nombre.trim(),
        cargo:            form.cargo || null,
        estado:           form.estado,
        observaciones:    form.observaciones.trim() || null,
        rut:              form.rut.trim() || null,
        numero_registro:  form.numero_registro.trim() || null,
      });
      setForm(FORM_VACIO);
      await cargar();
    });
  }

  function abrirEdicion(b) {
    setEdit({
      id:               b.id,
      nombre:           b.nombre ?? "",
      cargo:            b.cargo ?? "",
      estado:           (b.estado ?? "ACTIVO").toUpperCase(),
      observaciones:    b.observaciones ?? "",
      rut:              b.rut ?? "",
      numero_registro:  b.numero_registro ?? "",
    });
    setOpenEdit(true);
  }

  function guardarEdicion() {
    return conGuardando(async () => {
      await actualizarBombero(edit.id, {
        nombre:          edit.nombre.trim(),
        cargo:           edit.cargo || null,
        estado:          edit.estado,
        observaciones:   edit.observaciones.trim() || null,
        rut:             edit.rut.trim() || null,
        numero_registro: edit.numero_registro.trim() || null,
      });
      await cargar();
      setOpenEdit(false);
    });
  }

  function eliminar(b) {
    return conGuardando(async () => {
      if (!(await confirm(`¿Eliminar a ${b.nombre}? Esta acción no se puede deshacer.`))) return;
      await eliminarBombero(b.id);
      await cargar();
    });
  }

  const puedeGuardar = form.nombre.trim().length > 0;

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Bomberos</h2>

      {/* ── FORMULARIO NUEVO ── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agregar bombero</h3>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="label">
            Nombre
            <input className="input" value={form.nombre} onChange={campoForm("nombre")}
              placeholder="Ej: Juan Pérez" />
          </label>

          <label className="label">
            Cargo
            <CampoCargo value={form.cargo} onChange={campoForm("cargo")} />
          </label>

          <label className="label">
            RUT
            <input className="input" value={form.rut} onChange={campoForm("rut")}
              placeholder="Ej: 12.345.678-9" />
          </label>

          <label className="label">
            N° de Registro
            <input className="input" value={form.numero_registro} onChange={campoForm("numero_registro")}
              placeholder="Ej: 0042" />
          </label>

          <label className="label">
            Estado
            <select className="input" value={form.estado} onChange={campoForm("estado")}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>

          <label className="label">
            Observaciones
            <input className="input" value={form.observaciones} onChange={campoForm("observaciones")}
              placeholder="Opcional" />
          </label>
        </div>

        <div className="row row--end" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!puedeGuardar || guardando} type="button" onClick={crear}>
            Guardar
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>RUT y N° de registro deben ser únicos.</p>
      </div>

      {/* ── LISTADO ── */}
      <h3 style={{ marginTop: 18 }}>Listado</h3>
      {cargando && <p className="muted">Cargando…</p>}
      {error    && <p className="error">{error}</p>}

      <div className="stack">
        {lista.map((b) => (
          <BomberoCard key={b.id} bombero={b} esAdmin={esAdmin} deshabilitado={guardando}
            onEditar={() => abrirEdicion(b)} onEliminar={() => eliminar(b)} />
        ))}
      </div>

      {/* ── MODAL EDITAR ── */}
      <Modal open={openEdit} title="Editar bombero" onClose={() => setOpenEdit(false)}>
        {edit && (
          <div className="stack">
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre} onChange={campoEdit("nombre")} />
            </label>

            <label className="label">
              Cargo
              <CampoCargo value={edit.cargo} onChange={campoEdit("cargo")} />
            </label>

            <div className="grid-2">
              <label className="label">
                RUT
                <input className="input" value={edit.rut} onChange={campoEdit("rut")}
                  placeholder="Ej: 12.345.678-9" />
              </label>
              <label className="label">
                N° de Registro
                <input className="input" value={edit.numero_registro} onChange={campoEdit("numero_registro")}
                  placeholder="Ej: 0042" />
              </label>
            </div>

            <label className="label">
              Estado
              <select className="input" value={edit.estado} onChange={campoEdit("estado")}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </label>

            <label className="label">
              Observaciones
              <input className="input" value={edit.observaciones} onChange={campoEdit("observaciones")} />
            </label>

            <div className="row row--end">
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn" disabled={!edit.nombre.trim() || guardando} onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
