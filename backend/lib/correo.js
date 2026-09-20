// Envío de correo por SMTP. Se configura con variables de entorno (ver
// .env.example); si faltan SMTP_HOST, SMTP_USER o SMTP_PASS el envío queda
// desactivado y las funciones que dependen de él (recuperar contraseña) se
// declaran no disponibles en vez de fallar a medias.
const nodemailer = require("nodemailer");

let transporte = null; // se crea la primera vez que hace falta
let transporteDePrueba = null;

function configuracion() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

    const port = Number(SMTP_PORT) || 465;
    return {
        host: SMTP_HOST,
        port,
        // 465 va cifrado desde el inicio; 587 y otros negocian STARTTLS
        secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        from: SMTP_FROM || { name: "Inventario CBT10", address: SMTP_USER },
    };
}

function correoConfigurado() {
    return !!(transporteDePrueba || configuracion());
}

async function enviarCorreo({ para, asunto, texto }) {
    if (transporteDePrueba) {
        return transporteDePrueba.sendMail({ from: "inventario@pruebas.test", to: para, subject: asunto, text: texto });
    }

    const cfg = configuracion();
    if (!cfg) throw new Error("El envío de correo no está configurado");

    transporte ??= nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth,
        // Sin esto, un servidor de correo caído dejaría la solicitud colgada mucho rato
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    });
    return transporte.sendMail({ from: cfg.from, to: para, subject: asunto, text: texto });
}

// Solo para pruebas: reemplaza el envío real por un objeto con sendMail(). null lo quita.
function usarTransporteDePrueba(t) {
    transporteDePrueba = t;
}

module.exports = { correoConfigurado, enviarCorreo, usarTransporteDePrueba };
