const fs = require("fs");
const path = require("path");
const db = require("../db");

const BACKUP_DIR = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, "..", "data", "x")), "backups");
const MAX_POR_PREFIJO = 14;
const INTERVALO_MS = 24 * 60 * 60 * 1000;

function marcaTiempo() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Crea un respaldo <prefijo>_<fecha>.db y conserva solo los mas recientes de ese prefijo
async function crearBackup(prefijo = "auto") {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const destino = path.join(BACKUP_DIR, `${prefijo}_${marcaTiempo()}.db`);
    await db.backup(destino);
    rotar(prefijo);
    return destino;
}

// El timestamp del nombre ordena cronologicamente: se borran los mas antiguos
function rotar(prefijo) {
    const archivos = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith(`${prefijo}_`) && f.endsWith(".db"))
        .sort();
    for (const f of archivos.slice(0, Math.max(0, archivos.length - MAX_POR_PREFIJO))) {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch { /* noop */ }
    }
}

// Un respaldo al arrancar y luego cada 24 h
function iniciarBackupsAutomaticos() {
    const correr = () =>
        crearBackup("auto")
            .then((f) => console.log(`Respaldo automático guardado en ${f}`))
            .catch((e) => console.error("Error en respaldo automático:", e));
    correr();
    setInterval(correr, INTERVALO_MS).unref();
}

module.exports = { crearBackup, iniciarBackupsAutomaticos, BACKUP_DIR };
