import { API_URL } from "./config";

export async function listarBomberos() {
    const res = await fetch(`${API_URL}/bomberos`);
    if (!res.ok) throw new Error("No se pudieron cargar bomberos");
    return res.json();
}

export async function crearBombero({ nombre, cargo, estado, obsevaciones }) {
    const res = await fetch(`${API_URL}/bomberos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, cargo, estado, obsevaciones }),
    });
    if (!res.ok) throw new Error("No se pudo crear bombero");
    return res.json();
}

export async function actualizarBombero(id, payload) {
    const res = await fetch(`${API_URL}/bomberos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("No se pudo actualizar bombero");
    return res.json();
}