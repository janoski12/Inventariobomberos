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
