const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../lib/auth");
const { isNil, cleanText, badRequest, notFound, conflict, serverError, generarPasswordTemporal } = require("../lib/helpers");

const ROLES = ["ADMIN", "OPERADOR"];

// Todas las rutas de usuarios requieren ser admin
router.use("/usuarios", requireAuth, requireAdmin);

// Valida el bombero opcional a vincular a una cuenta: debe existir, y no
// puede estar ya vinculado a OTRA cuenta (un bombero, una sola cuenta). Si
// algo no es válido, ya responde el error y devuelve ok:false — el caller
// solo necesita cortar con `if (!vinculo.ok) return;`.
function validarBomberoVinculado(res, bombero_id, usuarioIdActual) {
    if (bombero_id === null) return { ok: true, value: null };
    if (!db.prepare("SELECT id FROM bombero WHERE id=?").get(bombero_id)) {
        notFound(res, "Bombero no encontrado");
        return { ok: false };
    }
    const yaVinculado = db.prepare("SELECT username FROM usuario WHERE bombero_id=? AND id != ?").get(bombero_id, usuarioIdActual ?? -1);
    if (yaVinculado) {
        conflict(res, `Ese bombero ya está vinculado a la cuenta "${yaVinculado.username}"`);
        return { ok: false };
    }
    return { ok: true, value: bombero_id };
}

// Listar usuarios (sin el hash)
router.get("/usuarios", (_req, res) => {
    const rows = db.prepare(`
        SELECT u.id, u.username, u.nombre, u.rol, u.activo, u.creado_en,
               u.bombero_id, b.nombre AS bombero_nombre
        FROM usuario u
        LEFT JOIN bombero b ON b.id = u.bombero_id
        ORDER BY u.username
    `).all();
    res.json(rows);
});

// Crear usuario: la contraseña la genera el sistema (temporal) y se debe
// cambiar obligatoriamente en el primer ingreso (ver requirePasswordActualizada)
router.post("/usuarios", (req, res) => {
    try {
        const username = cleanText(req.body.username);
        const nombre   = cleanText(req.body.nombre);
        const rol      = (cleanText(req.body.rol) || "OPERADOR").toUpperCase();
        const bombero_id = isNil(req.body.bombero_id) || req.body.bombero_id === "" ? null : Number(req.body.bombero_id);

        if (!username) return badRequest(res, "username es requerido");
        if (!ROLES.includes(rol)) return badRequest(res, `rol inválido. Use: ${ROLES.join(", ")}`);
        if (bombero_id !== null && (!Number.isInteger(bombero_id) || bombero_id <= 0))
            return badRequest(res, "bombero_id inválido");

        if (db.prepare("SELECT id FROM usuario WHERE username = ?").get(username))
            return conflict(res, `Ya existe un usuario "${username}"`);

        const vinculo = validarBomberoVinculado(res, bombero_id, null);
        if (!vinculo.ok) return;

        const passwordTemporal = generarPasswordTemporal();
        const info = db.prepare("INSERT INTO usuario (username, password_hash, nombre, rol, debe_cambiar_password, bombero_id) VALUES (?, ?, ?, ?, 1, ?)")
            .run(username, bcrypt.hashSync(passwordTemporal, 10), nombre ?? null, rol, vinculo.value);
        res.status(201).json({ id: info.lastInsertRowid, password_temporal: passwordTemporal });
    } catch (e) {
        return serverError(res, e, "Error creando usuario");
    }
});

// Editar usuario (nombre, rol, activo y opcionalmente password)
router.put("/usuarios/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const actual = db.prepare("SELECT * FROM usuario WHERE id = ?").get(id);
        if (!actual) return notFound(res, "Usuario no encontrado");

        const nombre = cleanText(req.body.nombre);
        const rol    = (cleanText(req.body.rol) || actual.rol).toUpperCase();
        const activo = req.body.activo === undefined ? actual.activo : (req.body.activo ? 1 : 0);
        const password = req.body.password;
        const bombero_id = req.body.bombero_id === undefined
            ? actual.bombero_id
            : (isNil(req.body.bombero_id) || req.body.bombero_id === "" ? null : Number(req.body.bombero_id));

        if (!ROLES.includes(rol)) return badRequest(res, `rol inválido. Use: ${ROLES.join(", ")}`);
        if (bombero_id !== null && (!Number.isInteger(bombero_id) || bombero_id <= 0))
            return badRequest(res, "bombero_id inválido");

        // No permitir que el ultimo admin activo se degrade o desactive (evita quedar sin acceso)
        if (actual.rol === "ADMIN" && (rol !== "ADMIN" || !activo)) {
            const otrosAdmins = db.prepare("SELECT COUNT(*) AS n FROM usuario WHERE rol='ADMIN' AND activo=1 AND id != ?").get(id);
            if (otrosAdmins.n === 0) return badRequest(res, "Debe quedar al menos un administrador activo");
        }

        const vinculo = validarBomberoVinculado(res, bombero_id, id);
        if (!vinculo.ok) return;

        if (password !== undefined && password !== null && password !== "") {
            if (String(password).length < 6) return badRequest(res, "La contraseña debe tener al menos 6 caracteres");
            // Una clave puesta por un admin tambien es "temporal": se exige cambiarla en el proximo ingreso
            db.prepare("UPDATE usuario SET password_hash = ?, debe_cambiar_password = 1 WHERE id = ?").run(bcrypt.hashSync(password, 10), id);
        }

        db.prepare("UPDATE usuario SET nombre = ?, rol = ?, activo = ?, bombero_id = ? WHERE id = ?")
            .run(nombre ?? actual.nombre, rol, activo, vinculo.value, id);
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error actualizando usuario");
    }
});

// Eliminar usuario
router.delete("/usuarios/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return badRequest(res, "ID inválido");

        const usuario = db.prepare("SELECT * FROM usuario WHERE id = ?").get(id);
        if (!usuario) return notFound(res, "Usuario no encontrado");

        if (id === req.usuario.id) return badRequest(res, "No puedes eliminar tu propio usuario");
        if (usuario.rol === "ADMIN") {
            const otrosAdmins = db.prepare("SELECT COUNT(*) AS n FROM usuario WHERE rol='ADMIN' AND activo=1 AND id != ?").get(id);
            if (otrosAdmins.n === 0) return badRequest(res, "Debe quedar al menos un administrador activo");
        }

        db.prepare("DELETE FROM usuario WHERE id = ?").run(id);
        res.json({ ok: true });
    } catch (e) {
        return serverError(res, e, "Error eliminando usuario");
    }
});

module.exports = router;
