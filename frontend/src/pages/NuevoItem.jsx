import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { crearItem } from "../api/itemsCrud";
import { listarBomberos } from "../api/bomberos";
import { listarUbicaciones } from "../api/ubicaciones";

export default function NuevoItem() {
  const navigate = useNavigate();

  const [bomberos, setBomberos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    codigo: "",
    categoria: "EPP",
    subcategoria: "",
    descripcion: "",
    marca: "",
    modelo: "",
    serie: "",
    estado: "OPERATIVO",
    criticidad: "ALTA",
    modo: "ASIGNAR", // ASIGNAR o UBICAR
    bombero_id: "",
    ubicacion_id: "",
  });

  useEffect(() => {
    (async () => {
      const [b, u] = await Promise.all([
        listarBomberos().catch(() => []),
        listarUbicaciones().catch(() => []),
      ]);
      setBomberos(b);
      setUbicaciones(u);
    })();
  }, []);

  const puedeGuardar =
    form.codigo.trim() &&
    form.descripcion.trim() &&
    ((form.modo === "ASIGNAR" && form.bombero_id) ||
      (form.modo === "UBICAR" && form.ubicacion_id));

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Nuevo ítem</h2>

      <div className="card">
        <div className="grid-2">
          <label className="label">
            Código
            <input
              className="input"
              value={form.codigo}
              onChange={(e) =>
                setForm((p) => ({ ...p, codigo: e.target.value }))
              }
              placeholder="Ej: EPP-0001"
            />
          </label>

          <label className="label">
            Categoría
            <select
              className="input"
              value={form.categoria}
              onChange={(e) =>
                setForm((p) => ({ ...p, categoria: e.target.value }))
              }
            >
              <option value="EPP">EPP</option>
              <option value="TRAUMA">TRAUMA</option>
              <option value="HERRAMIENTA">HERRAMIENTA</option>
              <option value="COMUNICACION">COMUNICACION</option>
              <option value="OTRO">OTRO</option>
            </select>
          </label>

          <label className="label" style={{ gridColumn: "1 / -1" }}>
            Descripción
            <input
              className="input"
              value={form.descripcion}
              onChange={(e) =>
                setForm((p) => ({ ...p, descripcion: e.target.value }))
              }
              placeholder="Ej: Casco Estructural"
            />
          </label>

          <label className="label">
            Subcategoría
            <input
              className="input"
              value={form.subcategoria}
              onChange={(e) =>
                setForm((p) => ({ ...p, subcategoria: e.target.value }))
              }
              placeholder="Ej: Casco / Guantes / Chaqueta "
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
              <option value="OPERATIVO">OPERATIVO</option>
              <option value="MANTENCION">MANTENCION</option>
              <option value="FUERA_SERVICIO">FUERA_SERVICIO</option>
              <option value="BAJA">BAJA</option>
            </select>
          </label>

          <label className="label">
            Criticidad
            <select
              className="input"
              value={form.criticidad}
              onChange={(e) =>
                setForm((p) => ({ ...p, criticidad: e.target.value }))
              }
            >
              <option value="ALTA">ALTA</option>
              <option value="MEDIA">MEDIA</option>
              <option value="BAJA">BAJA</option>
            </select>
          </label>

          <label className="label">
            Marca
            <input
              className="input"
              value={form.marca}
              onChange={(e) =>
                setForm((p) => ({ ...p, marca: e.target.value }))
              }
            />
          </label>

          <label className="label">
            Modelo
            <input
              className="input"
              value={form.modelo}
              onChange={(e) =>
                setForm((p) => ({ ...p, modelo: e.target.value }))
              }
            />
          </label>

          <label className="label">
            Serie
            <input
              className="input"
              value={form.serie}
              onChange={(e) =>
                setForm((p) => ({ ...p, serie: e.target.value }))
              }
            />
          </label>
        </div>

        <hr className="hr" />

        <div className="stack">
          <h3 className="section-title">Asignacion / Ubicacion Inicial</h3>

          <div className="row">
            <button
              className={form.modo === "ASIGNAR" ? "btn" : "btn-light"}
              type="button"
              onClick={() => setForm((p) => ({ ...p, modo: "ASIGNAR" }))}
            >
              Asignar a bombero (EPP)
            </button>
            <button
              className={form.modo === "UBICAR" ? "btn" : "btn-light"}
              type="button"
              onClick={() => setForm((p) => ({ ...p, modo: "UBICAR" }))}
            >
              Ubicar en lugar (Trauma/Bodega)
            </button>
          </div>

          {form.modo === "ASIGNAR" ? (
            <label className="label">
              Bombero
              <select
                className="input"
                value={form.bombero_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bombero_id: e.target.value }))
                }
              >
                <option value="">-- Selecciona --</option>
                {bomberos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} {b.cargo ? `(${b.cargo})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="label">
              Ubicacion
              <select
                className="input"
                value={form.ubicacion_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ubicacion_id: e.target.value }))
                }
              >
                <option value="">-- Selecciona --</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.tipo ? `(${u.tipo})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button
              className="btn-light"
              type="button"
              onClick={() => navigate("/")}
            >
              Cancelar
            </button>
          </div>

          <button
            className="btn"
            disabled={!puedeGuardar || guardando}
            type="button"
            onClick={async () => {
              try {
                const payload = {
                  codigo: form.codigo.trim(),
                  categoria: form.categoria,
                  subcategoria: form.subcategoria.trim() || null,
                  descripcion: form.descripcion.trim(),
                  marca: form.marca.trim() || null,
                  modelo: form.modelo.trim() || null,
                  serie: form.serie.trim() || null,
                  estado: form.estado,
                  criticidad: form.criticidad,
                  asignado_bombero_id:
                    form.modo === "ASIGNAR" ? Number(form.bombero_id) : null,
                  ubicacion_actual_id:
                    form.modo === "UBICAR" ? Number(form.ubicacion_id) : null,
                };

                const r = await crearItem(payload);

                alert("Ítem creado");
                // si backend retorna {id: ...}, navegamos a la ficha
                if (r?.id) navigate(`/items/${r.id}`);
                else navigate("/");
              } catch (e) {
                console.error(e);
                alert("No se pudo crear ítem (revisa backend / campos).");
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar Item
          </button>
        </div>

        <div className="muted">
          Tip: si no aparecen bomberos o ubicaciones, primero crealos en sus
          pantallas.
        </div>
      </div>
    </div>
  );
}