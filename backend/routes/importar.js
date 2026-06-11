const router = require("express").Router();
const db = require("../db");
const {
    upload, ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, ESTADOS_BOMBERO, TIPOS_UBICACION, TIPOS_CONTROL,
    badRequest, serverError, normXlsx, normFechaXlsx, parseXlsxBuffer,
} = require("../lib/helpers");

// Importar desde Excel (carga completa: borra y reemplaza todo)
router.post("/importar", upload.single("archivo"), (req, res) => {
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

        const insUbicacion = db.prepare(`INSERT INTO ubicacion (nombre, tipo, responsable, activo) VALUES (?, ?, ?, ?)`);
        const insBombero   = db.prepare(`INSERT INTO bombero (nombre, cargo, estado, observaciones) VALUES (?, ?, ?, ?)`);
        const insItem      = db.prepare(`INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id, fecha_fabricacion, fecha_recepcion, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insControl   = db.prepare(`INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion) VALUES (?, ?, ?, ?, ?, ?)`);
        const insMov       = db.prepare(`INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);

        db.transaction(() => {
            db.prepare("DELETE FROM uso_trauma").run();
            db.prepare("DELETE FROM movimiento").run();
            db.prepare("DELETE FROM control").run();
            db.prepare("DELETE FROM item").run();
            db.prepare("DELETE FROM bombero").run();
            db.prepare("DELETE FROM ubicacion").run();

            for (const u of ubicaciones) {
                const nombre = norm(u.nombre); if (!nombre) continue;
                const tipo   = TIPOS_UBICACION.includes(norm(u.tipo).toUpperCase()) ? norm(u.tipo).toUpperCase() : "OTRO";
                insUbicacion.run(nombre, tipo, norm(u.responsable) || null, norm(u.activo) === "0" ? 0 : 1);
            }

            // codigo_qr es gestionado por el sistema: UBIC-XXXX segun el id
            db.prepare("UPDATE ubicacion SET codigo_qr = 'UBIC-' || printf('%04d', id)").run();

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
                insItem.run(codigo, categoria, norm(it.subcategoria) || null, norm(it.descripcion) || codigo, norm(it.marca) || null, norm(it.modelo) || null, norm(it.serie) || null, estado, criticidad, ubicId, bomId, normFechaXlsx(it.fecha_fabricacion), normFechaXlsx(it.fecha_recepcion), normFechaXlsx(it.fecha_vencimiento));
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
router.get("/plantilla", (_req, res) => {
    try {
        const xlsx = require("xlsx");

        const bomberos = [
            { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "" },
            { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "" },
        ];
        const ubicaciones = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "", activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "", activo: 1 },
        ];
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",          subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",               bombero_nombre: "Juan Pérez", fecha_fabricacion: "2022-01-15", fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "TRM-0001", categoria: "TRAUMA",       subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",    bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "2025-01-10", fecha_vencimiento: "2027-01-10" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA",  subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", bombero_nombre: "",         fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "COM-0001", categoria: "COMUNICACION", subcategoria: "Radio",    descripcion: "Radio Portátil VHF",    marca: "Motorola", modelo: "DP4400", serie: "MOT-007", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Carro 1",        bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
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

// Plantilla parcial — Ubicaciones
router.get("/plantilla/ubicaciones", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const datos = [
            { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "Juan Pérez", activo: 1 },
            { nombre: "Carro 1",          tipo: "CARRO",     responsable: "",           activo: 1 },
            { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "",           activo: 1 },
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
router.get("/plantilla/bomberos", (_req, res) => {
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
router.get("/plantilla/items", (_req, res) => {
    try {
        const xlsx = require("xlsx");
        const items = [
            { codigo: "EPP-0001", categoria: "EPP",         subcategoria: "Casco",    descripcion: "Casco Estructural",      marca: "Bullard",  modelo: "FH2",    serie: "SN-001", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "",             bombero_nombre: "Juan Pérez", fecha_fabricacion: "2022-01-15", fecha_recepcion: "",           fecha_vencimiento: "" },
            { codigo: "TRM-0001", categoria: "TRAUMA",      subcategoria: "Botiquín", descripcion: "Botiquín Trauma Tipo A", marca: "",         modelo: "",       serie: "",        estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",  bombero_nombre: "",           fecha_fabricacion: "",           fecha_recepcion: "2025-01-10", fecha_vencimiento: "2027-01-10" },
            { codigo: "HRR-0001", categoria: "HERRAMIENTA", subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"", marca: "Makita",   modelo: "GA9020", serie: "MK-123",  estado: "MANTENCION",criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", bombero_nombre: "",         fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
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
router.post("/importar/ubicaciones", upload.single("archivo"), (req, res) => {
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
        const insUbic = db.prepare("INSERT INTO ubicacion (nombre, tipo, responsable, activo) VALUES (?, ?, ?, ?)");
        const updUbic = db.prepare("UPDATE ubicacion SET tipo=?, responsable=?, activo=? WHERE nombre=?");
        const setQr   = db.prepare("UPDATE ubicacion SET codigo_qr=? WHERE id=?");

        let insertados = 0, actualizados = 0;

        db.transaction(() => {
            for (const u of filas) {
                const nombre = normXlsx(u.nombre); if (!nombre) continue;
                const tipo   = TIPOS_UBICACION.includes(normXlsx(u.tipo).toUpperCase()) ? normXlsx(u.tipo).toUpperCase() : "OTRO";
                const resp   = normXlsx(u.responsable) || null;
                const activo = normXlsx(u.activo) === "0" ? 0 : 1;
                if (getUbic.get(nombre)) { updUbic.run(tipo, resp, activo, nombre); actualizados++; }
                else {
                    const info = insUbic.run(nombre, tipo, resp, activo);
                    setQr.run(`UBIC-${String(info.lastInsertRowid).padStart(4, "0")}`, info.lastInsertRowid);
                    insertados++;
                }
            }
        })();

        res.json({ ok: true, resumen: { insertados, actualizados } });
    } catch (e) { return res.status(400).json({ error: String(e.message ?? e) }); }
});

// Importar bomberos — upsert por nombre
router.post("/importar/bomberos", upload.single("archivo"), (req, res) => {
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
router.post("/importar/items", upload.single("archivo"), (req, res) => {
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
        const insItem = db.prepare("INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id, fecha_fabricacion, fecha_recepcion, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        const updItem = db.prepare("UPDATE item SET categoria=?, subcategoria=?, descripcion=?, marca=?, modelo=?, serie=?, estado=?, criticidad=?, ubicacion_actual_id=?, asignado_bombero_id=?, fecha_fabricacion=COALESCE(?, fecha_fabricacion), fecha_recepcion=COALESCE(?, fecha_recepcion), fecha_vencimiento=COALESCE(?, fecha_vencimiento), actualizado_en=datetime('now') WHERE codigo=?");
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
                const fechaFab     = normFechaXlsx(it.fecha_fabricacion);
                const fechaRec     = normFechaXlsx(it.fecha_recepcion);
                const fechaVenc    = normFechaXlsx(it.fecha_vencimiento);

                const existente = getItem.get(codigo);
                if (existente) {
                    updItem.run(categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicId, bomId, fechaFab, fechaRec, fechaVenc, codigo);
                    actualizados++;
                } else {
                    const info  = insItem.run(codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicId, bomId, fechaFab, fechaRec, fechaVenc);
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

// Descargar respaldo de la base de datos (snapshot consistente)
router.get("/backup", async (_req, res) => {
    const fs   = require("fs");
    const path = require("path");
    const tmpFile = path.join(__dirname, "..", "data", `backup_tmp_${Date.now()}.db`);
    try {
        await db.backup(tmpFile);
        const fecha = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="inventario_backup_${fecha}.db"`);
        res.sendFile(tmpFile, (err) => {
            fs.unlink(tmpFile, () => {});
            if (err && !res.headersSent) serverError(res, err, "Error enviando el respaldo");
        });
    } catch (e) {
        fs.unlink(tmpFile, () => {});
        return serverError(res, e, "Error generando el respaldo");
    }
});

module.exports = router;
