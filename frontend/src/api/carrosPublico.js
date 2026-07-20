import { API_URL } from "./config";

// Cliente para el formulario publico de revision de carros (sin login).
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

export function obtenerCarroPublico(id) {
  return request(`${API_URL}/carros-publico/${id}`);
}

export function enviarRevision(id, payload) {
  return request(`${API_URL}/carros-publico/${id}/revisiones`, { method: "POST", ...json(payload) });
}
