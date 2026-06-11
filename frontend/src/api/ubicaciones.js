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

export function listarUbicaciones() {
  return request(`${API_URL}/ubicaciones`);
}

export function crearUbicacion(payload) {
  return request(`${API_URL}/ubicaciones`, { method: "POST", ...json(payload) });
}

export function actualizarUbicacion(id, payload) {
  return request(`${API_URL}/ubicaciones/${id}`, { method: "PUT", ...json(payload) });
}

export function eliminarUbicacion(id) {
  return request(`${API_URL}/ubicaciones/${id}`, { method: "DELETE" });
}

export function obtenerUbicacion(id) {
  return request(`${API_URL}/ubicaciones/${id}`);
}

export async function descargarQR(id, nombre, codigo) {
  const res = await fetch(`${API_URL}/ubicaciones/${id}/qr`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const blob = await res.blob();
  const etiqueta = await _componerEtiqueta(blob, nombre ?? `Ubicación ${id}`, codigo ?? "");

  const slug = (nombre ?? `ubicacion_${id}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const url = URL.createObjectURL(etiqueta);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr_${slug}.png`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Compone el QR con el nombre y el código debajo, para que la
// etiqueta impresa sea identificable sin escanearla.
async function _componerEtiqueta(qrBlob, nombre, codigo) {
  const qrImg = await createImageBitmap(qrBlob);
  const W = 512, TEXT_H = 120, MARGEN = 32;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = W + TEXT_H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrImg, 0, 0, W, W);

  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(nombre, W / 2, W + 18, W - MARGEN * 2);

  if (codigo) {
    ctx.fillStyle = "#555555";
    ctx.font = "28px monospace";
    ctx.fillText(codigo, W / 2, W + 68, W - MARGEN * 2);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la etiqueta"))), "image/png");
  });
}
