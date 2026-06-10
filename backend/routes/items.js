const router = require("express").Router();
const db = require("../db");
const { ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, isNil, cleanText, badRequest, notFound, conflict, serverError, esFechaValida } = require("../lib/helpers");

//Crear items
router.post("/items", (req, res) => {
    try {
        const codigo            = cleanText(req.body.codigo);
        const categoria         = cleanText(req.body.categoria);
        const subcategoria      = cleanText(req.body.subcategoria);
        const descripcion       = cleanText(req.body.descripcion);
        const marca             = cleanText(req.body.marca);
        const modelo            = cleanText(req.body.modelo);
        const serie             = cleanText(req.body.serie);
        const estado            = cleanText(req.body.estado) || "OPERATIVO";
        const criticidad        = cleanText(req.body.criticidad) || "MEDIA";
        const fecha_fabricacion = cleanText(req.body.fecha_fabricacion);

        const ubicacion_actual_id = isNil(req.body.ubicacion_actual_id) ? null : Number(req.body.ubicacion_actual_id);
        const asignado_bombero_id = isNil(req.body.asignado_bombero_id) ? null : Number(req.body.asignado_bombero_id);

        if (!codigo) return badRequest(res, "codigo es requerido");
        if (!categoria) return badRequest(res, "categoria es requerida");
        if (!descripcion) return badRequest(res, "descripcion es requerida");

        if (!ESTADOS_ITEM.includes(estado)) {
            return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
        }
        if (!CATEGORIAS.includes(categoria)) {
            return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
        }
        if (!CRITICIDADES.includes(criticidad)) {
            return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);
        }
        if (fecha_fabricacion && !esFechaValida(fecha_fabricacion)) {
            return badRequest(res, "fecha_fabricacion inválida. Use formato YYYY-MM-DD");
        }

        if (!isNil(req.body.ubicacion_actual_id) && (!Number.isInteger(ubicacion_actual_id) || ubicacion_actual_id <= 0)) {
            return badRequest(res, "ubicacion_actual_id inválido");
        }
        if (!isNil(req.body.asignado_bombero_id) && (!Number.isInteger(asignado_bombero_id) || asignado_bombero_id <= 0)) {
            return badRequest(res, "asignado_bombero_id inválido");
        }
        if (ubicacion_actual_id && asignado_bombero_id) {
            return badRequest(res, "Un item no puede estar asignado a un bombero y una ubicación al mismo tiempo");
        }

        let ubicacion = null;
        let bombero = null;

        if (ubicacion_actual_id) {
            ubicacion = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(ubicacion_actual_id);
            if (!ubicacion) return notFound(res, "Ubicacion no encontrada");
        }
        if (asignado_bombero_id) {
            bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(asignado_bombero_id);
            if (!bombero) return notFound(res, "Bombero no encontrado");
        }

        const nuevoId = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id, fecha_fabricacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id, fecha_fabricacion ?? null);

            const itemId = info.lastInsertRowid;
            const hacia = bombero
                ? `Asignado a ${bombero.nombre}`
                : ubicacion
                    ? `Ubicado en ${ubicacion.nombre}`
                    : "Sin asignar";

            db.prepare(`
                INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion)
                VALUES (?, 'CREACION', 'Nuevo item', ?, 'Sistema', NULL)
            `).run(itemId, hacia);

            return itemId;
        })();

        res.status(201).json({ id: nuevoId });
    } catch (e) {
        if (String(e).includes("UNIQUE")) {
            return conflict(res, "El código del item ya existe");
        }
        return serverError(res, e, "Error creando item");
    }
});

