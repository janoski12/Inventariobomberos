const ExcelJS = require("exceljs");

// Mismos colores que usan los chips de estado/criticidad en el frontend
// (ver frontend/src/styles.css), oscurecidos un poco para que se lean bien
// sobre fondo blanco en Excel.
const COLOR_ESTADO = {
    OPERATIVO:      "FF2E7D32",
    MANTENCION:     "FFEF6C00",
    FUERA_SERVICIO: "FFC62828",
    BAJA:           "FF616161",
};
const COLOR_CRITICIDAD = {
    ALTA:  "FFC62828",
    MEDIA: "FFEF6C00",
    BAJA:  "FF2E7D32",
};

const COLUMNAS = [
    { header: "Código",             key: "codigo",             width: 13 },
    { header: "Descripción",        key: "descripcion",        width: 34 },
    { header: "Categoría",          key: "categoria",          width: 15 },
    { header: "Subcategoría",       key: "subcategoria",       width: 20 },
    { header: "Estado",             key: "estado",             width: 15 },
    { header: "Criticidad",         key: "criticidad",         width: 11 },
    { header: "Asignado a",         key: "asignado_a",         width: 24 },
    { header: "Ubicación",          key: "ubicacion",          width: 18 },
    { header: "Gaveta/Detalle",     key: "ubicacion_detalle",  width: 18 },
    { header: "Marca",              key: "marca",              width: 15 },
    { header: "Modelo",             key: "modelo",              width: 15 },
    { header: "Serie",              key: "serie",              width: 14 },
    { header: "Talla",              key: "talla",              width: 8 },
    { header: "Fecha Fabricación",  key: "fecha_fabricacion",  width: 16 },
    { header: "Fecha Recepción",    key: "fecha_recepcion",    width: 16 },
    { header: "Fecha Vencimiento",  key: "fecha_vencimiento",  width: 16 },
];

const FILA_TITULO = 1;
const FILA_SUBTITULO = 2;
const FILA_ENCABEZADOS = 4;
const PRIMERA_FILA_DATOS = 5;

const BORDE_SUAVE = { style: "thin", color: { argb: "FFD9D9D9" } };

function construirHojaInventario(ws, rows, fechaTexto) {
    ws.columns = COLUMNAS.map(({ width }) => ({ width }));

    ws.mergeCells(FILA_TITULO, 1, FILA_TITULO, COLUMNAS.length);
    const titulo = ws.getCell(FILA_TITULO, 1);
    titulo.value = "Inventario — 10ª Compañía, Cuerpo de Bomberos de Temuco";
    titulo.font = { bold: true, size: 14 };

    ws.mergeCells(FILA_SUBTITULO, 1, FILA_SUBTITULO, COLUMNAS.length);
    const subtitulo = ws.getCell(FILA_SUBTITULO, 1);
    subtitulo.value = `Exportado el ${fechaTexto} · ${rows.length} ítem${rows.length !== 1 ? "s" : ""}`;
    subtitulo.font = { italic: true, size: 10, color: { argb: "FF666666" } };

    const filaEncabezados = ws.getRow(FILA_ENCABEZADOS);
    COLUMNAS.forEach((col, i) => {
        const celda = filaEncabezados.getCell(i + 1);
        celda.value = col.header;
        celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF424242" } };
        celda.alignment = { vertical: "middle" };
        celda.border = { top: BORDE_SUAVE, bottom: BORDE_SUAVE, left: BORDE_SUAVE, right: BORDE_SUAVE };
    });
    filaEncabezados.height = 20;

    rows.forEach((r, i) => {
        const fila = ws.getRow(PRIMERA_FILA_DATOS + i);
        const asignado = !!r.asignado_a;

        COLUMNAS.forEach((col, ci) => {
            const celda = fila.getCell(ci + 1);
            celda.value = r[col.key] ?? "";
            celda.border = { top: BORDE_SUAVE, bottom: BORDE_SUAVE, left: BORDE_SUAVE, right: BORDE_SUAVE };
            // Fila entera con un tinte suave cuando el ítem está asignado a un
            // bombero (en vez de ubicado en un lugar): es justo lo que no se
            // distinguía en el Excel plano anterior.
            if (asignado) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
        });

        const celdaEstado = fila.getCell(COLUMNAS.findIndex((c) => c.key === "estado") + 1);
        if (COLOR_ESTADO[r.estado]) celdaEstado.font = { bold: true, color: { argb: COLOR_ESTADO[r.estado] } };

        const celdaCriticidad = fila.getCell(COLUMNAS.findIndex((c) => c.key === "criticidad") + 1);
        if (COLOR_CRITICIDAD[r.criticidad]) celdaCriticidad.font = { color: { argb: COLOR_CRITICIDAD[r.criticidad] } };
    });

    ws.views = [{ state: "frozen", ySplit: FILA_ENCABEZADOS }];
    ws.autoFilter = {
        from: { row: FILA_ENCABEZADOS, column: 1 },
        to: { row: FILA_ENCABEZADOS, column: COLUMNAS.length },
    };
}

// rows: filas ya resueltas desde la BD (codigo, descripcion, ..., asignado_a,
// ubicacion, ubicacion_detalle, ...), en el mismo orden en que deben salir.
async function generarExcelInventario(rows, fechaTexto) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario");
    construirHojaInventario(ws, rows, fechaTexto);
    return wb.xlsx.writeBuffer();
}

module.exports = { generarExcelInventario };
