import { API_URL } from "./config";

export async function buscarItems(q) {
    const url = q && q.trim()
         ? `${API_URL}/items?q=${encodeURIComponent(q.trim())}` 
         : `${API_URL}/items`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error buscando items: ${res.status}`);
    return res.json();
}