// Lógica de importación desde Excel, compartida por las rutas de routes/importar.js
// y por scripts/importar_excel.js (carga completa por línea de comandos), para que
// las reglas no se vuelvan a desalinear entre ambos.
//
// Reglas comunes:
// - Un valor de catálogo (categoría, estado, criticidad, tipo...) que no se
//   reconoce DETIENE la importación con un error que indica hoja y fila. Antes se
//   reemplazaba en silencio por un valor por defecto ("Fuera de servicio" quedaba
//   OPERATIVO). Se aceptan mayúsculas/minúsculas, tildes, espacios y "de"
//   ("Mantención" → MANTENCION, "Fuera de servicio" → FUERA_SERVICIO).
// - Celda vacía = sin dato: en un registro NUEVO se usa el valor por defecto; en
//   un registro que YA EXISTE (importación parcial) se conserva el valor actual.
//   Una importación parcial nunca borra un dato; para borrarlo se usa la ficha.
// - Se valida TODO el archivo antes de escribir: o se importa entero o no se
//   importa nada.

const db = require("../db");
const {
    ESTADOS_ITEM, CRITICIDADES, CATEGORIAS, ESTADOS_BOMBERO, TIPOS_UBICACION, TIPOS_CONTROL,
    RESULTADOS_CONTROL, normXlsx, normFechaXlsx, canonizarValorLibre,
} = require("./helpers");

// Error de contenido del archivo (no del servidor): la ruta lo responde como 400
class ErrorImportacion extends Error {
    constructor(errores) {
        const lista = Array.isArray(errores) ? errores : [errores];
        const MAX = 50;
        const visibles = lista.slice(0, MAX).map((e) => `• ${e}`);
        if (lista.length > MAX) visibles.push(`• ... y ${lista.length - MAX} errores más`);
        super(lista.length === 1 ? lista[0] : `El archivo tiene ${lista.length} errores:\n${visibles.join("\n")}`);
        this.errores = lista;
    }
}

// Clave para comparar contra un catálogo: sin tildes ni mayúsculas, y sin
// separadores ni la palabra "de" ("Fuera de servicio" ≡ "FUERA_SERVICIO")
function claveCatalogo(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
        .split(/[^A-Z0-9]+/).filter((w) => w && w !== "DE").join("_");
}

const VALORES_ACTIVO = new Map([
    ...["1", "SI", "S", "TRUE", "VERDADERO", "ACTIVO", "ACTIVA"].map((v) => [v, 1]),
    ...["0", "NO", "N", "FALSE", "FALSO", "INACTIVO", "INACTIVA"].map((v) => [v, 0]),
]);

// Fila tal como la ve la persona en Excel (la 1 es la de encabezados)
function numFila(r) {
    return r.__rowNum__ !== undefined ? r.__rowNum__ + 1 : "?";
}

// Acumula los errores de un archivo y lee celdas validadas
function crearLector() {
    const errores = [];
    const donde = (hoja, r) => `Hoja "${hoja}", fila ${numFila(r)}`;

    return {
        errores,
        error(hoja, r, msg) { errores.push(`${donde(hoja, r)}: ${msg}`); },

        // Valor de catálogo normalizado, o null si la celda está vacía
        catalogo(hoja, r, campo, catalogo) {
            const s = normXlsx(r[campo]);
            if (!s) return null;
            const clave = claveCatalogo(s);
            const valor = catalogo.find((c) => claveCatalogo(c) === clave);
            if (!valor) {
                errores.push(`${donde(hoja, r)}: ${campo} "${s}" no es válido (use: ${catalogo.join(", ")})`);
                return null;
            }
            return valor;
        },

        // 1/0, o null si la celda está vacía
        activo(hoja, r) {
            const s = normXlsx(r.activo);
            if (!s) return null;
            const v = VALORES_ACTIVO.get(claveCatalogo(s));
            if (v === undefined) {
                errores.push(`${donde(hoja, r)}: activo "${s}" no es válido (use 1 o 0, SI o NO)`);
                return null;
            }
            return v;
        },

        lanzarSiHayErrores() {
            if (errores.length) throw new ErrorImportacion(errores);
        },
    };
}

