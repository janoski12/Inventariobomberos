// Fecha local en YYYY-MM-DD (toISOString daria la fecha UTC, que en Chile
// se adelanta un dia desde las 20:00-21:00)
export function fechaLocalISO(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
