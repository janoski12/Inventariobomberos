import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buscarItems, exportarItems } from "../api/items";
import { obtenerReportes } from "../api/reportes";
import { useDialog } from "../context/DialogContext";
import { listarBomberos } from "../api/bomberos";
import { listarUbicaciones } from "../api/ubicaciones";
import SearchBar from "../components/SearchBar";
import ItemCard from "../components/ItemCard";

const ESTADOS    = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CATEGORIAS = ["EPP", "TRAUMA", "HERRAMIENTA", "COMUNICACION", "OTRO"];
const CRITICIDADES = ["ALTA", "MEDIA", "BAJA"];

const ESTADO_CLS = {
    OPERATIVO:     "text-operativo",
    MANTENCION:    "text-mantencion",
    FUERA_SERVICIO:"text-fuera-servicio",
    BAJA:          "text-baja-estado",
};

export default function BusquedaItems() {
    const [q, setQ]                               = useState("");
    const [filtroEstado, setFiltroEstado]         = useState("");
    const [filtroCategoria, setFiltroCategoria]   = useState("");
    const [filtroCriticidad, setFiltroCriticidad] = useState("");
    const [items, setItems]                       = useState([]);
    const [cargando, setCargando]                 = useState(false);
    const [error, setError]                       = useState("");
    const [stats, setStats]                       = useState(null);
    const { toast } = useDialog();
    const [exportando, setExportando]             = useState(false);
    const [bomberos, setBomberos]                 = useState([]);
    const [ubicaciones, setUbicaciones]           = useState([]);
    const [filtroBombero, setFiltroBombero]       = useState("");
    const [filtroUbicacion, setFiltroUbicacion]   = useState("");
    const navigate = useNavigate();

    const debouncedQ = useDebounce(q, 300);
    const hayFiltros = filtroEstado || filtroCategoria || filtroCriticidad || filtroBombero || filtroUbicacion;

    useEffect(() => {
        obtenerReportes().then(setStats).catch(() => {});
        listarBomberos().then(setBomberos).catch(() => {});
        listarUbicaciones().then(setUbicaciones).catch(() => {});
    }, []);

    useEffect(() => {
        let cancelado = false;
        async function run() {
            setError("");
            setCargando(true);
            try {
                const data = await buscarItems({
                    q:           debouncedQ,
                    estado:      filtroEstado,
                    categoria:   filtroCategoria,
                    criticidad:  filtroCriticidad,
                    bombero_id:  filtroBombero,
                    ubicacion_id:filtroUbicacion,
                });
                if (!cancelado) setItems(data);
            } catch {
                if (!cancelado) setError("No se pudo realizar la busqueda. Revisar backend activo");
            } finally {
                if (!cancelado) setCargando(false);
            }
        }
        run();
        return () => { cancelado = true; };
    }, [debouncedQ, filtroEstado, filtroCategoria, filtroCriticidad, filtroBombero, filtroUbicacion]);

    function limpiarFiltros() {
        setFiltroEstado("");
        setFiltroCategoria("");
        setFiltroCriticidad("");
        setFiltroBombero("");
        setFiltroUbicacion("");
    }

    const resumen = useMemo(() => {
        if (cargando) return "Buscando...";
        if (error)    return error;
        const tiene_q = debouncedQ.trim();
        if (!tiene_q && !hayFiltros) return `Mostrando ultimos ${items.length} items`;
        return `${items.length} resultado(s)`;
    }, [cargando, error, items.length, debouncedQ, hayFiltros]);

    const total = stats ? stats.porEstado.reduce((s, r) => s + r.total, 0) : null;

    return (
        <div className="container">

            {/* ── DASHBOARD ── */}
            {stats && (
                <div className="dashboard">
                    {/* Fila de estado */}
                    <div className="dashboard-estados">
                        <div className="dashboard-stat">
                            <span className="dashboard-num text-total">{total}</span>
                            <span className="dashboard-label">Total</span>
                        </div>
                        {stats.porEstado.map(r => (
                            <div
                                key={r.estado}
                                className="dashboard-stat dashboard-stat--clickable"
                                onClick={() => setFiltroEstado(r.estado)}
                                title={`Filtrar por ${r.estado}`}
                            >
                                <span className={`dashboard-num ${ESTADO_CLS[r.estado] ?? "text-total"}`}>{r.total}</span>
                                <span className="dashboard-label">{r.estado.replace("_", " ")}</span>
                            </div>
                        ))}
                    </div>

                    {/* Fila de alertas */}
                    <div className="dashboard-alertas">
                        <Link to="/reportes" className={`dashboard-alerta${stats.controlesVencidos.length > 0 ? " dashboard-alerta--danger" : ""}`}>
                            <span className="dashboard-alerta-num">{stats.controlesVencidos.length}</span>
                            <span className="dashboard-alerta-label">
                                {stats.controlesVencidos.length === 1 ? "control vencido" : "controles vencidos"}
                            </span>
                        </Link>
                        <Link to="/reportes" className={`dashboard-alerta${stats.proximosControles.length > 0 ? " dashboard-alerta--warning" : ""}`}>
                            <span className="dashboard-alerta-num">{stats.proximosControles.length}</span>
                            <span className="dashboard-alerta-label">
                                {stats.proximosControles.length === 1 ? "control próximo" : "controles próximos"}
                            </span>
                        </Link>
                        <Link to="/reportes" className={`dashboard-alerta${stats.sinUbicar.length > 0 ? " dashboard-alerta--neutral" : ""}`}>
                            <span className="dashboard-alerta-num">{stats.sinUbicar.length}</span>
                            <span className="dashboard-alerta-label">
                                {stats.sinUbicar.length === 1 ? "ítem sin ubicar" : "ítems sin ubicar"}
                            </span>
                        </Link>
                    </div>
                </div>
            )}

            {/* ── BÚSQUEDA ── */}
            <SearchBar
                value={q}
                onChange={setQ}
                placeholder="Busca por codigo (EPP-0001) o descripción (casco, oximetro...)"
            />

            <div className="filtros">
                <select
                    className={`filtro-select${filtroEstado ? " filtro-activo" : ""}`}
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>

                <select
                    className={`filtro-select${filtroCategoria ? " filtro-activo" : ""}`}
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                    <option value="">Todas las categorías</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                    className={`filtro-select${filtroCriticidad ? " filtro-activo" : ""}`}
                    value={filtroCriticidad}
                    onChange={(e) => setFiltroCriticidad(e.target.value)}
                >
                    <option value="">Todas las criticidades</option>
                    {CRITICIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                    className={`filtro-select${filtroBombero ? " filtro-activo" : ""}`}
                    value={filtroBombero}
                    onChange={(e) => { setFiltroBombero(e.target.value); setFiltroUbicacion(""); }}
                >
                    <option value="">Todos los bomberos</option>
                    {bomberos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>

                <select
                    className={`filtro-select${filtroUbicacion ? " filtro-activo" : ""}`}
                    value={filtroUbicacion}
                    onChange={(e) => { setFiltroUbicacion(e.target.value); setFiltroBombero(""); }}
                >
                    <option value="">Todas las ubicaciones</option>
                    {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>

                {hayFiltros && (
                    <button className="btn-clear-filtros" onClick={limpiarFiltros}>
                        Limpiar filtros
                    </button>
                )}
            </div>

            <div className="spread" style={{ marginTop: 10 }}>
                <div className={error ? "error" : "muted"}>{resumen}</div>
                <button
                    className="btn-light"
                    disabled={exportando || items.length === 0}
                    onClick={async () => {
                        try {
                            setExportando(true);
                            await exportarItems({ q: debouncedQ, estado: filtroEstado, categoria: filtroCategoria, criticidad: filtroCriticidad, bombero_id: filtroBombero, ubicacion_id: filtroUbicacion });
                        } catch { toast("No se pudo exportar. Revisa que el backend esté activo."); }
                        finally { setExportando(false); }
                    }}
                >
                    {exportando ? "Exportando..." : "Exportar Excel"}
                </button>
            </div>

            <div className="stack" style={{ marginTop: 14 }}>
                {items.map((it) => (
                    <ItemCard
                        key={it.id}
                        item={it}
                        onClick={() => navigate(`/items/${it.id}`)}
                    />
                ))}
            </div>
        </div>
    );
}

function useDebounce(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}
