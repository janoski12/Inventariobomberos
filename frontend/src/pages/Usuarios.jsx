import { useEffect, useState } from "react";
import { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "../context/DialogContext";
import Modal from "../components/Modal";

const ROLES = ["ADMIN", "OPERADOR"];
const FORM_VACIO = { username: "", nombre: "", rol: "OPERADOR", password: "" };

export default function Usuarios() {
  const { usuario: actual } = useAuth();
  const { toast, confirm }  = useDialog();
  const [lista, setLista]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState("");
  const [guardando, setGuardando] = useState(false);
  const [form, setForm]         = useState(FORM_VACIO);
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit]         = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try { setLista(await listarUsuarios()); }
    catch { setError("No se pudieron cargar los usuarios."); }
    finally { setCargando(false); }
  }

  useEffect(() => { cargar(); }, []);

  const puedeGuardar = form.username.trim() && form.password.length >= 6;

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Usuarios</h2>
      <p className="muted">Gestión de cuentas de acceso al sistema. Solo administradores.</p>

      {/* ── NUEVO USUARIO ── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agregar usuario</h3>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="label">
            Usuario
            <input className="input" value={form.username}
              onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Ej: jperez" autoComplete="off" />
          </label>
          <label className="label">
            Nombre
            <input className="input" value={form.nombre}
              onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Juan Pérez" />
          </label>
          <label className="label">
            Rol
            <select className="input" value={form.rol}
              onChange={(e) => setForm(p => ({ ...p, rol: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="label">
            Contraseña
            <input className="input" type="password" value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" disabled={!puedeGuardar || guardando}
            onClick={async () => {
              try {
                setGuardando(true);
                await crearUsuario({
                  username: form.username.trim(),
                  nombre: form.nombre.trim() || null,
                  rol: form.rol,
                  password: form.password,
                });
                setForm(FORM_VACIO);
                await cargar();
                toast("Usuario creado", "success");
              } catch (e) { toast(e.message); }
              finally { setGuardando(false); }
            }}>
            Guardar
          </button>
        </div>
      </div>

      {/* ── LISTADO ── */}
      <h3 style={{ marginTop: 18 }}>Cuentas</h3>
      {cargando && <p className="muted">Cargando…</p>}
      {error    && <p className="error">{error}</p>}

      <div className="stack">
        {lista.map((u) => (
          <div key={u.id} className="card">
            <div className="spread">
              <div>
                <div className="spread" style={{ gap: 10, justifyContent: "flex-start" }}>
                  <span className="card-title">{u.username}</span>
                  <span className={u.rol === "ADMIN" ? "chip chip--alta" : "chip chip--baja-crit"}>{u.rol}</span>
                  {!u.activo && <span className="chip chip--baja">INACTIVO</span>}
                  {u.id === actual.id && <span className="chip chip--media">tú</span>}
                </div>
                <div className="card-muted" style={{ marginTop: 4 }}>
                  {u.nombre ?? "Sin nombre"}
                </div>
              </div>
              <div className="row">
                <button className="btn-light" onClick={() => {
                  setEdit({ id: u.id, username: u.username, nombre: u.nombre ?? "", rol: u.rol, activo: u.activo, password: "" });
                  setOpenEdit(true);
                }}>
                  Editar
                </button>
                <button className="btn-danger" disabled={guardando || u.id === actual.id}
                  onClick={async () => {
                    if (!await confirm(`¿Eliminar al usuario "${u.username}"?`)) return;
                    try { setGuardando(true); await eliminarUsuario(u.id); await cargar(); }
                    catch (e) { toast(e.message); }
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
      <Modal open={openEdit} title="Editar usuario" onClose={() => setOpenEdit(false)}>
        {edit && (
          <div className="stack">
            <p className="muted">Usuario: <strong>{edit.username}</strong></p>
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre}
                onChange={(e) => setEdit(p => ({ ...p, nombre: e.target.value }))} />
            </label>
            <div className="grid-2">
              <label className="label">
                Rol
                <select className="input" value={edit.rol}
                  onChange={(e) => setEdit(p => ({ ...p, rol: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="label">
                Estado
                <select className="input" value={edit.activo ? "1" : "0"}
                  onChange={(e) => setEdit(p => ({ ...p, activo: e.target.value === "1" }))}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
            </div>
            <label className="label">
              Nueva contraseña (opcional)
              <input className="input" type="password" value={edit.password}
                onChange={(e) => setEdit(p => ({ ...p, password: e.target.value }))}
                placeholder="Dejar vacío para no cambiar" autoComplete="new-password" />
            </label>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn" disabled={guardando}
                onClick={async () => {
                  try {
                    setGuardando(true);
                    const payload = { nombre: edit.nombre.trim() || null, rol: edit.rol, activo: edit.activo };
                    if (edit.password) payload.password = edit.password;
                    await actualizarUsuario(edit.id, payload);
                    await cargar();
                    setOpenEdit(false);
                    toast("Usuario actualizado", "success");
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
