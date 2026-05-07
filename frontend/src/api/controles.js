import { API_URL } from "./config";

export async function obtenerControles(itemId) {
  const r = await fetch(`${API_URL}/items/${itemId}/controles`);
  if (!r.ok) throw new Error("Error obteniendo controles");
  return r.json();
}

export async function crearControl(itemId, payload) {
  const r = await fetch(`${API_URL}/items/${itemId}/controles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Error creando control");
  return r.json();
}

export async function completarControl(controlId, payload) {
  const r = await fetch(`${API_URL}/controles/${controlId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Error completando control");
  return r.json();
}
