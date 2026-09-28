const router = require("express").Router();
const db = require("../db");
const { serverError, fechaLocalISO } = require("../lib/helpers");

router.get("/reportes", (_req, res) => {
    try {
        const hoy = fechaLocalISO();
        const en30dias = fechaLocalISO(30);

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

        // Ítems cuya revisión física MÁS RECIENTE (entre todas las revisiones de
        // carro en que participaron) resultó FALLA o FALTANTE. La revisión es un
        // registro aparte del estado oficial del item (ver routes/carrosPublico.js),
        // así que sin esto nadie se entera de un hallazgo salvo que abra el
        // historial del carro a mano. Se excluyen los ítems ya dados de baja o
        // fuera de servicio: si ya están marcados así, no hace falta alertar de nuevo.
        const itemsConProblemaEnRevision = db.prepare(`
            WITH ultima AS (
                SELECT rci.item_id, rci.resultado, rci.observacion, rc.fecha, rc.ubicacion_id,
                       ROW_NUMBER() OVER (PARTITION BY rci.item_id ORDER BY rc.fecha DESC, rc.id DESC) AS rn
                FROM revision_carro_item rci
                JOIN revision_carro rc ON rc.id = rci.revision_id
            )
            SELECT i.id AS item_id, i.codigo, i.descripcion, i.estado,
                   u.nombre AS carro_nombre, ultima.resultado, ultima.observacion, ultima.fecha
            FROM ultima
            JOIN item i ON i.id = ultima.item_id
            JOIN ubicacion u ON u.id = ultima.ubicacion_id
            WHERE ultima.rn = 1 AND ultima.resultado != 'OK' AND i.estado IN ('OPERATIVO', 'MANTENCION')
            ORDER BY ultima.fecha DESC
            LIMIT 50
        `).all();

        res.json({
            porEstado,
            porCriticidad,
            porCategoria,
            sinUbicar,
            controlesVencidos,
            proximosControles,
            itemsConProblemaEnRevision,
        });
    } catch (e) {
        return serverError(res, e, "Error generando reportes");
    }
});

module.exports = router;
