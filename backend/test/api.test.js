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
const { fechaLocalISO: fechaISO } = require("../lib/helpers");

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
            .send({ username: "operador_test", nombre: "Op Test", rol: "OPERADOR" });
        assert.equal(res.status, 201);
        operadorId = res.body.id;
        assert.ok(res.body.password_temporal, "debe devolver la contraseña temporal generada");

        const login = await request(app).post("/api/auth/login")
            .send({ username: "operador_test", password: res.body.password_temporal });
        operadorToken = login.body.token;
        assert.ok(operadorToken);
        assert.equal(login.body.usuario.debe_cambiar_password, true);

        // Cambia la contraseña temporal: recien ahi el resto de la API deja de bloquearlo (ver describe de mas abajo)
        const cambio = await request(app).put("/api/auth/password").set(auth(operadorToken))
            .send({ actual: res.body.password_temporal, nueva: "oper123456" });
        assert.equal(cambio.status, 200);
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

    test("no se puede crear un ítem ya asignado a un bombero (debe pasar por el acta) → 400", async () => {
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero Directo" });
        const res = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "TEST-004", categoria: "EPP", descripcion: "x", asignado_bombero_id: bom.body.id });
        assert.equal(res.status, 400);

        const buscar = await request(app).get("/api/items?q=TEST-004").set(auth(adminToken));
        assert.equal(buscar.body.length, 0, "el item no debe haberse creado");
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
        const creado = await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "cambia_clave", nombre: "Cambia Clave", rol: "OPERADOR" });
        const clave1 = creado.body.password_temporal;
        const login = await request(app).post("/api/auth/login").send({ username: "cambia_clave", password: clave1 });
        const token = login.body.token;

        const mala = await request(app).put("/api/auth/password").set(auth(token))
            .send({ actual: "incorrecta", nueva: "clave2nueva" });
        assert.equal(mala.status, 401);

        const ok = await request(app).put("/api/auth/password").set(auth(token))
            .send({ actual: clave1, nueva: "clave2nueva" });
        assert.equal(ok.status, 200);

        const reloginViejo = await request(app).post("/api/auth/login").send({ username: "cambia_clave", password: clave1 });
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

