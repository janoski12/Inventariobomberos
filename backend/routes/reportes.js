const router = require("express").Router();
const db = require("../db");
const { serverError } = require("../lib/helpers");

router.get("/reportes", (_req, res) => {
    try {
        const hoy = new Date().toISOString().slice(0, 10);
        const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const porEstado = db.prepare(`
            SELECT estado, COUNT(*) AS total FROM item GROUP BY estado
        `).all();

        const porCriticidad = db.prepare(`
            SELECT criticidad, COUNT(*) AS total FROM item GROUP BY criticidad
        `).all();

        const porCategoria = db.prepare(`
            SELECT categoria, COUNT(*) AS total FROM item GROUP BY categoria ORDER BY total DESC
        `).all();

        const sinUbicar = db.prepare(`
            SELECT i.id, i.codigo, i.descripcion, i.estado, i.criticidad
            FROM item i
            WHERE i.ubicacion_actual_id IS NULL AND i.asignado_bombero_id IS NULL
            ORDER BY i.criticidad DESC, i.codigo
            LIMIT 50
        `).all();

        const controlesVencidos = db.prepare(`
            SELECT c.id, c.tipo, c.fecha_objetivo, c.observacion,
                   i.id AS item_id, i.codigo, i.descripcion
            FROM control c
            JOIN item i ON i.id = c.item_id
            WHERE c.fecha_real IS NULL AND c.fecha_objetivo < ?
            ORDER BY c.fecha_objetivo ASC
            LIMIT 100
        `).all(hoy);

        const proximosControles = db.prepare(`
            SELECT c.id, c.tipo, c.fecha_objetivo, c.observacion,
                   i.id AS item_id, i.codigo, i.descripcion
            FROM control c
            JOIN item i ON i.id = c.item_id
            WHERE c.fecha_real IS NULL AND c.fecha_objetivo >= ? AND c.fecha_objetivo <= ?
            ORDER BY c.fecha_objetivo ASC
            LIMIT 100
        `).all(hoy, en30dias);

        res.json({
            porEstado,
            porCriticidad,
            porCategoria,
            sinUbicar,
            controlesVencidos,
            proximosControles,
        });
    } catch (e) {
        return serverError(res, e, "Error generando reportes");
    }
});

module.exports = router;
