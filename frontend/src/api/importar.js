import { API_URL } from "./config";

export async function importarExcel(file) {
  const fd = new FormData();
  fd.append("archivo", file);
  const res = await fetch(`${API_URL}/importar`, { method: "POST", body: fd });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body;
}
