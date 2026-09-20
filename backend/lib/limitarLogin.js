// Freno a la fuerza bruta sobre /auth/login. Cuenta los intentos FALLIDOS por
// cuenta; al llegar al máximo, esa cuenta queda bloqueada (incluso con la clave
// correcta) durante la ventana completa. Un login correcto borra el contador.
//
// Es por cuenta y no por IP a propósito: detrás de Docker todos los clientes
// llegan con la misma IP interna, así que un límite por IP bloquearía a todos
// por los errores de una sola persona. Vive en memoria: alcanza para un único
// proceso y se reinicia junto con el servidor.
const MAX_FALLOS = 10;
const VENTANA_MS = 15 * 60 * 1000;
const MAX_ENTRADAS = 500;

const porClave = new Map(); // clave -> { fallos, desde, bloqueadoHasta }

// Milisegundos que le faltan a la clave para poder volver a intentar (0 si no está bloqueada)
function msBloqueado(clave, ahora = Date.now()) {
    const e = porClave.get(clave);
    if (!e || !e.bloqueadoHasta) return 0;
    if (ahora >= e.bloqueadoHasta) {
        porClave.delete(clave);
        return 0;
    }
    return e.bloqueadoHasta - ahora;
}

// Registra un intento fallido. Devuelve true si con este intento la clave quedó bloqueada.
function registrarFallo(clave, ahora = Date.now()) {
    if (porClave.size >= MAX_ENTRADAS) podar(ahora);

    let e = porClave.get(clave);
    if (!e || ahora - e.desde >= VENTANA_MS) {
        e = { fallos: 0, desde: ahora, bloqueadoHasta: 0 };
        porClave.set(clave, e);
    }
    e.fallos++;
    if (e.fallos >= MAX_FALLOS) {
        e.bloqueadoHasta = ahora + VENTANA_MS;
        return true;
    }
    return false;
}

function limpiar(clave) {
    porClave.delete(clave);
}

function podar(ahora) {
    for (const [clave, e] of porClave) {
        if (ahora - e.desde >= VENTANA_MS && ahora >= e.bloqueadoHasta) porClave.delete(clave);
    }
}

function reiniciar() {
    porClave.clear();
}

module.exports = { MAX_FALLOS, VENTANA_MS, msBloqueado, registrarFallo, limpiar, reiniciar };
