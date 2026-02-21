import { useEffect, useState } from "react";
import { crearUbicacion, listarUbicaciones } from "../api/ubicaciones";

export default function Ubicaciones() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "BODEGA",
    responsable: "",
    codigo_qr: "",
    activo: 1,
  });

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
              <option value="BODEGA">BODEGA</option>
              <option value="SALA">SALA</option>
              <option value="CARRO">CARRO</option>
              <option value="CASILLERO">CASILLERO</option>
              <option value="OTRO">OTRO</option>
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

          <label className="label" style={{ gridColumn: "1 / -1" }}>
            Código QR (opcional)
            <input
              className="input"
              value={form.codigo_qr}
              onChange={(e) =>
                setForm((p) => ({ ...p, codigo_qr: e.target.value }))
              }
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
                await crearUbicacion({
                  nombre: form.nombre.trim(),
                  tipo: form.tipo,
                  responsable: form.responsable.trim() || null,
                  codigo_qr: form.codigo_qr.trim() || null,
                  activo: form.activo,
                });

                setForm({
                  nombre: "",
                  tipo: "BODEGA",
                  responsable: "",
                  codigo_qr: "",
                  activo: 1,
                });
                await cargar();
                alert("Ubicación creada");
              } catch (e) {
                console.error(e);
                alert("No se pudo crear ubicación (revisa backend).");
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
          <div key={u.id} className="card clickable">
            <div className="spread">
              <div className="card-title">{u.nombre}</div>
              <div className="muted">{u.tipo ?? "-"}</div>
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Activo: {u.activo ? "Si" : "No"}
              {u.responsable ? ` • Responsable: ${u.responsable}` : ""}
              {u.codigo_qr ? `QR: ${u.codigo_qr}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


