const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const DOCS_DIR = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, "..", "data", "x")), "documentos");

function asegurarDir() {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function rutaActaSinFirmar(id) {
    return path.join(DOCS_DIR, `acta_${id}.pdf`);
}

// Genera el PDF del acta de entrega (sin firmar) para una solicitud de asignacion
// y la guarda en disco. Devuelve la ruta absoluta del archivo.
function generarActaEntrega(id, { item, bombero, solicitadoPor, fecha, observacion }) {
    asegurarDir();
    const destino = rutaActaSinFirmar(id);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "LETTER", margin: 56 });
        const stream = fs.createWriteStream(destino);
        doc.pipe(stream);
        stream.on("finish", () => resolve(destino));
        stream.on("error", reject);
        doc.on("error", reject);

        doc.font("Helvetica-Bold").fontSize(16).text("CBT10 — Inventario de Bomberos", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(13).text("ACTA DE ENTREGA Y RESPONSABILIDAD", { align: "center" });
        doc.moveDown(1.2);

        doc.font("Helvetica").fontSize(10);
        doc.text(`Fecha de emisión: ${fecha}`);
        doc.text(`Emitido por: ${solicitadoPor}`);
        doc.moveDown(1);

        doc.font("Helvetica-Bold").fontSize(11).text("Datos del bombero");
        doc.font("Helvetica").fontSize(10);
        doc.text(`Nombre: ${bombero.nombre}`);
        doc.text(`RUT: ${bombero.rut || "—"}`);
        doc.text(`N° de registro: ${bombero.numero_registro || "—"}`);
        doc.text(`Cargo: ${bombero.cargo || "—"}`);
        doc.moveDown(1);

        doc.font("Helvetica-Bold").fontSize(11).text("Datos del ítem entregado");
        doc.font("Helvetica").fontSize(10);
        doc.text(`Código: ${item.codigo}`);
        doc.text(`Descripción: ${item.descripcion}`);
        doc.text(`Categoría: ${item.categoria}${item.subcategoria ? " / " + item.subcategoria : ""}`);
        doc.text(`Marca / Modelo: ${item.marca || "—"} / ${item.modelo || "—"}`);
        doc.text(`N° de serie: ${item.serie || "—"}`);
        doc.text(`Criticidad: ${item.criticidad}`);
        doc.moveDown(1);

        if (observacion) {
            doc.font("Helvetica-Bold").fontSize(11).text("Observación");
            doc.font("Helvetica").fontSize(10).text(observacion);
            doc.moveDown(1);
        }

        doc.moveDown(0.5);
        doc.fontSize(10).text(
            "El/la bombero/a individualizado/a en este documento declara recibir conforme el equipo " +
            "detallado, en buen estado de funcionamiento, y se compromete a su cuidado, uso correcto y " +
            "devolución cuando así se le solicite.",
            { align: "justify" }
        );

        doc.moveDown(4);
        const y = doc.y;
        doc.moveTo(56, y).lineTo(280, y).stroke();
        doc.fontSize(9).text(bombero.nombre, 56, y + 4);
        doc.fontSize(8).fillColor("#666").text("Firma de quien recibe", 56, y + 17);

        doc.moveDown(4);
        doc.fontSize(8).fillColor("#999").text(
            "Este documento debe imprimirse, firmarse por la persona que recibe el equipo, y subirse " +
            "escaneado o fotografiado al sistema para confirmar la asignación.",
            { align: "center" }
        );

        doc.end();
    });
}

module.exports = { generarActaEntrega, rutaActaSinFirmar, DOCS_DIR };
