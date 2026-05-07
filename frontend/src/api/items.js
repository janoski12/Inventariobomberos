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

export function buscarItems({ q = "", estado = "", categoria = "", criticidad = "" } = {}) {
  const params = new URLSearchParams();
  if (q?.trim())    params.set("q",          q.trim());
  if (estado)       params.set("estado",      estado);
  if (categoria)    params.set("categoria",   categoria);
  if (criticidad)   params.set("criticidad",  criticidad);
  const qs = params.toString();
  return request(`${API_URL}/items${qs ? `?${qs}` : ""}`);
}

export function obtenerItem(id) {
  return request(`${API_URL}/items/${id}`);
}

export function obtenerMovimientos(id) {
  return request(`${API_URL}/items/${id}/movimientos`);
}

export function crearItem(payload) {
  return request(`${API_URL}/items`, { method: "POST", ...json(payload) });
}

export function actualizarItem(id, payload) {
  return request(`${API_URL}/items/${id}`, { method: "PUT", ...json(payload) });
}

export function asignarItem(id, payload) {
  return request(`${API_URL}/items/${id}/asignar`, { method: "POST", ...json(payload) });
}

export function moverItem(id, payload) {
  return request(`${API_URL}/items/${id}/mover`, { method: "POST", ...json(payload) });
}

export function cambiarEstadoItem(id, payload) {
  return request(`${API_URL}/items/${id}/estado`, { method: "POST", ...json(payload) });
}

export function eliminarItem(id) {
  return request(`${API_URL}/items/${id}`, { method: "DELETE" });
}
