const router = require("express").Router();
const db = require("../db");
const { cleanText, badRequest, notFound, serverError, esFechaValida } = require("../lib/helpers");

// Listar todos los ítems TRAUMA con fechas y conteo de usos
router.get("/trauma", (_req, res) => {
    try {
        const rows = db.prepare(`
            SELECT
                i.*,
                u.nombre AS ubicacion_nombre,
                b.nombre AS bombero_nombre,
                (SELECT COUNT(*) FROM uso_trauma WHERE item_id = i.id) AS total_usos
            FROM item i
            LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
            LEFT JOIN bombero  b ON b.id = i.asignado_bombero_id
            WHERE i.categoria = 'TRAUMA'
            ORDER BY
                CASE WHEN i.fecha_vencimiento IS NULL THEN 1 ELSE 0 END,
                i.fecha_vencimiento ASC,
                i.codigo
        `).all();
        res.json(rows);
    } catch (e) { return serverError(res, e, "Error obteniendo material trauma"); }
});

// Exportar material trauma a Excel (items + historial de usos)
router.get("/trauma/exportar", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const hoy  = new Date().toISOString().slice(0, 10);
        const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const items = db.prepare(`
            SELECT
                i.codigo, i.descripcion, i.subcategoria, i.marca, i.modelo, i.estado,
                i.fecha_fabricacion, i.fecha_recepcion, i.fecha_vencimiento,
                u.nombre AS ubicacion_nombre,
                b.nombre AS bombero_nombre,
                (SELECT COUNT(*) FROM uso_trauma WHERE item_id = i.id)                          AS total_usos,
                (SELECT COALESCE(SUM(cantidad), 0) FROM uso_trauma WHERE item_id = i.id)        AS unidades_usadas
            FROM item i
            LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
            LEFT JOIN bombero  b ON b.id = i.asignado_bombero_id
            WHERE i.categoria = 'TRAUMA'
            ORDER BY
                CASE WHEN i.fecha_vencimiento IS NULL THEN 1 ELSE 0 END,
                i.fecha_vencimiento ASC,
                i.codigo
        `).all();

        const estadoVenc = (f) => !f ? "SIN FECHA" : f < hoy ? "VENCIDO" : f <= en30 ? "POR VENCER" : "VIGENTE";

        const hojaTrauma = items.map(r => ({
            "Código":            r.codigo,
            "Descripción":       r.descripcion,
            "Subcategoría":      r.subcategoria ?? "",
            "Marca":             r.marca ?? "",
            "Modelo":            r.modelo ?? "",
            "Estado":            r.estado,
            "Ubicación":         r.ubicacion_nombre ?? r.bombero_nombre ?? "",
            "Fecha Fabricación": r.fecha_fabricacion ?? "",
            "Fecha Recepción":   r.fecha_recepcion ?? "",
            "Fecha Vencimiento": r.fecha_vencimiento ?? "",
            "Estado Vencimiento":estadoVenc(r.fecha_vencimiento),
            "Registros de Uso":  r.total_usos,
            "Unidades Usadas":   r.unidades_usadas,
        }));

        const usos = db.prepare(`
            SELECT i.codigo, i.descripcion, ut.fecha, ut.cantidad, ut.motivo, ut.responsable, ut.observacion
            FROM uso_trauma ut
            JOIN item i ON i.id = ut.item_id
            ORDER BY ut.fecha DESC, ut.id DESC
        `).all();

        const hojaUsos = usos.map(r => ({
            "Código":      r.codigo,
            "Descripción": r.descripcion,
            "Fecha":       r.fecha,
            "Cantidad":    r.cantidad,
            "Motivo":      r.motivo ?? "",
            "Responsable": r.responsable ?? "",
            "Observación": r.observacion ?? "",
        }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(hojaTrauma), "Trauma");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(hojaUsos.length ? hojaUsos : [{ "Código": "", "Descripción": "", "Fecha": "", "Cantidad": "", "Motivo": "", "Responsable": "", "Observación": "" }]), "Usos");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="trauma_${hoy}.xlsx"`);
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error exportando material trauma"); }
});

// Actualizar fechas de recepción y vencimiento
router.put("/trauma/:id/fechas", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id, categoria FROM item WHERE id = ?").get(id);
        if (!item) return notFound(res, "Ítem no encontrado");
        if (item.categoria !== "TRAUMA") return badRequest(res, "El ítem no es de categoría TRAUMA");

        const fecha_recepcion   = cleanText(req.body.fecha_recepcion)   || null;
        const fecha_vencimiento = cleanText(req.body.fecha_vencimiento) || null;

        if (fecha_recepcion && !esFechaValida(fecha_recepcion))
            return badRequest(res, "fecha_recepcion inválida. Use formato YYYY-MM-DD");
        if (fecha_vencimiento && !esFechaValida(fecha_vencimiento))
            return badRequest(res, "fecha_vencimiento inválida. Use formato YYYY-MM-DD");
        if (fecha_recepcion && fecha_vencimiento && fecha_vencimiento < fecha_recepcion)
            return badRequest(res, "La fecha de vencimiento no puede ser anterior a la de recepción");

        db.prepare(`UPDATE item SET fecha_recepcion=?, fecha_vencimiento=?, actualizado_en=datetime('now') WHERE id=?`)
            .run(fecha_recepcion, fecha_vencimiento, id);

        res.json({ ok: true });
    } catch (e) { return serverError(res, e, "Error actualizando fechas"); }
});

// Historial de usos de un ítem trauma
router.get("/trauma/:id/usos", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");
        const rows = db.prepare(`SELECT * FROM uso_trauma WHERE item_id = ? ORDER BY fecha DESC LIMIT 200`).all(id);
        res.json(rows);
    } catch (e) { return serverError(res, e, "Error obteniendo usos"); }
});

// Registrar uso de un ítem trauma
router.post("/trauma/:id/usos", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id, categoria FROM item WHERE id = ?").get(id);
        if (!item) return notFound(res, "Ítem no encontrado");
        if (item.categoria !== "TRAUMA") return badRequest(res, "El ítem no es de categoría TRAUMA");

        const cantidad    = Math.max(1, Number(req.body.cantidad) || 1);
        const motivo      = cleanText(req.body.motivo);
        const responsable = cleanText(req.body.responsable);
        const observacion = cleanText(req.body.observacion);
        const fecha       = cleanText(req.body.fecha) || new Date().toISOString().slice(0, 10);

        if (!esFechaValida(fecha))
            return badRequest(res, "fecha inválida. Use formato YYYY-MM-DD");

        const info = db.prepare(`
            INSERT INTO uso_trauma (item_id, fecha, cantidad, motivo, responsable, observacion)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, fecha, cantidad, motivo, responsable, observacion);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { return serverError(res, e, "Error registrando uso"); }
});

// Eliminar registro de uso
router.delete("/trauma/usos/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");
        const uso = db.prepare("SELECT id FROM uso_trauma WHERE id = ?").get(id);
        if (!uso) return notFound(res, "Registro no encontrado");
        db.prepare("DELETE FROM uso_trauma WHERE id = ?").run(id);
        res.json({ ok: true });
    } catch (e) { return serverError(res, e, "Error eliminando uso"); }
});

module.exports = router;
