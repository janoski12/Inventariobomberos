// Genera plantilla_importacion.xlsx en la misma carpeta
// Uso: node scripts/generar_plantilla.js

const path = require("path");
const xlsx = require("xlsx");

const bomberos = [
    { nombre: "Juan Pérez",    cargo: "Teniente",   estado: "ACTIVO",   observaciones: "" },
    { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "" },
    { nombre: "Carlos Rojas",  cargo: "Capitán",    estado: "INACTIVO", observaciones: "Licencia médica" },
];

const ubicaciones = [
    { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "Juan Pérez", codigo_qr: "", activo: 1 },
    { nombre: "Carro 1",         tipo: "CARRO",     responsable: "",           codigo_qr: "", activo: 1 },
    { nombre: "Sala Trauma",     tipo: "SALA",      responsable: "",           codigo_qr: "", activo: 1 },
    { nombre: "Casillero A1",    tipo: "CASILLERO", responsable: "",           codigo_qr: "", activo: 1 },
];

const items = [
    { codigo: "EPP-0001", categoria: "EPP",         subcategoria: "Casco",      descripcion: "Casco Estructural Rojo",  marca: "Bullard",  modelo: "FH2", serie: "SN-001", estado: "OPERATIVO",     criticidad: "ALTA",  ubicacion_nombre: "",           bombero_nombre: "Juan Pérez" },
    { codigo: "EPP-0002", categoria: "EPP",         subcategoria: "Chaqueta",   descripcion: "Chaqueta de Aproximación", marca: "MSA",     modelo: "",    serie: "",       estado: "OPERATIVO",     criticidad: "ALTA",  ubicacion_nombre: "",           bombero_nombre: "María González" },
    { codigo: "TRM-0001", categoria: "TRAUMA",      subcategoria: "Botiquín",   descripcion: "Botiquín de Trauma Tipo A", marca: "",        modelo: "",    serie: "",       estado: "OPERATIVO",     criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma", bombero_nombre: "" },
    { codigo: "HRR-0001", categoria: "HERRAMIENTA", subcategoria: "Corte",      descripcion: "Amoladora Angular 9\"",  marca: "Makita",   modelo: "GA9020", serie: "MK-123", estado: "MANTENCION", criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", bombero_nombre: "" },
    { codigo: "COM-0001", categoria: "COMUNICACION", subcategoria: "Radio",     descripcion: "Radio Portátil VHF",     marca: "Motorola", modelo: "DP4400", serie: "MOT-007", estado: "OPERATIVO", criticidad: "ALTA",  ubicacion_nombre: "Carro 1",    bombero_nombre: "" },
];

const controles = [
    { codigo_item: "EPP-0001", tipo: "INSPECCION",   fecha_objetivo: "2025-06-01", fecha_real: "",           resultado: "",         observacion: "Inspección anual de casco" },
    { codigo_item: "EPP-0002", tipo: "CERTIFICACION", fecha_objetivo: "2025-03-15", fecha_real: "2025-03-14", resultado: "APROBADO", observacion: "Certificación vigente" },
    { codigo_item: "HRR-0001", tipo: "MANTENCION",   fecha_objetivo: "2025-04-30", fecha_real: "",           resultado: "",         observacion: "Mantenimiento preventivo" },
];

const wb = xlsx.utils.book_new();

function addSheet(name, data) {
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, name);
}

addSheet("Bomberos",   bomberos);
addSheet("Ubicaciones", ubicaciones);
addSheet("Items",      items);
addSheet("Controles",  controles);

const outPath = path.join(__dirname, "plantilla_importacion.xlsx");
xlsx.writeFile(wb, outPath);
console.log("Plantilla generada en:", outPath);
