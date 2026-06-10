const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ESTADOS_ITEM       = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CRITICIDADES       = ["BAJA", "MEDIA", "ALTA"];
const CATEGORIAS         = ["EPP", "TRAUMA", "HERRAMIENTA", "COMUNICACION", "OTRO"];
const ESTADOS_BOMBERO    = ["ACTIVO", "INACTIVO"];
const TIPOS_UBICACION    = ["BODEGA", "SALA", "SALON", "CONTAINER", "CARRO", "CASILLERO", "OTRO"];
const TIPOS_CONTROL      = ["INSPECCION", "MANTENCION", "CERTIFICACION", "OTRO"];
const RESULTADOS_CONTROL = ["APROBADO", "RECHAZADO", "PENDIENTE"];

function isNil(v) {
    return v === null || v === undefined;
}

function cleanText(v) {
    if (isNil(v)) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}

function badRequest(res, message) {
    return res.status(400).json({ error: message });
}

function notFound(res, message) {
    return res.status(404).json({ error: message });
}

function conflict(res, message) {
    return res.status(409).json({ error: message });
}

function serverError(res, e, fallback = "Error en el servidor") {
    console.error(e);
    return res.status(500).json({ error: fallback, detail: String(e) });
}

function normXlsx(v) {
    if (v === undefined || v === null) return "";
    return String(v).trim();
}

// Normaliza una celda de fecha de Excel a "YYYY-MM-DD" (o null).
// Acepta numeros de serie de Excel, objetos Date, "YYYY-MM-DD" y "DD/MM/YYYY".
function normFechaXlsx(v) {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) {
        const d = new Date(Math.round((v - 25569) * 86400000));
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
}

function parseXlsxBuffer(req, res) {
    if (!req.file) { badRequest(res, "No se recibió ningún archivo"); return null; }
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") { badRequest(res, "El archivo debe ser .xlsx o .xls"); return null; }
    return req.file.buffer;
}

module.exports = {
    upload,
    ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, ESTADOS_BOMBERO, TIPOS_UBICACION,
    TIPOS_CONTROL, RESULTADOS_CONTROL,
    isNil, cleanText, badRequest, notFound, conflict, serverError,
    normXlsx, normFechaXlsx, parseXlsxBuffer,
};
