const multer = require("multer");
const crypto = require("crypto");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ESTADOS_ITEM       = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CRITICIDADES       = ["BAJA", "MEDIA", "ALTA"];
const CATEGORIAS         = ["EPP", "TRAUMA", "HERRAMIENTA", "COMUNICACION", "OTRO"];
const ESTADOS_BOMBERO    = ["ACTIVO", "INACTIVO"];
const TIPOS_UBICACION    = ["BODEGA", "SALA", "SALON", "CONTAINER", "CARRO", "CASILLERO", "OTRO"];
const TIPOS_CONTROL      = ["INSPECCION", "MANTENCION", "CERTIFICACION", "OTRO"];
const RESULTADOS_CONTROL = ["APROBADO", "RECHAZADO", "PENDIENTE"];
const ESTADOS_ASIGNACION = ["PENDIENTE", "CONFIRMADA", "CANCELADA"];
const RESULTADOS_REVISION = ["OK", "FALLA", "FALTANTE"];
const EXT_DOCUMENTO      = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

// Contraseña temporal aleatoria para usuarios nuevos (o al resetear la de
// otro usuario): 10 caracteres, sin 0/O/1/l/I para que no se preste a
// confusión al transcribirla a mano o dictarla por teléfono.
function generarPasswordTemporal(longitud = 10) {
    const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.randomBytes(longitud);
    let out = "";
    for (let i = 0; i < longitud; i++) out += alfabeto[bytes[i] % alfabeto.length];
    return out;
}

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
    return res.status(500).json({ error: fallback });
}

// Fecha local del servidor en YYYY-MM-DD (toISOString daria la fecha UTC,
// que en Chile se adelanta un dia desde las 20:00-21:00)
function fechaLocalISO(offsetDias = 0) {
    const d = new Date(Date.now() + offsetDias * 86400000);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

// Valida formato YYYY-MM-DD y que sea una fecha real de calendario
function esFechaValida(s) {
    if (typeof s !== "string") return false;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function parseXlsxBuffer(req, res) {
    if (!req.file) { badRequest(res, "No se recibió ningún archivo"); return null; }
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") { badRequest(res, "El archivo debe ser .xlsx o .xls"); return null; }
    return req.file.buffer;
}

// Valida el archivo subido como acta de entrega firmada (foto o escaneo)
function parseDocumentoBuffer(req, res) {
    if (!req.file) { badRequest(res, "Debes subir el documento firmado"); return null; }
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (!EXT_DOCUMENTO[ext]) { badRequest(res, "El documento debe ser PDF, JPG o PNG"); return null; }
    return { buffer: req.file.buffer, ext, mime: EXT_DOCUMENTO[ext] };
}

module.exports = {
    upload,
    ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, ESTADOS_BOMBERO, TIPOS_UBICACION,
    TIPOS_CONTROL, RESULTADOS_CONTROL, ESTADOS_ASIGNACION, RESULTADOS_REVISION,
    isNil, cleanText, badRequest, notFound, conflict, serverError, generarPasswordTemporal,
    normXlsx, normFechaXlsx, parseXlsxBuffer, esFechaValida, fechaLocalISO, parseDocumentoBuffer,
};
