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

export function listarBomberos() {
  return request(`${API_URL}/bomberos`);
}

export function crearBombero(payload) {
  return request(`${API_URL}/bomberos`, { method: "POST", ...json(payload) });
}

export function actualizarBombero(id, payload) {
  return request(`${API_URL}/bomberos/${id}`, { method: "PUT", ...json(payload) });
}

export function eliminarBombero(id) {
  return request(`${API_URL}/bomberos/${id}`, { method: "DELETE" });
}

export function obtenerBombero(id) {
  return request(`${API_URL}/bomberos/${id}`);
}
