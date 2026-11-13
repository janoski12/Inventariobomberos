const db = require("../db");
const { enviarCorreo, correoConfigurado } = require("./correo");

// Avisa por correo a la cuenta "admin" cuando el respaldo automático a la nube
// falla (ver scripts/alertar_backup_fallido.js, invocado por el cron del
// servidor desde fuera del contenedor). Sin correo configurado, o sin esa
// cuenta, no hay a quién avisar: no hace nada.
async function alertarBackupFallido(detalle) {
    if (!correoConfigurado()) return false;

    const admin = db.prepare("SELECT correo FROM usuario WHERE username = 'admin' AND correo IS NOT NULL").get();
    if (!admin) return false;

    await enviarCorreo({
        para: admin.correo,
        asunto: "CBT10 - Falló el respaldo a la nube",
        texto:
            `El respaldo automático a Google Drive falló.\n\n${detalle}\n\n` +
            "Puede ser un problema temporal de red, o que haya que repetir la " +
            "autorización de Google Drive en el servidor.",
    });
    return true;
}

module.exports = { alertarBackupFallido };
