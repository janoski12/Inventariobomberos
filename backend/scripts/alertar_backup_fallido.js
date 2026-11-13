// Invocado desde el cron del servidor (ver backup-nube.sh) cuando el
// respaldo a la nube falla. Uso: node alertar_backup_fallido.js "<detalle>"
const { alertarBackupFallido } = require("../lib/alertas");

alertarBackupFallido(process.argv[2] || "(sin detalle)")
    .then((enviado) => {
        if (!enviado) console.error("No se avisó: correo no configurado, o la cuenta admin no tiene correo.");
        process.exit(0);
    })
    .catch((e) => {
        console.error("Error enviando la alerta:", e);
        process.exit(1);
    });
