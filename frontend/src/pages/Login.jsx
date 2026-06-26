import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [entrando, setEntrando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setEntrando(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <span className="app-header-badge">CBT10</span>
          <span className="login-title">Inventario Bomberos</span>
        </div>

        <label className="label">
          Usuario
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="label">
          Contraseña
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

        <button className="btn" type="submit" disabled={entrando || !username.trim() || !password}>
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
