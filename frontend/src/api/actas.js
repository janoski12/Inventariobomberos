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

// Solicita la entrega de uno o varios items a un bombero: genera el acta de
// recepción (los items no cambian de dueño hasta confirmar con la firma)
export function solicitarActaEntrega(payload) {
  return request(`${API_URL}/actas-entrega`, { method: "POST", ...json(payload) });
}

// Solicita la devolución de uno o varios items que un bombero tiene
// asignados: genera el acta de devolución (los items no cambian de ubicación
// hasta confirmar con la firma). El bombero se deriva de los items, no se elige.
export function solicitarActaDevolucion(payload) {
  return request(`${API_URL}/actas-devolucion`, { method: "POST", ...json(payload) });
}

export function confirmarActaEntrega(id, archivo) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  return request(`${API_URL}/actas-entrega/${id}/confirmar`, { method: "POST", body: fd });
}

export function cancelarActaEntrega(id) {
  return request(`${API_URL}/actas-entrega/${id}/cancelar`, { method: "POST" });
}

export function listarActasPendientes() {
  return request(`${API_URL}/actas-entrega?estado=PENDIENTE`);
}

// Abre el acta sin firmar (para imprimirla)
export function abrirDocumento(id) {
  return _abrirEnNuevaPestana(`${API_URL}/actas-entrega/${id}/documento`);
}

// Abre el documento firmado que se subió al confirmar
export function abrirDocumentoFirmado(id) {
  return _abrirEnNuevaPestana(`${API_URL}/actas-entrega/${id}/documento-firmado`);
}

// Abre la pestaña ANTES del fetch (gesto del usuario) para evitar que el
// navegador bloquee el popup; luego la navega al blob ya descargado.
async function _abrirEnNuevaPestana(url) {
  const ventana = window.open("", "_blank");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = objectUrl;
    else window.open(objectUrl, "_blank");
  } catch (e) {
    if (ventana) ventana.close();
    throw e;
  }
}
