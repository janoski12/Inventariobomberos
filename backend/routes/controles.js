const router = require("express").Router();
const db = require("../db");
const { TIPOS_CONTROL, RESULTADOS_CONTROL, isNil, cleanText, badRequest, notFound, serverError, esFechaValida } = require("../lib/helpers");

// Listar controles de un item
router.get("/items/:id/controles", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID de item inválido");
    try {
        const rows = db.prepare(`
            SELECT * FROM control
            WHERE item_id = ?
            ORDER BY fecha_objetivo DESC
            LIMIT 200
        `).all(id);
        res.json(rows);
    } catch (e) {
        return serverError(res, e, "Error obteniendo controles");
    }
});

// Crear control para un item
router.post("/items/:id/controles", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID de item inválido");

        const item = db.prepare("SELECT id FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        const tipo = cleanText(req.body.tipo);
        const fecha_objetivo = cleanText(req.body.fecha_objetivo);
        const observacion = cleanText(req.body.observacion);

        if (!tipo) return badRequest(res, "tipo es requerido");
        if (!TIPOS_CONTROL.includes(tipo)) return badRequest(res, `tipo inválido. Use: ${TIPOS_CONTROL.join(", ")}`);
        if (!fecha_objetivo) return badRequest(res, "fecha_objetivo es requerida");
        if (!esFechaValida(fecha_objetivo)) return badRequest(res, "fecha_objetivo inválida. Use formato YYYY-MM-DD");

        const info = db.prepare(`
            INSERT INTO control (item_id, tipo, fecha_objetivo, observacion)
            VALUES (?, ?, ?, ?)
        `).run(id, tipo, fecha_objetivo, observacion ?? null);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        return serverError(res, e, "Error creando control");
    }
});

// Completar / actualizar un control
router.put("/controles/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID de control inválido");

        const actual = db.prepare("SELECT * FROM control WHERE id=?").get(id);
        if (!actual) return notFound(res, "Control no encontrado");

        const fecha_real = cleanText(req.body.fecha_real);
        const resultado = cleanText(req.body.resultado);
        const observacion = isNil(req.body.observacion) ? actual.observacion : cleanText(req.body.observacion);

        if (!fecha_real) return badRequest(res, "fecha_real es requerida");
        if (!esFechaValida(fecha_real)) return badRequest(res, "fecha_real inválida. Use formato YYYY-MM-DD");
        if (!resultado) return badRequest(res, "resultado es requerido");
        if (!RESULTADOS_CONTROL.includes(resultado)) return badRequest(res, `resultado inválido. Use: ${RESULTADOS_CONTROL.join(", ")}`);

        db.prepare(`
            UPDATE control SET fecha_real=?, resultado=?, observacion=? WHERE id=?
        `).run(fecha_real, resultado, observacion, id);

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando control");
    }
});

module.exports = router;
