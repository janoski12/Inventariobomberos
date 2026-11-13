const router = require("express").Router();
const db = require("../db");
const { requireAdmin, quienRegistra } = require("../lib/auth");
const { upload, serverError, parseXlsxBuffer, fechaLocalISO } = require("../lib/helpers");
const { crearBackup } = require("../lib/backups");
const {
    ErrorImportacion, importarUbicaciones, importarBomberos, importarItems, cargaCompleta,
} = require("../lib/importacion");

// Las reglas de importación (validación de catálogos, celdas vacías, ubicaciones
// que conservan su id/QR en la carga completa) viven en lib/importacion.js.

// Error del contenido del archivo → 400 con la lista de errores. Otros errores
// (p.ej. RUT repetido contra la BD) se siguen respondiendo como 400 con su mensaje.
function responderError(res, e) {
    if (e instanceof ErrorImportacion) return res.status(400).json({ error: e.message, errores: e.errores });
    return res.status(400).json({ error: String(e.message ?? e) });
}

function leerLibro(buffer) {
    const xlsx = require("xlsx");
    return xlsx.read(buffer, { type: "buffer" });
}

// Importar desde Excel (carga completa: reemplaza bomberos, ítems, controles e historial) — solo admin
router.post("/importar", requireAdmin, upload.single("archivo"), async (req, res) => {
    const buffer = parseXlsxBuffer(req, res);
    if (!buffer) return;

    let wb;
    try { wb = leerLibro(buffer); } catch (e) { return responderError(res, e); }

    let respaldoFallo = null;
    try {
        const resumen = await cargaCompleta(wb, quienRegistra(req), {
            // Red de seguridad: respaldo en disco DESPUÉS de validar y ANTES de borrar
            antesDeEscribir: async () => {
                try { await crearBackup("pre_carga_completa"); } catch (e) { respaldoFallo = e; throw e; }
            },
        });
        res.json({ ok: true, resumen });
    } catch (e) {
        if (respaldoFallo) return serverError(res, respaldoFallo, "No se pudo crear el respaldo previo; la importación fue cancelada");
        return responderError(res, e);
    }
});

// Descargar plantilla de importación Excel
router.get("/plantilla", (_req, res) => {
    try {
        const xlsx = require("xlsx");

        const bomberos = [
            { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "", rut: "12345678-9", numero_registro: "101" },
            { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "", rut: "",           numero_registro: "" },
        ];
        const ubicaciones = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "", activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "", activo: 1 },
        ];
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",          subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", talla: "",  estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",               ubicacion_detalle: "",         bombero_nombre: "Juan Pérez", fecha_fabricacion: "2022-01-15", fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "TRM-0001", categoria: "TRAUMA",       subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        talla: "",  estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",    ubicacion_detalle: "",         bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "2025-01-10", fecha_vencimiento: "2027-01-10" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA",  subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  talla: "",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", ubicacion_detalle: "",       bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "COM-0001", categoria: "COMUNICACION", subcategoria: "Radio",    descripcion: "Radio Portátil VHF",    marca: "Motorola", modelo: "DP4400", serie: "MOT-007", talla: "",  estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Carro 1",        ubicacion_detalle: "Gaveta 2", bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "EPP-0002", categoria: "EPP",          subcategoria: "Chaqueta", descripcion: "Chaqueta Estructural",   marca: "Lion",     modelo: "",       serie: "SN-002",  talla: "S", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",               ubicacion_detalle: "",         bombero_nombre: "Juan Pérez", fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
        ];
        const controles = [
            { codigo_item: "EPP-0001", tipo: "INSPECCION",    fecha_objetivo: "2025-06-01", fecha_real: "",           resultado: "",         observacion: "Inspección anual" },
            { codigo_item: "HRR-0001", tipo: "MANTENCION",    fecha_objetivo: "2025-04-30", fecha_real: "",           resultado: "",         observacion: "Mantenimiento preventivo" },
            { codigo_item: "TRM-0001", tipo: "CERTIFICACION", fecha_objetivo: "2025-03-15", fecha_real: "2025-03-14", resultado: "APROBADO", observacion: "" },
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(bomberos),   "Bomberos");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(ubicaciones), "Ubicaciones");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(items),      "Items");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(controles),  "Controles");

        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_importacion.xlsx"');
        res.send(buf);
    } catch (e) {
        return serverError(res, e, "Error generando plantilla");
    }
});

// Plantilla parcial — Ubicaciones
router.get("/plantilla/ubicaciones", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const datos = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "Juan Pérez", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "",           activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "",           activo: 1 },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(datos), "Ubicaciones");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_ubicaciones.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Plantilla parcial — Bomberos
router.get("/plantilla/bomberos", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const datos = [
            { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "", rut: "12345678-9", numero_registro: "101" },
            { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "", rut: "",           numero_registro: "" },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(datos), "Bomberos");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_bomberos.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Plantilla parcial — Items
router.get("/plantilla/items", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",         subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", talla: "",  estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",             ubicacion_detalle: "",         bombero_nombre: "Juan Pérez", fecha_fabricacion: "2022-01-15", fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "TRM-0001", categoria: "TRAUMA",      subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        talla: "",  estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",  ubicacion_detalle: "",         bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "2025-01-10", fecha_vencimiento: "2027-01-10" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA", subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  talla: "",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", ubicacion_detalle: "",     bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "EPP-0002", categoria: "EPP",         subcategoria: "Chaqueta", descripcion: "Chaqueta Estructural",   marca: "Lion",     modelo: "",       serie: "SN-002",  talla: "S", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",             ubicacion_detalle: "",         bombero_nombre: "Juan Pérez", fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
        ];
        const controles = [
            { codigo_item: "EPP-0001", tipo: "INSPECCION", fecha_objetivo: "2025-06-01", fecha_real: "", resultado: "", observacion: "Inspección anual" },
            { codigo_item: "HRR-0001", tipo: "MANTENCION", fecha_objetivo: "2025-04-30", fecha_real: "", resultado: "", observacion: "Mantenimiento preventivo" },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(items),    "Items");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(controles), "Controles");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_items.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Importaciones parciales: crean o actualizan; una celda vacía nunca borra un dato existente
function rutaParcial(importar) {
    return (req, res) => {
        const buffer = parseXlsxBuffer(req, res);
        if (!buffer) return;
        try {
            const resumen = importar(leerLibro(buffer), quienRegistra(req));
            res.json({ ok: true, resumen });
        } catch (e) { return responderError(res, e); }
    };
}

router.post("/importar/ubicaciones", upload.single("archivo"), rutaParcial((wb) => importarUbicaciones(wb)));
router.post("/importar/bomberos",    upload.single("archivo"), rutaParcial((wb) => importarBomberos(wb)));
router.post("/importar/items",       upload.single("archivo"), rutaParcial((wb, quien) => importarItems(wb, quien)));

// Descargar respaldo de la base de datos (snapshot consistente) — solo admin: contiene hashes de contraseñas
router.get("/backup", requireAdmin, async (_req, res) => {
    const fs   = require("fs");
    const path = require("path");
    const tmpFile = path.join(__dirname, "..", "data", `backup_tmp_${Date.now()}.db`);
    try {
        await db.backup(tmpFile);
        const fecha = fechaLocalISO();
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="inventario_backup_${fecha}.db"`);
        res.sendFile(tmpFile, (err) => {
            fs.unlink(tmpFile, () => {});
            if (err && !res.headersSent) serverError(res, err, "Error enviando el respaldo");
        });
    } catch (e) {
        fs.unlink(tmpFile, () => {});
        return serverError(res, e, "Error generando el respaldo");
    }
});

module.exports = router;
