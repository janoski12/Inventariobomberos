import { API_URL } from "./config";

export async function obtenerItem(id) {
    const res = await fetch(`${API_URL}/items/${id}`);
    if(!res.ok) throw new Error(`No se pudo obtener el item: ${res.status}`);
    return res.json();
}

export async function obtenerMovimientos(id) {
    const res = await fetch(`${API_URL}/items/${id}/movimientos`);
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`No se pudieron obtener movimientos: ${res.status} ${txt}`);
    }
    return res.json();
}