import { API_URL } from "../api/config";

const KEY = "cbt10_token";

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

// Instala un interceptor sobre window.fetch que:
//  - agrega el header Authorization a las llamadas al backend
//  - emite el evento "auth:401" cuando el backend rechaza la sesion
// Se llama una vez al iniciar la app.
export function instalarInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    const esApi = url.startsWith(API_URL);

    if (esApi) {
      const token = getToken();
      if (token) {
        const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
        init = { ...init, headers };
      }
    }

    const res = await originalFetch(input, init);

    // No disparamos logout por el propio login fallido
    if (esApi && res.status === 401 && !url.endsWith("/auth/login")) {
      window.dispatchEvent(new CustomEvent("auth:401"));
    }
    return res;
  };
}
