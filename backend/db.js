const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const schemaPath = path.join(__dirname, "schema.sql");

// El path de la BD es configurable (DB_PATH) para que los tests usen
// una base temporal aislada. Por defecto: data/inventario.db
const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "inventario.db");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true});

const db = new Database(dbPath);

const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

db.exec("PRAGMA foreign_keys = ON;");
// WAL: las lecturas no se bloquean durante escrituras largas (p.ej. importaciones)
db.pragma("journal_mode = WAL");

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

// codigo_qr gestionado por el sistema: formato UBIC-XXXX para todas
try { db.exec("UPDATE ubicacion SET codigo_qr = 'UBIC-' || printf('%04d', id) WHERE codigo_qr IS NULL OR codigo_qr = '' OR codigo_qr NOT LIKE 'UBIC-%'"); } catch {}

// Migracion: vincula el movimiento de asignacion con el acta de entrega que lo respalda
try { db.exec("ALTER TABLE movimiento ADD COLUMN asignacion_id INTEGER"); } catch {}

// Migracion: talla (EPP con tallas: uniforme, botas, chaqueta, etc.)
try { db.exec("ALTER TABLE item ADD COLUMN talla TEXT"); } catch {}

// Migracion: ubicacion exacta dentro de un carro (gaveta/compartimiento)
try { db.exec("ALTER TABLE item ADD COLUMN ubicacion_detalle TEXT"); } catch {}

// Migracion: contraseña temporal obligatoria a cambiar en el primer login
// (se asigna al crear el usuario, o cuando un admin le resetea la clave)
try { db.exec("ALTER TABLE usuario ADD COLUMN debe_cambiar_password INTEGER NOT NULL DEFAULT 0"); } catch {}

// La tabla asignacion_pendiente (un item por acta) se reemplazo por acta_entrega +
// acta_entrega_item (varios items por acta). No hubo datos reales en producción
// bajo el modelo anterior, asi que se descarta en vez de migrarla.
try { db.exec("DROP TABLE IF EXISTS asignacion_pendiente"); } catch {}

// Seed: si no existe ningun usuario, crear admin inicial (admin / admin123)
try {
    const { total } = db.prepare("SELECT COUNT(*) AS total FROM usuario").get();
    if (total === 0) {
        const bcrypt = require("bcryptjs");
        const hash = bcrypt.hashSync("admin123", 10);
        db.prepare("INSERT INTO usuario (username, password_hash, nombre, rol) VALUES (?, ?, ?, 'ADMIN')")
            .run("admin", hash, "Administrador");
        console.log("⚠️  Usuario admin inicial creado → usuario: admin / clave: admin123 (cámbiala tras el primer login)");
    }
} catch (e) { console.error("Error en seed de usuario:", e); }

module.exports = db;