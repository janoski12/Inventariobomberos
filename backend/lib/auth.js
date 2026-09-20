const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("ERROR: falta JWT_SECRET. Define esta variable en backend/.env (ver .env.example) antes de iniciar el servidor.");
    process.exit(1);
}
const TOKEN_EXPIRA = "12h";

function firmarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRA }
    );
}

// Verifica el Bearer token y deja el usuario en req.usuario. El token solo
// prueba quién es: nombre, rol y estado se leen de la BD en cada petición, para
// que desactivar, eliminar o cambiar de rol una cuenta valga de inmediato y no
// recién cuando venza el token.
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autenticado" });

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: "Sesión inválida o expirada" });
    }

    const usuario = db.prepare(
        "SELECT id, username, nombre, rol, debe_cambiar_password FROM usuario WHERE id = ? AND activo = 1"
    ).get(payload.id);
    if (!usuario) return res.status(401).json({ error: "Sesión inválida o expirada" });

    req.usuario = usuario;
    next();
}

// Requiere rol ADMIN (debe ir despues de requireAuth)
function requireAdmin(req, res, next) {
    if (req.usuario?.rol !== "ADMIN")
        return res.status(403).json({ error: "Requiere permisos de administrador" });
    next();
}

// Bloquea el resto de la API mientras el usuario tenga pendiente cambiar su
// contraseña temporal (asignada al crear la cuenta, o al resetearla un
// admin). /auth/login, /auth/me y /auth/password se resuelven antes de
// llegar aca (routes/auth.js se monta antes que este gate en server.js), asi
// que no necesitan excepcion explicita.
function requirePasswordActualizada(req, res, next) {
    if (req.usuario.debe_cambiar_password) {
        return res.status(403).json({ error: "Debes cambiar tu contraseña temporal antes de continuar", debe_cambiar_password: true });
    }
    next();
}

// Nombre con el que se registra al usuario autenticado en la trazabilidad
function quienRegistra(req) {
    return req.usuario?.nombre || req.usuario?.username || "Sistema";
}

module.exports = { firmarToken, requireAuth, requireAdmin, requirePasswordActualizada, quienRegistra, JWT_SECRET };
