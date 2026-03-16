import { API_URL } from "./config";

export async function actualizarItem(id, payload) {
  const res = await fetch(`${API_URL}/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("No se pudo actualizar ítem");
  return res.json();
}