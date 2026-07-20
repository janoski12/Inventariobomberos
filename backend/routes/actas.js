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

function itemsDeActa(actaId) {
    return db.prepare(`
        SELECT i.id, i.codigo, i.descripcion
        FROM acta_entrega_item ai
        JOIN item i ON i.id = ai.item_id
        WHERE ai.acta_id = ?
        ORDER BY i.codigo
    `).all(actaId);
}

// Solicitar la entrega de uno o varios ítems a un bombero: genera el acta de
// recepción (PDF sin firmar). Los ítems NO cambian de dueño todavía — eso
// ocurre recién al confirmar con el documento firmado.
router.post("/actas-entrega", async (req, res) => {
    try {
        const bomberoId = Number(req.body.bombero_id);
        const itemIds = Array.isArray(req.body.item_ids) ? [...new Set(req.body.item_ids.map(Number))] : [];
        const observacion = cleanText(req.body.observacion);

        if (!Number.isInteger(bomberoId) || bomberoId <= 0) return badRequest(res, "ID de bombero inválido");
        if (itemIds.length === 0 || itemIds.some((n) => !Number.isInteger(n) || n <= 0))
            return badRequest(res, "Debes seleccionar al menos un ítem válido");

        const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(bomberoId);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const items = itemIds.map((id) => db.prepare("SELECT * FROM item WHERE id=?").get(id));
        const faltantes = itemIds.filter((id, i) => !items[i]);
        if (faltantes.length > 0) return notFound(res, `Ítem(s) no encontrado(s): ${faltantes.join(", ")}`);

        const yaPendientes = db.prepare(`
            SELECT i.codigo FROM acta_entrega_item ai
            JOIN acta_entrega ae ON ae.id = ai.acta_id
            JOIN item i ON i.id = ai.item_id
            WHERE ae.estado = 'PENDIENTE' AND ai.item_id IN (${itemIds.map(() => "?").join(",")})
        `).all(...itemIds);
        if (yaPendientes.length > 0)
            return conflict(res, `Ya hay una entrega pendiente de firma con: ${yaPendientes.map((r) => r.codigo).join(", ")}`);

        const solicitadoPor = quienRegistra(req);
        const fecha = fechaLocalISO();

        const nuevoId = db.transaction(() => {
            const id = db.prepare(`
                INSERT INTO acta_entrega (bombero_id, estado, documento_path, observacion, solicitado_por)
                VALUES (?, 'PENDIENTE', '', ?, ?)
            `).run(bomberoId, observacion, solicitadoPor).lastInsertRowid;

            const insItem = db.prepare("INSERT INTO acta_entrega_item (acta_id, item_id) VALUES (?, ?)");
            for (const itemId of itemIds) insItem.run(id, itemId);

            return id;
        })();

        try {
            const documentoPath = await generarActaEntrega(nuevoId, { bombero, items, solicitadoPor, fecha, observacion });
            db.prepare("UPDATE acta_entrega SET documento_path=? WHERE id=?").run(documentoPath, nuevoId);
        } catch (e) {
            db.transaction(() => {
                db.prepare("DELETE FROM acta_entrega_item WHERE acta_id=?").run(nuevoId);
                db.prepare("DELETE FROM acta_entrega WHERE id=?").run(nuevoId);
            })();
            throw e;
        }

        res.status(201).json({ id: nuevoId });
    } catch (e) {
        return serverError(res, e, "Error generando la solicitud de entrega");
    }
});

// Listado de actas (por defecto, pendientes de firma) — para el panel de Reportes
router.get("/actas-entrega", (req, res) => {
    const estado = ESTADOS_ASIGNACION.includes(req.query.estado) ? req.query.estado : "PENDIENTE";
    const actas = db.prepare(`
        SELECT ae.id, ae.estado, ae.observacion, ae.solicitado_por, ae.fecha_solicitud,
               ae.confirmado_por, ae.fecha_confirmacion,
               b.id AS bombero_id, b.nombre AS bombero_nombre
        FROM acta_entrega ae
        JOIN bombero b ON b.id = ae.bombero_id
        WHERE ae.estado = ?
        ORDER BY ae.fecha_solicitud ASC
    `).all(estado);
    res.json(actas.map((a) => ({ ...a, items: itemsDeActa(a.id) })));
});

