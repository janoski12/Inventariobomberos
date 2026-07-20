const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const DOCS_DIR = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, "..", "data", "x")), "documentos");
const ESCUDO_PATH = path.join(__dirname, "..", "assets", "escudo.png");

const MARGEN = 56;
const ANCHO_UTIL = 612 - MARGEN * 2; // Letter

function asegurarDir() {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function rutaActaSinFirmar(id) {
    return path.join(DOCS_DIR, `acta_${id}.pdf`);
}

// Dibuja una tabla simple (encabezado + filas) con bordes, centrada por columna.
// Devuelve la posicion Y donde termina, para seguir escribiendo debajo.
function dibujarTabla(doc, x, y, colWidths, filas, rowHeight = 24) {
    const anchoTotal = colWidths.reduce((a, b) => a + b, 0);
    let curY = y;

    filas.forEach((fila, i) => {
        const esEncabezado = i === 0;
        if (esEncabezado) doc.rect(x, curY, anchoTotal, rowHeight).fill("#dddddd");

        doc.fillColor("#000000").font(esEncabezado ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        let curX = x;
        fila.forEach((texto, ci) => {
            doc.text(String(texto ?? ""), curX + 4, curY + rowHeight / 2 - 4.5, {
                width: colWidths[ci] - 8,
                align: "center",
                lineBreak: false,
                ellipsis: true,
            });
            curX += colWidths[ci];
        });

        doc.strokeColor("#999999").lineWidth(0.5).rect(x, curY, anchoTotal, rowHeight).stroke();
        curX = x;
        colWidths.forEach((w) => {
            curX += w;
            doc.moveTo(curX, curY).lineTo(curX, curY + rowHeight).stroke();
        });

        curY += rowHeight;
    });

    return curY;
}

// Genera el PDF del acta de entrega (sin firmar) para una solicitud y la guarda
// en disco. `items` es un arreglo (una acta puede cubrir varios items a la vez,
// ej. un kit completo de EPP). Devuelve la ruta absoluta del archivo.
function generarActaEntrega(id, { bombero, items, solicitadoPor, fecha, observacion }) {
    asegurarDir();
    const destino = rutaActaSinFirmar(id);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "LETTER", margin: MARGEN });
        const stream = fs.createWriteStream(destino);
        doc.pipe(stream);
        stream.on("finish", () => resolve(destino));
        stream.on("error", reject);
        doc.on("error", reject);

        // ── Encabezado institucional ──
        const tieneEscudo = fs.existsSync(ESCUDO_PATH);
        const textoX = tieneEscudo ? MARGEN + 70 : MARGEN;
        const textoAncho = ANCHO_UTIL - (tieneEscudo ? 70 : 0);

        if (tieneEscudo) {
            try { doc.image(ESCUDO_PATH, MARGEN, MARGEN, { width: 56 }); } catch { /* imagen invalida, se omite */ }
        }

        doc.font("Helvetica-Bold").fontSize(14).text("DÉCIMA COMPAÑÍA", textoX, MARGEN, { width: textoAncho, align: "center" });
        doc.fontSize(12).text("CUERPO DE BOMBEROS TEMUCO", { width: textoAncho, align: "center" });
        doc.font("Helvetica").fontSize(9).text("FUNDADA EL 14 DE JULIO 1997", { width: textoAncho, align: "center" });
        doc.font("Helvetica-Oblique").fontSize(9).text('"SACRIFICIO Y ABNEGACION"', { width: textoAncho, align: "center" });

        doc.y = MARGEN + 78;
        doc.x = MARGEN;
        doc.font("Helvetica-Bold").fontSize(13).text("ACTA DE RECEPCIÓN", MARGEN, doc.y, { width: ANCHO_UTIL, align: "center", underline: true });
        doc.moveDown(1.5);

        // ── Cuerpo ──
        doc.font("Helvetica").fontSize(10);
        doc.text(
            `En dependencias de la 10° Compañía del Cuerpo de Bomberos de Temuco, Calle 5 Oriente ` +
            `S/N Labranza, por el presente documento, yo Voluntario/a `,
            MARGEN, doc.y, { width: ANCHO_UTIL, continued: true }
        );
        doc.font("Helvetica-Bold").text(bombero.nombre, { continued: true });
        doc.font("Helvetica").text(`, RUT N° `, { continued: true });
        doc.font("Helvetica-Bold").text(bombero.rut || "________________", { continued: true });
        doc.font("Helvetica").text(`, dejo constancia de la entrega de los siguientes elementos de protección personal:`);
        doc.moveDown(1);

        // ── Tabla de items ──
        const colWidths = [220, 70, 70, ANCHO_UTIL - 220 - 70 - 70];
        const filas = [
            ["Elemento", "Talla", "Cantidad", "Marca"],
            ...items.map((it) => [it.descripcion, it.talla || "", "1", it.marca || ""]),
        ];
        const yTrasTabla = dibujarTabla(doc, MARGEN, doc.y, colWidths, filas);
        doc.y = yTrasTabla + 16;
        doc.x = MARGEN;

        if (observacion) {
            doc.font("Helvetica-Bold").fontSize(10).text("Observación", MARGEN, doc.y, { width: ANCHO_UTIL });
            doc.font("Helvetica").text(observacion, { width: ANCHO_UTIL });
            doc.moveDown(1);
        }

        doc.font("Helvetica").fontSize(10).text(
            "Para constancia de lo anteriormente señalado, se procede a firmar la entrega conforme " +
            "de los implementos ya señalados.",
            MARGEN, doc.y, { width: ANCHO_UTIL, align: "justify" }
        );

        // ── Firmas ──
        doc.moveDown(5);
        const yFirma = doc.y;
        const anchoFirma = (ANCHO_UTIL - 30) / 2;
        doc.moveTo(MARGEN, yFirma).lineTo(MARGEN + anchoFirma, yFirma).stroke();
        doc.moveTo(MARGEN + anchoFirma + 30, yFirma).lineTo(MARGEN + anchoFirma * 2 + 30, yFirma).stroke();
        doc.fontSize(9).text("Firma del Voluntario que recibe", MARGEN, yFirma + 4, { width: anchoFirma, align: "center" });
        doc.text("Firma Capitán de Compañía", MARGEN + anchoFirma + 30, yFirma + 4, { width: anchoFirma, align: "center" });

        // ── Pie institucional ──
        // Sin esto, pdfkit interpreta que el texto no cabe antes del margen inferior
        // y lo empuja a una pagina nueva, aunque la posicion Y este dentro de la hoja.
        doc.page.margins.bottom = 0;
        doc.fontSize(8).fillColor("#666666").text(
            "5 Oriente 070 - Fono (45) 2375125 - Labranza - capitan10.bomberostemuco@gmail.com",
            MARGEN, 730, { width: ANCHO_UTIL, align: "center" }
        );

        doc.fontSize(7).fillColor("#999999").text(
            `Acta generada por el sistema el ${fecha} · Solicitada por ${solicitadoPor}. Debe imprimirse, ` +
            "firmarse, y subirse fotografiada o escaneada al sistema para confirmar la entrega.",
            MARGEN, 745, { width: ANCHO_UTIL, align: "center" }
        );

        doc.end();
    });
}

module.exports = { generarActaEntrega, rutaActaSinFirmar, DOCS_DIR, ESCUDO_PATH };
