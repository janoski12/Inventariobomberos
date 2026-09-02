import { useEffect, useState } from "react";
import { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "../context/DialogContext";
import Modal from "../components/Modal";

const ROLES = ["ADMIN", "OPERADOR"];
const FORM_VACIO = { username: "", nombre: "", rol: "OPERADOR" };

function UsuarioCard({ usuario: u, esActual, deshabilitado, onEditar, onEliminar }) {
  return (
    <div className="card">
      <div className="spread">
        <div>
          <div className="spread" style={{ gap: 10, justifyContent: "flex-start" }}>
            <span className="card-title">{u.username}</span>
            <span className={u.rol === "ADMIN" ? "chip chip--alta" : "chip chip--baja-crit"}>{u.rol}</span>
            {!u.activo && <span className="chip chip--baja">INACTIVO</span>}
            {esActual && <span className="chip chip--media">tú</span>}
          </div>
          <div className="card-muted" style={{ marginTop: 4 }}>{u.nombre ?? "Sin nombre"}</div>
        </div>
        <div className="row">
          <button className="btn-light" onClick={onEditar}>Editar</button>
          <button className="btn-danger" disabled={deshabilitado || esActual} onClick={onEliminar}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

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
  // Contraseña temporal recien generada al crear un usuario, para mostrarla una sola vez
  const [tempInfo, setTempInfo] = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try { setLista(await listarUsuarios()); }
    catch { setError("No se pudieron cargar los usuarios."); }
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
    const username = form.username.trim();
    return conGuardando(async () => {
      const data = await crearUsuario({ username, nombre: form.nombre.trim() || null, rol: form.rol });
      setForm(FORM_VACIO);
      await cargar();
      setTempInfo({ username, password: data.password_temporal });
    });
  }

  function abrirEdicion(u) {
    setEdit({ id: u.id, username: u.username, nombre: u.nombre ?? "", rol: u.rol, activo: u.activo, password: "" });
    setOpenEdit(true);
  }

  function guardarEdicion() {
    return conGuardando(async () => {
      const payload = { nombre: edit.nombre.trim() || null, rol: edit.rol, activo: edit.activo };
      if (edit.password) payload.password = edit.password;
      await actualizarUsuario(edit.id, payload);
      await cargar();
      setOpenEdit(false);
      toast("Usuario actualizado", "success");
    });
  }

  function eliminar(u) {
    return conGuardando(async () => {
      if (!(await confirm(`¿Eliminar al usuario "${u.username}"?`))) return;
      await eliminarUsuario(u.id);
      await cargar();
    });
  }

  function copiarPasswordTemporal() {
    navigator.clipboard?.writeText(tempInfo.password).catch(() => {});
    toast("Copiada al portapapeles", "success");
  }

  const puedeGuardar = !!form.username.trim();

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
            <input className="input" value={form.username} onChange={campoForm("username")}
              placeholder="Ej: jperez" autoComplete="off" />
          </label>
          <label className="label">
            Nombre
            <input className="input" value={form.nombre} onChange={campoForm("nombre")}
              placeholder="Ej: Juan Pérez" />
          </label>
          <label className="label">
            Rol
            <select className="input" value={form.rol} onChange={campoForm("rol")}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          La contraseña la genera el sistema: se muestra una sola vez al crear la cuenta.
          Se le pedirá cambiarla obligatoriamente en su primer ingreso.
        </p>
        <div className="row row--end" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!puedeGuardar || guardando} onClick={crear}>
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
          <UsuarioCard key={u.id} usuario={u} esActual={u.id === actual.id} deshabilitado={guardando}
            onEditar={() => abrirEdicion(u)} onEliminar={() => eliminar(u)} />
        ))}
      </div>

      {/* ── MODAL EDITAR ── */}
      <Modal open={openEdit} title="Editar usuario" onClose={() => setOpenEdit(false)}>
        {edit && (
          <div className="stack">
            <p className="muted">Usuario: <strong>{edit.username}</strong></p>
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre} onChange={campoEdit("nombre")} />
            </label>
            <div className="grid-2">
              <label className="label">
                Rol
                <select className="input" value={edit.rol} onChange={campoEdit("rol")}>
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
              <input className="input" type="password" value={edit.password} onChange={campoEdit("password")}
                placeholder="Dejar vacío para no cambiar" autoComplete="new-password" />
            </label>
            {edit.password && (
              <p className="muted" style={{ marginTop: -6 }}>
                Se le pedirá cambiarla obligatoriamente en su próximo ingreso.
              </p>
            )}

            <div className="row row--end">
              <button className="btn-light" onClick={() => setOpenEdit(false)}>Cancelar</button>
              <button className="btn" disabled={guardando} onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── CONTRASEÑA TEMPORAL RECIEN GENERADA (se muestra una sola vez) ── */}
      <Modal open={!!tempInfo} title="Usuario creado" onClose={() => setTempInfo(null)}>
        {tempInfo && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Comparte esta contraseña temporal con <strong>{tempInfo.username}</strong>. No se
              volverá a mostrar. Se le pedirá cambiarla obligatoriamente en su primer ingreso.
            </p>
            <div className="inforow">
              <span className="inforow-label">Contraseña temporal</span>
              <span className="inforow-value" style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: 1 }}>
                {tempInfo.password}
              </span>
            </div>
            <div className="row row--end">
              <button className="btn-light" type="button" onClick={copiarPasswordTemporal}>Copiar</button>
              <button className="btn" type="button" onClick={() => setTempInfo(null)}>Listo</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
