// Uso: node scripts/importar_excel.js "C:\ruta\plantilla_importacion.xlsx"
//
// Duplica (para uso por linea de comandos, sin pasar por el servidor) la misma
// carga completa que POST /api/importar — mismas columnas, mismas reglas.
// Reutiliza los catalogos y el parseo de fechas de lib/helpers para no volver
// a desalinearse con el resto de la app.

const path = require("path");
const fs   = require("fs");
const xlsx = require("xlsx");
const Database = require("better-sqlite3");
const {
    TIPOS_UBICACION, ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, TIPOS_CONTROL,
    normXlsx: norm, normFechaXlsx,
} = require("../lib/helpers");

function die(msg) {
    console.error("ERROR:", msg);
    process.exit(1);
}

function main() {
    const excelPath = process.argv[2];
    if (!excelPath) die('Falta ruta Excel. Ej: node scripts/importar_excel.js "C:\\plantilla.xlsx"');
    if (!fs.existsSync(excelPath)) die("No existe el archivo: " + excelPath);

    // DB_PATH permite apuntar a otra base (p.ej. para probar el script sin tocar la de producción)
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "inventario.db");
    if (!fs.existsSync(dbPath)) die("No se encontró la DB en: " + dbPath);

    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");

    const wb = xlsx.readFile(excelPath);

    function readSheet(name) {
        const ws = wb.Sheets[name];
        if (!ws) die(`No existe la hoja "${name}" en el Excel`);
        return xlsx.utils.sheet_to_json(ws, { defval: "" });
    }

    const bomberos   = readSheet("Bomberos");
    const ubicaciones = readSheet("Ubicaciones");
    const items      = readSheet("Items");
    const controles  = readSheet("Controles");

    // ==== Validaciones previas ====
    const uNames = new Set();
    for (const u of ubicaciones) {
        const nombre = norm(u.nombre);
        if (!nombre) continue;
        if (uNames.has(nombre)) die(`Ubicación duplicada en Excel: "${nombre}"`);
        uNames.add(nombre);
    }

    const bNames = new Set();
    for (const b of bomberos) {
        const nombre = norm(b.nombre);
        if (!nombre) continue;
        if (bNames.has(nombre)) die(`Bombero duplicado en Excel: "${nombre}"`);
        bNames.add(nombre);
    }

    const codes = new Set();
    for (const it of items) {
        const codigo = norm(it.codigo);
        if (!codigo) continue;
        if (codes.has(codigo)) die(`Código de item duplicado en Excel: "${codigo}"`);
        codes.add(codigo);
    }

    // ==== Prepared statements ====
    // codigo_qr no se lee del Excel: lo asigna el sistema despues de insertar (UBIC-XXXX segun el id)
    const insUbicacion = db.prepare(`
        INSERT INTO ubicacion (nombre, tipo, responsable, activo)
        VALUES (?, ?, ?, ?)
    `);

    const insBombero = db.prepare(`
        INSERT INTO bombero (nombre, cargo, estado, observaciones, rut, numero_registro)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insItem = db.prepare(`
        INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, talla, estado, criticidad, ubicacion_actual_id, ubicacion_detalle, asignado_bombero_id, fecha_fabricacion, fecha_recepcion, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insControl = db.prepare(`
        INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insMov = db.prepare(`
        INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `);

    const trx = db.transaction(() => {
        // Limpieza de tablas (importación limpia desde cero)
        console.log("Limpiando tablas existentes...");
        db.prepare("DELETE FROM movimiento").run();
        db.prepare("DELETE FROM control").run();
        db.prepare("DELETE FROM item").run();
        db.prepare("DELETE FROM bombero").run();
        db.prepare("DELETE FROM ubicacion").run();

        // Insertar ubicaciones
        console.log(`Insertando ${ubicaciones.length} ubicaciones...`);
        for (const u of ubicaciones) {
            const nombre = norm(u.nombre);
            if (!nombre) continue;

            const tipo = TIPOS_UBICACION.includes(norm(u.tipo).toUpperCase())
                ? norm(u.tipo).toUpperCase()
                : "OTRO";
            const responsable = norm(u.responsable) || null;
            const activo      = norm(u.activo) === "0" ? 0 : 1;

            insUbicacion.run(nombre, tipo, responsable, activo);
        }

        // codigo_qr gestionado por el sistema: UBIC-XXXX segun el id
        db.prepare("UPDATE ubicacion SET codigo_qr = 'UBIC-' || printf('%04d', id)").run();

        const ubicMap = new Map();
        for (const r of db.prepare("SELECT id, nombre FROM ubicacion").all())
            ubicMap.set(r.nombre, r.id);

        // Insertar bomberos
        console.log(`Insertando ${bomberos.length} bomberos...`);
        for (const b of bomberos) {
            const nombre = norm(b.nombre);
            if (!nombre) continue;

            const cargo          = norm(b.cargo)           || null;
            const estado         = norm(b.estado).toUpperCase() || "ACTIVO";
            const observaciones  = norm(b.observaciones)   || null;
            const rut            = norm(b.rut)              || null;
            const numeroRegistro = norm(b.numero_registro) || null;

            insBombero.run(nombre, cargo, estado, observaciones, rut, numeroRegistro);
        }

        const bomMap = new Map();
        for (const r of db.prepare("SELECT id, nombre FROM bombero").all())
            bomMap.set(r.nombre, r.id);

        // Insertar items
        console.log(`Insertando ${items.length} items...`);
        for (const it of items) {
            const codigo = norm(it.codigo);
            if (!codigo) continue;

            const categoria   = CATEGORIAS.includes(norm(it.categoria).toUpperCase())
                ? norm(it.categoria).toUpperCase() : "OTRO";
            const subcategoria = norm(it.subcategoria) || null;
            const descripcion  = norm(it.descripcion)  || codigo;
            const marca        = norm(it.marca)         || null;
            const modelo       = norm(it.modelo)        || null;
            const serie        = norm(it.serie)         || null;
            const talla        = norm(it.talla)         || null;
            const estado       = ESTADOS_ITEM.includes(norm(it.estado).toUpperCase())
                ? norm(it.estado).toUpperCase() : "OPERATIVO";
            const criticidad   = CRITICIDADES.includes(norm(it.criticidad).toUpperCase())
                ? norm(it.criticidad).toUpperCase() : "MEDIA";

            const ubicNombre       = norm(it.ubicacion_nombre);
            const bomNombre        = norm(it.bombero_nombre);
            const ubicacionDetalle = norm(it.ubicacion_detalle) || null;

            if (ubicNombre && bomNombre)
                die(`Item "${codigo}": no puede tener ubicación y bombero al mismo tiempo`);

            const ubicId = ubicNombre ? ubicMap.get(ubicNombre) ?? die(`Item "${codigo}": ubicación no encontrada "${ubicNombre}"`) : null;
            const bomId  = bomNombre  ? bomMap.get(bomNombre)   ?? die(`Item "${codigo}": bombero no encontrado "${bomNombre}"`)   : null;

            const fechaFab  = normFechaXlsx(it.fecha_fabricacion);
            const fechaRec  = normFechaXlsx(it.fecha_recepcion);
            const fechaVenc = normFechaXlsx(it.fecha_vencimiento);

            insItem.run(codigo, categoria, subcategoria, descripcion, marca, modelo, serie, talla, estado, criticidad, ubicId, ubicacionDetalle, bomId, fechaFab, fechaRec, fechaVenc);
        }

        const itemMap = new Map();
        for (const r of db.prepare("SELECT id, codigo FROM item").all())
            itemMap.set(r.codigo, r.id);

        // Insertar controles
        console.log(`Insertando ${controles.length} controles...`);
        for (const c of controles) {
            const codigo_item = norm(c.codigo_item);
            if (!codigo_item) continue;

            const itemId = itemMap.get(codigo_item);
            if (!itemId) die(`Control referencia item inexistente: "${codigo_item}"`);

            const tipo          = TIPOS_CONTROL.includes(norm(c.tipo).toUpperCase())
                ? norm(c.tipo).toUpperCase() : "INSPECCION";
            const fecha_objetivo = norm(c.fecha_objetivo) || null;
            const fecha_real     = norm(c.fecha_real)     || null;
            const resultado      = norm(c.resultado)      || null;
            const observacion    = norm(c.observacion)    || null;

            insControl.run(itemId, tipo, fecha_objetivo, fecha_real, resultado, observacion);
        }

        // Movimientos iniciales
        console.log("Registrando movimientos iniciales...");
        const rows = db.prepare(`
            SELECT it.id, it.codigo, it.asignado_bombero_id,
                   u.nombre AS ubic, b.nombre AS bom
            FROM item it
            LEFT JOIN ubicacion u ON u.id = it.ubicacion_actual_id
            LEFT JOIN bombero   b ON b.id = it.asignado_bombero_id
        `).all();

        for (const r of rows) {
            const hacia = r.bom
                ? `Asignado a ${r.bom}`
                : r.ubic
                    ? `Ubicado en ${r.ubic}`
                    : "Sin ubicación/asignación";

            insMov.run(r.id, "ALTA", "Carga inicial", hacia, "Sistema", "Importación desde Excel");
        }
    });

    trx();

    console.log("✓ Importación completada.");
    console.log(`  Ubicaciones: ${ubicaciones.length}`);
    console.log(`  Bomberos:    ${bomberos.length}`);
    console.log(`  Items:       ${items.length}`);
    console.log(`  Controles:   ${controles.length}`);
}

main();
