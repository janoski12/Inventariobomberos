import { API_URL } from "./config";

export async function importarExcel(file) {
  const fd = new FormData();
  fd.append("archivo", file);
  const res = await fetch(`${API_URL}/importar`, { method: "POST", body: fd });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body;
}

export async function importarParcial(seccion, file) {
  const fd = new FormData();
  fd.append("archivo", file);
  const res = await fetch(`${API_URL}/importar/${seccion}`, { method: "POST", body: fd });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body;
}

export async function descargarPlantilla() {
  await _descargarArchivo(`${API_URL}/plantilla`, "plantilla_importacion.xlsx");
}

export async function descargarPlantillaParcial(seccion) {
  await _descargarArchivo(`${API_URL}/plantilla/${seccion}`, `plantilla_${seccion}.xlsx`);
}

async function _descargarArchivo(url, nombre) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Error descargando plantilla");
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}
