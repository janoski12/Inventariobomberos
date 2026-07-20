// Modulo "Carros": vista aparte del inventario general, solo ubicaciones tipo
// CARRO con sus items y el historial de revisiones fisicas (registradas sin
// sesion desde routes/carrosPublico.js). Requiere sesion (montado despues del
// gate de auth en server.js).
const router = require("express").Router();
const db = require("../db");
const { badRequest, notFound, serverError } = require("../lib/helpers");

// Listado de carros con resumen: total de items y ultima revision
router.get("/carros", (_req, res) => {
    const carros = db.prepare(`
        SELECT u.id, u.nombre, u.codigo_qr, u.responsable,
               (SELECT COUNT(*) FROM item i WHERE i.ubicacion_actual_id = u.id) AS total_items,
               (SELECT COUNT(*) FROM item i WHERE i.ubicacion_actual_id = u.id AND i.estado != 'OPERATIVO') AS items_no_operativos
        FROM ubicacion u
        WHERE u.tipo = 'CARRO' AND u.activo = 1
        ORDER BY u.nombre
    `).all();

    const ultimaRevision = db.prepare(`
        SELECT id, realizada_por, fecha
        FROM revision_carro WHERE ubicacion_id = ?
        ORDER BY fecha DESC, id DESC LIMIT 1
    `);
    const fallasDeRevision = db.prepare(`
        SELECT COUNT(*) AS total FROM revision_carro_item WHERE revision_id = ? AND resultado != 'OK'
    `);

    res.json(carros.map((c) => {
        const rev = ultimaRevision.get(c.id);
        return { ...c, ultima_revision: rev ? { ...rev, fallas: fallasDeRevision.get(rev.id).total } : null };
    }));
});

// Ficha de un carro: sus items (con gaveta/compartimiento) + historial de revisiones
router.get("/carros/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

    const carro = db.prepare("SELECT * FROM ubicacion WHERE id=? AND tipo='CARRO'").get(id);
    if (!carro) return notFound(res, "Carro no encontrado");

    const items = db.prepare(`
        SELECT id, codigo, descripcion, categoria, subcategoria, estado, criticidad, marca, modelo, ubicacion_detalle
        FROM item WHERE ubicacion_actual_id = ?
        ORDER BY ubicacion_detalle IS NULL, ubicacion_detalle, codigo
    `).all(id);

    const revisiones = db.prepare(`
        SELECT rc.id, rc.realizada_por, rc.fecha, rc.observacion_general,
               (SELECT COUNT(*) FROM revision_carro_item WHERE revision_id = rc.id AND resultado != 'OK') AS fallas,
               (SELECT COUNT(*) FROM revision_carro_item WHERE revision_id = rc.id) AS total_items
        FROM revision_carro rc
        WHERE rc.ubicacion_id = ?
        ORDER BY rc.fecha DESC, rc.id DESC
        LIMIT 50
    `).all(id);

    res.json({ ...carro, items, revisiones });
});

// Detalle de una revision puntual (resultado de cada item)
router.get("/carros/:id/revisiones/:revisionId", (req, res) => {
    const id = Number(req.params.id);
    const revisionId = Number(req.params.revisionId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(revisionId) || revisionId <= 0)
        return badRequest(res, "ID inválido");

    const revision = db.prepare("SELECT * FROM revision_carro WHERE id=? AND ubicacion_id=?").get(revisionId, id);
    if (!revision) return notFound(res, "Revisión no encontrada");

    const items = db.prepare(`
        SELECT rci.item_id, rci.resultado, rci.observacion, i.codigo, i.descripcion, i.ubicacion_detalle
        FROM revision_carro_item rci
        JOIN item i ON i.id = rci.item_id
        WHERE rci.revision_id = ?
        ORDER BY i.codigo
    `).all(revisionId);

    res.json({ ...revision, items });
});

// Codigo QR que lleva directo al formulario publico de revision de este carro
// (para imprimir y pegar dentro del carro; distinto del QR de ficha)
router.get("/carros/:id/qr-revision", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const carro = db.prepare("SELECT id, nombre FROM ubicacion WHERE id=? AND tipo='CARRO'").get(id);
        if (!carro) return notFound(res, "Carro no encontrado");

        const qrcode = require("qrcode");
        const origen = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
        const url = `${origen}/revision-carro/${id}`;

        const png = await qrcode.toBuffer(url, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });

        const slug = carro.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `attachment; filename="qr_revision_${slug}.png"`);
        res.send(png);
    } catch (e) {
        return serverError(res, e, "Error generando el código QR de revisión");
    }
});

module.exports = router;
