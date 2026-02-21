import { API_URL } from "./config";

export async function asignarItem(id, { bombero_id, responsable, observacion }) {
    const res = await fetch(`${API_URL}/items/${id}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bombero_id, responsable, observacion }),
    });
    if (!res.ok) throw new Error("No se pudo asignar el item");
    return res.json();
}

export async function moverItem(id, { ubicacion_id, responsable, observacion }) {
    const res = await fetch(`${API_URL}/items/${id}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ubicacion_id, responsable, observacion }),
    });
    if (!res.ok) throw new Error("No se pudo mover el item");
    return res.json();
}

export async function cambiarEstadoItem(id, { estado, responsable, observacion }) {
    const res = await fetch(`${API_URL}/items/${id}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, responsable, observacion }),
    });
    if (!res.ok) throw new Error("No se pudo cambiar el estado");
    return res.json();
}