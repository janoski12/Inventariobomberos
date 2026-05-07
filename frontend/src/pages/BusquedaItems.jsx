import { useEffect, useMemo, useState } from "react";
import { buscarItems } from "../api/items";
import SearchBar from "../components/SearchBar";
import ItemCard from "../components/ItemCard";
import { useNavigate } from "react-router-dom";

const ESTADOS    = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CATEGORIAS = ["EPP", "TRAUMA", "HERRAMIENTA", "COMUNICACION", "OTRO"];
const CRITICIDADES = ["ALTA", "MEDIA", "BAJA"];

export default function BusquedaItems() {
    const [q, setQ]                       = useState("");
    const [filtroEstado, setFiltroEstado]         = useState("");
    const [filtroCategoria, setFiltroCategoria]   = useState("");
    const [filtroCriticidad, setFiltroCriticidad] = useState("");

    const [items, setItems]     = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError]     = useState("");
    const navigate = useNavigate();

    const debouncedQ = useDebounce(q, 300);

    const hayFiltros = filtroEstado || filtroCategoria || filtroCriticidad;

    useEffect(() => {
        let cancelado = false;

        async function run() {
            setError("");
            setCargando(true);
            try {
                const data = await buscarItems({
                    q: debouncedQ,
                    estado:     filtroEstado,
                    categoria:  filtroCategoria,
                    criticidad: filtroCriticidad,
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
    }, [debouncedQ, filtroEstado, filtroCategoria, filtroCriticidad]);

    function limpiarFiltros() {
        setFiltroEstado("");
        setFiltroCategoria("");
        setFiltroCriticidad("");
    }

    const resumen = useMemo(() => {
        if (cargando) return "Buscando...";
        if (error)    return error;
        const tiene_q = debouncedQ.trim();
        if (!tiene_q && !hayFiltros) return `Mostrando ultimos ${items.length} items`;
        return `${items.length} resultado(s)`;
    }, [cargando, error, items.length, debouncedQ, hayFiltros]);

    return (
        <div className="container">
            <h2 style={{ marginTop: 0 }}>Busqueda de Items</h2>

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

                {hayFiltros && (
                    <button className="btn-clear-filtros" onClick={limpiarFiltros}>
                        Limpiar filtros
                    </button>
                )}
            </div>

            <div className={error ? "error" : "muted"} style={{ marginTop: 10 }}>
                {resumen}
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