describe("Acta de devolución (bombero devuelve items a una ubicación)", () => {
    let bomberoId, bodegaId, carroId, itemId;

    test("preparar: bombero con un item asignado (vía acta de entrega confirmada)", async () => {
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero Devolución" });
        bomberoId = bom.body.id;
        const bodega = await request(app).post("/api/ubicaciones").set(auth(adminToken)).send({ nombre: "Bodega Devolución", tipo: "BODEGA" });
        bodegaId = bodega.body.id;
        const carro = await request(app).post("/api/ubicaciones").set(auth(adminToken)).send({ nombre: "Carro Devolución", tipo: "CARRO" });
        carroId = carro.body.id;

        const item = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "DEV-001", categoria: "EPP", descripcion: "Casco a devolver" });
        itemId = item.body.id;

        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bomberoId, item_ids: [itemId] });
        await request(app).post(`/api/actas-entrega/${acta.body.id}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("firma"), "firma.jpg");

        const ficha = await request(app).get(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, bomberoId);
    });

    test("no se puede solicitar devolución de un item que no está asignado a nadie → 400", async () => {
        const suelto = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "DEV-SUELTO", categoria: "EPP", descripcion: "Sin dueño" });
        const res = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [suelto.body.id], ubicacion_id: bodegaId });
        assert.equal(res.status, 400);
    });

    test("items asignados a bomberos distintos en la misma solicitud → 400", async () => {
        const otroBombero = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Otro Bombero" });
        const otroItem = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "DEV-OTRO", categoria: "EPP", descripcion: "De otro bombero" });
        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: otroBombero.body.id, item_ids: [otroItem.body.id] });
        await request(app).post(`/api/actas-entrega/${acta.body.id}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("firma"), "firma.jpg");

        const res = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [itemId, otroItem.body.id], ubicacion_id: bodegaId });
        assert.equal(res.status, 400);
    });

    test("ubicación de destino inexistente → 404", async () => {
        const res = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [itemId], ubicacion_id: 999999 });
        assert.equal(res.status, 404);
    });

    let actaDevolucionId;
    test("solicitar devolución genera un acta y NO mueve el item todavía", async () => {
        const res = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [itemId], ubicacion_id: bodegaId, observacion: "Fin de turno" });
        assert.equal(res.status, 201);
        actaDevolucionId = res.body.id;

        const ficha = await request(app).get(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, bomberoId, "el item sigue con el bombero hasta confirmar");
        assert.ok(ficha.body.acta_pendiente);
        assert.equal(ficha.body.acta_pendiente.tipo, "DEVOLUCION");
        assert.equal(ficha.body.acta_pendiente.ubicacion_destino_nombre, "Bodega Devolución");
    });

    test("no se puede solicitar una nueva devolución mientras el item ya está en un acta pendiente → 409", async () => {
        const res = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [itemId], ubicacion_id: bodegaId });
        assert.equal(res.status, 409);
    });

    test("el acta de devolución sin firmar se puede descargar como PDF", async () => {
        const res = await request(app).get(`/api/actas-entrega/${actaDevolucionId}/documento`).set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /pdf/);
    });

    test("cancelar una devolución pendiente no modifica el item, y se puede reintentar", async () => {
        const cancel = await request(app).post(`/api/actas-entrega/${actaDevolucionId}/cancelar`).set(auth(adminToken));
        assert.equal(cancel.status, 200);

        const ficha = await request(app).get(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, bomberoId);
        assert.equal(ficha.body.acta_pendiente, null);

        const reintento = await request(app).post("/api/actas-devolucion").set(auth(adminToken))
            .send({ item_ids: [itemId], ubicacion_id: carroId, ubicacion_detalle: "Gaveta 4" });
        assert.equal(reintento.status, 201);
        actaDevolucionId = reintento.body.id;
    });

    test("confirmar la devolución libera el item y lo ubica en el destino (con gaveta)", async () => {
        const res = await request(app).post(`/api/actas-entrega/${actaDevolucionId}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("firma devolución"), "firma_devolucion.jpg");
        assert.equal(res.status, 200);

        const ficha = await request(app).get(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(ficha.body.asignado_bombero_id, null, "ya no está asignado a ningún bombero");
        assert.equal(ficha.body.ubicacion_actual_id, carroId);
        assert.equal(ficha.body.ubicacion_detalle, "Gaveta 4");
        assert.equal(ficha.body.acta_pendiente, null);

        const movs = await request(app).get(`/api/items/${itemId}/movimientos`).set(auth(adminToken));
        const mov = movs.body.find(m => m.asignacion_id === actaDevolucionId);
        assert.ok(mov, "debe existir un movimiento ligado al acta de devolución");
        assert.equal(mov.tipo, "DEVOLUCION");
        assert.match(mov.desde, /Asignado a Bombero Devolución/);
        assert.match(mov.hacia, /Carro Devolución/);

        const firmado = await request(app).get(`/api/actas-entrega/${actaDevolucionId}/documento-firmado`).set(auth(adminToken));
        assert.equal(firmado.status, 200);
    });

    test("confirmar una devolución ya resuelta → 400", async () => {
        const res = await request(app).post(`/api/actas-entrega/${actaDevolucionId}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("x"), "otra.jpg");
        assert.equal(res.status, 400);
    });

    test("eliminar el item con una devolución confirmada no falla por FK (cascada, borra también el PDF)", async () => {
        const acta = await request(app).get(`/api/actas-entrega/${actaDevolucionId}/documento`).set(auth(adminToken));
        assert.equal(acta.status, 200);

        const del = await request(app).delete(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(del.status, 200);

        const rutas = db.prepare("SELECT documento_path, documento_firmado_path FROM acta_entrega WHERE id=?").get(actaDevolucionId);
        assert.equal(rutas, undefined, "el acta de devolución debe haberse borrado junto al item (sin otros items en el kit)");
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
            .send({ codigo: "IMP-001", categoria: "EPP", descripcion: "Casco importado" });
        assert.equal(item.status, 201);

        // La asignación, incluso para el setup del test, pasa por el acta de entrega
        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken))
            .send({ bombero_id: bom.body.id, item_ids: [item.body.id] });
        await request(app).post(`/api/actas-entrega/${acta.body.id}/confirmar`).set(auth(adminToken))
            .attach("archivo", Buffer.from("firma"), "firma.jpg");

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

describe("Módulo Carros y revisión pública", () => {
    let carroId, itemId;

    test("crear un carro y mover un item con gaveta/compartimiento", async () => {
        const carro = await request(app).post("/api/ubicaciones").set(auth(adminToken))
            .send({ nombre: "Carro Test 1", tipo: "CARRO" });
        assert.equal(carro.status, 201);
        carroId = carro.body.id;

        const item = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "CAR-001", categoria: "EPP", descripcion: "Casco Carro" });
        itemId = item.body.id;

        const mov = await request(app).post(`/api/items/${itemId}/mover`).set(auth(adminToken))
            .send({ ubicacion_id: carroId, ubicacion_detalle: "Gaveta 2" });
        assert.equal(mov.status, 200);

        const ficha = await request(app).get(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(ficha.body.ubicacion_detalle, "Gaveta 2");
    });

    test("GET /carros (autenticado) requiere sesión → 401 sin token", async () => {
        const res = await request(app).get("/api/carros");
        assert.equal(res.status, 401);
    });

    test("GET /carros lista solo ubicaciones tipo CARRO con su resumen", async () => {
        const res = await request(app).get("/api/carros").set(auth(adminToken));
        assert.equal(res.status, 200);
        const carro = res.body.find((c) => c.id === carroId);
        assert.ok(carro, "el carro creado debe aparecer en el listado");
        assert.equal(carro.total_items, 1);
        assert.equal(carro.items_no_operativos, 0);
        assert.equal(carro.ultima_revision, null);
    });

    test("GET /carros-publico/:id NO requiere sesión y solo expone datos del carro", async () => {
        const res = await request(app).get(`/api/carros-publico/${carroId}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.nombre, "Carro Test 1");
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].ubicacion_detalle, "Gaveta 2");
    });

    test("GET /carros-publico/:id sobre una ubicación que no es CARRO → 404", async () => {
        const bodega = await request(app).post("/api/ubicaciones").set(auth(adminToken))
            .send({ nombre: "Bodega No Carro", tipo: "BODEGA" });
        const res = await request(app).get(`/api/carros-publico/${bodega.body.id}`);
        assert.equal(res.status, 404);
    });

    test("POST revisión pública sin nombre → 400", async () => {
        const res = await request(app).post(`/api/carros-publico/${carroId}/revisiones`)
            .send({ items: [{ item_id: itemId, resultado: "OK" }] });
        assert.equal(res.status, 400);
    });

    test("POST revisión pública con item que no pertenece al carro → 400", async () => {
        const otroItem = await request(app).post("/api/items").set(auth(adminToken))
            .send({ codigo: "CAR-999", categoria: "EPP", descripcion: "Item ajeno" });
        const res = await request(app).post(`/api/carros-publico/${carroId}/revisiones`)
            .send({ realizada_por: "Bombero X", items: [{ item_id: otroItem.body.id, resultado: "OK" }] });
        assert.equal(res.status, 400);
    });

    let revisionId;
    test("POST revisión pública válida (sin token) queda registrada", async () => {
        const res = await request(app).post(`/api/carros-publico/${carroId}/revisiones`)
            .send({
                realizada_por: "Bombero Revisor",
                observacion_general: "Todo en orden salvo el casco",
                items: [{ item_id: itemId, resultado: "FALLA", observacion: "Correa cortada" }],
            });
        assert.equal(res.status, 201);
        revisionId = res.body.id;
    });

    test("la revisión aparece en el resumen y en la ficha autenticada del carro", async () => {
        const lista = await request(app).get("/api/carros").set(auth(adminToken));
        const carro = lista.body.find((c) => c.id === carroId);
        assert.ok(carro.ultima_revision, "debe reflejar la última revisión");
        assert.equal(carro.ultima_revision.realizada_por, "Bombero Revisor");
        assert.equal(carro.ultima_revision.fallas, 1);

        const ficha = await request(app).get(`/api/carros/${carroId}`).set(auth(adminToken));
        assert.equal(ficha.body.revisiones.length, 1);
        assert.equal(ficha.body.revisiones[0].fallas, 1);
    });

    test("GET /carros/:id/revisiones/:revisionId trae el detalle por item", async () => {
        const res = await request(app).get(`/api/carros/${carroId}/revisiones/${revisionId}`).set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].resultado, "FALLA");
        assert.equal(res.body.items[0].observacion, "Correa cortada");
    });

    test("no se puede confirmar dos veces la misma revisión sobre un item ya eliminado (cascada al borrar item)", async () => {
        const del = await request(app).delete(`/api/items/${itemId}`).set(auth(adminToken));
        assert.equal(del.status, 200, "eliminar un item con revisiones no debe fallar por FK");
    });

    test("eliminar el carro con historial de revisiones (sin items) no falla por FK", async () => {
        const del = await request(app).delete(`/api/ubicaciones/${carroId}`).set(auth(adminToken));
        assert.equal(del.status, 200);
    });
});

describe("Limpieza de PDFs huérfanos al eliminar item/bombero", () => {
    test("borrar el único item de un acta borra tambien el acta y su PDF del disco", async () => {
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero PDF 1" });
        const item = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "PDF-0001", categoria: "EPP", descripcion: "Item pdf 1" });
        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken)).send({ bombero_id: bom.body.id, item_ids: [item.body.id] });

        const ruta = db.prepare("SELECT documento_path FROM acta_entrega WHERE id=?").get(acta.body.id).documento_path;
        assert.ok(fs.existsSync(ruta), "el PDF sin firmar debe existir tras crear la solicitud");

        await request(app).delete(`/api/items/${item.body.id}`).set(auth(adminToken));

        assert.ok(!fs.existsSync(ruta), "el PDF debe borrarse del disco al quedar el acta sin items");
        assert.equal(db.prepare("SELECT id FROM acta_entrega WHERE id=?").get(acta.body.id), undefined, "el acta huérfana también se borra de la BD");
    });

    test("kit con 2 items: borrar solo uno conserva el acta y su PDF (el otro item lo sigue necesitando)", async () => {
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero PDF 2" });
        const itemA = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "PDF-0002", categoria: "EPP", descripcion: "Item pdf A" });
        const itemB = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "PDF-0003", categoria: "EPP", descripcion: "Item pdf B" });
        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken)).send({ bombero_id: bom.body.id, item_ids: [itemA.body.id, itemB.body.id] });
        const ruta = db.prepare("SELECT documento_path FROM acta_entrega WHERE id=?").get(acta.body.id).documento_path;

        await request(app).delete(`/api/items/${itemA.body.id}`).set(auth(adminToken));

        assert.ok(fs.existsSync(ruta), "el PDF del kit debe conservarse: itemB todavia lo referencia");
        assert.ok(db.prepare("SELECT id FROM acta_entrega WHERE id=?").get(acta.body.id), "el acta debe seguir existiendo");
    });

    test("eliminar un bombero borra los PDFs (sin firmar y firmado) de todas sus actas", async () => {
        const bom = await request(app).post("/api/bomberos").set(auth(adminToken)).send({ nombre: "Bombero PDF 3" });
        const item = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "PDF-0004", categoria: "EPP", descripcion: "Item pdf 3" });
        const acta = await request(app).post("/api/actas-entrega").set(auth(adminToken)).send({ bombero_id: bom.body.id, item_ids: [item.body.id] });
        await request(app).post(`/api/actas-entrega/${acta.body.id}/confirmar`).set(auth(adminToken)).attach("archivo", Buffer.from("firma"), "firma.jpg");

        const rutas = db.prepare("SELECT documento_path, documento_firmado_path FROM acta_entrega WHERE id=?").get(acta.body.id);
        assert.ok(fs.existsSync(rutas.documento_path) && fs.existsSync(rutas.documento_firmado_path));

        // Hay que soltar la asignación antes de poder borrar al bombero (bloqueado si tiene items asignados)
        const bodega = await request(app).post("/api/ubicaciones").set(auth(adminToken)).send({ nombre: "Bodega PDF", tipo: "BODEGA" });
        await request(app).post(`/api/items/${item.body.id}/mover`).set(auth(adminToken)).send({ ubicacion_id: bodega.body.id });

        await request(app).delete(`/api/bomberos/${bom.body.id}`).set(auth(adminToken));

        assert.ok(!fs.existsSync(rutas.documento_path) && !fs.existsSync(rutas.documento_firmado_path), "ambos PDFs deben borrarse del disco");
    });
});

describe("Controles de mantenimiento/inspección", () => {
    let itemId, controlId;

    test("crear un control requiere tipo y fecha_objetivo válidos", async () => {
        const item = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "CTL-0001", categoria: "HERRAMIENTA", descripcion: "Item con control" });
        itemId = item.body.id;

        const sinTipo = await request(app).post(`/api/items/${itemId}/controles`).set(auth(adminToken)).send({ fecha_objetivo: "2026-01-01" });
        assert.equal(sinTipo.status, 400);

        const tipoInvalido = await request(app).post(`/api/items/${itemId}/controles`).set(auth(adminToken)).send({ tipo: "NO_EXISTE", fecha_objetivo: "2026-01-01" });
        assert.equal(tipoInvalido.status, 400);

        const fechaInvalida = await request(app).post(`/api/items/${itemId}/controles`).set(auth(adminToken)).send({ tipo: "MANTENCION", fecha_objetivo: "no-es-fecha" });
        assert.equal(fechaInvalida.status, 400);

        const ok = await request(app).post(`/api/items/${itemId}/controles`).set(auth(adminToken)).send({ tipo: "MANTENCION", fecha_objetivo: "2026-01-01", observacion: "Revisión anual" });
        assert.equal(ok.status, 201);
        controlId = ok.body.id;
    });

    test("GET /items/:id/controles lista el control recién creado", async () => {
        const res = await request(app).get(`/api/items/${itemId}/controles`).set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.ok(res.body.some((c) => c.id === controlId && c.tipo === "MANTENCION"));
    });

    test("completar un control valida resultado y fecha_real", async () => {
        const sinResultado = await request(app).put(`/api/controles/${controlId}`).set(auth(adminToken)).send({ fecha_real: "2026-01-02" });
        assert.equal(sinResultado.status, 400);

        const resultadoInvalido = await request(app).put(`/api/controles/${controlId}`).set(auth(adminToken)).send({ fecha_real: "2026-01-02", resultado: "NO_EXISTE" });
        assert.equal(resultadoInvalido.status, 400);

        const ok = await request(app).put(`/api/controles/${controlId}`).set(auth(adminToken)).send({ fecha_real: "2026-01-02", resultado: "APROBADO" });
        assert.equal(ok.status, 200);

        const lista = await request(app).get(`/api/items/${itemId}/controles`).set(auth(adminToken));
        const completado = lista.body.find((c) => c.id === controlId);
        assert.equal(completado.resultado, "APROBADO");
        assert.equal(completado.fecha_real, "2026-01-02");
    });

    test("control sobre item inexistente → 404", async () => {
        const res = await request(app).post("/api/items/999999/controles").set(auth(adminToken)).send({ tipo: "INSPECCION", fecha_objetivo: "2026-01-01" });
        assert.equal(res.status, 404);
    });
});

describe("Reportes", () => {
    test("GET /reportes agrega estado/categoría/criticidad e incluye controles vencidos y próximos a vencer", async () => {
        const hoy = fechaISO(0);
        const ayer = fechaISO(-1);
        const en10dias = fechaISO(10);

        const sinUbicar = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "RPT-0001", categoria: "OTRO", descripcion: "Item sin ubicar para reportes" });

        const conControlVencido = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "RPT-0002", categoria: "OTRO", descripcion: "Item con control vencido" });
        const ctrlVencido = await request(app).post(`/api/items/${conControlVencido.body.id}/controles`).set(auth(adminToken)).send({ tipo: "INSPECCION", fecha_objetivo: ayer });

        const conControlProximo = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "RPT-0003", categoria: "OTRO", descripcion: "Item con control próximo" });
        const ctrlProximo = await request(app).post(`/api/items/${conControlProximo.body.id}/controles`).set(auth(adminToken)).send({ tipo: "INSPECCION", fecha_objetivo: en10dias });

        const res = await request(app).get("/api/reportes").set(auth(adminToken));
        assert.equal(res.status, 200);

        assert.ok(res.body.porEstado.some((r) => r.estado === "OPERATIVO" && r.total > 0));
        assert.ok(res.body.porCategoria.some((r) => r.categoria === "OTRO" && r.total > 0));
        assert.ok(res.body.sinUbicar.some((i) => i.id === sinUbicar.body.id), "el item recién creado sin ubicar/asignar debe aparecer");
        assert.ok(res.body.controlesVencidos.some((c) => c.id === ctrlVencido.body.id), "el control con fecha_objetivo en el pasado debe aparecer como vencido");
        assert.ok(res.body.proximosControles.some((c) => c.id === ctrlProximo.body.id), "el control con fecha_objetivo dentro de 30 días debe aparecer como próximo");
        assert.ok(!res.body.controlesVencidos.some((c) => c.id === ctrlProximo.body.id), "un control aún no vencido no debe aparecer en vencidos");
    });
});

describe("Material Trauma", () => {
    let itemId;

    test("PUT /trauma/:id/fechas valida y fija fecha de recepción/vencimiento", async () => {
        const item = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "TRM-0100", categoria: "TRAUMA", descripcion: "Botiquín test" });
        itemId = item.body.id;

        const noTrauma = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "TRM-0101-NOTRAUMA", categoria: "OTRO", descripcion: "No es trauma" });
        const sobreNoTrauma = await request(app).put(`/api/trauma/${noTrauma.body.id}/fechas`).set(auth(adminToken)).send({ fecha_recepcion: "2026-01-01" });
        assert.equal(sobreNoTrauma.status, 400);

        const vencAntesDeRecepcion = await request(app).put(`/api/trauma/${itemId}/fechas`).set(auth(adminToken))
            .send({ fecha_recepcion: "2026-06-01", fecha_vencimiento: "2026-01-01" });
        assert.equal(vencAntesDeRecepcion.status, 400);

        const ok = await request(app).put(`/api/trauma/${itemId}/fechas`).set(auth(adminToken))
            .send({ fecha_recepcion: "2026-01-01", fecha_vencimiento: "2027-01-01" });
        assert.equal(ok.status, 200);

        const lista = await request(app).get("/api/trauma").set(auth(adminToken));
        const fila = lista.body.find((i) => i.id === itemId);
        assert.equal(fila.fecha_recepcion, "2026-01-01");
        assert.equal(fila.fecha_vencimiento, "2027-01-01");
    });

    let usoId;
    test("registrar y listar un uso de material trauma", async () => {
        const sinCantidad = await request(app).post(`/api/trauma/${itemId}/usos`).set(auth(adminToken)).send({ motivo: "Práctica" });
        assert.equal(sinCantidad.status, 201, "cantidad es opcional, debe usar el default 1");
        usoId = sinCantidad.body.id;

        const lista = await request(app).get(`/api/trauma/${itemId}/usos`).set(auth(adminToken));
        const uso = lista.body.find((u) => u.id === usoId);
        assert.equal(uso.cantidad, 1);
        assert.equal(uso.motivo, "Práctica");

        const usoSobreItemNoTrauma = await request(app).post("/api/items").set(auth(adminToken)).send({ codigo: "TRM-0102-X", categoria: "OTRO", descripcion: "x" })
            .then((it) => request(app).post(`/api/trauma/${it.body.id}/usos`).set(auth(adminToken)).send({}));
        assert.equal(usoSobreItemNoTrauma.status, 400);
    });

    test("eliminar un registro de uso", async () => {
        const del = await request(app).delete(`/api/trauma/usos/${usoId}`).set(auth(adminToken));
        assert.equal(del.status, 200);

        const lista = await request(app).get(`/api/trauma/${itemId}/usos`).set(auth(adminToken));
        assert.ok(!lista.body.some((u) => u.id === usoId));
    });

    test("GET /trauma/exportar responde un archivo Excel", async () => {
        const res = await request(app).get("/api/trauma/exportar").set(auth(adminToken));
        assert.equal(res.status, 200);
        assert.match(res.headers["content-type"], /spreadsheetml/);
    });
});

describe("Contraseña temporal obligatoria en el primer login", () => {
    test("crear un usuario devuelve una contraseña temporal, no acepta una propia", async () => {
        const res = await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "temp_pw_1", nombre: "Temp Uno", rol: "OPERADOR", password: "esto-se-ignora" });
        assert.equal(res.status, 201);
        assert.ok(res.body.password_temporal && res.body.password_temporal.length >= 8);

        // La contraseña enviada en el body no sirve: solo la temporal generada por el sistema
        const conClaveEnviada = await request(app).post("/api/auth/login")
            .send({ username: "temp_pw_1", password: "esto-se-ignora" });
        assert.equal(conClaveEnviada.status, 401);

        const conClaveTemporal = await request(app).post("/api/auth/login")
            .send({ username: "temp_pw_1", password: res.body.password_temporal });
        assert.equal(conClaveTemporal.status, 200);
        assert.equal(conClaveTemporal.body.usuario.debe_cambiar_password, true);
    });

    test("con la contraseña pendiente de cambio, el resto de la API queda bloqueada (403)", async () => {
        const creado = await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "temp_pw_2", nombre: "Temp Dos", rol: "OPERADOR" });
        const login = await request(app).post("/api/auth/login")
            .send({ username: "temp_pw_2", password: creado.body.password_temporal });
        const token = login.body.token;

        const bloqueado = await request(app).get("/api/items").set(auth(token));
        assert.equal(bloqueado.status, 403);
        assert.equal(bloqueado.body.debe_cambiar_password, true);

        // /auth/me sigue accesible (no queda "encerrado" sin poder ver su propio estado)
        const me = await request(app).get("/api/auth/me").set(auth(token));
        assert.equal(me.status, 200);
        assert.equal(me.body.debe_cambiar_password, true);

        // Tras cambiar la contraseña, el bloqueo se levanta de inmediato (mismo token, sin relogear)
        await request(app).put("/api/auth/password").set(auth(token))
            .send({ actual: creado.body.password_temporal, nueva: "nueva-clave-1" });

        const desbloqueado = await request(app).get("/api/items").set(auth(token));
        assert.equal(desbloqueado.status, 200);

        const meActualizado = await request(app).get("/api/auth/me").set(auth(token));
        assert.equal(meActualizado.body.debe_cambiar_password, false);
    });

    test("un usuario sin contraseña pendiente no queda bloqueado (admin, caso normal)", async () => {
        const res = await request(app).get("/api/items").set(auth(adminToken));
        assert.equal(res.status, 200);
    });

    test("si un admin le resetea la clave a otro usuario, vuelve a quedar pendiente de cambio", async () => {
        const creado = await request(app).post("/api/usuarios").set(auth(adminToken))
            .send({ username: "temp_pw_3", nombre: "Temp Tres", rol: "OPERADOR" });
        const login1 = await request(app).post("/api/auth/login")
            .send({ username: "temp_pw_3", password: creado.body.password_temporal });
        await request(app).put("/api/auth/password").set(auth(login1.body.token))
            .send({ actual: creado.body.password_temporal, nueva: "clave-propia-1" });

        // Ya cambio su clave: no deberia estar bloqueado
        const sinBloqueo = await request(app).get("/api/items").set(auth(login1.body.token));
        assert.equal(sinBloqueo.status, 200);

        // El admin le resetea la contraseña manualmente
        await request(app).put(`/api/usuarios/${creado.body.id}`).set(auth(adminToken))
            .send({ nombre: "Temp Tres", rol: "OPERADOR", activo: 1, password: "clave-reseteada-admin" });

        const login2 = await request(app).post("/api/auth/login")
            .send({ username: "temp_pw_3", password: "clave-reseteada-admin" });
        assert.equal(login2.body.usuario.debe_cambiar_password, true, "una clave reseteada por un admin tambien es temporal");

        const bloqueadoDeNuevo = await request(app).get("/api/items").set(auth(login2.body.token));
        assert.equal(bloqueadoDeNuevo.status, 403);
    });
});