// Buscar items (por código o descripción, con filtros opcionales)
router.get("/items", (req, res) => {
  const q           = (req.query.q          ?? "").trim();
  const estado      = (req.query.estado     ?? "").trim();
  const categoria   = (req.query.categoria  ?? "").trim();
  const criticidad  = (req.query.criticidad ?? "").trim();
  const bombero_id  = req.query.bombero_id  ? Number(req.query.bombero_id)  : null;
  const ubicacion_id= req.query.ubicacion_id? Number(req.query.ubicacion_id): null;

  if (estado     && !ESTADOS_ITEM.includes(estado))
    return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
  if (categoria  && !CATEGORIAS.includes(categoria))
    return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
  if (criticidad && !CRITICIDADES.includes(criticidad))
    return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);

  const baseSelect = `
    SELECT i.*, u.nombre AS ubicacion_nombre, b.nombre AS bombero_nombre
    FROM item i
    LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
    LEFT JOIN bombero   b ON b.id = i.asignado_bombero_id
  `;

  const conditions = [];
  const params     = [];

  if (q)           { conditions.push("(i.codigo LIKE ? OR i.descripcion LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (estado)      { conditions.push("i.estado = ?");               params.push(estado); }
  if (categoria)   { conditions.push("i.categoria = ?");            params.push(categoria); }
  if (criticidad)  { conditions.push("i.criticidad = ?");           params.push(criticidad); }
  if (bombero_id)  { conditions.push("i.asignado_bombero_id = ?");  params.push(bombero_id); }
  if (ubicacion_id){ conditions.push("i.ubicacion_actual_id = ?");  params.push(ubicacion_id); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = q ? "ORDER BY i.codigo" : "ORDER BY i.id DESC";
  const limit = (q || conditions.length) ? 500 : 50;

  const rows = db.prepare(`${baseSelect} ${where} ${order} LIMIT ${limit}`).all(...params);
  res.json(rows);
});

//editar item
router.put("/items/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0){
            return badRequest(res, "ID inválido");
        }

        const actual = db.prepare("SELECT * FROM item WHERE id=?").get(id);
        if (!actual) {
            return notFound(res, "Item no encontrado");
        }

        const codigo = cleanText(req.body.codigo) ?? actual.codigo;
        const categoria = cleanText(req.body.categoria) ?? actual.categoria;
        const subcategoria = isNil(req.body.subcategoria) ? actual.subcategoria : cleanText(req.body.subcategoria);
        const descripcion = cleanText(req.body.descripcion) ?? actual.descripcion;
        const marca = isNil(req.body.marca) ? actual.marca : cleanText(req.body.marca);
        const modelo = isNil(req.body.modelo) ? actual.modelo : cleanText(req.body.modelo);
        const serie = isNil(req.body.serie) ? actual.serie : cleanText(req.body.serie);
        const criticidad = cleanText(req.body.criticidad) ?? actual.criticidad;

        if (!codigo) return badRequest(res, "codigo es requerido");
        if (!categoria) return badRequest(res, "categoria es requerida");
        if (!descripcion) return badRequest(res, "descripcion es requerida");

        if (!CATEGORIAS.includes(categoria)) {
            return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
        }
        if (!CRITICIDADES.includes(criticidad)) {
            return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);
        }

        const duplicado = db.prepare("SELECT * FROM item WHERE codigo=? AND id<>?").get(codigo, id);
        if (duplicado) {
            return conflict(res, "El código del item ya existe");
        }

        db.prepare(`
            UPDATE item
            SET
            codigo=?,
            categoria=?,
            subcategoria=?,
            descripcion=?,
            marca=?,
            modelo=?,
            serie=?,
            criticidad=?,
            actualizado_en=datetime('now')
            WHERE id=?
        `).run(
            codigo,
            categoria,
            subcategoria,
            descripcion,
            marca,
            modelo,
            serie,
            criticidad,
            id
        );

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando item");
    }
});

router.get("/items/:id/movimientos", (req, res) => {
    const id = Number(req.params.id);

    try{
        const rows = db.prepare(`
            SELECT *
            FROM movimiento
            WHERE item_id = ?
            ORDER BY datetime(fecha) DESC
            LIMIT 200
    `).all(id);

    res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Error obteniendo los movimientos", detail: String(e) });
    }
});

