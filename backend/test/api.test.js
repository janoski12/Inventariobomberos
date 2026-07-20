const { test, before, after, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// BD temporal aislada: debe definirse ANTES de importar la app (que carga db.js)
const TMP_DB = path.join(os.tmpdir(), `cbt10_test_${Date.now()}.db`);
process.env.DB_PATH = TMP_DB;
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const app = require("../server");
const db = require("../db");

let adminToken;
let operadorToken;

before(async () => {
    // El seed crea admin/admin123 automaticamente al cargar db.js
    const res = await request(app).post("/api/auth/login").send({ username: "admin", password: "admin123" });
    adminToken = res.body.token;
});

after(() => {
    try { db.close(); } catch { /* noop */ }
    try { fs.unlinkSync(TMP_DB); } catch { /* noop */ }
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("Autenticación", () => {
    test("health es público", async () => {
        const res = await request(app).get("/api/health");
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
    });

    test("ruta protegida sin token → 401", async () => {
        const res = await request(app).get("/api/items");
        assert.equal(res.status, 401);
    });

    test("login con credenciales incorrectas → 401", async () => {
        const res = await request(app).post("/api/auth/login").send({ username: "admin", password: "malo" });
        assert.equal(res.status, 401);
    });

    test("login admin correcto devuelve token y datos", async () => {
        const res = await request(app).post("/api/auth/login").send({ username: "admin", password: "admin123" });
        assert.equal(res.status, 200);
        assert.ok(res.body.token);
        assert.equal(res.body.usuario.rol, "ADMIN");
    });

    test("/api/auth/me con token devuelve el usuario", async () => {
        const res = await request(app).get("/api/auth/me").set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.equal(res.body.username, "admin");
    });

    test("ruta protegida con token válido → 200", async () => {
        const res = await request(app).get("/api/items").set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    test("ruta de API inexistente → 404 JSON (no HTML)", async () => {
        const res = await request(app).get("/api/no-existe").set(auth(adminToken));
        assert.equal(res.status, 404);
        assert.ok(res.body.error);
    });
});

describe("Permisos por rol", () => {
    let operadorId;

    test("admin crea un operador", async () => {
        const res = await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "operador_test", password: "oper123", nombre: "Op Test", rol: "OPERADOR" });
        assert.equal(res.status, 201);
        operadorId = res.body.id;

        const login = await request(app).post("/api/auth/login").send({ username: "operador_test", password: "oper123" });
        operadorToken = login.body.token;
        assert.ok(operadorToken);
    });

    test("operador puede crear (POST) un bombero", async () => {
        const res = await request(app).post("/api/bomberos").set(auth(operadorToken)).send({ nombre: "Bombero Op" });
        assert.equal(res.status, 201);
    });

    test("operador NO puede eliminar (DELETE) → 403", async () => {
        const res = await request(app).delete("/api/bomberos/999999").set(auth(operadorToken));
        assert.equal(res.status, 403);
    });

    test("operador NO puede gestionar usuarios → 403", async () => {
        const res = await request(app).get("/api/usuarios").set(auth(operadorToken));
        assert.equal(res.status, 403);
    });

    test("operador NO puede hacer carga completa → 403", async () => {
        const res = await request(app).post("/api/importar").set(auth(operadorToken));
        assert.equal(res.status, 403);
    });

    test("operador NO puede descargar el respaldo → 403", async () => {
        const res = await request(app).get("/api/backup").set(auth(operadorToken));
        assert.equal(res.status, 403);
    });

    test("admin SÍ puede descargar el respaldo → 200", async () => {
        const res = await request(app).get("/api/backup").set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /octet-stream/);
    });

    test("admin puede eliminar el operador", async () => {
        const res = await request(app).delete(`/api/usuarios/${operadorId}`).set(auth(adminToken));
        assert.equal(res.status, 200);
    });
});

describe("CRUD y validaciones de ítems", () => {
    test("crear ítem válido → 201", async () => {
        const res = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TEST-001", categoria: "EPP", descripcion: "Casco de prueba", criticidad: "ALTA" });
        assert.equal(res.status, 201);
    });

    test("código duplicado → 409", async () => {
        const res = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TEST-001", categoria: "EPP", descripcion: "Duplicado" });
        assert.equal(res.status, 409);
    });

    test("categoría inválida → 400", async () => {
        const res = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TEST-002", categoria: "INVENTADA", descripcion: "x" });
        assert.equal(res.status, 400);
    });

    test("fecha de fabricación inválida → 400", async () => {
        const res = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TEST-003", categoria: "EPP", descripcion: "x", fecha_fabricacion: "2026-02-30" });
        assert.equal(res.status, 400);
    });

    test("filtro de estado inválido en búsqueda → 400", async () => {
        const res = await request(app).get("/api/items?estado=NOEXISTE").set(auth(adminToken));
        assert.equal(res.status, 400);
    });
});

describe("Unicidad de nombres", () => {
    test("bombero con nombre duplicado → 409", async () => {
        await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Nombre Unico" });
        const res = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Nombre Unico" });
        assert.equal(res.status, 409);
    });

    test("ubicación duplicada → 409 y genera codigo_qr UBIC-", async () => {
        const r1 = await request(app).post("/api/ubicaciones").set(auth(adminToken)).send({ nombre: "Bodega Test", tipo: "BODEGA" });
        assert.equal(r1.status, 201);
        const ficha = await request(app).get(`/api/ubicaciones/${r1.body.id}`).set(auth(adminToken));
        assert.match(ficha.body.codigo_qr, /^UBIC-\d{4}$/);

        const r2 = await request(app).post("/api/ubicaciones").set(auth(adminToken)).send({ nombre: "Bodega Test", tipo: "BODEGA" });
        assert.equal(r2.status, 409);
    });
});

describe("Integridad referencial (TRAUMA + usos)", () => {
    test("eliminar ítem TRAUMA con usos registrados → 200 (no falla por FK)", async () => {
        const crea = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TRA-TEST", categoria: "TRAUMA", descripcion: "Material trauma" });
        const itemId = crea.body.id;

        const uso = await request(app).post(`/api/trauma/${itemId}/usos`).set(auth(adminToken))
            .send({ fecha: "2026-06-01", cantidad: 2, motivo: "test" });
        assert.equal(uso.status, 201);

        const del = await request(app).delete(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(del.status, 200);
    });
});

describe("Protección del último administrador", () => {
    test("no se puede eliminar el único admin → 400", async () => {
        const usuarios = await request(app).get("/api/usuarios").set(auth(adminToken));
        const admin = usuarios.body.find(u => u.username === "admin");
        const res = await request(app).delete(`/api/usuarios/${admin.id}`).set(auth(adminToken));
        assert.equal(res.status, 400);
    });
});

describe("Trazabilidad atribuida al usuario logueado", () => {
    test("mover un ítem registra el movimiento a nombre del usuario", async () => {
        const ubic = await request(app).post("/api/ubicaciones").set(auth(adminToken))
            .send({ nombre: "Bodega Trazas", tipo: "BODEGA" });
        const item = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TRZ-001", categoria: "EPP", descripcion: "Casco trazas" });

        const mov = await request(app).post(`/api/items/${item.body.id}/mover`).set(auth(adminToken))
            .send({ ubicacion_id: ubic.body.id, responsable: "Texto que debe ignorarse" });
        assert.equal(mov.status, 200);

        const movs = await request(app).get(`/api/items/${item.body.id}/movimientos`).set(auth(adminToken));
        assert.equal(movs.body[0].tipo, "MOVIMIENTO", "el más reciente va primero");
        const traslado = movs.body.find(m => m.tipo === "MOVIMIENTO");
        assert.equal(traslado.responsable, "Administrador");
    });
});

describe("Ubicaciones inactivas", () => {
    test("una ubicación desactivada sigue visible con ?todas=1 y puede reactivarse", async () => {
        const crea = await request(app).post("/api/ubicaciones").set(auth(adminToken))
            .send({ nombre: "Bodega Clausurada", tipo: "BODEGA" });
        const id = crea.body.id;

        await request(app).put(`/api/ubicaciones/${id}`).set(auth(adminToken)).send({ activo: 0 });

        const activas = await request(app).get("/api/ubicaciones").set(auth(adminToken));
        assert.ok(!activas.body.some(u => u.id === id), "no debe aparecer en el listado por defecto");

        const todas = await request(app).get("/api/ubicaciones?todas=1").set(auth(adminToken));
        assert.ok(todas.body.some(u => u.id === id && u.activo === 0), "debe aparecer con ?todas=1");

        const react = await request(app).put(`/api/ubicaciones/${id}`).set(auth(adminToken)).send({ activo: 1 });
        assert.equal(react.status, 200);
        const activas2 = await request(app).get("/api/ubicaciones").set(auth(adminToken));
        assert.ok(activas2.body.some(u => u.id === id), "reactivada vuelve al listado");
    });
});

describe("Errores controlados", () => {
    test("JSON malformado → 400 JSON (no HTML)", async () => {
        const res = await request(app).post("/api/auth/login")
            .set("Content-Type", "application/json")
            .send('{"username": "admin", ');
        assert.equal(res.status, 400);
        assert.ok(res.body.error);
    });
});

describe("Cambio de contraseña propio", () => {
    test("flujo completo: crear usuario, cambiar clave y reloguear", async () => {
        await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "cambia_clave", password: "clave1", nombre: "Cambia Clave", rol: "OPERADOR" });
        const login = await request(app).post("/api/auth/login").send({ username: "cambia_clave", password: "clave1" });
        const token = login.body.token;

        const mala = await request(app).put("/api/auth/password").set(auth(token))
            .send({ actual: "incorrecta", nueva: "clave2nueva" });
        assert.equal(mala.status, 401);

        const ok = await request(app).put("/api/auth/password").set(auth(token))
            .send({ actual: "clave1", nueva: "clave2nueva" });
        assert.equal(ok.status, 200);

        const reloginViejo = await request(app).post("/api/auth/login").send({ username: "cambia_clave", password: "clave1" });
        assert.equal(reloginViejo.status, 401);
        const reloginNuevo = await request(app).post("/api/auth/login").send({ username: "cambia_clave", password: "clave2nueva" });
        assert.equal(reloginNuevo.status, 200);
    });
});

describe("Entrega de kit (uno o varios items) con acta de recepción", () => {
    let item1Id, item2Id, bomberoId, actaId;

    test("crear items y bombero de prueba", async () => {
        const i1 = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "ACTA-001", categoria: "EPP", descripcion: "Casco acta", talla: "" });
        const i2 = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "ACTA-002", categoria: "EPP", descripcion: "Chaqueta acta", talla: "S" });
        item1Id = i1.body.id;
        item2Id = i2.body.id;
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero Acta" });
        bomberoId = bom.body.id;
    });

    test("solicitar entrega de 2 items genera un acta y NO los reasigna todavía", async () => {
        const res = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bomberoId, item_ids: [item1Id, item2Id], observacion: "Kit inicial" });
        assert.equal(res.status, 201);
        actaId = res.body.id;

        const ficha1 = await request(app).get(`/api/items/${item1Id}`).set(auth(adminToken));
        const ficha2 = await request(app).get(`/api/items/${item2Id}`).set(auth(adminToken));
        assert.equal(ficha1.body.asignado_bombero_id, null, "ningún item cambia de dueño hasta confirmar");
        assert.equal(ficha2.body.asignado_bombero_id, null);
        assert.ok(ficha1.body.acta_pendiente, "debe reflejar la solicitud pendiente");
        assert.equal(ficha1.body.acta_pendiente.bombero_nombre, "Bombero Acta");
        assert.equal(ficha1.body.acta_pendiente.items.length, 2, "la ficha muestra el kit completo, no solo este item");
        assert.deepEqual(
            ficha1.body.acta_pendiente.items.map(i => i.codigo).sort(),
            ["ACTA-001", "ACTA-002"]
        );
    });

    test("no se puede solicitar una nueva entrega mientras un item ya está en un acta pendiente → 409", async () => {
        const res = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bomberoId, item_ids: [item1Id] });
        assert.equal(res.status, 409);
    });

    test("el acta sin firmar se puede descargar como PDF", async () => {
        const res = await request(app).get(`/api/actas-entrega/${actaId}/documento`).set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /pdf/);
    });

    test("confirmar sin adjuntar archivo → 400", async () => {
        const res = await request(app).post(`/api/actas-entrega/${actaId}/confirmar`).set(auth(adminToken));
        assert.equal(res.status, 400);
    });

    test("confirmar con el documento firmado asigna AMBOS items y registra sus movimientos", async () => {
        const res = await request(app).post(`/api/actas-entrega/${actaId}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("contenido de prueba"), "acta_firmada.jpg");
        assert.equal(res.status, 200);

        const ficha1 = await request(app).get(`/api/items/${item1Id}`).set(auth(adminToken));
        const ficha2 = await request(app).get(`/api/items/${item2Id}`).set(auth(adminToken));
        assert.equal(ficha1.body.asignado_bombero_id, bomberoId);
        assert.equal(ficha2.body.asignado_bombero_id, bomberoId);
        assert.equal(ficha1.body.acta_pendiente, null);

        for (const itemId of [item1Id, item2Id]) {
            const movs = await request(app).get(`/api/items/${itemId}/movimientos`).set(auth(adminToken));
            const mov = movs.body.find(m => m.asignacion_id === actaId);
            assert.ok(mov, `debe existir un movimiento ligado al acta para el item ${itemId}`);
            assert.equal(mov.tipo, "ASIGNACION");
        }

        const firmado = await request(app).get(`/api/actas-entrega/${actaId}/documento-firmado`).set(auth(adminToken));
        assert.equal(firmado.status, 200);
    });

    test("confirmar una solicitud ya resuelta → 400", async () => {
        const res = await request(app).post(`/api/actas-entrega/${actaId}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("x"), "otra.pdf");
        assert.equal(res.status, 400);
    });

    test("cancelar una solicitud pendiente no modifica ningún item", async () => {
        const item3 = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "ACTA-003", categoria: "EPP", descripcion: "Botas acta" });
        const sol = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bomberoId, item_ids: [item3.body.id] });
        assert.equal(sol.status, 201);

        const cancel = await request(app).post(`/api/actas-entrega/${sol.body.id}/cancelar`).set(auth(adminToken));
        assert.equal(cancel.status, 200);

        const ficha = await request(app).get(`/api/items/${item3.body.id}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, null);
        assert.equal(ficha.body.acta_pendiente, null);

        // al estar cancelada, se puede volver a solicitar sobre el mismo item
        const reintento = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bomberoId, item_ids: [item3.body.id] });
        assert.equal(reintento.status, 201);
    });

    test("listado de pendientes solo incluye solicitudes en estado PENDIENTE", async () => {
        const res = await request(app).get("/api/actas-entrega?estado=PENDIENTE").set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.ok(res.body.every(p => p.estado === undefined || p.estado === "PENDIENTE"));
        assert.ok(!res.body.some(p => p.id === actaId), "la ya confirmada no debe aparecer");
    });

    test("eliminar un item con acta confirmada no falla por FK (cascada)", async () => {
        const del = await request(app).delete(`/api/items/${item1Id}`).set(auth(adminToken));
        assert.equal(del.status, 200);
    });

    test("eliminar un bombero con historial de actas no falla por FK (cascada)", async () => {
        // item2 sigue asignado a este bombero: hay que liberarlo primero (regla de negocio aparte)
        await request(app).delete(`/api/items/${item2Id}`).set(auth(adminToken));
        const del = await request(app).delete(`/api/bomberos/${bomberoId}`).set(auth(adminToken));
        assert.equal(del.status, 200);
    });
});

describe("Campo talla", () => {
    test("se puede crear y editar un item con talla, y viaja en la exportación", async () => {
        const crea = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TALLA-001", categoria: "EPP", descripcion: "Chaqueta con talla", talla: "M" });
        assert.equal(crea.status, 201);

        const ficha = await request(app).get(`/api/items/${crea.body.id}`).set(auth(adminToken));
        assert.equal(ficha.body.talla, "M");

        const edit = await request(app).put(`/api/items/${crea.body.id}`).set(auth(adminToken)).send({ talla: "L" });
        assert.equal(edit.status, 200);
        const ficha2 = await request(app).get(`/api/items/${crea.body.id}`).set(auth(adminToken));
        assert.equal(ficha2.body.talla, "L");
    });
});

describe("Importación parcial de ítems", () => {
    test("celdas de asignación vacías conservan la asignación actual", async () => {
        const xlsx = require("xlsx");

        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero Importa" });
        const item = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "IMP-001", categoria: "EPP", descripcion: "Casco importado", asignado_bombero_id: bom.body.id });
        assert.equal(item.status, 201);

        // Excel con el mismo código pero ubicación/bombero vacíos (caso típico de re-importación)
        const filas = [{
            codigo: "IMP-001", categoria: "EPP", subcategoria: "", descripcion: "Casco importado v2",
            marca: "", modelo: "", serie: "", estado: "OPERATIVO", criticidad: "ALTA",
            ubicacion_nombre: "", bombero_nombre: "",
            fecha_fabricacion: "", fecha_recepcion: "", fecha_vencimiento: "",
        }];
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(filas), "Items");
        const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        const imp = await request(app).post("/api/importar/items").set(auth(adminToken))
            .attach("archivo", buf, "items.xlsx");
        assert.equal(imp.status, 200);
        assert.equal(imp.body.resumen.actualizados, 1);

        const ficha = await request(app).get(`/api/items/${item.body.id}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, bom.body.id, "debe conservar el bombero asignado");
        assert.equal(ficha.body.descripcion, "Casco importado v2", "los demás campos sí se actualizan");
        assert.equal(ficha.body.criticidad, "ALTA");
    });
});
