const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

//Check Health
app.get("/health", (req, res) => res.json({ ok:true }));

//Crear bombero
app.post("/bomberos", (req, res) => {

    const {
        nombre,
        cargo,
        estado,
        observaciones
    } = req.body;

    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

    const stmt = db.prepare(`
       INSERT INTO bombero (nombre, cargo, estado, observaciones)
       VALUES (?, ?, COALESCE(?, 'ACTIVO'), ?) 
    `);

    const info = stmt.run(nombre, cargo ?? null, estado ?? null, observaciones ?? null);
    res.status(201).json({ id: info.lastInsertRowid });
});

//Editar bombero
app.put("/bomberos/:id", (req, res) => {
    const id = Number(req.params.id);
    const {
        nombre,
        cargo,
        estado,
        observaciones
    } = req.body;

    const existe = db.prepare("SELECT * FROM bombero WHERE id=?").get(id);
    if (!existe) return res.status(404).json({ error: "Bombero no encontrado" });

    db.prepare(`
        UPDATE bombero SET nombre=?, cargo=?, estado=?, observaciones=?
        WHERE id=?    
    `).run(nombre, cargo ?? null, estado ?? null, observaciones ?? null, id);

    res.json({ ok: true });
});

//Listar bomberos
app.get("/bomberos", (req, res) => {
    const rows = db.prepare(`SELECT * FROM bombero ORDER BY nombre`).all();
    res.json(rows);
});

//Crear ubicacion
app.post("/ubicaciones", (req, res) => {
    const {
        nombre,
        tipo,
        responsable,
        codigo_qr
    } = req.body;

    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

    const stmt = db.prepare(`
        INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr)
        VALUES (?, COALESCE(?, 'CONTAINER'), ?, ?)    
    `);

    const info = stmt.run(nombre, tipo ?? null, responsable ?? null, codigo_qr ?? null);
    res.status(201).json({ id: info.lastInsertRowid });
});

app.put("/ubicaciones/:id", (req, res) => {
    const id = Number(req.params.id);
    const {
        nombre,
        tipo,
        responsable,
        codigo_qr
    } = req.body;

    const existe = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(id);
    if (!existe) return res.status(404).json({ error: "Ubicacion no encontrada" });

    db.prepare(`
        UPDATE ubicacion SET nombre=?, tipo=?, responsable=?, codigo_qr=?
        WHERE id=?    
    `).run(nombre, tipo ?? null, responsable ?? null, codigo_qr ?? null, typeof activo === "number" ? activo : (activo ? 1 : 0), id);

    res.json({ ok: true });
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
    const{
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
    } = req.body;

    if (!codigo || !categoria || !descripcion) {
        return res.status(400).json({ error: "codigo, categoria y descripcion son requeridos" });
    }

    const stmt = db.prepare(`
        INSERT INTO item ( 
        codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'OPERATIVO'), COALESCE(?, 'MEDIA'), ?, ?)    
    `);

    try{
        const info = stmt.run(
            codigo, categoria, subcategoria ?? null, descripcion, marca ?? null, modelo ?? null, serie ?? null, estado ?? null, criticidad ?? null, 
            ubicacion_actual_id ?? null, asignado_bombero_id ?? null 
        );
        res.status(201).json({ id:info.lastInsertRowid });
    } catch (e) {
        if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "codigo ya existe" });
        res.status(500).json({ error: "error creando item", detail: String(e) });
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
    const id = Number(req.params.id);
    const { bombero_id, responsable, observacion } = req.body;

    if (!bombero_id) return res.status(400).json({ error: "bombero_id es requerido" });

    const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
    if (!item) return res.status(404).json({ error: "Item no encontrado" });
    
    const bombero = db.prepare("SELECT * FROM bombero WHERE id=?").get(bombero_id);
    if (!bombero) return res.status(404).json({ error: "Bombero no encontrado" });

    const trx = db.transaction(() => {
        //update 
        db.prepare(`UPDATE item SET asignado_bombero_id=?, ubicacion_actual_id=NULL, actualizado_en=datetime('now') WHERE id=?`).run(bombero_id, id);

        //movimiento
        db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'ASIGNACION', ?, ?, ?, ?)`)
            .run(id,
                 item.asignado_bombero_id ? `Bombero ID ${item.asignado_bombero_id}` : (item.ubicacion_actual_id ? `Ubicacion ID ${item.ubicacion_actual_id}` : "Sin asignacion"),
                 `Asignado a ${bombero.nombre}`,
                 responsable ?? "Sistema",
                 observacion ?? null
                );
    });

    trx();
    res.json({ ok: true });
});

app.post("/items/:id/mover", (req, res) => {
    const id = Number(req.params.id);
    const { ubicacion_id, responsable, observacion } = req.body;

    if (!ubicacion_id) return res.status(400).json({ error: "ubicacion_id es requerido" });

    const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
    if (!item) return res.status(404).json({ error: "Item no encontrado" });
    
    const ubicacion = db.prepare("SELECT * FROM ubicacion WHERE id=?").get(ubicacion_id);
    if (!ubicacion) return res.status(404).json({ error: "Ubicacion no encontrada" });

    const trx = db.transaction(() => {
        //update 
        db.prepare(`UPDATE item SET ubicacion_actual_id=?, asignado_bombero_id=NULL , actualizado_en=datetime('now') WHERE id=?`).run(ubicacion_id, id);

        //movimiento
        db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'TRASLADO', ?, ?, ?, ?)`)
            .run(
                id,
                item.asignado_bombero_id ? `Bombero ID ${item.asignado_bombero_id}` : (item.ubicacion_actual_id ? `Ubicacion ID ${item.ubicacion_actual_id}` : "Sin ubicacion"),
                `Ubicacion a ${ubicacion.nombre}`,
                responsable ?? "Sistema",
                observacion ?? null
                );
    });

    trx();
    res.json({ ok: true });
});

app.post("/items/:id/estado", (req, res) => {
    const id = Number(req.params.id);
    const { estado, responsable, observacion } = req.body;

    const estadosValidos = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
    if(!estado || !estadosValidos.includes(estado)){
        return res.status(400).json({ error: `estado invalido. Use: ${estadosValidos.join(", ")}` });
    }

    const item = db.prepare("SELECT * FROM item WHERE id=?").get(id);
    if (!item) return res.status(404).json({ error: "Item no encontrado" });

    const trx = db.transaction(() => {
        //update 
        db.prepare(`UPDATE item SET estado=?, actualizado_en=datetime('now') WHERE id=?`).run(estado, id);

        //movimiento
        db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion) VALUES (?, 'ESTADO', ?, ?, ?, ?)`)
            .run(
                id,
                item.estado,
                estado,
                responsable ?? "Sistema",
                observacion ?? null
                );
    });

    trx();
    res.json({ ok: true });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Inventario corriendo en http://localhost:${PORT}`));


  