// Acta de recepción sin firmar (PDF, para imprimir)
router.get("/actas-entrega/:id/documento", (req, res) => {
    const id = Number(req.params.id);
    const acta = db.prepare("SELECT documento_path FROM acta_entrega WHERE id=?").get(id);
    if (!acta || !acta.documento_path) return notFound(res, "Documento no encontrado");
    if (!fs.existsSync(acta.documento_path)) return notFound(res, "El archivo del documento ya no existe en el servidor");
    res.sendFile(acta.documento_path);
});

// Documento firmado, subido por el usuario al confirmar
router.get("/actas-entrega/:id/documento-firmado", (req, res) => {
    const id = Number(req.params.id);
    const acta = db.prepare("SELECT documento_firmado_path FROM acta_entrega WHERE id=?").get(id);
    if (!acta || !acta.documento_firmado_path) return notFound(res, "Documento firmado no encontrado");
    if (!fs.existsSync(acta.documento_firmado_path)) return notFound(res, "El archivo ya no existe en el servidor");
    res.sendFile(acta.documento_firmado_path);
});

// Confirmar: sube el documento firmado y recién ahí se concreta la entrega de todos los items del acta
router.post("/actas-entrega/:id/confirmar", upload.single("archivo"), (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const acta = db.prepare("SELECT * FROM acta_entrega WHERE id=?").get(id);
        if (!acta) return notFound(res, "Solicitud no encontrada");
        if (acta.estado !== "PENDIENTE") return badRequest(res, "Esta solicitud ya fue resuelta");

        const archivo = parseDocumentoBuffer(req, res);
        if (!archivo) return;

        const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(acta.bombero_id);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const itemIds = db.prepare("SELECT item_id FROM acta_entrega_item WHERE acta_id=?").all(id).map((r) => r.item_id);

        const quien = quienRegistra(req);
        const destino = path.join(DOCS_DIR, `firmado_${id}.${archivo.ext}`);
        fs.writeFileSync(destino, archivo.buffer);

        db.transaction(() => {
            for (const itemId of itemIds) {
                const item = db.prepare("SELECT * FROM item WHERE id=?").get(itemId);
                if (!item) continue; // el item pudo haber sido eliminado despues de solicitar

                const desde = item.asignado_bombero_id
                    ? `Asignado a ${db.prepare("SELECT nombre FROM bombero WHERE id=?").get(item.asignado_bombero_id)?.nombre ?? "Bombero desconocido"}`
                    : item.ubicacion_actual_id
                        ? `Ubicado en ${db.prepare("SELECT nombre FROM ubicacion WHERE id=?").get(item.ubicacion_actual_id)?.nombre ?? "Ubicación desconocida"}`
                        : "Sin asignación";

                db.prepare(`
                    UPDATE item SET asignado_bombero_id=?, ubicacion_actual_id=NULL, actualizado_en=datetime('now','localtime')
                    WHERE id=?
                `).run(acta.bombero_id, itemId);

                db.prepare(`
                    INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha, asignacion_id)
                    VALUES (?, 'ASIGNACION', ?, ?, ?, ?, datetime('now','localtime'), ?)
                `).run(itemId, desde, `Asignado a ${bombero.nombre}`, quien, acta.observacion, id);
            }

            db.prepare(`
                UPDATE acta_entrega
                SET estado='CONFIRMADA', documento_firmado_path=?, confirmado_por=?, fecha_confirmacion=datetime('now','localtime')
                WHERE id=?
            `).run(destino, quien, id);
        })();

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error confirmando la entrega");
    }
});

// Cancelar una solicitud pendiente (ningún item cambió de dueño)
router.post("/actas-entrega/:id/cancelar", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const acta = db.prepare("SELECT id, estado FROM acta_entrega WHERE id=?").get(id);
        if (!acta) return notFound(res, "Solicitud no encontrada");
        if (acta.estado !== "PENDIENTE") return badRequest(res, "Esta solicitud ya fue resuelta");

        db.prepare(`
            UPDATE acta_entrega
            SET estado='CANCELADA', confirmado_por=?, fecha_confirmacion=datetime('now','localtime')
            WHERE id=?
        `).run(quienRegistra(req), id);

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error cancelando la solicitud");
    }
});

module.exports = router;
module.exports.itemsDeActa = itemsDeActa;
