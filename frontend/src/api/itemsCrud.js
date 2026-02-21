import { API_URL } from "./config";

export async function crearItem(payload) {
  const res = await fetch(`${API_URL}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("No se pudo crear ítem");
  return res.json();
}
