/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, obtenerPerfil } from "../api/auth";
import { getToken, setToken, instalarInterceptor } from "../auth/token";

instalarInterceptor();

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario]   = useState(null);
  const [cargando, setCargando] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
  }, []);

  // Al montar: si hay token, validarlo con el backend
  useEffect(() => {
    async function validar() {
      if (!getToken()) { setCargando(false); return; }
      try { setUsuario(await obtenerPerfil()); }
      catch { setToken(null); setUsuario(null); }
      finally { setCargando(false); }
    }
    validar();
  }, []);

  // El interceptor avisa cuando el backend rechaza la sesion
  useEffect(() => {
    const onExpiry = () => logout();
    window.addEventListener("auth:401", onExpiry);
    return () => window.removeEventListener("auth:401", onExpiry);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const esAdmin = usuario?.rol === "ADMIN";

  return (
    <Ctx.Provider value={{ usuario, cargando, login, logout, esAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
