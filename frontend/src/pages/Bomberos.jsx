import { useEffect, useState } from "react";
import { crearBombero, listarBomberos } from "../api/bomberos";

export default function Bomberos() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cargo: "",
    estado: "ACTIVO",
    observaciones: "",
  });

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
    <div className="containter">
      <h2 style={{ marginTop: 0 }}>Bomberos</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agregar bombero</h3>

        <div className="grid-2" style={{ marginTop: 10 }}>
          <label className="label">
            Nombre
            <input
              className="input"
              value={form.nombre}
              onChange={(e) =>
                setForm((p) => ({ ...p, nombre: e.target.value }))
              }
            />
          </label>

          <label className="label">
            Cargo
            <input
              className="input"
              value={form.cargo}
              onChange={(e) =>
                setForm((p) => ({ ...p, cargo: e.target.value }))
              }
              placeholder="Ej: Teniente / Voluntario"
            />
          </label>

          <label className="label">
            Estado
            <select
              className="input"
              value={form.estado}
              onChange={(e) =>
                setForm((p) => ({ ...p, estado: e.target.value }))
              }
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
              onChange={(e) =>
                setForm((p) => ({ ...p, observaciones: e.target.value }))
              }
              placeholder="OPCIONAL"
            />
          </label>
        </div>

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
                await crearBombero({
                  nombre: form.nombre.trim(),
                  cargo: form.cargo.trim() || null,
                  estado: form.estado,
                  obsevaciones: form.observaciones.trim() || null,
                });

                setForm({
                  nombre: "",
                  cargo: "",
                  estado: "ACTIVO",
                  observaciones: "",
                });
                await cargar();
                alert("Bombero Creado");
              } catch (e) {
                console.error(e);
                alert("No se pudo crear bombero (revisar backend).");
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          Tip: usa el nombre completo para evitar duplicados
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Listado</h3>
      {cargando ? <p className="muted">Cargando...</p> : null}
      {error ? <p className="error">{error}</p> : error}

      <div className="stack">
        {lista.map((b) => (
            <div key={b.id} className="card clickable">
                <div className="spread">
                    <div className="card-title">{b.nombre}</div>
                    <div className="muted">{b.estado ?? "-"}</div>
                </div>
                <div className="card-muted" style={{ marginTop: 6 }}>
                    {b.cargo ? `Cargo: ${b.cargo}` : "Cargo: -"}
                    {b.observaciones ? ` Obs: ${b.observaciones}` : ""}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}

