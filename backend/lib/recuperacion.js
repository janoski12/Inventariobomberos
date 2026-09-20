// Recuperación de contraseña por correo: la persona anota el correo registrado
// en su cuenta y el sistema le envía una contraseña temporal, que debe cambiar
// al ingresar.
//
// Decisiones de diseño:
// - La temporal es una SEGUNDA credencial con vencimiento: no reemplaza a la
//   contraseña actual hasta que se usa. Así, pedir la recuperación de la cuenta
//   de otra persona no le quita el acceso, y si la persona recuerda su clave y
//   entra normalmente, la temporal se descarta.
// - La respuesta es la misma exista o no el correo (no revela qué correos hay
//   registrados), y el trabajo (generar, guardar, enviar) ocurre DESPUÉS de
//   responder, para que ni el tiempo de respuesta lo delate.
// - Hay un límite de solicitudes por correo y otro global, para que nadie use
//   esto para llenar un buzón ajeno o agotar la cuota del servicio de correo.
const bcrypt = require("bcryptjs");
const db = require("../db");
const { generarPasswordTemporal } = require("./helpers");
const { enviarCorreo } = require("./correo");
const { crearLimitador } = require("./limitarSolicitudes");

const VIGENCIA_MIN = 60;
const VIGENCIA_MS = VIGENCIA_MIN * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

const limitePorCorreo = crearLimitador({ max: 3, ventanaMs: HORA_MS });
const limiteGlobal = crearLimitador({ max: 30, ventanaMs: HORA_MS });

const pendientes = new Set();

// true si la solicitud entra en los cupos (y los consume)
function permitirSolicitud(correo) {
    return limitePorCorreo.permitir(correo) && limiteGlobal.permitir("global");
}

function textoCorreo({ nombre, username, temporal }) {
    return [
        `Hola ${nombre || username},`,
        "",
        "Recibimos una solicitud para recuperar tu contraseña del sistema Inventario CBT10.",
        "",
        `Usuario: ${username}`,
        `Contraseña temporal: ${temporal}`,
        "",
        `Es válida por ${VIGENCIA_MIN} minutos. Ingresa con ella y el sistema te pedirá elegir una contraseña nueva.`,
        "",
        "Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue funcionando y la temporal vencerá sola.",
    ].join("\n");
}

// Genera y envía la contraseña temporal a la cuenta activa que tenga ese correo
// (si no hay ninguna, no hace nada). Corre en segundo plano: nunca lanza.
function solicitar(correo) {
    const tarea = (async () => {
        const usuario = db.prepare("SELECT id, username, nombre FROM usuario WHERE correo = ? AND activo = 1").get(correo);
        if (!usuario) return;

        const temporal = generarPasswordTemporal();
        const hash = await bcrypt.hash(temporal, 10);
        db.prepare("UPDATE usuario SET recuperacion_hash = ?, recuperacion_expira = ? WHERE id = ?")
            .run(hash, Date.now() + VIGENCIA_MS, usuario.id);

        try {
            await enviarCorreo({
                para: correo,
                asunto: "Recuperación de contraseña - Inventario CBT10",
                texto: textoCorreo({ nombre: usuario.nombre, username: usuario.username, temporal }),
            });
        } catch (e) {
            // Sin correo entregado, la temporal no le sirve a nadie: se retira (solo si sigue siendo la misma)
            db.prepare("UPDATE usuario SET recuperacion_hash = NULL, recuperacion_expira = NULL WHERE id = ? AND recuperacion_hash = ?")
                .run(usuario.id, hash);
            console.error(`No se pudo enviar el correo de recuperación a la cuenta "${usuario.username}": ${e.message}`);
        }
    })()
        .catch((e) => console.error(`Error en la recuperación de contraseña: ${e.message}`))
        .finally(() => pendientes.delete(tarea));
    pendientes.add(tarea);
}

// ¿La clave escrita es la temporal enviada por correo, y sigue vigente?
function esTemporalVigente(usuario, password) {
    return !!usuario.recuperacion_hash
        && usuario.recuperacion_expira > Date.now()
        && bcrypt.compareSync(password, usuario.recuperacion_hash);
}

// Al ingresar con la temporal, pasa a ser la contraseña de la cuenta y obliga a
// cambiarla (mismo mecanismo que la clave temporal que asigna un administrador)
function promoverTemporal(usuario) {
    db.prepare(`
        UPDATE usuario
        SET password_hash = recuperacion_hash, debe_cambiar_password = 1, recuperacion_hash = NULL, recuperacion_expira = NULL
        WHERE id = ?
    `).run(usuario.id);
    usuario.debe_cambiar_password = 1;
}

// Descarta una temporal pendiente (la persona entró con su clave, la cambió, o un admin la restableció)
function descartarTemporal(usuarioId) {
    db.prepare("UPDATE usuario SET recuperacion_hash = NULL, recuperacion_expira = NULL WHERE id = ?").run(usuarioId);
}

// Espera a que terminen los envíos en curso (las pruebas lo usan para no depender de tiempos)
async function esperarPendientes() {
    await Promise.allSettled([...pendientes]);
}

function reiniciarLimites() {
    limitePorCorreo.reiniciar();
    limiteGlobal.reiniciar();
}

module.exports = {
    VIGENCIA_MIN, permitirSolicitud, solicitar, esTemporalVigente, promoverTemporal, descartarTemporal,
    esperarPendientes, reiniciarLimites,
};
