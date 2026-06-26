const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-inseguro";
const TOKEN_EXPIRA = "12h";

function firmarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRA }
    );
}

// Verifica el Bearer token y deja el usuario en req.usuario
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autenticado" });
    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Sesión inválida o expirada" });
    }
}

// Requiere rol ADMIN (debe ir despues de requireAuth)
function requireAdmin(req, res, next) {
    if (req.usuario?.rol !== "ADMIN")
        return res.status(403).json({ error: "Requiere permisos de administrador" });
    next();
}

module.exports = { firmarToken, requireAuth, requireAdmin, JWT_SECRET };
