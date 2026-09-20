import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { obtenerCarro, obtenerRevision, descargarQRRevision } from "../api/carros";
import { useDialog } from "../context/DialogContext";
import SearchBar from "../components/SearchBar";

// Valores únicos ya presentes en esta lista de ítems, en el orden en que
// aparecen por primera vez (para no ofrecer, p.ej., filtrar por TRAUMA en un
// carro que no tiene ningún ítem de esa categoría)
function valoresPresentes(items, campo) {
  return [...new Set(items.map((it) => it[campo]).filter(Boolean))];
}

const CHIP_ESTADO = {
  OPERATIVO:      "chip chip--operativo",
  MANTENCION:     "chip chip--mantencion",
  FUERA_SERVICIO: "chip chip--fuera_servicio",
  BAJA:           "chip chip--baja",
};

const CHIP_RESULTADO = {
  OK:       "chip chip--operativo",
  FALLA:    "chip chip--fuera_servicio",
  FALTANTE: "chip chip--fuera_servicio",
};

export default function FichaCarro() {
  const { id } = useParams();
  const { toast } = useDialog();
  const [carro, setCarro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  const [revisionAbierta, setRevisionAbierta] = useState(null);
  const [detalleRevision, setDetalleRevision] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroCriticidad, setFiltroCriticidad] = useState("");
  const [filtroGaveta, setFiltroGaveta] = useState("");

  const items = useMemo(() => carro?.items ?? [], [carro]);
  const estadosPresentes     = useMemo(() => valoresPresentes(items, "estado"), [items]);
  const categoriasPresentes  = useMemo(() => valoresPresentes(items, "categoria"), [items]);
  const criticidadesPresentes= useMemo(() => valoresPresentes(items, "criticidad"), [items]);
  const gavetasPresentes     = useMemo(() => valoresPresentes(items, "ubicacion_detalle").sort(), [items]);

  const hayFiltros = q.trim() || filtroEstado || filtroCategoria || filtroCriticidad || filtroGaveta;

  const itemsFiltrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return items.filter((it) => {
      if (texto && !`${it.codigo} ${it.descripcion}`.toLowerCase().includes(texto)) return false;
      if (filtroEstado      && it.estado !== filtroEstado) return false;
      if (filtroCategoria   && it.categoria !== filtroCategoria) return false;
      if (filtroCriticidad  && it.criticidad !== filtroCriticidad) return false;
      if (filtroGaveta      && it.ubicacion_detalle !== filtroGaveta) return false;
      return true;
    });
  }, [items, q, filtroEstado, filtroCategoria, filtroCriticidad, filtroGaveta]);

  function limpiarFiltros() {
    setQ("");
    setFiltroEstado("");
    setFiltroCategoria("");
    setFiltroCriticidad("");
    setFiltroGaveta("");
  }

  useEffect(() => {
    setCargando(true);
    setError("");
    obtenerCarro(id)
      .then(setCarro)
      .catch(() => setError("No se pudo cargar la ficha del carro."))
      .finally(() => setCargando(false));
  }, [id]);

  async function toggleRevision(revisionId) {
    if (revisionAbierta === revisionId) {
      setRevisionAbierta(null);
      setDetalleRevision(null);
      return;
    }
    setRevisionAbierta(revisionId);
    setDetalleRevision(null);
    setCargandoDetalle(true);
    try {
      const data = await obtenerRevision(id, revisionId);
      setDetalleRevision(data);
    } catch {
      toast("No se pudo cargar el detalle de la revisión.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  if (cargando) return <div className="container"><p className="muted">Cargando...</p></div>;
  if (error || !carro) return <div className="container"><Link to="/carros">← Volver</Link><p className="error">{error}</p></div>;

  return (
    <div className="container">
      <Link to="/carros" style={{ textDecoration: "none" }}>← Volver a Carros</Link>

      <div className="spread" style={{ margin: "12px 0" }}>
        <h2 style={{ margin: 0 }}>{carro.nombre}</h2>
        <button
          className="btn-light"
          disabled={descargando}
          onClick={async () => {
            try {
              setDescargando(true);
              await descargarQRRevision(carro.id, carro.nombre);
            } catch { toast("No se pudo descargar el QR de revisión."); }
            finally { setDescargando(false); }
          }}
        >
          {descargando ? "Generando..." : "QR de revisión"}
        </button>
      </div>

      {carro.responsable && <p className="muted">Responsable: {carro.responsable}</p>}

      <h3 style={{ marginTop: 22 }}>Ítems en este carro</h3>
      {items.length === 0 ? (
        <p className="muted">No hay ítems asignados a este carro.</p>
      ) : (
        <>
          <SearchBar value={q} onChange={setQ} placeholder="Busca por código o descripción..." />
          <div className="filtros" style={{ marginTop: 10 }}>
            <select
              className={`filtro-select${filtroEstado ? " filtro-activo" : ""}`}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {estadosPresentes.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
            </select>

            {categoriasPresentes.length > 1 && (
              <select
                className={`filtro-select${filtroCategoria ? " filtro-activo" : ""}`}
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categoriasPresentes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <select
              className={`filtro-select${filtroCriticidad ? " filtro-activo" : ""}`}
              value={filtroCriticidad}
              onChange={(e) => setFiltroCriticidad(e.target.value)}
            >
              <option value="">Todas las criticidades</option>
              {criticidadesPresentes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {gavetasPresentes.length > 0 && (
              <select
                className={`filtro-select${filtroGaveta ? " filtro-activo" : ""}`}
                value={filtroGaveta}
                onChange={(e) => setFiltroGaveta(e.target.value)}
              >
                <option value="">Todas las gavetas</option>
                {gavetasPresentes.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {hayFiltros && (
              <button className="btn-clear-filtros" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            {hayFiltros ? `${itemsFiltrados.length} de ${items.length} ítem(s)` : `${items.length} ítem(s)`}
          </p>

          {itemsFiltrados.length === 0 ? (
            <p className="muted">Ningún ítem coincide con la búsqueda o los filtros.</p>
          ) : (
            <div className="stack">
              {itemsFiltrados.map((it) => (
                <Link key={it.id} to={`/items/${it.id}`} style={{ textDecoration: "none" }}>
                  <div className="card clickable">
                    <div className="spread">
                      <div>
                        <span className="item-code">{it.codigo}</span>
                        <span className="item-desc">{it.descripcion}</span>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <span className={CHIP_ESTADO[it.estado] ?? "chip"}>{it.estado.replace("_", " ")}</span>
                      </div>
                    </div>
                    <div className="card-detail">
                      {it.ubicacion_detalle ? <b>{it.ubicacion_detalle}</b> : <span className="muted">Sin gaveta/compartimiento indicado</span>}
                      {(it.marca || it.modelo) ? ` · ${[it.marca, it.modelo].filter(Boolean).join(" / ")}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <h3 style={{ marginTop: 22 }}>Historial de revisiones</h3>
      {carro.revisiones.length === 0 ? (
        <p className="muted">Este carro todavía no tiene revisiones registradas.</p>
      ) : (
        <div className="stack">
          {carro.revisiones.map((r) => (
            <div key={r.id} className="card">
              <div className="spread clickable" onClick={() => toggleRevision(r.id)}>
                <div>
                  <div className="card-title">{r.fecha}</div>
                  <div className="card-muted">
                    Realizada por {r.realizada_por} · {r.total_items} ítem{r.total_items !== 1 ? "s" : ""} revisado{r.total_items !== 1 ? "s" : ""}
                  </div>
                </div>
                {r.fallas > 0 ? (
                  <span className="badge-warning">{r.fallas} observación{r.fallas !== 1 ? "es" : ""}</span>
                ) : (
                  <span className="badge-neutral">Todo OK</span>
                )}
              </div>

              {r.observacion_general && <div className="card-detail">Obs: {r.observacion_general}</div>}

              {revisionAbierta === r.id && (
                <div className="stack" style={{ marginTop: 10, gap: 4 }}>
                  {cargandoDetalle ? (
                    <p className="muted">Cargando...</p>
                  ) : (
                    detalleRevision?.items.map((it) => (
                      <div key={it.item_id} className="spread" style={{ padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                        <div>
                          <span className="item-code">{it.codigo}</span>
                          <span className="item-desc">{it.descripcion}</span>
                          {it.observacion && <div className="card-detail">Obs: {it.observacion}</div>}
                        </div>
                        <span className={CHIP_RESULTADO[it.resultado] ?? "chip"}>{it.resultado}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
