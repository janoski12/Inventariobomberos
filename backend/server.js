require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const db      = require("./db");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ESTADOS_ITEM    = ["OPERATIVO", "MANTENCION", "FUERA_SERVICIO", "BAJA"];
const CRITICIDADES    = ["BAJA", "MEDIA", "ALTA"];
const CATEGORIAS      = ["EPP", "TRAUMA", "HERRAMIENTA", "COMUNICACION", "OTRO"];
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
        const nombre          = cleanText(req.body.nombre);
        const cargo           = cleanText(req.body.cargo);
        const estado          = (cleanText(req.body.estado) || "ACTIVO").toUpperCase();
        const observaciones   = cleanText(req.body.observaciones);
        const rut             = cleanText(req.body.rut);
        const numero_registro = cleanText(req.body.numero_registro);

        if (!nombre) return badRequest(res, "nombre es requerido");
        if (!ESTADOS_BOMBERO.includes(estado))
            return badRequest(res, `estado inválido. Use: ${ESTADOS_BOMBERO.join(", ")}`);

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
app.put("/bomberos/:id", (req, res) => {
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
app.get("/bomberos/:id", (req, res) => {
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
    const rows = db.prepare("SELECT * FROM ubicacion WHERE activo=1 ORDER BY nombre").all();
    res.json(rows);
});

// Ficha de ubicación con sus ítems
app.get("/ubicaciones/:id", (req, res) => {
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
        if (!CATEGORIAS.includes(categoria)) {
            return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
        }
        if (!CRITICIDADES.includes(criticidad)) {
            return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);
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
                INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id);

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
app.get("/items", (req, res) => {
  const q          = (req.query.q         ?? "").trim();
  const estado     = (req.query.estado    ?? "").trim();
  const categoria  = (req.query.categoria ?? "").trim();
  const criticidad = (req.query.criticidad ?? "").trim();

  if (estado     && !ESTADOS_ITEM.includes(estado))
    return badRequest(res, `estado inválido. Use: ${ESTADOS_ITEM.join(", ")}`);
  if (categoria  && !CATEGORIAS.includes(categoria))
    return badRequest(res, `categoria inválida. Use: ${CATEGORIAS.join(", ")}`);
  if (criticidad && !CRITICIDADES.includes(criticidad))
    return badRequest(res, `criticidad inválida. Use: ${CRITICIDADES.join(", ")}`);

  const baseSelect = `
    SELECT
        i.*,
        u.nombre AS ubicacion_nombre,
        b.nombre AS bombero_nombre
    FROM item i
    LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
    LEFT JOIN bombero b ON b.id = i.asignado_bombero_id
  `;

  const conditions = [];
  const params     = [];

  if (q) {
    conditions.push("(i.codigo LIKE ? OR i.descripcion LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (estado)     { conditions.push("i.estado = ?");     params.push(estado); }
  if (categoria)  { conditions.push("i.categoria = ?");  params.push(categoria); }
  if (criticidad) { conditions.push("i.criticidad = ?"); params.push(criticidad); }

  const where  = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order  = q ? "ORDER BY i.codigo" : "ORDER BY i.id DESC";
  const limit  = q ? 200 : 50;

  const rows = db.prepare(`${baseSelect} ${where} ${order} LIMIT ${limit}`).all(...params);
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

// Metadatos para dropdowns creativos
app.get("/items/meta/subcategorias", (req, res) => {
    const { categoria } = req.query;
    const rows = categoria
        ? db.prepare("SELECT DISTINCT subcategoria FROM item WHERE categoria = ? AND subcategoria IS NOT NULL ORDER BY subcategoria").all(categoria)
        : db.prepare("SELECT DISTINCT subcategoria FROM item WHERE subcategoria IS NOT NULL ORDER BY subcategoria").all();
    res.json(rows.map(r => r.subcategoria));
});

app.get("/items/meta/marcas", (_req, res) => {
    const rows = db.prepare("SELECT DISTINCT marca FROM item WHERE marca IS NOT NULL ORDER BY marca").all();
    res.json(rows.map(r => r.marca));
});

app.get("/items/meta/modelos", (req, res) => {
    const { marca } = req.query;
    const rows = marca
        ? db.prepare("SELECT DISTINCT modelo FROM item WHERE marca = ? AND modelo IS NOT NULL ORDER BY modelo").all(marca)
        : db.prepare("SELECT DISTINCT modelo FROM item WHERE modelo IS NOT NULL ORDER BY modelo").all();
    res.json(rows.map(r => r.modelo));
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

// Importar desde Excel
app.post("/importar", upload.single("archivo"), (req, res) => {
    if (!req.file) return badRequest(res, "No se recibió ningún archivo");

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") return badRequest(res, "El archivo debe ser .xlsx o .xls");

    try {
        const xlsx = require("xlsx");
        const wb   = xlsx.read(req.file.buffer, { type: "buffer" });

        function readSheet(name) {
            const ws = wb.Sheets[name];
            if (!ws) throw new Error(`No existe la hoja "${name}" en el archivo`);
            return xlsx.utils.sheet_to_json(ws, { defval: "" });
        }

        function norm(v) {
            if (v === undefined || v === null) return "";
            return String(v).trim();
        }

        const bomberos   = readSheet("Bomberos");
        const ubicaciones = readSheet("Ubicaciones");
        const items      = readSheet("Items");
        const controles  = readSheet("Controles");

        // Validaciones de unicidad
        const uNames = new Set();
        for (const u of ubicaciones) {
            const n = norm(u.nombre); if (!n) continue;
            if (uNames.has(n)) return badRequest(res, `Ubicación duplicada: "${n}"`);
            uNames.add(n);
        }
        const bNames = new Set();
        for (const b of bomberos) {
            const n = norm(b.nombre); if (!n) continue;
            if (bNames.has(n)) return badRequest(res, `Bombero duplicado: "${n}"`);
            bNames.add(n);
        }
        const codes = new Set();
        for (const it of items) {
            const c = norm(it.codigo); if (!c) continue;
            if (codes.has(c)) return badRequest(res, `Código de ítem duplicado: "${c}"`);
            codes.add(c);
        }

        const insUbicacion = db.prepare(`INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr, activo) VALUES (?, ?, ?, ?, ?)`);
        const insBombero   = db.prepare(`INSERT INTO bombero (nombre, cargo, estado, observaciones) VALUES (?, ?, ?, ?)`);
        const insItem      = db.prepare(`INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insControl   = db.prepare(`INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion) VALUES (?, ?, ?, ?, ?, ?)`);
        const insMov       = db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);

        db.transaction(() => {
            db.prepare("DELETE FROM movimiento").run();
            db.prepare("DELETE FROM control").run();
            db.prepare("DELETE FROM item").run();
            db.prepare("DELETE FROM bombero").run();
            db.prepare("DELETE FROM ubicacion").run();

            for (const u of ubicaciones) {
                const nombre = norm(u.nombre); if (!nombre) continue;
                const tipo   = TIPOS_UBICACION.includes(norm(u.tipo).toUpperCase()) ? norm(u.tipo).toUpperCase() : "OTRO";
                insUbicacion.run(nombre, tipo, norm(u.responsable) || null, norm(u.codigo_qr) || null, norm(u.activo) === "0" ? 0 : 1);
            }

            const ubicMap = new Map();
            for (const r of db.prepare("SELECT id, nombre FROM ubicacion").all()) ubicMap.set(r.nombre, r.id);

            for (const b of bomberos) {
                const nombre = norm(b.nombre); if (!nombre) continue;
                insBombero.run(nombre, norm(b.cargo) || null, norm(b.estado).toUpperCase() || "ACTIVO", norm(b.observaciones) || null);
            }

            const bomMap = new Map();
            for (const r of db.prepare("SELECT id, nombre FROM bombero").all()) bomMap.set(r.nombre, r.id);

            for (const it of items) {
                const codigo = norm(it.codigo); if (!codigo) continue;
                const categoria  = CATEGORIAS.includes(norm(it.categoria).toUpperCase()) ? norm(it.categoria).toUpperCase() : "OTRO";
                const estado     = ESTADOS_ITEM.includes(norm(it.estado).toUpperCase())  ? norm(it.estado).toUpperCase()    : "OPERATIVO";
                const criticidad = CRITICIDADES.includes(norm(it.criticidad).toUpperCase()) ? norm(it.criticidad).toUpperCase() : "MEDIA";
                const ubicNombre = norm(it.ubicacion_nombre);
                const bomNombre  = norm(it.bombero_nombre);
                if (ubicNombre && bomNombre) throw new Error(`Ítem "${codigo}": no puede tener ubicación y bombero simultáneamente`);
                const ubicId = ubicNombre ? ubicMap.get(ubicNombre) ?? (() => { throw new Error(`Ítem "${codigo}": ubicación no encontrada "${ubicNombre}"`); })() : null;
                const bomId  = bomNombre  ? bomMap.get(bomNombre)   ?? (() => { throw new Error(`Ítem "${codigo}": bombero no encontrado "${bomNombre}"`);   })() : null;
                insItem.run(codigo, categoria, norm(it.subcategoria) || null, norm(it.descripcion) || codigo, norm(it.marca) || null, norm(it.modelo) || null, norm(it.serie) || null, estado, criticidad, ubicId, bomId);
            }

            const itemMap = new Map();
            for (const r of db.prepare("SELECT id, codigo FROM item").all()) itemMap.set(r.codigo, r.id);

            for (const c of controles) {
                const codigo_item = norm(c.codigo_item); if (!codigo_item) continue;
                const itemId = itemMap.get(codigo_item);
                if (!itemId) throw new Error(`Control referencia ítem inexistente: "${codigo_item}"`);
                const tipo = TIPOS_CONTROL.includes(norm(c.tipo).toUpperCase()) ? norm(c.tipo).toUpperCase() : "INSPECCION";
                insControl.run(itemId, tipo, norm(c.fecha_objetivo) || null, norm(c.fecha_real) || null, norm(c.resultado) || null, norm(c.observacion) || null);
            }

            for (const r of db.prepare(`SELECT it.id, u.nombre AS ubic, b.nombre AS bom FROM item it LEFT JOIN ubicacion u ON u.id = it.ubicacion_actual_id LEFT JOIN bombero b ON b.id = it.asignado_bombero_id`).all()) {
                const hacia = r.bom ? `Asignado a ${r.bom}` : r.ubic ? `Ubicado en ${r.ubic}` : "Sin ubicación";
                insMov.run(r.id, "ALTA", "Carga inicial", hacia, "Sistema", "Importación desde Excel");
            }
        })();

        res.json({
            ok: true,
            resumen: {
                bomberos:   bomberos.filter(b => norm(b.nombre)).length,
                ubicaciones: ubicaciones.filter(u => norm(u.nombre)).length,
                items:       items.filter(i => norm(i.codigo)).length,
                controles:   controles.filter(c => norm(c.codigo_item)).length,
            },
        });
    } catch (e) {
        return res.status(400).json({ error: String(e.message ?? e) });
    }
});

// Descargar plantilla de importación Excel
app.get("/plantilla", (_req, res) => {
    try {
        const xlsx = require("xlsx");

        const bomberos = [
            { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "" },
            { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "" },
        ];
        const ubicaciones = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "", codigo_qr: "", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "", codigo_qr: "", activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "", codigo_qr: "", activo: 1 },
        ];
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",          subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",               bombero_nombre: "Juan Pérez" },
            { codigo: "TRM-0001", categoria: "TRAUMA",       subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",    bombero_nombre: "" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA",  subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", bombero_nombre: "" },
            { codigo: "COM-0001", categoria: "COMUNICACION", subcategoria: "Radio",    descripcion: "Radio Portátil VHF",    marca: "Motorola", modelo: "DP4400", serie: "MOT-007", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Carro 1",        bombero_nombre: "" },
        ];
        const controles = [
            { codigo_item: "EPP-0001", tipo: "INSPECCION",    fecha_objetivo: "2025-06-01", fecha_real: "",           resultado: "",         observacion: "Inspección anual" },
            { codigo_item: "HRR-0001", tipo: "MANTENCION",    fecha_objetivo: "2025-04-30", fecha_real: "",           resultado: "",         observacion: "Mantenimiento preventivo" },
            { codigo_item: "TRM-0001", tipo: "CERTIFICACION", fecha_objetivo: "2025-03-15", fecha_real: "2025-03-14", resultado: "APROBADO", observacion: "" },
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(bomberos),   "Bomberos");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(ubicaciones), "Ubicaciones");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(items),      "Items");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(controles),  "Controles");

        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_importacion.xlsx"');
        res.send(buf);
    } catch (e) {
        return serverError(res, e, "Error generando plantilla");
    }
});

// Reportes
app.get("/reportes", (_req, res) => {
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

// Eliminar item (cascada: controles y movimientos)
app.delete("/items/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id FROM item WHERE id=?").get(id);
        if (!item) return notFound(res, "Item no encontrado");

        db.transaction(() => {
            db.prepare("DELETE FROM control   WHERE item_id=?").run(id);
            db.prepare("DELETE FROM movimiento WHERE item_id=?").run(id);
            db.prepare("DELETE FROM item       WHERE id=?").run(id);
        })();

        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error eliminando item");
    }
});

// Eliminar bombero (bloqueado si tiene items asignados)
app.delete("/bomberos/:id", (req, res) => {
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

// Eliminar ubicacion (bloqueada si tiene items)
app.delete("/ubicaciones/:id", (req, res) => {
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

const TIPOS_CONTROL = ["INSPECCION", "MANTENCION", "CERTIFICACION", "OTRO"];
const RESULTADOS_CONTROL = ["APROBADO", "RECHAZADO", "PENDIENTE"];

// Listar controles de un item
app.get("/items/:id/controles", (req, res) => {
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
app.post("/items/:id/controles", (req, res) => {
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
app.put("/controles/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID de control inválido");

        const actual = db.prepare("SELECT * FROM control WHERE id=?").get(id);
        if (!actual) return notFound(res, "Control no encontrado");

        const fecha_real = cleanText(req.body.fecha_real);
        const resultado = cleanText(req.body.resultado);
        const observacion = isNil(req.body.observacion) ? actual.observacion : cleanText(req.body.observacion);

        if (!fecha_real) return badRequest(res, "fecha_real es requerida");
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

// ========================
// TRAUMA
// ========================

// Listar todos los ítems TRAUMA con fechas y conteo de usos
app.get("/trauma", (_req, res) => {
    try {
        const rows = db.prepare(`
            SELECT
                i.*,
                u.nombre AS ubicacion_nombre,
                b.nombre AS bombero_nombre,
                (SELECT COUNT(*) FROM uso_trauma WHERE item_id = i.id) AS total_usos
            FROM item i
            LEFT JOIN ubicacion u ON u.id = i.ubicacion_actual_id
            LEFT JOIN bombero  b ON b.id = i.asignado_bombero_id
            WHERE i.categoria = 'TRAUMA'
            ORDER BY
                CASE WHEN i.fecha_vencimiento IS NULL THEN 1 ELSE 0 END,
                i.fecha_vencimiento ASC,
                i.codigo
        `).all();
        res.json(rows);
    } catch (e) { return serverError(res, e, "Error obteniendo material trauma"); }
});

// Actualizar fechas de recepción y vencimiento
app.put("/trauma/:id/fechas", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id, categoria FROM item WHERE id = ?").get(id);
        if (!item) return notFound(res, "Ítem no encontrado");
        if (item.categoria !== "TRAUMA") return badRequest(res, "El ítem no es de categoría TRAUMA");

        const fecha_recepcion   = cleanText(req.body.fecha_recepcion)   || null;
        const fecha_vencimiento = cleanText(req.body.fecha_vencimiento) || null;

        db.prepare(`UPDATE item SET fecha_recepcion=?, fecha_vencimiento=?, actualizado_en=datetime('now') WHERE id=?`)
            .run(fecha_recepcion, fecha_vencimiento, id);

        res.json({ ok: true });
    } catch (e) { return serverError(res, e, "Error actualizando fechas"); }
});

// Historial de usos de un ítem trauma
app.get("/trauma/:id/usos", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");
        const rows = db.prepare(`SELECT * FROM uso_trauma WHERE item_id = ? ORDER BY fecha DESC LIMIT 200`).all(id);
        res.json(rows);
    } catch (e) { return serverError(res, e, "Error obteniendo usos"); }
});

// Registrar uso de un ítem trauma
app.post("/trauma/:id/usos", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const item = db.prepare("SELECT id, categoria FROM item WHERE id = ?").get(id);
        if (!item) return notFound(res, "Ítem no encontrado");
        if (item.categoria !== "TRAUMA") return badRequest(res, "El ítem no es de categoría TRAUMA");

        const cantidad    = Math.max(1, Number(req.body.cantidad) || 1);
        const motivo      = cleanText(req.body.motivo);
        const responsable = cleanText(req.body.responsable);
        const observacion = cleanText(req.body.observacion);
        const fecha       = cleanText(req.body.fecha) || new Date().toISOString().slice(0, 10);

        const info = db.prepare(`
            INSERT INTO uso_trauma (item_id, fecha, cantidad, motivo, responsable, observacion)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, fecha, cantidad, motivo, responsable, observacion);

        res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { return serverError(res, e, "Error registrando uso"); }
});

// Eliminar registro de uso
app.delete("/trauma/usos/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");
        const uso = db.prepare("SELECT id FROM uso_trauma WHERE id = ?").get(id);
        if (!uso) return notFound(res, "Registro no encontrado");
        db.prepare("DELETE FROM uso_trauma WHERE id = ?").run(id);
        res.json({ ok: true });
    } catch (e) { return serverError(res, e, "Error eliminando uso"); }
});

// ========================
// IMPORTACIONES PARCIALES
// ========================

function parseXlsxBuffer(req, res) {
    if (!req.file) { badRequest(res, "No se recibió ningún archivo"); return null; }
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") { badRequest(res, "El archivo debe ser .xlsx o .xls"); return null; }
    return req.file.buffer;
}

function normXlsx(v) {
    if (v === undefined || v === null) return "";
    return String(v).trim();
}

// Plantilla parcial — Ubicaciones
app.get("/plantilla/ubicaciones", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const datos = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "Juan Pérez", codigo_qr: "", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "",           codigo_qr: "", activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "",           codigo_qr: "", activo: 1 },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(datos), "Ubicaciones");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_ubicaciones.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Plantilla parcial — Bomberos
app.get("/plantilla/bomberos", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const datos = [
            { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "" },
            { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "" },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(datos), "Bomberos");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_bomberos.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Plantilla parcial — Items
app.get("/plantilla/items", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",         subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",             bombero_nombre: "Juan Pérez" },
            { codigo: "TRM-0001", categoria: "TRAUMA",      subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",  bombero_nombre: "" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA", subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", bombero_nombre: "" },
        ];
        const controles = [
            { codigo_item: "EPP-0001", tipo: "INSPECCION", fecha_objetivo: "2025-06-01", fecha_real: "", resultado: "", observacion: "Inspección anual" },
            { codigo_item: "HRR-0001", tipo: "MANTENCION", fecha_objetivo: "2025-04-30", fecha_real: "", resultado: "", observacion: "Mantenimiento preventivo" },
        ];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(items),    "Items");
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(controles), "Controles");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_items.xlsx"');
        res.send(buf);
    } catch (e) { return serverError(res, e, "Error generando plantilla"); }
});

// Importar ubicaciones — upsert por nombre
app.post("/importar/ubicaciones", upload.single("archivo"), (req, res) => {
    const buffer = parseXlsxBuffer(req, res);
    if (!buffer) return;
    try {
        const xlsx = require("xlsx");
        const wb = xlsx.read(buffer, { type: "buffer" });
        const ws = wb.Sheets["Ubicaciones"];
        if (!ws) return badRequest(res, 'No existe la hoja "Ubicaciones" en el archivo');
        const filas = xlsx.utils.sheet_to_json(ws, { defval: "" });

        const nombres = new Set();
        for (const u of filas) {
            const n = normXlsx(u.nombre); if (!n) continue;
            if (nombres.has(n)) return badRequest(res, `Nombre duplicado en el archivo: "${n}"`);
            nombres.add(n);
        }

        const getUbic = db.prepare("SELECT id FROM ubicacion WHERE nombre = ?");
        const insUbic = db.prepare("INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr, activo) VALUES (?, ?, ?, ?, ?)");
        const updUbic = db.prepare("UPDATE ubicacion SET tipo=?, responsable=?, codigo_qr=?, activo=? WHERE nombre=?");

        let insertados = 0, actualizados = 0;

        db.transaction(() => {
            for (const u of filas) {
                const nombre = normXlsx(u.nombre); if (!nombre) continue;
                const tipo   = TIPOS_UBICACION.includes(normXlsx(u.tipo).toUpperCase()) ? normXlsx(u.tipo).toUpperCase() : "OTRO";
                const resp   = normXlsx(u.responsable) || null;
                const qr     = normXlsx(u.codigo_qr)   || null;
                const activo = normXlsx(u.activo) === "0" ? 0 : 1;
                if (getUbic.get(nombre)) { updUbic.run(tipo, resp, qr, activo, nombre); actualizados++; }
                else                     { insUbic.run(nombre, tipo, resp, qr, activo); insertados++; }
            }
        })();

        res.json({ ok: true, resumen: { insertados, actualizados } });
    } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }
});

