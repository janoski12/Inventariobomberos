const router = require("express").Router();
const db = require("../db");
const { ESTADOS_BOMBERO, cleanText, badRequest, notFound, conflict, serverError } = require("../lib/helpers");

//Crear bombero
router.post("/bomberos", (req, res) => {
    try {
        const nombre          = cleanText(req.body.nombre);
        const cargo           = cleanText(req.body.cargo);
        const estado          = (cleanText(req.body.estado) || "ACTIVO").toUpperCase();
        const observaciones   = cleanText(req.body.observaciones);
        const rut             = cleanText(req.body.rut);
        const numero_registro = cleanText(req.body.numero_registro);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!ESTADOS_BOMBERO.includes(estado))
            return badRequest(res, `estado inválido. Use: ${ESTADOS_BOMBERO.join(", ")}`);

        if (db.prepare("SELECT id FROM bombero WHERE nombre=?").get(nombre))
            return conflict(res, `Ya existe un bombero llamado "${nombre}"`);
        if (rut && db.prepare("SELECT id FROM bombero WHERE rut=?").get(rut))
            return conflict(res, `Ya existe un bombero con el RUT ${rut}`);
        if (numero_registro && db.prepare("SELECT id FROM bombero WHERE numero_registro=?").get(numero_registro))
            return conflict(res, `Ya existe un bombero con el N° de registro ${numero_registro}`);

        const info = db.prepare(`
            INSERT INTO bombero (nombre, cargo, estado, observaciones, rut, numero_registro)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(nombre, cargo ?? null, estado, observaciones ?? null, rut ?? null, numero_registro ?? null);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        return serverError(res, e, "Error creando bombero");
    }
});

//Editar bombero
router.put("/bomberos/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const actual = db.prepare("SELECT * FROM bombero WHERE id=?").get(id);
        if (!actual) return notFound(res, "Bombero no encontrado");

        const nombre          = cleanText(req.body.nombre);
        const cargo           = cleanText(req.body.cargo);
        const estado          = (cleanText(req.body.estado) || "ACTIVO").toUpperCase();
        const observaciones   = cleanText(req.body.observaciones);
        const rut             = cleanText(req.body.rut);
        const numero_registro = cleanText(req.body.numero_registro);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!ESTADOS_BOMBERO.includes(estado))
            return badRequest(res, `estado inválido. Use: ${ESTADOS_BOMBERO.join(", ")}`);

        if (db.prepare("SELECT id FROM bombero WHERE nombre=? AND id!=?").get(nombre, id))
            return conflict(res, `Ya existe un bombero llamado "${nombre}"`);
        const rutExiste = rut && db.prepare("SELECT id FROM bombero WHERE rut=? AND id!=?").get(rut, id);
        if (rutExiste) return conflict(res, `Ya existe un bombero con el RUT ${rut}`);
        const regExiste = numero_registro && db.prepare("SELECT id FROM bombero WHERE numero_registro=? AND id!=?").get(numero_registro, id);
        if (regExiste) return conflict(res, `Ya existe un bombero con el N° de registro ${numero_registro}`);

        db.prepare(`
            UPDATE bombero SET nombre=?, cargo=?, estado=?, observaciones=?, rut=?, numero_registro=?
            WHERE id=?
        `).run(nombre, cargo ?? null, estado, observaciones ?? null, rut ?? null, numero_registro ?? null, id);

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando bombero");
    }
});

// Ficha de bombero con sus ítems asignados
router.get("/bomberos/:id", (req, res) => {
    const id = Number(req.params.id);
    const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(id);
    if (!bombero) return notFound(res, "Bombero no encontrado");

    const items = db.prepare(`
        SELECT id, codigo, descripcion, categoria, subcategoria, estado, criticidad, marca, modelo
        FROM item WHERE asignado_bombero_id = ?
        ORDER BY codigo
    `).all(id);

    res.json({ ...bombero, items });
});

//Listar bomberos
router.get("/bomberos", (req, res) => {
    const rows = db.prepare(`SELECT * FROM bombero ORDER BY nombre`).all();
    res.json(rows);
});

// Eliminar bombero (bloqueado si tiene items asignados)
router.delete("/bomberos/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const bombero = db.prepare("SELECT id FROM bombero WHERE id=?").get(id);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const asignados = db.prepare("SELECT COUNT(*) AS total FROM item WHERE asignado_bombero_id=?").get(id);
        if (asignados.total > 0) {
            return res.status(409).json({
                error: `No se puede eliminar: tiene ${asignados.total} ítem(s) asignado(s). Reasígnalos primero.`,
            });
        }

        db.prepare("DELETE FROM bombero WHERE id=?").run(id);
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error eliminando bombero");
    }
});

module.exports = router;
