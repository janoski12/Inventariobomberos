const express = require("express");
const cors = require("cors");
const db = require("./db");

const ESTADOS_ITEM = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CRITICIDADES = ["BAJA", "MEDIA", "ALTA"];
const ESTADOS_BOMBERO = ["ACTIVO", "INACTIVO"];
const TIPOS_UBICACION = ["BODEGA", "SALA", "SALON", "CONTAINER", "CARRO", "CASILLERO", "OTRO"];

function isNil(v) {
    return v === null || v === undefined;
}

function cleanText(v) {
    if (isNil(v)) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}

function badRequest(res, message) {
    return res.status(400).json({ error: message });
}

function notFound(res, message) {
    return res.status(404).json({ error: message });
}

function conflict(res, message) {
    return res.status(409).json({ error: message });
}

function serverError(res, e, fallback = "Error en el servidor") {
    console.error(e);
    return res.status(500).json({ error: fallback, detail: String(e) });
}



const app = express();
app.use(cors());
app.use(express.json());

//Check Health
app.get("/health", (req, res) => res.json({ ok:true }));

//Crear bombero
app.post("/bomberos", (req, res) => {
    try {
        const nombre = cleanText(req.body.nombre);
        const cargo = cleanText(req.body.cargo);
        const estado = cleanText(req.body.estado) || "ACTIVO";
        const observaciones = cleanText(req.body.observaciones);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (estado && !ESTADOS_BOMBERO.includes(estado)) {
            return badRequest(res, `estado inválido. Use: ${ESTADOS_BOMBERO.join(", ")}`);
        }

        const info = db.prepare(`
            INSERT INTO bombero (nombre, cargo, estado, observaciones)
            VALUES (?, ?, ?, ?)    
        `).run(nombre, cargo ?? null, estado, observaciones ?? null);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        return serverError(res, e, "Error creando bombero");
    }
});

//Editar bombero
app.put("/bomberos/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0){
            return badRequest(res, "ID inválido");
        }

        const actual = db.prepare("SELECT * FROM bombero WHERE id=?").get(id);
        if (!actual) {
            return notFound(res, "Bombero no encontrado");
        }

        const nombre = cleanText(req.body.nombre);
        const cargo = cleanText(req.body.cargo);
        const estado = cleanText(req.body.estado);
        const observaciones = cleanText(req.body.observaciones);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!ESTADOS_BOMBERO.includes(estado)) {
            return badRequest(res, `estado inválido. Use: ${ESTADOS_BOMBERO.join(", ")}`);
        }

        db.prepare(`
            UPDATE bombero SET nombre=?, cargo=?, estado=?, observaciones=?
            WHERE id=?    
        `).run(
            nombre,
            isNil(req.body.cargo) ? actual.cargo : cargo,
            estado,
            isNil(req.body.observaciones) ? actual.observaciones : observaciones,
            id
        );

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando bombero");
    }
});

//Listar bomberos
app.get("/bomberos", (req, res) => {
    const rows = db.prepare(`SELECT * FROM bombero ORDER BY nombre`).all();
    res.json(rows);
});

//Crear ubicacion
app.post("/ubicaciones", (req, res) => {
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

        const info = db.prepare(`
            INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr, activo)
            VALUES (?, ?, ?, ?, ?)    
        `).run(nombre, tipo, responsable, codigo_qr, activo);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        return serverError(res, e, "Error creando ubicacion");
    }
});

