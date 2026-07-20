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

// Solicita la asignación de un item a un bombero: genera el acta de entrega
// (el item no cambia de dueño hasta confirmar con el documento firmado)
export function solicitarAsignacion(itemId, payload) {
  return request(`${API_URL}/items/${itemId}/asignaciones`, { method: "POST", ...json(payload) });
}

export function confirmarAsignacion(id, archivo) {
  const fd = new FormData();
  fd.append("archivo", archivo);
  return request(`${API_URL}/asignaciones/${id}/confirmar`, { method: "POST", body: fd });
}

export function cancelarAsignacion(id) {
  return request(`${API_URL}/asignaciones/${id}/cancelar`, { method: "POST" });
}

export function listarAsignacionesPendientes() {
  return request(`${API_URL}/asignaciones?estado=PENDIENTE`);
}

// Abre el acta sin firmar (para imprimirla)
export function abrirDocumento(id) {
  return _abrirEnNuevaPestana(`${API_URL}/asignaciones/${id}/documento`);
}

// Abre el documento firmado que se subió al confirmar
export function abrirDocumentoFirmado(id) {
  return _abrirEnNuevaPestana(`${API_URL}/asignaciones/${id}/documento-firmado`);
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
