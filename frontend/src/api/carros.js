import { API_URL } from "./config";

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status}`);
  }
  return res.json();
}

export function listarCarros() {
  return request(`${API_URL}/carros`);
}

export function obtenerCarro(id) {
  return request(`${API_URL}/carros/${id}`);
}

export function obtenerRevision(carroId, revisionId) {
  return request(`${API_URL}/carros/${carroId}/revisiones/${revisionId}`);
}

// Descarga la etiqueta QR de revisión (distinta a la de ficha): apunta al
// formulario público /revision-carro/:id, para pegar dentro del carro.
export async function descargarQRRevision(id, nombre) {
  const res = await fetch(`${API_URL}/carros/${id}/qr-revision`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const blob = await res.blob();
  const etiqueta = await _componerEtiqueta(blob, nombre ?? `Carro ${id}`, "Escanear para revisar");

  const slug = (nombre ?? `carro_${id}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const url = URL.createObjectURL(etiqueta);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr_revision_${slug}.png`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

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
    ctx.font = "24px sans-serif";
    ctx.fillText(codigo, W / 2, W + 68, W - MARGEN * 2);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la etiqueta"))), "image/png");
  });
}
