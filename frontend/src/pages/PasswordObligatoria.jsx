import { useState } from "react";
import { cambiarPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const FORM_VACIO = { actual: "", nueva: "", repetir: "" };

// Pantalla de bloqueo: se muestra en vez del resto de la app cuando el
// usuario tiene una contraseña temporal pendiente de cambiar (asignada al
// crear la cuenta, o al resetearla un administrador). No tiene forma de
// cerrarla ni saltarla — el unico camino hacia adelante es cambiarla. Si no
// la tiene a mano en este momento, puede cerrar sesion y volver despues.
export default function PasswordObligatoria() {
  const { logout, refrescarPerfil } = useAuth();
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const puedeGuardar =
    form.actual.length > 0 && form.nueva.length >= 6 && form.repetir.length > 0 && !guardando;

  const campo = (nombre) => (e) => setForm((p) => ({ ...p, [nombre]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (form.nueva !== form.repetir) {
      setError("La nueva contraseña y su repetición no coinciden.");
      return;
    }
    try {
      setGuardando(true);
      setError("");
      await cambiarPassword(form.actual, form.nueva);
      await refrescarPerfil();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="app-header-badge">CBT10</span>
          <span className="login-title">Cambia tu contraseña</span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Tu contraseña es temporal. Debes definir una propia antes de continuar.
        </p>

        <label className="label">
          Contraseña temporal
          <input
            className="input"
            type="password"
            value={form.actual}
            onChange={campo("actual")}
            autoComplete="current-password"
            autoFocus
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

        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

        <button className="btn" type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando..." : "Cambiar contraseña"}
        </button>

        <button className="btn-light" type="button" onClick={logout}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