// Importar bomberos — upsert por nombre
app.post("/importar/bomberos", upload.single("archivo"), (req, res) => {
    const buffer = parseXlsxBuffer(req, res);
    if (!buffer) return;
    try {
        const xlsx = require("xlsx");
        const wb = xlsx.read(buffer, { type: "buffer" });
        const ws = wb.Sheets["Bomberos"];
        if (!ws) return badRequest(res, 'No existe la hoja "Bomberos" en el archivo');
        const filas = xlsx.utils.sheet_to_json(ws, { defval: "" });

        const nombres = new Set();
        for (const b of filas) {
            const n = normXlsx(b.nombre); if (!n) continue;
            if (nombres.has(n)) return badRequest(res, `Nombre duplicado en el archivo: "${n}"`);
            nombres.add(n);
        }

        const getBom = db.prepare("SELECT id FROM bombero WHERE nombre = ?");
        const insBom = db.prepare("INSERT INTO bombero (nombre, cargo, estado, observaciones) VALUES (?, ?, ?, ?)");
        const updBom = db.prepare("UPDATE bombero SET cargo=?, estado=?, observaciones=? WHERE nombre=?");

        let insertados = 0, actualizados = 0;

        db.transaction(() => {
            for (const b of filas) {
                const nombre = normXlsx(b.nombre); if (!nombre) continue;
                const cargo  = normXlsx(b.cargo) || null;
                const estado = ESTADOS_BOMBERO.includes(normXlsx(b.estado).toUpperCase()) ? normXlsx(b.estado).toUpperCase() : "ACTIVO";
                const obs    = normXlsx(b.observaciones) || null;
                if (getBom.get(nombre)) { updBom.run(cargo, estado, obs, nombre); actualizados++; }
                else                    { insBom.run(nombre, cargo, estado, obs); insertados++; }
            }
        })();

        res.json({ ok: true, resumen: { insertados, actualizados } });
    } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }
});

