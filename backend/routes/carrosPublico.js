// Rutas PUBLICAS (sin sesion): permiten a cualquier bombero, escaneando el QR
// de revision pegado en un carro, ver los items de ESE carro y registrar una
// revision. No exponen nada mas del sistema (ni otros carros, ni el resto del
// inventario, ni historial), y no permiten modificar el inventario: la
// revision es un registro aparte, no cambia el estado oficial de los items.
const router = require("express").Router();
const db = require("../db");
const { cleanText, badRequest, notFound, serverError, RESULTADOS_REVISION } = require("../lib/helpers");

function obtenerCarro(id) {
    const ubicacion = db.prepare("SELECT id, nombre, tipo, codigo_qr FROM ubicacion WHERE id=?").get(id);
    if (!ubicacion || ubicacion.tipo !== "CARRO") return null;
    return ubicacion;
}

// Ficha minima del carro para el formulario publico de revision
router.get("/carros-publico/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const carro = obtenerCarro(id);
        if (!carro) return notFound(res, "Carro no encontrado");

        const items = db.prepare(`
            SELECT id, codigo, descripcion, categoria, marca, modelo, estado, ubicacion_detalle
            FROM item WHERE ubicacion_actual_id = ?
            ORDER BY ubicacion_detalle IS NULL, ubicacion_detalle, codigo
        `).all(id);

        res.json({ id: carro.id, nombre: carro.nombre, items });
    } catch (e) {
        return serverError(res, e, "Error obteniendo el carro");
    }
});

// Registrar una revision del carro (sin sesion)
router.post("/carros-publico/:id/revisiones", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const carro = obtenerCarro(id);
        if (!carro) return notFound(res, "Carro no encontrado");

        const realizadaPor = cleanText(req.body.realizada_por);
        if (!realizadaPor) return badRequest(res, "Debes indicar tu nombre");

        const observacionGeneral = cleanText(req.body.observacion_general);
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (items.length === 0) return badRequest(res, "No hay ítems para revisar");

        const itemsDelCarro = new Set(
            db.prepare("SELECT id FROM item WHERE ubicacion_actual_id=?").all(id).map((r) => r.id)
        );

        const filas = [];
        for (const it of items) {
            const itemId = Number(it.item_id);
            if (!Number.isInteger(itemId) || !itemsDelCarro.has(itemId))
                return badRequest(res, `Ítem inválido o no pertenece a este carro: ${it.item_id}`);
            const resultado = cleanText(it.resultado);
            if (!RESULTADOS_REVISION.includes(resultado))
                return badRequest(res, `Resultado inválido para el ítem ${itemId}. Use: ${RESULTADOS_REVISION.join(", ")}`);
            filas.push({ itemId, resultado, observacion: cleanText(it.observacion) });
        }

        const nuevoId = db.transaction(() => {
            const revId = db.prepare(`
                INSERT INTO revision_carro (ubicacion_id, realizada_por, observacion_general)
                VALUES (?, ?, ?)
            `).run(id, realizadaPor, observacionGeneral).lastInsertRowid;

            const insItem = db.prepare(`
                INSERT INTO revision_carro_item (revision_id, item_id, resultado, observacion)
                VALUES (?, ?, ?, ?)
            `);
            for (const f of filas) insItem.run(revId, f.itemId, f.resultado, f.observacion);

            return revId;
        })();

        res.status(201).json({ id: nuevoId });
    } catch (e) {
        return serverError(res, e, "Error registrando la revisión");
    }
});

module.exports = router;
