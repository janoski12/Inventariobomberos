import { useEffect, useMemo, useState } from "react";
import { buscarItems } from "../api/items";
import SearchBar from "../components/SearchBar";
import ItemCard from "../components/ItemCard";
import { useNavigate } from "react-router-dom";

export default function BusquedaItems(){
    const [q, setQ] = useState("");
    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const debouncedQ = useDebounce(q, 300);

    useEffect(() => {
        let cancelado = false;

        async function run() {
            setError("");
            setCargando(true);
            try {
                const data = await buscarItems(debouncedQ);
                if(!cancelado) setItems(data);
            } catch {
                if (!cancelado) setError("No se pudo realizar la busqueda. Revisar backend activo");
            } finally {
                if (!cancelado) setCargando(false);
            }
        }

        run();
        return () => { cancelado = true; };
    }, [debouncedQ]);

    const resumen = useMemo(() => {
        if (cargando) return "Buscando...";
        if (error) return error;
        if (!debouncedQ.trim()) return `Mostrando ultimos ${items.length} items`;
        return `${items.length} resultados(s) para "${debouncedQ.trim()}"`;
    }, [cargando, error, items.length, debouncedQ]);

    return (
        <div className="container">
            <h2 style={{ marginTop: 0}}>Busqueda de Items</h2>

            <SearchBar
                value={q}
                onChange={setQ}
                placeholder="Busca por codigo (EPP-0001) o por descripción (casco, oximetro...)"
            />

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


//alert(`Codigo: ${it.codigo}\nDescripcion: ${it.descripcion}\nCategoria: ${it.categoria}\nEstado: ${it.estado}\nID: ${it.id}`);