// Exportar inventario filtrado a Excel
router.get("/items/exportar", (req, res) => {
    try {
        const xlsx = require("xlsx");
        const q            = (req.query.q          ?? "").trim();
        const estado       = (req.query.estado     ?? "").trim();
        const categoria    = (req.query.categoria  ?? "").trim();
        const criticidad   = (req.query.criticidad ?? "").trim();
        const bombero_id   = req.query.bombero_id  ? Number(req.query.bombero_id)  : null;
        const ubicacion_id = req.query.ubicacion_id? Number(req.query.ubicacion_id): null;

        if (estado     && !ESTADOS_ITEM.includes(estado))
            return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
        if (categoria  && !CATEGORIAS.includes(categoria))
            return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
        if (criticidad && !CRITICIDADES.includes(criticidad))
            return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);

        const conditions = [], params = [];
        if (q)           { conditions.push("(i.codigo LIKE ? OR i.descripcion LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
        if (estado)      { conditions.push("i.estado = ?");               params.push(estado); }
        if (categoria)   { conditions.push("i.categoria = ?");            params.push(categoria); }
        if (criticidad)  { conditions.push("i.criticidad = ?");           params.push(criticidad); }
        if (bombero_id)  { conditions.push("i.asignado_bombero_id = ?");  params.push(bombero_id); }
        if (ubicacion_id){ conditions.push("i.ubicacion_actual_id = ?");  params.push(ubicacion_id); }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = db.prepare(`
            SELECT i.codigo, i.descripcion, i.categoria, i.subcategoria, i.estado, i.criticidad,
                   i.marca, i.modelo, i.serie,
                   b.nombre AS asignado_a, u.nombre AS ubicacion,
                   i.fecha_recepcion, i.fecha_vencimiento, i.fecha_fabricacion
            FROM item i
            LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
            LEFT JOIN bombero   b ON b.id = i.asignado_bombero_id
            ${where}
            ORDER BY i.codigo
        `).all(...params);

        const datos = rows.map(r => ({
            "Código":             r.codigo,
            "Descripción":        r.descripcion,
            "Categoría":          r.categoria,
            "Subcategoría":       r.subcategoria ?? "",
            "Estado":             r.estado,
            "Criticidad":         r.criticidad,
            "Marca":              r.marca ?? "",
            "Modelo":             r.modelo ?? "",
            "Serie":              r.serie ?? "",
            "Asignado a":         r.asignado_a ?? "",
            "Ubicación":          r.ubicacion ?? "",
            "Fecha Fabricación":  r.fecha_fabricacion ?? "",
            "Fecha Recepción":    r.fecha_recepcion ?? "",
            "Fecha Vencimiento":  r.fecha_vencimiento ?? "",
        }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(datos), "Inventario");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        const fecha = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="inventario_${fecha}.xlsx"`);
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error exportando inventario"); }
});

// Metadatos para dropdowns creativos
router.get("/items/meta/subcategorias", (req, res) => {
    const { categoria } = req.query;
    const rows = categoria
        ? db.prepare("SELECT DISTINCT subcategoria FROM item WHERE categoria = ? AND subcategoria IS NOT NULL ORDER BY subcategoria").all(categoria)
        : db.prepare("SELECT DISTINCT subcategoria FROM item WHERE subcategoria IS NOT NULL ORDER BY subcategoria").all();
    res.json(rows.map(r => r.subcategoria));
});

router.get("/items/meta/marcas", (_req, res) => {
    const rows = db.prepare("SELECT DISTINCT marca FROM item WHERE marca IS NOT NULL ORDER BY marca").all();
    res.json(rows.map(r => r.marca));
});

router.get("/items/meta/modelos", (req, res) => {
    const { marca } = req.query;
    const rows = marca
        ? db.prepare("SELECT DISTINCT modelo FROM item WHERE marca = ? AND modelo IS NOT NULL ORDER BY modelo").all(marca)
        : db.prepare("SELECT DISTINCT modelo FROM item WHERE modelo IS NOT NULL ORDER BY modelo").all();
    res.json(rows.map(r => r.modelo));
});

router.get("/items/:id", (req, res) => {
    const id = Number(req.params.id);

    const row = db.prepare(`
        SELECT
        it.*,
        ub.nombre AS ubicacion_nombre,
        bo.nombre AS bombero_nombre
        FROM item it
        LEFT JOIN ubicacion ub ON ub.id = it.ubicacion_actual_id
        LEFT JOIN bombero bo ON bo.id = it.asignado_bombero_id
        WHERE it.id = ?
    `).get(id);

    if (!row) return res.status(404).json({ error: "Item no encontrado" });
    res.json(row);
});

router.post("/items/:id/asignar", (req, res) => {
    try {
        const id = Number(req.params.id);
        const bombero_id = Number(req.body.bombero_id);
        const responsable = cleanText(req.body.responsable) || "Sistema";
        const observacion = cleanText(req.body.observacion);

        if (!Number.isInteger(id) || id <= 0){
            return badRequest(res, "ID de item inválido");
        }
        if (!Number.isInteger(bombero_id) || bombero_id <= 0){
            return badRequest(res, "ID de bombero inválido");
        }

        const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(bombero_id);
        if (!bombero) return notFound(res, "Bombero no encontrado");

        const desdeAsignar = item.asignado_bombero_id
            ? `Asignado a ${db.prepare("SELECT nombre FROM bombero WHERE id=?").get(item.asignado_bombero_id)?.nombre ?? "Bombero desconocido"}`
            : item.ubicacion_actual_id
                ? `Ubicado en ${db.prepare("SELECT nombre FROM ubicacion WHERE id=?").get(item.ubicacion_actual_id)?.nombre ?? "Ubicación desconocida"}`
                : "Sin asignación";

        const trx = db.transaction(() => {
            db.prepare(`UPDATE item SET asignado_bombero_id=?, ubicacion_actual_id=NULL, actualizado_en=datetime('now') WHERE id=?`).run(bombero_id, id);
            db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'ASIGNACION', ?, ?, ?, ?)`)
                .run(id, desdeAsignar, `Asignado a ${bombero.nombre}`, responsable, observacion ?? null);
        });

        trx();
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error asignando item");
    }
});