// Importar items — upsert por código, valida todas las referencias antes de insertar
app.post("/importar/items", upload.single("archivo"), (req, res) => {
    const buffer = parseXlsxBuffer(req, res);
    if (!buffer) return;
    try {
        const xlsx = require("xlsx");
        const wb = xlsx.read(buffer, { type: "buffer" });

        const wsItems = wb.Sheets["Items"];
        if (!wsItems) return badRequest(res, 'No existe la hoja "Items" en el archivo');
        const filas = xlsx.utils.sheet_to_json(wsItems, { defval: "" });
        const filasControl = wb.Sheets["Controles"]
            ? xlsx.utils.sheet_to_json(wb.Sheets["Controles"], { defval: "" })
            : [];

        const codigos = new Set();
        for (const it of filas) {
            const c = normXlsx(it.codigo); if (!c) continue;
            if (codigos.has(c)) return badRequest(res, `Código duplicado en el archivo: "${c}"`);
            codigos.add(c);
        }

        // Cargar referencias de la BD
        const ubicMap = new Map();
        for (const r of db.prepare("SELECT id, nombre FROM ubicacion").all()) ubicMap.set(r.nombre, r.id);
        const bomMap = new Map();
        for (const r of db.prepare("SELECT id, nombre FROM bombero").all()) bomMap.set(r.nombre, r.id);

        // Validar TODAS las referencias antes de insertar (no para en el primero)
        const errores = [];
        for (const it of filas) {
            const codigo     = normXlsx(it.codigo); if (!codigo) continue;
            const ubicNombre = normXlsx(it.ubicacion_nombre);
            const bomNombre  = normXlsx(it.bombero_nombre);
            if (ubicNombre && bomNombre)
                errores.push(`"${codigo}": no puede tener ubicación y bombero simultáneamente`);
            else {
                if (ubicNombre && !ubicMap.has(ubicNombre)) errores.push(`"${codigo}": ubicación no encontrada → "${ubicNombre}"`);
                if (bomNombre  && !bomMap.has(bomNombre))   errores.push(`"${codigo}": bombero no encontrado → "${bomNombre}"`);
            }
        }
        if (errores.length > 0)
            return res.status(400).json({ error: `Referencias no encontradas:\n${errores.map(e => "• " + e).join("\n")}` });

        const getItem = db.prepare("SELECT id FROM item WHERE codigo = ?");
        const insItem = db.prepare("INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const updItem = db.prepare("UPDATE item SET categoria=?, subcategoria=?, descripcion=?, marca=?, modelo=?, serie=?, estado=?, criticidad=?, ubicacion_actual_id=?, asignado_bombero_id=?, actualizado_en=datetime('now') WHERE codigo=?");
        const insMov  = db.prepare("INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))");
        const insCtrl = db.prepare("INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion) VALUES (?, ?, ?, ?, ?, ?)");

        let insertados = 0, actualizados = 0, controles = 0;

        db.transaction(() => {
            for (const it of filas) {
                const codigo      = normXlsx(it.codigo); if (!codigo) continue;
                const categoria   = CATEGORIAS.includes(normXlsx(it.categoria).toUpperCase())   ? normXlsx(it.categoria).toUpperCase()   : "OTRO";
                const estado      = ESTADOS_ITEM.includes(normXlsx(it.estado).toUpperCase())     ? normXlsx(it.estado).toUpperCase()     : "OPERATIVO";
                const criticidad  = CRITICIDADES.includes(normXlsx(it.criticidad).toUpperCase()) ? normXlsx(it.criticidad).toUpperCase() : "MEDIA";
                const subcategoria = normXlsx(it.subcategoria) || null;
                const descripcion  = normXlsx(it.descripcion)  || codigo;
                const marca        = normXlsx(it.marca)         || null;
                const modelo       = normXlsx(it.modelo)        || null;
                const serie        = normXlsx(it.serie)         || null;
                const ubicNombre   = normXlsx(it.ubicacion_nombre);
                const bomNombre    = normXlsx(it.bombero_nombre);
                const ubicId       = ubicNombre ? ubicMap.get(ubicNombre) : null;
                const bomId        = bomNombre  ? bomMap.get(bomNombre)   : null;

                const existente = getItem.get(codigo);
                if (existente) {
                    updItem.run(categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicId, bomId, codigo);
                    actualizados++;
                } else {
                    const info  = insItem.run(codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicId, bomId);
                    const hacia = bomId  ? `Asignado a ${bomNombre}` : ubicId ? `Ubicado en ${ubicNombre}` : "Sin ubicar";
                    insMov.run(info.lastInsertRowid, "ALTA", "Importación parcial", hacia, "Sistema", "Importación parcial desde Excel");
                    insertados++;
                }
            }

            const itemMap = new Map();
            for (const r of db.prepare("SELECT id, codigo FROM item").all()) itemMap.set(r.codigo, r.id);

            for (const c of filasControl) {
                const codigo_item = normXlsx(c.codigo_item); if (!codigo_item) continue;
                const itemId = itemMap.get(codigo_item);
                if (!itemId) continue;
                const tipo = TIPOS_CONTROL.includes(normXlsx(c.tipo).toUpperCase()) ? normXlsx(c.tipo).toUpperCase() : "INSPECCION";
                insCtrl.run(itemId, tipo, normXlsx(c.fecha_objetivo) || null, normXlsx(c.fecha_real) || null, normXlsx(c.resultado) || null, normXlsx(c.observacion) || null);
                controles++;
            }
        })();

        res.json({ ok: true, resumen: { insertados, actualizados, controles } });
    } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Inventario corriendo en http://localhost:${PORT}`));


  
