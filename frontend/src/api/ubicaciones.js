import { API_URL } from "./config";

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status}`);
  }
  return res.json();
}

const json = (payload) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export function listarUbicaciones() {
  return request(`${API_URL}/ubicaciones`);
}

export function crearUbicacion(payload) {
  return request(`${API_URL}/ubicaciones`, { method: "POST", ...json(payload) });
}

export function actualizarUbicacion(id, payload) {
  return request(`${API_URL}/ubicaciones/${id}`, { method: "PUT", ...json(payload) });
}

export function eliminarUbicacion(id) {
  return request(`${API_URL}/ubicaciones/${id}`, { method: "DELETE" });
}

export function obtenerUbicacion(id) {
  return request(`${API_URL}/ubicaciones/${id}`);
}
