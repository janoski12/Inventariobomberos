import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { recuperacionDisponible, solicitarRecuperacion } from "../api/auth";

function Marca({ titulo }) {
  return (
    <div className="login-brand">
      <span className="app-header-badge">CBT10</span>
      <span className="login-title">{titulo}</span>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  // "ingresar" | "recuperar" (pide el correo) | "enviado" (ya se envió la solicitud)
  const [modo, setModo]         = useState("ingresar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [correo, setCorreo]     = useState("");
  const [vigencia, setVigencia] = useState(60);
  const [error, setError]       = useState("");
  const [entrando, setEntrando] = useState(false);
  // "¿Olvidaste tu contraseña?" solo se ofrece si el servidor tiene configurado el envío de correo
  const [recuperable, setRecuperable] = useState(false);

  useEffect(() => {
    recuperacionDisponible().then((r) => setRecuperable(!!r.disponible)).catch(() => {});
  }, []);

  function irA(nuevoModo) {
    setError("");
    setModo(nuevoModo);
  }

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

  async function onRecuperar(e) {
    e.preventDefault();
    setError("");
    setEntrando(true);
    try {
      const r = await solicitarRecuperacion(correo.trim());
      setVigencia(r.vigencia_minutos);
      setModo("enviado");
    } catch (err) {
      setError(err.message || "No se pudo enviar la solicitud");
    } finally {
      setEntrando(false);
    }
  }

  if (modo === "recuperar") {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={onRecuperar}>
          <Marca titulo="Recuperar contraseña" />

          <p className="muted" style={{ margin: 0 }}>
            Escribe el correo registrado en tu cuenta. Te enviaremos una contraseña temporal,
            que deberás cambiar al ingresar.
          </p>

          <label className="label">
            Correo registrado
            <input
              className="input"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoFocus
              autoComplete="email"
              placeholder="Ej: jperez@gmail.com"
            />
          </label>

          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

          <button className="btn" type="submit" disabled={entrando || !correo.trim()}>
            {entrando ? "Enviando..." : "Enviar contraseña temporal"}
          </button>
          <button className="btn-light" type="button" onClick={() => irA("ingresar")}>
            Volver
          </button>
        </form>
      </div>
    );
  }

  if (modo === "enviado") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <Marca titulo="Revisa tu correo" />

          <p style={{ margin: 0 }}>
            Si el correo está registrado, en unos minutos te llegará una contraseña temporal
            (revisa también la carpeta de spam). Es válida por {vigencia} minutos.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Si no recibes nada, pídele a un administrador que revise el correo de tu cuenta
            o que restablezca tu contraseña.
          </p>

          <button className="btn" type="button" onClick={() => irA("ingresar")}>
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <Marca titulo="Inventario Bomberos" />

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

        {recuperable && (
          <button
            type="button"
            className="link-button"
            style={{ alignSelf: "center" }}
            onClick={() => irA("recuperar")}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>
    </div>
  );
}
