require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { requireAuth, requireAdmin } = require("./lib/auth");

const app = express();
app.use(cors());
app.use(express.json());

// ── Rutas publicas ──
app.get("/health", (req, res) => res.json({ ok: true }));
app.use(require("./routes/auth"));   // /auth/login es publico; /auth/me y /auth/password validan internamente

// ── A partir de aqui todo requiere sesion ──
app.use(requireAuth);
// Las operaciones destructivas (DELETE) requieren rol admin
app.use((req, res, next) => (req.method === "DELETE" ? requireAdmin(req, res, next) : next()));

app.use(require("./routes/usuarios"));   // ademas restringido a admin internamente
app.use(require("./routes/bomberos"));
app.use(require("./routes/ubicaciones"));
app.use(require("./routes/items"));
app.use(require("./routes/controles"));
app.use(require("./routes/trauma"));
app.use(require("./routes/reportes"));
app.use(require("./routes/importar"));

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Inventario corriendo en http://localhost:${PORT}`));
