const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { quienRegistra } = require("../lib/auth");
const {
    upload, badRequest, notFound, conflict, serverError, cleanText, fechaLocalISO,
    parseDocumentoBuffer, ESTADOS_ASIGNACION,
} = require("../lib/helpers");
const { generarActaEntrega, DOCS_DIR } = require("../lib/documentos");

// Solicitar la asignación de un ítem a un bombero: genera el acta de entrega (PDF sin firmar).
// El ítem NO cambia de dueño todavía — eso ocurre recién al confirmar con el documento firmado.
router.post("/items/:id/asignaciones", async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const bomberoId = Number(req.body.bombero_id);
        const observacion = cleanText(req.body.observacion);

        if (!Number.isInteger(itemId) || itemId <= 0) return badRequest(res, "ID de ítem inválido");
        if (!Number.isInteger(bomberoId) || bomberoId <= 0) return badRequest(res, "ID de bombero inválido");

        const item = db.prepare("SELECT * FROM item WHERE id=?").get(itemId);
        if (!item) return notFound(res, "Ítem no encontrado");
        const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(bomberoId);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const yaPendiente = db.prepare("SELECT id FROM asignacion_pendiente WHERE item_id=? AND estado='PENDIENTE'").get(itemId);
        if (yaPendiente) return conflict(res, "Este ítem ya tiene una asignación pendiente de firma. Confírmala o cancélala primero.");

        const solicitadoPor = quienRegistra(req);
        const fecha = fechaLocalISO();

        const nuevoId = db.prepare(`
            INSERT INTO asignacion_pendiente (item_id, bombero_id, estado, documento_path, observacion, solicitado_por)
            VALUES (?, ?, 'PENDIENTE', '', ?, ?)
        `).run(itemId, bomberoId, observacion, solicitadoPor).lastInsertRowid;

        try {
            const documentoPath = await generarActaEntrega(nuevoId, { item, bombero, solicitadoPor, fecha, observacion });
            db.prepare("UPDATE asignacion_pendiente SET documento_path=? WHERE id=?").run(documentoPath, nuevoId);
        } catch (e) {
            db.prepare("DELETE FROM asignacion_pendiente WHERE id=?").run(nuevoId);
            throw e;
        }

        res.status(201).json({ id: nuevoId });
    } catch (e) {
        if (String(e).includes("UNIQUE")) return conflict(res, "Este ítem ya tiene una asignación pendiente de firma.");
        return serverError(res, e, "Error generando la solicitud de asignación");
    }
});

// Listado de solicitudes (por defecto, las pendientes de firma) — para el panel de Reportes
router.get("/asignaciones", (req, res) => {
    const estado = ESTADOS_ASIGNACION.includes(req.query.estado) ? req.query.estado : "PENDIENTE";
    const rows = db.prepare(`
        SELECT ap.id, ap.estado, ap.observacion, ap.solicitado_por, ap.fecha_solicitud,
               ap.confirmado_por, ap.fecha_confirmacion,
               i.id AS item_id, i.codigo AS item_codigo, i.descripcion AS item_descripcion,
               b.id AS bombero_id, b.nombre AS bombero_nombre
        FROM asignacion_pendiente ap
        JOIN item i ON i.id = ap.item_id
        JOIN bombero b ON b.id = ap.bombero_id
        WHERE ap.estado = ?
        ORDER BY ap.fecha_solicitud ASC
    `).all(estado);
    res.json(rows);
});

// Acta de entrega sin firmar (PDF, para imprimir)
router.get("/asignaciones/:id/documento", (req, res) => {
    const id = Number(req.params.id);
    const solicitud = db.prepare("SELECT documento_path FROM asignacion_pendiente WHERE id=?").get(id);
    if (!solicitud || !solicitud.documento_path) return notFound(res, "Documento no encontrado");
    if (!fs.existsSync(solicitud.documento_path)) return notFound(res, "El archivo del documento ya no existe en el servidor");
    res.sendFile(solicitud.documento_path);
});

// Documento firmado, subido por el usuario al confirmar
router.get("/asignaciones/:id/documento-firmado", (req, res) => {
    const id = Number(req.params.id);
    const solicitud = db.prepare("SELECT documento_firmado_path FROM asignacion_pendiente WHERE id=?").get(id);
    if (!solicitud || !solicitud.documento_firmado_path) return notFound(res, "Documento firmado no encontrado");
    if (!fs.existsSync(solicitud.documento_firmado_path)) return notFound(res, "El archivo ya no existe en el servidor");
    res.sendFile(solicitud.documento_firmado_path);
});

// Confirmar: sube el documento firmado y recién ahí se concreta la asignación
router.post("/asignaciones/:id/confirmar", upload.single("archivo"), (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const solicitud = db.prepare("SELECT * FROM asignacion_pendiente WHERE id=?").get(id);
        if (!solicitud) return notFound(res, "Solicitud no encontrada");
        if (solicitud.estado !== "PENDIENTE") return badRequest(res, "Esta solicitud ya fue resuelta");

        const archivo = parseDocumentoBuffer(req, res);
        if (!archivo) return;

        const item = db.prepare("SELECT * FROM item WHERE id=?").get(solicitud.item_id);
        if (!item) return notFound(res, "Ítem no encontrado");
        const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(solicitud.bombero_id);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const desde = item.asignado_bombero_id
            ? `Asignado a ${db.prepare("SELECT nombre FROM bombero WHERE id=?").get(item.asignado_bombero_id)?.nombre ?? "Bombero desconocido"}`
            : item.ubicacion_actual_id
                ? `Ubicado en ${db.prepare("SELECT nombre FROM ubicacion WHERE id=?").get(item.ubicacion_actual_id)?.nombre ?? "Ubicación desconocida"}`
                : "Sin asignación";

        const quien = quienRegistra(req);
        const destino = path.join(DOCS_DIR, `firmado_${id}.${archivo.ext}`);
        fs.writeFileSync(destino, archivo.buffer);

        db.transaction(() => {
            db.prepare(`
                UPDATE item SET asignado_bombero_id=?, ubicacion_actual_id=NULL, actualizado_en=datetime('now','localtime')
                WHERE id=?
            `).run(solicitud.bombero_id, solicitud.item_id);

            db.prepare(`
                INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha, asignacion_id)
                VALUES (?, 'ASIGNACION', ?, ?, ?, ?, datetime('now','localtime'), ?)
            `).run(solicitud.item_id, desde, `Asignado a ${bombero.nombre}`, quien, solicitud.observacion, id);

            db.prepare(`
                UPDATE asignacion_pendiente
                SET estado='CONFIRMADA', documento_firmado_path=?, confirmado_por=?, fecha_confirmacion=datetime('now','localtime')
                WHERE id=?
            `).run(destino, quien, id);
        })();

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error confirmando la asignación");
    }
});

// Cancelar una solicitud pendiente (el ítem no llegó a cambiar de dueño)
router.post("/asignaciones/:id/cancelar", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const solicitud = db.prepare("SELECT id, estado FROM asignacion_pendiente WHERE id=?").get(id);
        if (!solicitud) return notFound(res, "Solicitud no encontrada");
        if (solicitud.estado !== "PENDIENTE") return badRequest(res, "Esta solicitud ya fue resuelta");

        db.prepare(`
            UPDATE asignacion_pendiente
            SET estado='CANCELADA', confirmado_por=?, fecha_confirmacion=datetime('now','localtime')
            WHERE id=?
        `).run(quienRegistra(req), id);

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error cancelando la solicitud");
    }
});

module.exports = router;
