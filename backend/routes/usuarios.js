const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../lib/auth");
const { cleanText, badRequest, notFound, conflict, serverError } = require("../lib/helpers");

const ROLES = ["ADMIN", "OPERADOR"];

// Todas las rutas de usuarios requieren ser admin
router.use("/usuarios", requireAuth, requireAdmin);

// Listar usuarios (sin el hash)
router.get("/usuarios", (_req, res) => {
    const rows = db.prepare("SELECT id, username, nombre, rol, activo, creado_en FROM usuario ORDER BY username").all();
    res.json(rows);
});

// Crear usuario
router.post("/usuarios", (req, res) => {
    try {
        const username = cleanText(req.body.username);
        const nombre   = cleanText(req.body.nombre);
        const rol      = (cleanText(req.body.rol) || "OPERADOR").toUpperCase();
        const password = req.body.password;

        if (!username) return badRequest(res, "username es requerido");
        if (!password || String(password).length < 6) return badRequest(res, "La contraseña debe tener al menos 6 caracteres");
        if (!ROLES.includes(rol)) return badRequest(res, `rol inválido. Use: ${ROLES.join(", ")}`);

        if (db.prepare("SELECT id FROM usuario WHERE username = ?").get(username))
            return conflict(res, `Ya existe un usuario "${username}"`);

        const info = db.prepare("INSERT INTO usuario (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)")
            .run(username, bcrypt.hashSync(password, 10), nombre ?? null, rol);
        res.status(201).json({ id: info.lastInsertRowid });
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

        if (!ROLES.includes(rol)) return badRequest(res, `rol inválido. Use: ${ROLES.join(", ")}`);

        // No permitir que el ultimo admin activo se degrade o desactive (evita quedar sin acceso)
        if (actual.rol === "ADMIN" && (rol !== "ADMIN" || !activo)) {
            const otrosAdmins = db.prepare("SELECT COUNT(*) AS n FROM usuario WHERE rol='ADMIN' AND activo=1 AND id != ?").get(id);
            if (otrosAdmins.n === 0) return badRequest(res, "Debe quedar al menos un administrador activo");
        }

        if (password !== undefined && password !== null && password !== "") {
            if (String(password).length < 6) return badRequest(res, "La contraseña debe tener al menos 6 caracteres");
            db.prepare("UPDATE usuario SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), id);
        }

        db.prepare("UPDATE usuario SET nombre = ?, rol = ?, activo = ? WHERE id = ?")
            .run(nombre ?? actual.nombre, rol, activo, id);
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
