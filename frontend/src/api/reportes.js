import { API_URL } from "./config";

export async function obtenerReportes() {
  const r = await fetch(`${API_URL}/reportes`);
  if (!r.ok) throw new Error("Error obteniendo reportes");
  return r.json();
}
