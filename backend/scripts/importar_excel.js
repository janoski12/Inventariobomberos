// Uso: node scripts/importar_excel.js "C:\ruta\plantilla_importacion.xlsx"
//
// La misma carga completa que POST /api/importar, por línea de comandos (sin
// pasar por el servidor). No duplica la lógica: llama a cargaCompleta() de
// lib/importacion.js, así que valida y reemplaza exactamente igual que la app
// (incluido el respaldo previo y que las ubicaciones conserven su id y su QR).
//
// DB_PATH permite apuntar a otra base (p.ej. para probar sin tocar la de producción).

const path = require("path");
const fs   = require("fs");

function die(msg) {
    console.error("ERROR:", msg);
    process.exit(1);
}

async function main() {
    const excelPath = process.argv[2];
    if (!excelPath) die('Falta ruta Excel. Ej: node scripts/importar_excel.js "C:\\plantilla.xlsx"');
    if (!fs.existsSync(excelPath)) die("No existe el archivo: " + excelPath);

    // Debe definirse antes de cargar db.js (lo cargan los módulos de lib/)
    process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "inventario.db");
    if (!fs.existsSync(process.env.DB_PATH)) die("No se encontró la DB en: " + process.env.DB_PATH);

    const xlsx = require("xlsx");
    const { cargaCompleta, ErrorImportacion } = require("../lib/importacion");
    const { crearBackup } = require("../lib/backups");

    try {
        const resumen = await cargaCompleta(xlsx.readFile(excelPath), "Sistema (script)", {
            antesDeEscribir: async () => {
                const archivo = await crearBackup("pre_carga_completa");
                console.log("Respaldo previo:", archivo);
            },
        });
        console.log("✓ Importación completada.");
        console.log(`  Ubicaciones: ${resumen.ubicaciones} (${resumen.ubicaciones_conservadas} conservadas, ${resumen.ubicaciones_nuevas} nuevas, ${resumen.ubicaciones_eliminadas} eliminadas)`);
        console.log(`  Bomberos:    ${resumen.bomberos}`);
        console.log(`  Items:       ${resumen.items}`);
        console.log(`  Controles:   ${resumen.controles}`);
    } catch (e) {
        die(e instanceof ErrorImportacion ? e.message : (e.stack ?? e));
    }
}

main();
