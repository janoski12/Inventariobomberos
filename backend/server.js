require("dotenv").config();
const fs      = require("fs");
const path    = require("path");
const express = require("express");
const { requireAuth, requireAdmin } = require("./lib/auth");

const app = express();
app.use(express.json());

// ── API publica ──
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", require("./routes/auth"));   // /auth/login es publico; /auth/me y /auth/password validan internamente

// ── A partir de aqui toda la API requiere sesion ──
app.use("/api", requireAuth);
// Las operaciones destructivas (DELETE) requieren rol admin
app.use("/api", (req, res, next) => (req.method === "DELETE" ? requireAdmin(req, res, next) : next()));

app.use("/api", require("./routes/usuarios"));   // ademas restringido a admin internamente
app.use("/api", require("./routes/bomberos"));
app.use("/api", require("./routes/ubicaciones"));
app.use("/api", require("./routes/items"));
app.use("/api", require("./routes/asignaciones"));
app.use("/api", require("./routes/controles"));
app.use("/api", require("./routes/trauma"));
app.use("/api", require("./routes/reportes"));
app.use("/api", require("./routes/importar"));

// Rutas de API inexistentes responden JSON, nunca el HTML del SPA
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── Frontend compilado (produccion): un solo puerto para app + API ──
const DIST = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
    app.use(express.static(DIST));
    // Fallback SPA: cualquier GET que no sea API devuelve index.html (React Router resuelve la ruta)
    app.get("/{*splat}", (req, res) => res.sendFile(path.join(DIST, "index.html")));
} else if (require.main === module) {
    console.warn("Aviso: no existe frontend/dist — solo se sirve la API. Para servir la app ejecuta 'npm run build' en frontend/.");
}

// Errores no capturados responden JSON (nunca HTML con stack trace)
app.use((err, req, res, _next) => {
    if (err?.type === "entity.parse.failed")
        return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido" });
    if (err?.name === "MulterError")
        return res.status(400).json({
            error: err.code === "LIMIT_FILE_SIZE" ? "El archivo supera el límite de 10 MB" : "Error procesando el archivo",
        });
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
});

// Iniciar servidor solo si se ejecuta directamente (no al importar en tests)
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    require("./lib/backups").iniciarBackupsAutomaticos();
    app.listen(PORT, () => console.log(`Inventario CBT10 corriendo en http://localhost:${PORT}`));
}

module.exports = app;
