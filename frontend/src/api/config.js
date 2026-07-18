// Ruta relativa: la app y la API se sirven desde el mismo origen.
// En desarrollo, el proxy de Vite (vite.config.js) redirige /api al backend.
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";
