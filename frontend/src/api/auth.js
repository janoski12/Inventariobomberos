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

export const login = (username, password) =>
  request(`${API_URL}/auth/login`, { method: "POST", ...json({ username, password }) });

export const obtenerPerfil = () =>
  request(`${API_URL}/auth/me`);

export const cambiarPassword = (actual, nueva) =>
  request(`${API_URL}/auth/password`, { method: "PUT", ...json({ actual, nueva }) });

export const listarUsuarios = () =>
  request(`${API_URL}/usuarios`);

export const crearUsuario = (payload) =>
  request(`${API_URL}/usuarios`, { method: "POST", ...json(payload) });

export const actualizarUsuario = (id, payload) =>
  request(`${API_URL}/usuarios/${id}`, { method: "PUT", ...json(payload) });

export const eliminarUsuario = (id) =>
  request(`${API_URL}/usuarios/${id}`, { method: "DELETE" });
