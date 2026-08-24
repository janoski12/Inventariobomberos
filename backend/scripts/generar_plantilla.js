// Genera plantilla_importacion.xlsx en la misma carpeta
// Uso: node scripts/generar_plantilla.js
//
// Debe reflejar exactamente las mismas columnas que GET /api/plantilla
// (routes/importar.js) — si se agrega una columna ahí, agregarla aquí también.

const path = require("path");
const xlsx = require("xlsx");

const bomberos = [
    { nombre: "Juan Pérez",     cargo: "Teniente",   estado: "ACTIVO",   observaciones: "",                rut: "12345678-9", numero_registro: "101" },
    { nombre: "María González", cargo: "Voluntario", estado: "ACTIVO",   observaciones: "",                rut: "",           numero_registro: "" },
    { nombre: "Carlos Rojas",   cargo: "Capitán",    estado: "INACTIVO", observaciones: "Licencia médica", rut: "9876543-2",  numero_registro: "045" },
];

// codigo_qr no va en la plantilla: lo asigna el sistema automaticamente (UBIC-XXXX)
const ubicaciones = [
    { nombre: "Bodega Principal", tipo: "BODEGA",    responsable: "Juan Pérez", activo: 1 },
    { nombre: "Carro 1",          tipo: "CARRO",     responsable: "",           activo: 1 },
    { nombre: "Sala Trauma",      tipo: "SALA",      responsable: "",           activo: 1 },
    { nombre: "Casillero A1",     tipo: "CASILLERO", responsable: "",           activo: 1 },
];

const items = [
    { codigo: "EPP-0001", categoria: "EPP",          subcategoria: "Casco",    descripcion: "Casco Estructural Rojo",   marca: "Bullard",  modelo: "FH2",    serie: "SN-001",  talla: "",  estado: "OPERATIVO",  criticidad: "ALTA",  ubicacion_nombre: "",                 ubicacion_detalle: "",         bombero_nombre: "Juan Pérez",     fecha_fabricacion: "2022-01-15", fecha_recepcion: "",           fecha_vencimiento: "" },
    { codigo: "EPP-0002", categoria: "EPP",          subcategoria: "Chaqueta", descripcion: "Chaqueta de Aproximación", marca: "MSA",      modelo: "",       serie: "",         talla: "S", estado: "OPERATIVO",  criticidad: "ALTA",  ubicacion_nombre: "",                 ubicacion_detalle: "",         bombero_nombre: "María González", fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
    { codigo: "TRM-0001", categoria: "TRAUMA",       subcategoria: "Botiquín", descripcion: "Botiquín de Trauma Tipo A", marca: "",        modelo: "",       serie: "",         talla: "",  estado: "OPERATIVO",  criticidad: "ALTA",  ubicacion_nombre: "Sala Trauma",      ubicacion_detalle: "",         bombero_nombre: "",               fecha_fabricacion: "",           fecha_recepcion: "2025-01-10", fecha_vencimiento: "2027-01-10" },
    { codigo: "HRR-0001", categoria: "HERRAMIENTA",  subcategoria: "Corte",    descripcion: "Amoladora Angular 9\"",    marca: "Makita",   modelo: "GA9020", serie: "MK-123",   talla: "",  estado: "MANTENCION", criticidad: "MEDIA", ubicacion_nombre: "Bodega Principal", ubicacion_detalle: "",         bombero_nombre: "",               fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
    { codigo: "COM-0001", categoria: "COMUNICACION", subcategoria: "Radio",    descripcion: "Radio Portátil VHF",       marca: "Motorola", modelo: "DP4400", serie: "MOT-007",  talla: "",  estado: "OPERATIVO",  criticidad: "ALTA",  ubicacion_nombre: "Carro 1",          ubicacion_detalle: "Gaveta 2", bombero_nombre: "",               fecha_fabricacion: "",           fecha_recepcion: "",           fecha_vencimiento: "" },
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
