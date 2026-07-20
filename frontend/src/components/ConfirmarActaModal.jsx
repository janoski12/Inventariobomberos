import { useState } from "react";
import Modal from "./Modal";
import { confirmarActaEntrega } from "../api/actas";
import { useDialog } from "../context/DialogContext";

// Modal para subir el acta de entrega ya firmada (foto o escaneo) y confirmar
// la entrega de todos los items que incluye. Reutilizable desde la ficha de un
// item, la ficha de un bombero, o el listado de pendientes en Reportes.
export default function ConfirmarActaModal({ open, onClose, actaId, onDone }) {
  const { toast } = useDialog();
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);

  function cerrar() {
    setArchivo(null);
    onClose();
  }

  return (
    <Modal open={open} title="Subir documento firmado" onClose={cerrar}>
      <div className="stack">
        <p className="muted">
          Sube una foto o escaneo del acta ya firmada (PDF, JPG o PNG). Los ítems
          del kit quedarán asignados al bombero recién al confirmar.
        </p>

        <label className="importar-label" htmlFor="input-acta-firmada">
          {archivo ? archivo.name : "Seleccionar archivo (PDF, JPG o PNG)"}
        </label>
        <input
          id="input-acta-firmada"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="importar-input"
          onChange={(e) => setArchivo(e.target.files[0] ?? null)}
        />

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={cerrar} className="btn-light">Cancelar</button>
          <button
            disabled={!archivo || procesando}
            className="btn"
            onClick={async () => {
              try {
                setProcesando(true);
                await confirmarActaEntrega(actaId, archivo);
                toast("Entrega confirmada", "success");
                cerrar();
                onDone?.();
              } catch (e) {
                toast(e.message || "No se pudo confirmar la entrega.");
              } finally {
                setProcesando(false);
              }
            }}
          >
            {procesando ? "Confirmando..." : "Confirmar entrega"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
