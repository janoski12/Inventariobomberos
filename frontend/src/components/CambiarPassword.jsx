import { useState } from "react";
import Modal from "./Modal";
import { cambiarPassword } from "../api/auth";
import { useDialog } from "../context/DialogContext";

const FORM_VACIO = { actual: "", nueva: "", repetir: "" };

// Modal para que cualquier usuario (admin u operador) cambie su propia contraseña
export default function CambiarPassword({ open, onClose }) {
  const { toast } = useDialog();
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setForm(FORM_VACIO);
    setError("");
    onClose();
  };

  const puedeGuardar =
    form.actual.length > 0 && form.nueva.length >= 6 && form.repetir.length > 0 && !guardando;

  const campo = (nombre) => (e) => setForm((p) => ({ ...p, [nombre]: e.target.value }));

  async function handleGuardar() {
    if (form.nueva !== form.repetir) {
      setError("La nueva contraseña y su repetición no coinciden.");
      return;
    }
    try {
      setGuardando(true);
      setError("");
      await cambiarPassword(form.actual, form.nueva);
      toast("Contraseña actualizada", "success");
      cerrar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={open} title="Cambiar mi contraseña" onClose={cerrar}>
      <div className="stack">
        <label className="label">
          Contraseña actual
          <input
            className="input"
            type="password"
            value={form.actual}
            onChange={campo("actual")}
            autoComplete="current-password"
          />
        </label>

        <label className="label">
          Nueva contraseña
          <input
            className="input"
            type="password"
            value={form.nueva}
            onChange={campo("nueva")}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </label>

        <label className="label">
          Repetir nueva contraseña
          <input
            className="input"
            type="password"
            value={form.repetir}
            onChange={campo("repetir")}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row row--end">
          <button className="btn-light" onClick={cerrar}>Cancelar</button>
          <button className="btn" disabled={!puedeGuardar} onClick={handleGuardar}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
