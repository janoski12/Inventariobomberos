const router = require("express").Router();
const db = require("../db");
const { TIPOS_UBICACION, isNil, cleanText, badRequest, notFound, conflict, serverError } = require("../lib/helpers");

//Crear ubicacion
router.post("/ubicaciones", (req, res) => {
    try {
        const nombre = cleanText(req.body.nombre);
        const tipo = cleanText(req.body.tipo) || "BODEGA";
        const responsable = cleanText(req.body.responsable);
        const codigo_qr = cleanText(req.body.codigo_qr);
        const activo = isNil(req.body.activo) ? 1 : Number(req.body.activo);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!TIPOS_UBICACION.includes(tipo)) {
            return badRequest(res, `tipo inválido. Use: ${TIPOS_UBICACION.join(", ")}`);
        }
        if (![0,1].includes(activo)) {
            return badRequest(res, "activo debe ser 0 o 1");
        }

        if (db.prepare("SELECT id FROM ubicacion WHERE nombre=?").get(nombre))
            return conflict(res, `Ya existe una ubicación llamada "${nombre}"`);

        // Si no viene codigo_qr, se genera uno automatico (UBIC-0001) tras conocer el id
        const nuevoId = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr, activo)
                VALUES (?, ?, ?, ?, ?)
            `).run(nombre, tipo, responsable, codigo_qr, activo);

            const id = info.lastInsertRowid;
            if (!codigo_qr) {
                const codigo = `UBIC-${String(id).padStart(4, "0")}`;
                db.prepare("UPDATE ubicacion SET codigo_qr=? WHERE id=?").run(codigo, id);
            }
            return id;
        })();

        res.status(201).json({ id: nuevoId });
    } catch (e) {
        return serverError(res, e, "Error creando ubicacion");
    }
});

router.put("/ubicaciones/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0){
            return badRequest(res, "ID inválido");
        }

        const actual = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(id);
        if (!actual) {
            return notFound(res, "Ubicacion no encontrada");
        }

        const nombre = cleanText(req.body.nombre) ?? actual.nombre;
        const tipo = cleanText(req.body.tipo) ?? actual.tipo;
        const responsable = cleanText(req.body.responsable);
        const codigo_qr = cleanText(req.body.codigo_qr);
        const activo = isNil(req.body.activo) ? actual.activo : Number(req.body.activo);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!TIPOS_UBICACION.includes(tipo)) {
            return badRequest(res, `tipo inválido. Use: ${TIPOS_UBICACION.join(", ")}`);
        }
        if (![0,1].includes(activo)) {
            return badRequest(res, "activo debe ser 0 o 1");
        }

        if (db.prepare("SELECT id FROM ubicacion WHERE nombre=? AND id!=?").get(nombre, id))
            return conflict(res, `Ya existe una ubicación llamada "${nombre}"`);

        db.prepare(`
            UPDATE ubicacion
            SET nombre=?, tipo=?, responsable=?, codigo_qr=?, activo=?
            WHERE id=?
        `).run(
            nombre,
            tipo,
            isNil(req.body.responsable) ? actual.responsable : responsable,
            isNil(req.body.codigo_qr) ? actual.codigo_qr : codigo_qr,
            activo,
            id
        );

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando ubicacion");
    }
});

//Listar ubicaciones
router.get("/ubicaciones", (req, res) => {
    const rows = db.prepare("SELECT * FROM ubicacion WHERE activo=1 ORDER BY nombre").all();
    res.json(rows);
});

// Codigo QR de la ubicacion en PNG (codifica la URL de la ficha)
router.get("/ubicaciones/:id/qr", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const ubicacion = db.prepare("SELECT id, nombre, codigo_qr FROM ubicacion WHERE id=?").get(id);
        if (!ubicacion) return notFound(res, "Ubicacion no encontrada");

        const qrcode = require("qrcode");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const url = `${frontendUrl}/ubicaciones/${id}`;

        const png = await qrcode.toBuffer(url, {
            type: "png",
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
        });

        const slug = ubicacion.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `attachment; filename="qr_${slug}.png"`);
        res.send(png);
    } catch (e) {
        return serverError(res, e, "Error generando el código QR");
    }
});

// Ficha de ubicación con sus ítems
router.get("/ubicaciones/:id", (req, res) => {
    const id = Number(req.params.id);
    const ubicacion = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(id);
    if (!ubicacion) return notFound(res, "Ubicación no encontrada");

    const items = db.prepare(`
        SELECT id, codigo, descripcion, categoria, subcategoria, estado, criticidad, marca, modelo
        FROM item WHERE ubicacion_actual_id = ?
        ORDER BY codigo
    `).all(id);

    res.json({ ...ubicacion, items });
});

// Eliminar ubicacion (bloqueada si tiene items)
router.delete("/ubicaciones/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const ubicacion = db.prepare("SELECT id FROM ubicacion WHERE id=?").get(id);
        if (!ubicacion) return notFound(res, "Ubicacion no encontrada");

        const conItems = db.prepare("SELECT COUNT(*) AS total FROM item WHERE ubicacion_actual_id=?").get(id);
        if (conItems.total > 0) {
            return res.status(409).json({
                error: `No se puede eliminar: tiene ${conItems.total} ítem(s) en esta ubicación. Muévelos primero.`,
            });
        }

        db.prepare("DELETE FROM ubicacion WHERE id=?").run(id);
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error eliminando ubicacion");
    }
});

module.exports = router;
