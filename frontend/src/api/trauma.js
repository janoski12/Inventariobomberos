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

export const obtenerTrauma = () =>
  request(`${API_URL}/trauma`);

export const actualizarFechasTrauma = (id, payload) =>
  request(`${API_URL}/trauma/${id}/fechas`, { method: "PUT", ...json(payload) });

export const obtenerUsosTrauma = (id) =>
  request(`${API_URL}/trauma/${id}/usos`);

export const registrarUso = (id, payload) =>
  request(`${API_URL}/trauma/${id}/usos`, { method: "POST", ...json(payload) });

export const eliminarUso = (usoId) =>
  request(`${API_URL}/trauma/usos/${usoId}`, { method: "DELETE" });

export async function exportarTrauma() {
  const res = await fetch(`${API_URL}/trauma/exportar`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const blob = await res.blob();
  const fecha = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trauma_${fecha}.xlsx`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
