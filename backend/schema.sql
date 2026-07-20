PRAGMA foreign_keys = ON;

-- usuarios del sistema (autenticacion)
CREATE TABLE IF NOT EXISTS usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre TEXT,
    rol TEXT NOT NULL DEFAULT 'OPERADOR',
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- bombero
CREATE TABLE IF NOT EXISTS bombero (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cargo TEXT,
    estado TEXT NOT NULL DEFAULT 'ACTIVO',
    observaciones TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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

    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    actualizado_en TEXT NOT NULL DEFAULT(datetime('now','localtime')),

    FOREIGN KEY (ubicacion_actual_id) REFERENCES ubicacion(id),
    FOREIGN KEY (asignado_bombero_id) REFERENCES bombero(id)
);

CREATE INDEX IF NOT EXISTS idx_item_categoria ON item(categoria);
CREATE INDEX IF NOT EXISTS idx_item_asignado ON item(asignado_bombero_id);
CREATE INDEX IF NOT EXISTS idx_item_ubicacion ON item(ubicacion_actual_id);

--moviemientos
CREATE TABLE IF NOT EXISTS movimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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

    creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),

    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_control_objetivo ON control(tipo, fecha_objetivo);

-- registro de uso de material trauma
CREATE TABLE IF NOT EXISTS uso_trauma (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL,
    fecha       TEXT NOT NULL DEFAULT (date('now','localtime')),
    cantidad    INTEGER NOT NULL DEFAULT 1,
    motivo      TEXT,
    responsable TEXT,
    observacion TEXT,
    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_uso_trauma_item ON uso_trauma(item_id, fecha);

-- actas de entrega: entregar uno o varios items a un bombero exige un documento
-- firmado (acta de recepcion) antes de confirmarse. Una acta puede cubrir varios
-- items a la vez (ej. kit completo de EPP), de ahi la tabla puente.
CREATE TABLE IF NOT EXISTS acta_entrega (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bombero_id  INTEGER NOT NULL,
    estado      TEXT NOT NULL DEFAULT 'PENDIENTE',

    documento_path          TEXT NOT NULL,
    documento_firmado_path  TEXT,

    observacion TEXT,

    solicitado_por    TEXT NOT NULL,
    fecha_solicitud   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    confirmado_por    TEXT,
    fecha_confirmacion TEXT,

    FOREIGN KEY (bombero_id) REFERENCES bombero(id)
);

CREATE TABLE IF NOT EXISTS acta_entrega_item (
    acta_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    PRIMARY KEY (acta_id, item_id),
    FOREIGN KEY (acta_id) REFERENCES acta_entrega(id),
    FOREIGN KEY (item_id) REFERENCES item(id)
);

CREATE INDEX IF NOT EXISTS idx_acta_entrega_bombero ON acta_entrega(bombero_id, estado);
CREATE INDEX IF NOT EXISTS idx_acta_entrega_item_item ON acta_entrega_item(item_id);