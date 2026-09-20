// Limitador de ventana fija, en memoria: deja pasar hasta `max` solicitudes por
// clave dentro de `ventanaMs`. Sirve para acciones que cualquiera puede pedir
// sin sesión y que cuestan algo (p.ej. enviar un correo). Se reinicia junto con
// el servidor.
const MAX_ENTRADAS = 500;

function crearLimitador({ max, ventanaMs }) {
    const porClave = new Map(); // clave -> { n, desde }

    function podar(ahora) {
        for (const [clave, e] of porClave) {
            if (ahora - e.desde >= ventanaMs) porClave.delete(clave);
        }
    }

    return {
        // true si la solicitud entra en el cupo (y lo consume); false si ya se agotó
        permitir(clave, ahora = Date.now()) {
            if (porClave.size >= MAX_ENTRADAS) podar(ahora);

            let e = porClave.get(clave);
            if (!e || ahora - e.desde >= ventanaMs) {
                e = { n: 0, desde: ahora };
                porClave.set(clave, e);
            }
            if (e.n >= max) return false;
            e.n++;
            return true;
        },
        reiniciar() {
            porClave.clear();
        },
    };
}

module.exports = { crearLimitador };
