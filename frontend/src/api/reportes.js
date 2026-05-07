import { API_URL } from "./config";

export async function obtenerReportes() {
  const r = await fetch(`${API_URL}/reportes`);
  if (!r.ok) throw new Error("Error obteniendo reportes");
  return r.json();
}

export async function descargarPlantilla() {
  const r = await fetch(`${API_URL}/plantilla`);
  if (!r.ok) throw new Error("Error descargando plantilla");
  const blob = await r.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "plantilla_importacion.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
