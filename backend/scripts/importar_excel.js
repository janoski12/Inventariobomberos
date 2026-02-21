// Uso: node scripts/importar_excel.js "C:\ruta\Catastro_Inventario_Bomberos.xlsx"

const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const Database = require("better-sqlite3");

function norm(s) {
    return String(s ?? "").trim();
}

function die(msg) {
    console.error("X", msg);
    process.exit(1);
}

function main() {
    const excelPath = process.argv[2];
    if (!excelPath) die('Falta ruta Excel. Ej: node scripts/importar_excel.js "C:\\catastro.xlsx"');
    if (!fs.existsSync(excelPath)) die("No existe el archivo: "+ excelPath);

    const dbPath = path.join(__dirname, "..", "inventario.db");
    if (!fs.existsSync(dbPath)) {
        die ("No se encontro la DB en: " + dbPath + " (Ajusta dbPath en el script)");
    }

    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");

    const wb = xlsx.readFile(excelPath);

    function readSheet(name){
        const ws = wb.Sheets[name];
        if (!ws) die(`No existe la hoja "${name}" en el excel`);
        return xlsx.utils.sheet_to_json(ws, { defval: "" });
    }

    const bomberos = readSheet("Bomberos");
    const ubicaciones = readSheet("Ubicaciones");
    const items = readSheet("Items");
    const controles = readSheet("Controles");

    
    // ==== Validaciones ====
    // Valida nombre unico Ubicaciones
    const uNames = new Set();
    for (const u of ubicaciones) {
        const nombre = norm(u.nombre);
        if (!nombre) continue;
        if (uNames.has(nombre)) die(`Ubicacion repetida en Excel: "${nombre}"`);
        uNames.add(nombre);
    }

    //Valida nombre unico Bomberos
    const bNames = new Set();
    for (const b of bomberos) {
      const nombre = norm(b.nombre);
      if (!nombre) continue;
      if (bNames.has(nombre)) die(`Bombero repetido en Excel: "${nombre}"`);
      bNames.add(nombre);
    }


    //Valida codigo unico Item
    const codes = new Set();
    for (const it of items) {
      const codigo = norm(it.codigo);
      if (!codigo) continue;
      if (codes.has(codigo)) die(`Item con codigo repetido en Excel: "${codigo}"`);
      codes.add(codigo);
    }


    //Prepared Statements
    const insUbicacion = db.prepare(`
       INSERT INTO ubicacion (nombre, tipo, responsable, codigo_qr, activo)
       VALUES (?, ?, ?, ?, ?) 
    `);

    const insBombero = db.prepare(`
       INSERT INTO bombero (nombre, cargo, estado, observaciones)
       VALUES (?, ?, ?, ?) 
    `);

    const insItem = db.prepare(`
        INSERT INTO item (
            codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicacion_actual_id, asignado_bombero_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)    
    `);

    const insControl = db.prepare(`
        INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion)
        VALUES (?, ?, ?, ?, ?, ?)    
    `);

    const insMov = db.prepare(`
        INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))    
    `);

    const trx = db.transaction(() => {
        // Limpieza opcional de tablas
        //Comentar si no se quiere borrar los datos existentes
        console.log("Limpieza: borrando tablas (solo si estas iniciando de 0)...");
        db.prepare("DELETE FROM movimiento").run();
        db.prepare("DELETE FROM control").run();
        db.prepare("DELETE FROM item").run();
        db.prepare("DELETE FROM bombero").run();
        db.prepare("DELETE FROM ubicacion").run();

        //Insertar ubicaciones
        console.log("Insertando ubicaciones");
        for (const u of ubicaciones) {
            const nombre = norm(u.nombre);
            if (!nombre) continue;

            const tipo = norm(u.tipo) || "OTRO";
            const responsable = norm(u.responsable) || null;
            const codigo_qr = norm(u.codigo_qr) || null;
            const activo = norm(u.activo) === "0" ? 0 : 1;

            insUbicacion.run(nombre, tipo, responsable, codigo_qr, activo);
        }

        //Mapeo de ubicaciones por nombre
        const ubicMap = new Map();
        const allU = db.prepare("SELECT id, nombre FROM ubicacion").all();
        for (const r of allU) ubicMap.set(r.nombre, r.id);

        //Insertar bomberos
        console.log("Insertando bomberos...");
        for (const b of bomberos) {
            const nombre = norm(b.nombre);
            if (!nombre) continue;

            const cargo = norm(b.cargo) || "VOLUNTARIO";
            const estado = norm(b.estado) || "ACTIVO";
            const observaciones = norm(b.observaciones) || null;

            insBombero.run(nombre, cargo, estado, observaciones);
        }

        //Mapeo bomberos por nombre
        const bomMap = new Map();
        const allB = db.prepare("SELECT id, nombre FROM bombero").all();
        for (const r of allB) bomMap.set(r.nombre, r.id);

        //Insertar items
        console.log("Insertando Items...");
        for (const it of items) {
            const codigo = norm(it.codigo);
            if (!codigo) continue;

            const categoria = norm(it.categoria) || "OTRO";
            const subcategoria = norm(it.subcategoria) || null;
            const descripcion = norm(it.descripcion) || null;

            const marca = norm(it.marca) || null;
            const modelo = norm(it.modelo) || null;
            const serie = norm(it.serie) || null;

            const estado = norm(it.estado) || "OPERATIVO";
            const criticidad = norm(it.criticidad) || "MEDIA";

            const ubicNombre = norm(it.ubicacion_nombre);
            const bomNombre = norm(it.bombero_nombre);

            const ubicId = ubicNombre ? ubicMap.get(ubicNombre) : null;
            const bomId = bomNombre ? bomMap.get(bomNombre) : null;

            if (ubicNombre && !ubicId) die(`Item "${codigo}" referencia ubicacion inexistente: "${ubicNombre}"`);
            if (bomNombre && !bomId) die(`Item "${codigo}" referencia bombero inexistente: "${bomNombre}"`);

            insItem.run(
                codigo, categoria, subcategoria, descripcion, marca, modelo, serie, estado, criticidad, ubicId, bomId
            );
        }

        //Mapeo items por codigo
        const itemMap = new Map();
        const allI = db.prepare("SELECT id, codigo FROM item").all();
        for (const r of allI) itemMap.set(r.codigo, r.id);

        //Insertar Controles
        console.log("Insertando controles...");
        for (const c of controles){
            const codigo_item = norm(c.codigo_item);
            if (!codigo_item) continue;

            const itemId = itemMap.get(codigo_item);
            if (!itemId) die (`Control referencia item inexistente: "${codigo_item}"`);

            const tipo = norm(c.tipo) || "REVISION";
            const fecha_objetivo = norm(c.fecha_objetivo) || null;
            const fecha_real = norm(c.fecha_real) || null;
            const resultado = norm(c.resultado) || null;
            const observacion = norm(c.observacion) || null;

            insControl(itemId, tipo, fecha_objetivo, fecha_real, resultado, observacion);
        }

        //Movimientos inciales (opcional)
        console.log("Registrando movimientos inciales..");
        const rows = db.prepare(`
            SELECT it.id, it.codigo, it.ubicacion_actual_id, it.asignado_bombero_id, u.nombre AS ubic, b.nombre AS bom
            FROM item it
            LEFT JOIN ubicacion u ON u.id = it.ubicacion_actual_id
            LEFT JOIN bombero b ON b.id = it.asignado_id    
        `).all();

        for (const r of rows) {
            const hacia = r.bomb ? `Asignado a ${r.bomb}` : (r.ubic ? `Ubicacion: ${r.ubic}` : "Sin ubicacion/asignacion");
            insMov.run(
                r.id,"ALTA","Carga Incial", hacia, "Sistema", "Importacion desde Excel",
            );
        }
    });

    trx();

    console.log("Importacion completada.");
    console.log("Revisa en el sistema: busqueda y ficha deberian mostrar todo");
}

main();