// Lee una hoja y exige su columna clave: sin ella, cada fila quedaría
// "vacía" y se saltaría en silencio (p.ej. al subir un Excel exportado,
// que tiene encabezados legibles en vez de los de la plantilla)
function leerHoja(wb, nombre, columnaClave, { obligatoria = true } = {}) {
    const xlsx = require("xlsx");
    const ws = wb.Sheets[nombre];
    if (!ws) {
        if (!obligatoria) return [];
        throw new ErrorImportacion(`No existe la hoja "${nombre}" en el archivo`);
    }
    const filas = xlsx.utils.sheet_to_json(ws, { defval: "" });
    const encabezados = (xlsx.utils.sheet_to_json(ws, { header: 1 })[0] ?? []).map((h) => normXlsx(h));
    if (filas.length && !encabezados.includes(columnaClave)) {
        throw new ErrorImportacion(
            `La hoja "${nombre}" no tiene la columna "${columnaClave}". ` +
            "Use los encabezados de la plantilla de importación (fila 1)."
        );
    }
    return filas;
}

function exigirUnicos(filas, campo, hoja, lector) {
    const vistos = new Set();
    for (const r of filas) {
        const v = normXlsx(r[campo]); if (!v) continue;
        if (vistos.has(v)) lector.error(hoja, r, `${campo} "${v}" está repetido en el archivo`);
        vistos.add(v);
    }
}

// Texto libre opcional: null si la celda está vacía
const texto = (v) => normXlsx(v) || null;

