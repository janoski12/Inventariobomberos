// navigator.clipboard solo existe en contextos seguros (HTTPS, o localhost).
// Este sistema corre en HTTP plano dentro de la red del cuartel
// (http://inventario-cbt10.local o una IP LAN), así que ahí navigator.clipboard
// es undefined y hay que recurrir al método clásico (un textarea oculto +
// document.execCommand) para poder copiar igual. Lanza si ningún método
// funcionó, para que quien llama nunca reporte un copiado que no ocurrió.
export async function copiarAlPortapapeles(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copiado = false;
  try {
    copiado = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copiado) throw new Error("No se pudo copiar al portapapeles");
}
