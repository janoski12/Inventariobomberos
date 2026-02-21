import { API_URL } from "./config";

export async function listarUbicaciones() {
    const res = await fetch(`${API_URL}/ubicaciones`);
    if (!res.ok) throw new Error("No se pudieron cargar ubicaciones");
    return res.json();
}

export async function crearUbicacion({ nombre, tipo, responsable, codigo_qr, activo }) {
    const res = await fetch(`${API_URL}/ubicaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ nombre, tipo, responsable, codigo_qr, activo }),
    });
    if (!res.ok) throw new Error("No se pudo crear ubicacion");
    return res.json();
}