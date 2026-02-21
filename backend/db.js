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

module.exports = db;