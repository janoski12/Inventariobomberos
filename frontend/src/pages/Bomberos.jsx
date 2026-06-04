import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { actualizarBombero, crearBombero, eliminarBombero, listarBomberos } from "../api/bomberos";
import Modal from "../components/Modal";
import { useDialog } from "../context/DialogContext";

const CARGOS = [
  "Comandante", "Director", "Capitan", "Secretario", "Prosecretario",
  "Tesorero", "Protesorero", "Teniente", "Teniente 2do", "Teniente 3ro",
  "Teniente 4to", "Ayudante", "Ayudante 2do", "Ayudante 3ro",
  "Jefe de Maquinas", "Conductor", "Honorario", "Voluntario",
];

const FORM_VACIO = { nombre: "", cargo: "", estado: "ACTIVO", observaciones: "", rut: "", numero_registro: "" };

export default function Bomberos() {
  const [lista, setLista]       = useState([]);
  const [error, setError]       = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const { toast, confirm } = useDialog();
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
            <input className="input" value={form.nombre}
              onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Juan Pérez" />
          </label>

          <label className="label">
            Cargo
            <select className="input" value={form.cargo}
              onChange={(e) => setForm(p => ({ ...p, cargo: e.target.value }))}>
              <option value="">— Sin cargo —</option>
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="label">
            RUT
            <input className="input" value={form.rut}
              onChange={(e) => setForm(p => ({ ...p, rut: e.target.value }))}
              placeholder="Ej: 12.345.678-9" />
          </label>

          <label className="label">
            N° de Registro
            <input className="input" value={form.numero_registro}
              onChange={(e) => setForm(p => ({ ...p, numero_registro: e.target.value }))}
              placeholder="Ej: 0042" />
          </label>

          <label className="label">
            Estado
            <select className="input" value={form.estado}
              onChange={(e) => setForm(p => ({ ...p, estado: e.target.value }))}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>

          <label className="label">
            Observaciones
            <input className="input" value={form.observaciones}
              onChange={(e) => setForm(p => ({ ...p, observaciones: e.target.value }))}
              placeholder="Opcional" />
          </label>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" disabled={!puedeGuardar || guardando} type="button"
            onClick={async () => {
              try {
                setGuardando(true);
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
              } catch (e) {
                toast(e.message);
              } finally {
                setGuardando(false);
              }
            }}>
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
          <div key={b.id} className="card">
            <div className="spread">
              <div>
                <div className="spread" style={{ gap: 10, justifyContent: "flex-start" }}>
                  <Link to={`/bomberos/${b.id}`} className="card-title bombero-link">
                    {b.nombre}
                  </Link>
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
                <button className="btn-light" onClick={() => {
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
                }}>
                  Editar
                </button>
                <button className="btn-danger" disabled={guardando}
                  onClick={async () => {
                    if (!await confirm(`¿Eliminar a ${b.nombre}? Esta acción no se puede deshacer.`)) return;
                    try {
                      setGuardando(true);
                      await eliminarBombero(b.id);
                      await cargar();
                    } catch (e) { toast(e.message); }
                    finally { setGuardando(false); }
                  }}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL EDITAR ── */}
      <Modal open={openEdit} title="Editar bombero" onClose={() => setOpenEdit(false)}>
        {edit && (
          <div className="stack">
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre}
                onChange={(e) => setEdit(p => ({ ...p, nombre: e.target.value }))} />
            </label>

            <label className="label">
              Cargo
              <select className="input" value={edit.cargo}
                onChange={(e) => setEdit(p => ({ ...p, cargo: e.target.value }))}>
                <option value="">— Sin cargo —</option>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <div className="grid-2">
              <label className="label">
                RUT
                <input className="input" value={edit.rut}
                  onChange={(e) => setEdit(p => ({ ...p, rut: e.target.value }))}
                  placeholder="Ej: 12.345.678-9" />
              </label>
              <label className="label">
                N° de Registro
                <input className="input" value={edit.numero_registro}
                  onChange={(e) => setEdit(p => ({ ...p, numero_registro: e.target.value }))}
                  placeholder="Ej: 0042" />
              </label>
            </div>

            <label className="label">
              Estado
              <select className="input" value={edit.estado}
                onChange={(e) => setEdit(p => ({ ...p, estado: e.target.value }))}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </label>

            <label className="label">
              Observaciones
              <input className="input" value={edit.observaciones}
                onChange={(e) => setEdit(p => ({ ...p, observaciones: e.target.value }))} />
            </label>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn" disabled={!edit.nombre.trim() || guardando}
                onClick={async () => {
                  try {
                    setGuardando(true);
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
                  } catch (e) { toast(e.message); }
                  finally { setGuardando(false); }
                }}>
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
