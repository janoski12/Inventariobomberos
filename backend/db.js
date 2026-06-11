const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "inventario.db");
const schemaPath = path.join(__dirname, "schema.sql");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true});

const db = new Database(dbPath);

const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

db.exec("PRAGMA foreign_keys = ON;");

// Migraciones: columnas trauma
try { db.exec("ALTER TABLE item ADD COLUMN fecha_recepcion TEXT"); } catch {}
try { db.exec("ALTER TABLE item ADD COLUMN fecha_vencimiento TEXT"); } catch {}

// Migraciones: fecha fabricación en item
try { db.exec("ALTER TABLE item ADD COLUMN fecha_fabricacion TEXT"); } catch {}

// Migraciones: campos bombero
try { db.exec("ALTER TABLE bombero ADD COLUMN rut TEXT"); } catch {}
try { db.exec("ALTER TABLE bombero ADD COLUMN numero_registro TEXT"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bombero_rut ON bombero(rut) WHERE rut IS NOT NULL"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bombero_registro ON bombero(numero_registro) WHERE numero_registro IS NOT NULL"); } catch {}
// Normalizar estados existentes a uppercase
try { db.exec("UPDATE bombero SET estado = UPPER(estado) WHERE estado != UPPER(estado)"); } catch {}

// Normalizar tipos de ubicacion legacy (minusculas o valores invalidos)
try {
    db.exec("UPDATE ubicacion SET tipo = UPPER(tipo) WHERE tipo != UPPER(tipo)");
    db.exec("UPDATE ubicacion SET tipo = 'OTRO' WHERE tipo IS NULL OR tipo = '' OR tipo NOT IN ('BODEGA','SALA','SALON','CONTAINER','CARRO','CASILLERO','OTRO')");
} catch {}

// Backfill: codigo_qr automatico para ubicaciones que no tienen
try { db.exec("UPDATE ubicacion SET codigo_qr = 'UBIC-' || printf('%04d', id) WHERE codigo_qr IS NULL OR codigo_qr = ''"); } catch {}

module.exports = db;