require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

//Check Health
app.get("/health", (req, res) => res.json({ ok: true }));

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