// ─────────────────────────────────────────────────────────────────────────────
// Importación parcial — Ubicaciones (crea o actualiza por nombre)
// ─────────────────────────────────────────────────────────────────────────────
function importarUbicaciones(wb) {
    const filas = leerHoja(wb, "Ubicaciones", "nombre");
    const L = crearLector();
    exigirUnicos(filas, "nombre", "Ubicaciones", L);

    const datos = [];
    for (const r of filas) {
        const nombre = normXlsx(r.nombre); if (!nombre) continue;
        datos.push({
            nombre,
            tipo: L.catalogo("Ubicaciones", r, "tipo", TIPOS_UBICACION),
            responsable: texto(r.responsable),
            activo: L.activo("Ubicaciones", r),
        });
    }
    L.lanzarSiHayErrores();

    const getUbic = db.prepare("SELECT * FROM ubicacion WHERE nombre = ?");
    const insUbic = db.prepare("INSERT INTO ubicacion (nombre, tipo, responsable, activo) VALUES (?, ?, ?, ?)");
    const updUbic = db.prepare("UPDATE ubicacion SET tipo=?, responsable=?, activo=? WHERE id=?");
    const setQr   = db.prepare("UPDATE ubicacion SET codigo_qr=? WHERE id=?");

    let insertados = 0, actualizados = 0;
    db.transaction(() => {
        for (const d of datos) {
            const ex = getUbic.get(d.nombre);
            if (ex) {
                updUbic.run(d.tipo ?? ex.tipo, d.responsable ?? ex.responsable, d.activo ?? ex.activo, ex.id);
                actualizados++;
            } else {
                const info = insUbic.run(d.nombre, d.tipo ?? "OTRO", d.responsable, d.activo ?? 1);
                setQr.run(`UBIC-${String(info.lastInsertRowid).padStart(4, "0")}`, info.lastInsertRowid);
                insertados++;
            }
        }
    })();
    return { insertados, actualizados };
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación parcial — Bomberos (crea o actualiza por nombre)
// ─────────────────────────────────────────────────────────────────────────────
function importarBomberos(wb) {
    const filas = leerHoja(wb, "Bomberos", "nombre");
    const L = crearLector();
    exigirUnicos(filas, "nombre", "Bomberos", L);

    const datos = [];
    for (const r of filas) {
        const nombre = normXlsx(r.nombre); if (!nombre) continue;
        datos.push({
            nombre,
            cargo: texto(r.cargo),
            estado: L.catalogo("Bomberos", r, "estado", ESTADOS_BOMBERO),
            observaciones: texto(r.observaciones),
            rut: texto(r.rut),
            numero_registro: texto(r.numero_registro),
        });
    }
    L.lanzarSiHayErrores();

    const getBom = db.prepare("SELECT * FROM bombero WHERE nombre = ?");
    const insBom = db.prepare("INSERT INTO bombero (nombre, cargo, estado, observaciones, rut, numero_registro) VALUES (?, ?, ?, ?, ?, ?)");
    const updBom = db.prepare("UPDATE bombero SET cargo=?, estado=?, observaciones=?, rut=?, numero_registro=? WHERE id=?");

    let insertados = 0, actualizados = 0;
    db.transaction(() => {
        for (const d of datos) {
            const ex = getBom.get(d.nombre);
            if (ex) {
                updBom.run(d.cargo ?? ex.cargo, d.estado ?? ex.estado, d.observaciones ?? ex.observaciones,
                    d.rut ?? ex.rut, d.numero_registro ?? ex.numero_registro, ex.id);
                actualizados++;
            } else {
                insBom.run(d.nombre, d.cargo, d.estado ?? "ACTIVO", d.observaciones, d.rut, d.numero_registro);
                insertados++;
            }
        }
    })();
    return { insertados, actualizados };
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación parcial — Ítems (crea o actualiza por código) + Controles (aditiva)
// ─────────────────────────────────────────────────────────────────────────────
function importarItems(wb, responsable) {
    const filas = leerHoja(wb, "Items", "codigo");
    const filasControl = leerHoja(wb, "Controles", "codigo_item", { obligatoria: false });
    const L = crearLector();
    exigirUnicos(filas, "codigo", "Items", L);

    const ubicMap = new Map(db.prepare("SELECT id, nombre FROM ubicacion").all().map((r) => [r.nombre, r.id]));
    const bomMap  = new Map(db.prepare("SELECT id, nombre FROM bombero").all().map((r) => [r.nombre, r.id]));
    const ubicPorId = new Map([...ubicMap].map(([n, id]) => [id, n]));
    const bomPorId  = new Map([...bomMap].map(([n, id]) => [id, n]));

    const datos = [];
    for (const r of filas) {
        const codigo = normXlsx(r.codigo); if (!codigo) continue;
        const ubicNombre = normXlsx(r.ubicacion_nombre);
        const bomNombre  = normXlsx(r.bombero_nombre);
        if (ubicNombre && bomNombre) L.error("Items", r, `"${codigo}" no puede tener ubicación y bombero a la vez`);
        else {
            if (ubicNombre && !ubicMap.has(ubicNombre)) L.error("Items", r, `"${codigo}": ubicación no encontrada → "${ubicNombre}"`);
            if (bomNombre  && !bomMap.has(bomNombre))   L.error("Items", r, `"${codigo}": bombero no encontrado → "${bomNombre}"`);
        }
        datos.push({
            codigo, ubicNombre, bomNombre,
            categoria:  L.catalogo("Items", r, "categoria", CATEGORIAS),
            estado:     L.catalogo("Items", r, "estado", ESTADOS_ITEM),
            criticidad: L.catalogo("Items", r, "criticidad", CRITICIDADES),
            // subcategoria/marca/modelo/talla se canonizan al escribir (dentro de la
            // transacción), para comparar también contra filas previas del mismo archivo
            subcategoria: texto(r.subcategoria),
            descripcion:  texto(r.descripcion),
            marca:        texto(r.marca),
            modelo:       texto(r.modelo),
            serie:        texto(r.serie),
            talla:        texto(r.talla),
            ubicacion_detalle: texto(r.ubicacion_detalle),
            fecha_fabricacion: normFechaXlsx(r.fecha_fabricacion),
            fecha_recepcion:   normFechaXlsx(r.fecha_recepcion),
            fecha_vencimiento: normFechaXlsx(r.fecha_vencimiento),
        });
    }

    const controles = [];
    for (const c of filasControl) {
        const codigo_item = normXlsx(c.codigo_item); if (!codigo_item) continue;
        controles.push({
            codigo_item,
            tipo: L.catalogo("Controles", c, "tipo", TIPOS_CONTROL) ?? "INSPECCION",
            resultado: L.catalogo("Controles", c, "resultado", RESULTADOS_CONTROL),
            fecha_objetivo: texto(c.fecha_objetivo),
            fecha_real: texto(c.fecha_real),
            observacion: texto(c.observacion),
        });
    }
    L.lanzarSiHayErrores();

    const getItem = db.prepare("SELECT * FROM item WHERE codigo = ?");
    const insItem = db.prepare("INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, talla, estado, criticidad, ubicacion_actual_id, ubicacion_detalle, asignado_bombero_id, fecha_fabricacion, fecha_recepcion, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const updItem = db.prepare("UPDATE item SET categoria=?, subcategoria=?, descripcion=?, marca=?, modelo=?, serie=?, talla=?, estado=?, criticidad=?, ubicacion_actual_id=?, ubicacion_detalle=?, asignado_bombero_id=?, fecha_fabricacion=?, fecha_recepcion=?, fecha_vencimiento=?, actualizado_en=datetime('now','localtime') WHERE id=?");
    const insMov  = db.prepare("INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))");
    const insCtrl = db.prepare("INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion) VALUES (?, ?, ?, ?, ?, ?)");

    let insertados = 0, actualizados = 0, nControles = 0;
    db.transaction(() => {
        for (const d of datos) {
            for (const campo of ["subcategoria", "marca", "modelo", "talla"]) d[campo] = canonizarValorLibre(campo, d[campo]);
            const ubicId = d.ubicNombre ? ubicMap.get(d.ubicNombre) : null;
            const bomId  = d.bomNombre  ? bomMap.get(d.bomNombre)   : null;
            const ex = getItem.get(d.codigo);

            if (ex) {
                // Celda vacía => se conserva el valor actual del ítem. La asignación
                // solo cambia si el Excel indica una ubicación o un bombero.
                const sinAsignacion = !d.ubicNombre && !d.bomNombre;
                const nuevoUbicId = sinAsignacion ? ex.ubicacion_actual_id : ubicId;
                const nuevoBomId  = sinAsignacion ? ex.asignado_bombero_id : bomId;
                const v = (campo) => d[campo] ?? ex[campo];

                updItem.run(
                    v("categoria"), v("subcategoria"), v("descripcion"), v("marca"), v("modelo"), v("serie"),
                    v("talla"), v("estado"), v("criticidad"), nuevoUbicId, v("ubicacion_detalle"), nuevoBomId,
                    v("fecha_fabricacion"), v("fecha_recepcion"), v("fecha_vencimiento"), ex.id,
                );

                if (nuevoUbicId !== ex.ubicacion_actual_id || nuevoBomId !== ex.asignado_bombero_id) {
                    const desde = ex.asignado_bombero_id
                        ? `Asignado a ${bomPorId.get(ex.asignado_bombero_id) ?? "Bombero desconocido"}`
                        : ex.ubicacion_actual_id
                            ? `Ubicado en ${ubicPorId.get(ex.ubicacion_actual_id) ?? "Ubicación desconocida"}`
                            : "Sin asignación";
                    const hacia = nuevoBomId ? `Asignado a ${d.bomNombre}` : `Ubicado en ${d.ubicNombre}`;
                    insMov.run(ex.id, nuevoBomId ? "ASIGNACION" : "MOVIMIENTO", desde, hacia, responsable, "Importación parcial desde Excel");
                }
                actualizados++;
            } else {
                const info = insItem.run(
                    d.codigo, d.categoria ?? "OTRO", d.subcategoria, d.descripcion ?? d.codigo, d.marca, d.modelo,
                    d.serie, d.talla, d.estado ?? "OPERATIVO", d.criticidad ?? "MEDIA", ubicId, d.ubicacion_detalle,
                    bomId, d.fecha_fabricacion, d.fecha_recepcion, d.fecha_vencimiento,
                );
                const hacia = bomId ? `Asignado a ${d.bomNombre}` : ubicId ? `Ubicado en ${d.ubicNombre}` : "Sin ubicar";
                insMov.run(info.lastInsertRowid, "ALTA", "Importación parcial", hacia, responsable, "Importación parcial desde Excel");
                insertados++;
            }
        }

        const itemMap = new Map(db.prepare("SELECT id, codigo FROM item").all().map((r) => [r.codigo, r.id]));
        for (const c of controles) {
            const itemId = itemMap.get(c.codigo_item);
            if (!itemId) continue;
            insCtrl.run(itemId, c.tipo, c.fecha_objetivo, c.fecha_real, c.resultado, c.observacion);
            nControles++;
        }
    })();
    return { insertados, actualizados, controles: nControles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga completa: reemplaza bomberos, ítems, controles y todo su historial.
//
// Las UBICACIONES no se recrean: las que siguen en el Excel (mismo nombre)
// conservan su id y su código UBIC-XXXX, porque los QR impresos y pegados en
// carros y bodegas codifican ese id (/ubicaciones/:id y /revision-carro/:id).
// Solo se eliminan las que ya no figuran en el Excel; como la tabla usa
// AUTOINCREMENT, su id no se reutiliza y un QR viejo nunca apunta a otra.
//
// `antesDeEscribir` (async) corre después de validar y antes de tocar la BD:
// la ruta y el script lo usan para el respaldo previo.
// ─────────────────────────────────────────────────────────────────────────────
async function cargaCompleta(wb, responsable, { antesDeEscribir } = {}) {
    const ubicaciones = leerHoja(wb, "Ubicaciones", "nombre");
    const bomberos    = leerHoja(wb, "Bomberos", "nombre");
    const items       = leerHoja(wb, "Items", "codigo");
    const controles   = leerHoja(wb, "Controles", "codigo_item");
    const L = crearLector();

    exigirUnicos(ubicaciones, "nombre", "Ubicaciones", L);
    exigirUnicos(bomberos, "nombre", "Bomberos", L);
    exigirUnicos(items, "codigo", "Items", L);

    const datosUbic = ubicaciones.filter((u) => normXlsx(u.nombre)).map((u) => ({
        nombre: normXlsx(u.nombre),
        tipo: L.catalogo("Ubicaciones", u, "tipo", TIPOS_UBICACION) ?? "OTRO",
        responsable: texto(u.responsable),
        activo: L.activo("Ubicaciones", u) ?? 1,
    }));
    const datosBom = bomberos.filter((b) => normXlsx(b.nombre)).map((b) => ({
        nombre: normXlsx(b.nombre),
        cargo: texto(b.cargo),
        estado: L.catalogo("Bomberos", b, "estado", ESTADOS_BOMBERO) ?? "ACTIVO",
        observaciones: texto(b.observaciones),
        rut: texto(b.rut),
        numero_registro: texto(b.numero_registro),
    }));

    const nombresUbic = new Set(datosUbic.map((u) => u.nombre));
    const nombresBom  = new Set(datosBom.map((b) => b.nombre));
    const datosItems = [];
    for (const it of items) {
        const codigo = normXlsx(it.codigo); if (!codigo) continue;
        const ubicNombre = normXlsx(it.ubicacion_nombre);
        const bomNombre  = normXlsx(it.bombero_nombre);
        if (ubicNombre && bomNombre) L.error("Items", it, `"${codigo}" no puede tener ubicación y bombero a la vez`);
        else {
            if (ubicNombre && !nombresUbic.has(ubicNombre)) L.error("Items", it, `"${codigo}": ubicación no encontrada en la hoja Ubicaciones → "${ubicNombre}"`);
            if (bomNombre  && !nombresBom.has(bomNombre))   L.error("Items", it, `"${codigo}": bombero no encontrado en la hoja Bomberos → "${bomNombre}"`);
        }
        datosItems.push({
            it, codigo, ubicNombre, bomNombre,
            categoria:  L.catalogo("Items", it, "categoria", CATEGORIAS) ?? "OTRO",
            estado:     L.catalogo("Items", it, "estado", ESTADOS_ITEM) ?? "OPERATIVO",
            criticidad: L.catalogo("Items", it, "criticidad", CRITICIDADES) ?? "MEDIA",
        });
    }

    const codigos = new Set(datosItems.map((d) => d.codigo));
    const datosCtrl = [];
    for (const c of controles) {
        const codigo_item = normXlsx(c.codigo_item); if (!codigo_item) continue;
        if (!codigos.has(codigo_item)) L.error("Controles", c, `referencia un ítem que no está en la hoja Items → "${codigo_item}"`);
        datosCtrl.push({
            codigo_item,
            tipo: L.catalogo("Controles", c, "tipo", TIPOS_CONTROL) ?? "INSPECCION",
            resultado: L.catalogo("Controles", c, "resultado", RESULTADOS_CONTROL),
            fecha_objetivo: texto(c.fecha_objetivo),
            fecha_real: texto(c.fecha_real),
            observacion: texto(c.observacion),
        });
    }
    L.lanzarSiHayErrores();

    if (antesDeEscribir) await antesDeEscribir();

    const insUbicacion = db.prepare("INSERT INTO ubicacion (nombre, tipo, responsable, activo) VALUES (?, ?, ?, ?)");
    const updUbicacion = db.prepare("UPDATE ubicacion SET tipo=?, responsable=?, activo=? WHERE id=?");
    const insBombero   = db.prepare("INSERT INTO bombero (nombre, cargo, estado, observaciones, rut, numero_registro) VALUES (?, ?, ?, ?, ?, ?)");
    const insItem      = db.prepare("INSERT INTO item (codigo, categoria, subcategoria, descripcion, marca, modelo, serie, talla, estado, criticidad, ubicacion_actual_id, ubicacion_detalle, asignado_bombero_id, fecha_fabricacion, fecha_recepcion, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insControl   = db.prepare("INSERT INTO control (item_id, tipo, fecha_objetivo, fecha_real, resultado, observacion) VALUES (?, ?, ?, ?, ?, ?)");
    const insMov       = db.prepare("INSERT INTO movimiento (item_id, tipo, desde, hacia, responsable, observacion, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))");

    const resumenUbic = { conservadas: 0, nuevas: 0, eliminadas: 0 };

    db.transaction(() => {
        // Las cuentas de usuario no se borran, pero su bombero sí se recrea (con otro id):
        // se anota a quién estaba vinculada cada una para re-vincularla por nombre al final
        const vinculos = db.prepare("SELECT u.id, b.nombre FROM usuario u JOIN bombero b ON b.id = u.bombero_id").all();
        db.prepare("UPDATE usuario SET bombero_id = NULL").run();

        db.prepare("DELETE FROM uso_trauma").run();
        db.prepare("DELETE FROM acta_entrega_item").run();
        db.prepare("DELETE FROM acta_entrega").run();
        db.prepare("DELETE FROM revision_carro_item").run();
        db.prepare("DELETE FROM revision_carro").run();
        db.prepare("DELETE FROM movimiento").run();
        db.prepare("DELETE FROM control").run();
        db.prepare("DELETE FROM item").run();
        db.prepare("DELETE FROM bombero").run();

        // Ubicaciones: se actualizan en su lugar (mismo id y QR) en vez de recrearse
        const existentes = new Map(db.prepare("SELECT id, nombre FROM ubicacion").all().map((r) => [r.nombre, r.id]));
        for (const u of datosUbic) {
            const id = existentes.get(u.nombre);
            if (id) { updUbicacion.run(u.tipo, u.responsable, u.activo, id); resumenUbic.conservadas++; }
            else    { insUbicacion.run(u.nombre, u.tipo, u.responsable, u.activo); resumenUbic.nuevas++; }
        }
        const borrarUbic = db.prepare("DELETE FROM ubicacion WHERE id = ?");
        for (const [nombre, id] of existentes) {
            if (!nombresUbic.has(nombre)) { borrarUbic.run(id); resumenUbic.eliminadas++; }
        }
        // codigo_qr es gestionado por el sistema (UBIC-XXXX según el id): solo se
        // completa en las que no lo tienen, nunca se reescribe el de una existente
        db.prepare("UPDATE ubicacion SET codigo_qr = 'UBIC-' || printf('%04d', id) WHERE codigo_qr IS NULL").run();

        const ubicMap = new Map(db.prepare("SELECT id, nombre FROM ubicacion").all().map((r) => [r.nombre, r.id]));

        for (const b of datosBom) insBombero.run(b.nombre, b.cargo, b.estado, b.observaciones, b.rut, b.numero_registro);
        const bomMap = new Map(db.prepare("SELECT id, nombre FROM bombero").all().map((r) => [r.nombre, r.id]));

        // Quien ya no figura en el Excel queda sin vínculo (la cuenta se conserva)
        const revincular = db.prepare("UPDATE usuario SET bombero_id = ? WHERE id = ?");
        for (const v of vinculos) revincular.run(bomMap.get(v.nombre) ?? null, v.id);

        for (const d of datosItems) {
            const it = d.it;
            insItem.run(
                d.codigo, d.categoria, canonizarValorLibre("subcategoria", normXlsx(it.subcategoria)),
                normXlsx(it.descripcion) || d.codigo, canonizarValorLibre("marca", normXlsx(it.marca)),
                canonizarValorLibre("modelo", normXlsx(it.modelo)), texto(it.serie),
                canonizarValorLibre("talla", normXlsx(it.talla)), d.estado, d.criticidad,
                d.ubicNombre ? ubicMap.get(d.ubicNombre) : null, texto(it.ubicacion_detalle),
                d.bomNombre ? bomMap.get(d.bomNombre) : null,
                normFechaXlsx(it.fecha_fabricacion), normFechaXlsx(it.fecha_recepcion), normFechaXlsx(it.fecha_vencimiento),
            );
        }

        const itemMap = new Map(db.prepare("SELECT id, codigo FROM item").all().map((r) => [r.codigo, r.id]));
        for (const c of datosCtrl) {
            insControl.run(itemMap.get(c.codigo_item), c.tipo, c.fecha_objetivo, c.fecha_real, c.resultado, c.observacion);
        }

        for (const r of db.prepare(`SELECT it.id, u.nombre AS ubic, b.nombre AS bom FROM item it LEFT JOIN ubicacion u ON u.id = it.ubicacion_actual_id LEFT JOIN bombero b ON b.id = it.asignado_bombero_id`).all()) {
            const hacia = r.bom ? `Asignado a ${r.bom}` : r.ubic ? `Ubicado en ${r.ubic}` : "Sin ubicación";
            insMov.run(r.id, "ALTA", "Carga inicial", hacia, responsable, "Importación desde Excel");
        }
    })();

    return {
        bomberos: datosBom.length,
        ubicaciones: datosUbic.length,
        items: datosItems.length,
        controles: datosCtrl.length,
        ubicaciones_conservadas: resumenUbic.conservadas,
        ubicaciones_nuevas: resumenUbic.nuevas,
        ubicaciones_eliminadas: resumenUbic.eliminadas,
    };
}

module.exports = {
    ErrorImportacion, claveCatalogo,
    importarUbicaciones, importarBomberos, importarItems, cargaCompleta,
};
