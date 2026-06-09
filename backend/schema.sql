PRAGMA foreign_keys = ON;

-- bombero
CREATE TABLE IF NOT EXISTS bombero (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cargo TEXT,
    estado TEXT NOT NULL DEFAULT 'ACTIVO',
    observaciones TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- los imports parciales upsertan por nombre: debe ser unico
CREATE UNIQUE INDEX IF NOT EXISTS idx_bombero_nombre ON bombero(nombre);

--ubicacion / lugar
CREATE TABLE IF NOT EXISTS ubicacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'BODEGA',
    responsable TEXT,
    codigo_qr TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicacion_nombre ON ubicacion(nombre);

--items / activos
CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    subcategoria TEXT,
    descripcion TEXT NOT NULL,
    marca TEXT,
    modelo TEXT,
    serie TEXT,
    estado TEXT NOT NULL DEFAULT 'OPERATIVO',
    criticidad TEXT NOT NULL DEFAULT 'MEDIA',

    ubicacion_actual_id INTEGER,
    asignado_bombero_id INTEGER,

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT(datetime('now')),

    FOREIGN KEY (ubicacion_actual_id) REFERENCES ubicacion(id),
    FOREIGN KEY (asignado_bombero_id) REFERENCES bombero(id)
);

CREATE INDEX IF NOT EXISTS idx_item_categoria ON item(categoria);
CREATE INDEX IF NOT EXISTS idx_item_asignado ON item(asignado_bombero_id);
CREATE INDEX IF NOT EXISTS idx_item_ubicacion ON item(ubicacion_actual_id);

--moviemientos
CREATE TABLE IF NOT EXISTS movimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    item_id INTEGER NOT NULL,

    tipo TEXT NOT NULL,
    desde TEXT,
    hacia TEXT,

    responsable TEXT,
    observacion TEXT,

    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_mov_item_fecha ON movimiento(item_id, fecha);

--revisiones 
CREATE TABLE IF NOT EXISTS control (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,

    tipo TEXT NOT NULL,
    fecha_objetivo TEXT NOT NULL, 
    fecha_real TEXT,
    resultado TEXT,
    observacion TEXT,

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_control_objetivo ON control(tipo, fecha_objetivo);

-- registro de uso de material trauma
CREATE TABLE IF NOT EXISTS uso_trauma (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL,
    fecha       TEXT NOT NULL DEFAULT (date('now')),
    cantidad    INTEGER NOT NULL DEFAULT 1,
    motivo      TEXT,
    responsable TEXT,
    observacion TEXT,
    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_uso_trauma_item ON uso_trauma(item_id, fecha);