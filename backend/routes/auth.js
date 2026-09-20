const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { firmarToken, requireAuth } = require("../lib/auth");
const { cleanText, badRequest, serverError } = require("../lib/helpers");
const limiteLogin = require("../lib/limitarLogin");

// Iniciar sesion
router.post("/auth/login", (req, res) => {
    try {
        const username = cleanText(req.body.username);
        const password = req.body.password;

        if (!username || !password) return badRequest(res, "Usuario y contraseña son requeridos");

        const usuario = db.prepare(`
            SELECT usu.*, b.nombre AS bombero_nombre
            FROM usuario usu
            LEFT JOIN bombero b ON b.id = usu.bombero_id
            WHERE usu.username = ?
        `).get(username);

        // Límite de intentos por cuenta (ver lib/limitarLogin.js). Los nombres que no
        // existen comparten un solo cupo, para que probar nombres al azar no llene la memoria.
        const cuenta = usuario ? `usuario:${usuario.id}` : "usuario-inexistente";
        const espera = limiteLogin.msBloqueado(cuenta);
        if (espera > 0) {
            const minutos = Math.ceil(espera / 60000);
            res.set("Retry-After", String(Math.ceil(espera / 1000)));
            return res.status(429).json({
                error: `Demasiados intentos fallidos con esta cuenta. Espera ${minutos} minuto${minutos !== 1 ? "s" : ""} antes de volver a intentarlo.`,
            });
        }

        if (!usuario || !usuario.activo || !bcrypt.compareSync(password, usuario.password_hash)) {
            if (limiteLogin.registrarFallo(cuenta))
                console.warn(`Login bloqueado por ${limiteLogin.MAX_FALLOS} intentos fallidos seguidos: ${usuario ? `cuenta "${usuario.username}"` : "nombres de usuario inexistentes"}`);
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        limiteLogin.limpiar(cuenta);
        const token = firmarToken(usuario);
        res.json({
            token,
            usuario: {
                id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol,
                debe_cambiar_password: !!usuario.debe_cambiar_password,
                bombero_id: usuario.bombero_id, bombero_nombre: usuario.bombero_nombre,
            },
        });
    } catch (e) {
        return serverError(res, e, "Error al iniciar sesión");
    }
});

// Datos del usuario autenticado (valida que el token siga vivo)
router.get("/auth/me", requireAuth, (req, res) => {
    const usuario = db.prepare(`
        SELECT usu.id, usu.username, usu.nombre, usu.rol, usu.activo, usu.debe_cambiar_password,
               usu.bombero_id, b.nombre AS bombero_nombre
        FROM usuario usu
        LEFT JOIN bombero b ON b.id = usu.bombero_id
        WHERE usu.id = ?
    `).get(req.usuario.id);
    if (!usuario || !usuario.activo) return res.status(401).json({ error: "Sesión inválida" });
    res.json({
        id: usuario.id, username: usuario.username, nombre: usuario.nombre, rol: usuario.rol,
        debe_cambiar_password: !!usuario.debe_cambiar_password,
        bombero_id: usuario.bombero_id, bombero_nombre: usuario.bombero_nombre,
    });
});

// Cambiar la propia contraseña
router.put("/auth/password", requireAuth, (req, res) => {
    try {
        const actual = req.body.actual;
        const nueva = req.body.nueva;
        if (!actual || !nueva) return badRequest(res, "Contraseña actual y nueva son requeridas");
        if (String(nueva).length < 6) return badRequest(res, "La nueva contraseña debe tener al menos 6 caracteres");

        const usuario = db.prepare("SELECT * FROM usuario WHERE id = ?").get(req.usuario.id);
        if (!usuario || !bcrypt.compareSync(actual, usuario.password_hash))
            return res.status(401).json({ error: "La contraseña actual es incorrecta" });

        db.prepare("UPDATE usuario SET password_hash = ?, debe_cambiar_password = 0 WHERE id = ?").run(bcrypt.hashSync(nueva, 10), usuario.id);
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error al cambiar la contraseña");
    }
});

module.exports = router;