app.put("/ubicaciones/:id", (req, res) => {
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
app.get("/ubicaciones", (req, res) => {
    const rows = db.prepare(`
        SELECT * FROM ubicacion WHERE activo=1 ORDER BY nombre    
    `).all();

    res.json(rows);
});

//Crear items
app.post("/items", (req, res) => {
    try {
        const codigo = cleanText(req.body.codigo);
        const categoria = cleanText(req.body.categoria);
        const subcategoria = cleanText(req.body.subcategoria);
        const descripcion = cleanText(req.body.descripcion);
        const marca = cleanText(req.body.marca);
        const modelo = cleanText(req.body.modelo);
        const serie = cleanText(req.body.serie);
        const estado = cleanText(req.body.estado) || "OPERATIVO";
        const criticidad = cleanText(req.body.criticidad) || "MEDIA";

        const ubicacion_actual_id = isNil(req.body.ubicacion_actual_id) ? null : Number(req.body.ubicacion_actual_id);
        const asignado_bombero_id = isNil(req.body.asignado_bombero_id) ? null : Number(req.body.asignado_bombero_id);

        if (!codigo) return badRequest(res, "codigo es requerido");
        if (!categoria) return badRequest(res, "categoria es requerida");
        if (!descripcion) return badRequest(res, "descripcion es requerida");

        if (!ESTADOS_ITEM.includes(estado)) {
            return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
        }

        if (!CRITICIDADES.includes(criticidad)) {
            return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);
        }

        if (ubicacion_actual_id && asignado_bombero_id) {
            return badRequest(res, "Un item no puede estar asignado a un bombero y una ubicación al mismo tiempo");
        }

        if (ubicacion_actual_id) {
            const ubic = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(ubicacion_actual_id);
            if (!ubic) return notFound(res, "Ubicacion no encontrada");
        }
        
        if (asignado_bombero_id) {
            const bomb = db.prepare("SELECT * FROM bombero WHERE id=?").get(asignado_bombero_id);
            if (!bomb) return notFound(res, "Bombero no encontrado");
        }

        const info = db.prepare(`
            INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            codigo,
            categoria,
            subcategoria,
            descripcion,
            marca,
            modelo,
            serie,
            estado,
            criticidad,
            ubicacion_actual_id,
            asignado_bombero_id
        );

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) {
        if (String(e).includes("UNIQUE")) {
            return conflict(res, "El código del item ya existe");
        }
        return serverError(res, e, "Error creando item");
    }
});

// Buscar items (por código o descripción)
app.get("/items", (req, res) => {
  const q = (req.query.q ?? "").trim();

  const baseSelect = `
    SELECT
        i.*,
        u.nombre AS ubicacion_nombre,
        b.nombre AS bombero_nombre
    FROM item i
    LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
    LEFT JOIN bombero b ON b.id = i.asignado_bombero_id
  `;

  if (!q) {
    const rows = db.prepare(`
        ${baseSelect}
        ORDER BY i.id DESC
        LIMIT 50    
    `).all();
    return res.json(rows);
  }

  const like = `%${q}%`;
  const rows = db.prepare(`
    ${baseSelect}
    WHERE i.codigo LIKE ? OR i.descripcion LIKE ?
    ORDER BY i.codigo
    LIMIT 200
  `).all(like, like);

  res.json(rows);
});

//editar item
app.put("/items/:id", (req, res) => {
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
    } catch (e) {
        return serverError(res, e, "Error actualizando item");
    }
});

app.get("/items/:id/movimientos", (req, res) => {
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

app.get("/items/:id", (req, res) => {
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

app.post("/items/:id/asignar", (req, res) => {
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

        const trx = db.transaction(() => {
            //update 
            db.prepare(`UPDATE item SET asignado_bombero_id=?, ubicacion_actual_id=NULL, actualizado_en=datetime('now') WHERE id=?`).run(bombero_id, id);

            //movimiento
            db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'ASIGNACION', ?, ?, ?, ?)`)
                .run(
                    id,
                    item.asignado_bombero_id
                        ? `Bombero ID ${item.asignado_bombero_id}`
                        : item.ubicacion_actual_id
                            ? `Ubicacion ID ${item.ubicacion_actual_id}`
                            : "Sin ubicacion",
                    `Asignado a Bombero ${bombero.nombre}`,
                    responsable,
                    observacion ?? null
                );
        });

        trx();
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error asignando item");
    }
});

app.post("/items/:id/mover", (req, res) => {
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

        const trx = db.transaction(() => {
            //update
            db.prepare(`UPDATE item SET ubicacion_actual_id=?, asignado_bombero_id=NULL, actualizado_en=datetime('now') WHERE id=?`).run(ubicacion_id, id);

            //movimiento
            db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'MOVIMIENTO', ?, ?, ?, ?)`)
                .run(
                    id,
                    item.asignado_bombero_id
                        ? `Bombero ID ${item.asignado_bombero_id}`
                        : item.ubicacion_actual_id
                            ? `Ubicacion ID ${item.ubicacion_actual_id}`
                            : "Sin ubicacion",
                    `Movido a Ubicacion ${ubicacion.nombre}`,
                    responsable,
                    observacion
                );
        });

        trx();
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error moviendo item");
    }
});

app.post("/items/:id/estado", (req, res) => {
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

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Inventario corriendo en http://localhost:${PORT}`));


  