router.post("/items/:id/mover", (req, res) => {
    try {
        const id = Number(req.params.id);
        const ubicacion_id = Number(req.body.ubicacion_id);
        const responsable = cleanText(req.body.responsable) || "Sistema";
        const observacion = cleanText(req.body.observacion);

        if (!Number.isInteger(id) || id <= 0){ return badRequest(res, "ID de item inválido"); }
        if (!Number.isInteger(ubicacion_id) || ubicacion_id <= 0){
            return badRequest(res, "ID de ubicacion inválido");
        }

        const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        const ubicacion = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(ubicacion_id);
        if (!ubicacion) return notFound(res, "Ubicacion no encontrada");

        const desdeMover = item.asignado_bombero_id
            ? `Asignado a ${db.prepare("SELECT nombre FROM bombero WHERE id=?").get(item.asignado_bombero_id)?.nombre ?? "Bombero desconocido"}`
            : item.ubicacion_actual_id
                ? `Ubicado en ${db.prepare("SELECT nombre FROM ubicacion WHERE id=?").get(item.ubicacion_actual_id)?.nombre ?? "Ubicación desconocida"}`
                : "Sin asignación";

        const trx = db.transaction(() => {
            db.prepare(`UPDATE item SET ubicacion_actual_id=?, asignado_bombero_id=NULL, actualizado_en=datetime('now') WHERE id=?`).run(ubicacion_id, id);
            db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'MOVIMIENTO', ?, ?, ?, ?)`)
                .run(id, desdeMover, `Ubicado en ${ubicacion.nombre}`, responsable, observacion);
        });

        trx();
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error moviendo item");
    }
});

router.post("/items/:id/estado", (req, res) => {
    try {
        const id = Number(req.params.id);
        const estado = cleanText(req.body.estado);
        const responsable = cleanText(req.body.responsable) || "Sistema";
        const observacion = cleanText(req.body.observacion);

        if (!Number.isInteger(id) || id <= 0){ return badRequest(res, "ID de item inválido"); }
        if (!estado) return badRequest(res, "Estado es requerido");
        if (!ESTADOS_ITEM.includes(estado)) {
            return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
        }

        const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        const trx = db.transaction(() => {
            //update
            db.prepare(`UPDATE item SET estado=?, actualizado_en=datetime('now') WHERE id=?`).run(estado, id);

            //movimiento
            db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'CAMBIO_ESTADO', ?, ?, ?, ?)`)
                .run(
                    id,
                    item.estado,
                    estado,
                    responsable,
                    observacion
                );
        });

        trx();
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error cambiando estado del item");
    }
});

// Eliminar item (cascada: usos trauma, controles y movimientos)
router.delete("/items/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        db.transaction(() => {
            db.prepare("DELETE FROM uso_trauma WHERE item_id=?").run(id);
            db.prepare("DELETE FROM control   WHERE item_id=?").run(id);
            db.prepare("DELETE FROM movimiento WHERE item_id=?").run(id);
            db.prepare("DELETE FROM item       WHERE id=?").run(id);
        })();

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error eliminando item");
    }
});

module.exports = router;
