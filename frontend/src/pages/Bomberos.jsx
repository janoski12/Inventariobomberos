import { useEffect, useState } from "react";
import { actualizarBombero, crearBombero, eliminarBombero, listarBomberos } from "../api/bomberos";
import Modal from "../components/Modal";

export default function Bomberos() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    grado: "",
    estado: "ACTIVO",
    observaciones: "",
  });
  
  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit] = useState(null);

  async function cargar() {
    setError("");
    setCargando(true);
    try {
      const data = await listarBomberos();
      setLista(data);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar bomberos.");
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
      <h2 style={{ marginTop: 0 }}>Bomberos</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agregar bombero</h3>

        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="label">
            Nombre
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Juan Pérez"
            />
          </label>

          <label className="label">
            Cargo
            <input
              className="input"
              value={form.cargo}
              onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
              placeholder="Ej: Teniente / Voluntario"
            />
          </label>

          <label className="label">
            Estado
            <select
              className="input"
              value={form.estado}
              onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}
            >
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </label>

          <label className="label">
            Observaciones
            <input
              className="input"
              value={form.observaciones}
              onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Opcional"
            />
          </label>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button
            className="btn"
            disabled={!puedeGuardar || guardando}
            type="button"
            onClick={async () => {
              try {
                setGuardando(true);
                await crearBombero({
                  nombre: form.nombre.trim(),
                  cargo: form.cargo.trim() || null,
                  estado: form.estado,
                  observaciones: form.observaciones.trim() || null,
                });

                setForm({ nombre: "", cargo: "", estado: "ACTIVO", observaciones: "" });
                await cargar();
                alert("Bombero creado ");
              } catch (e) {
                console.error(e);
                alert("No se pudo crear bombero (revisa backend).");
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          Tip: usa el nombre completo para evitar duplicados.
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Listado</h3>
      {cargando ? <p className="muted">Cargando…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="stack">
        {lista.map((b) => (
          <div key={b.id} className="card">
            <div className="spread">
              <div>
                <div className="card-title">{b.nombre}</div>
                <div className="card-muted" style={{ marginTop: 6 }}>
                  {b.cargo ? `Cargo: ${b.cargo}` : "Cargo: -"} • Estado: {b.estado ?? "-"}
                </div>
              </div>

              <div className="row">
                <button
                  className="btn-light"
                  onClick={() => {
                    setEdit({
                      id: b.id,
                      nombre: b.nombre ?? "",
                      cargo: b.cargo ?? "",
                      estado: b.estado ?? "ACTIVO",
                      observaciones: b.observaciones ?? "",
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
                    if (!window.confirm(`¿Eliminar a ${b.nombre}? Esta acción no se puede deshacer.`)) return;
                    try {
                      setGuardando(true);
                      await eliminarBombero(b.id);
                      await cargar();
                    } catch (e) {
                      alert(e.message);
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

      <Modal open={openEdit} title="Editar bombero" onClose={() => setOpenEdit(false)}>
        {edit ? (
          <div className="stack">
            <label className="label">
              Nombre
              <input className="input" value={edit.nombre}
                onChange={(e) => setEdit(p => ({ ...p, nombre: e.target.value }))} />
            </label>

            <label className="label">
              Grado
              <input className="input" value={edit.grado}
                onChange={(e) => setEdit(p => ({ ...p, grado: e.target.value }))} />
            </label>

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
              <button
                className="btn"
                disabled={!edit.nombre.trim() || guardando}
                onClick={async () => {
                  try {
                    setGuardando(true);
                    await actualizarBombero(edit.id, {
                      nombre: edit.nombre.trim(),
                      cargo: edit.cargo.trim() || null,
                      estado: edit.estado,
                      observaciones: edit.observaciones.trim() || null,
                    });
                    await cargar();
                    setOpenEdit(false);
                  } catch (e) {
                    console.error(e);
                    alert("No se pudo actualizar bombero.");
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