# Inventario Bomberos — CBT10

Sistema de gestión de inventario para una compañía de bomberos. Permite llevar el
control de equipos (EPP, herramientas, material de trauma, comunicaciones), su
asignación a bomberos o ubicaciones, controles/revisiones, y material de trauma con
fechas de vencimiento y registro de uso.

## Características

- **Inventario** — alta, búsqueda y ficha de ítems con código, categoría, estado,
  criticidad, marca/modelo (con autocompletado), serie y fecha de fabricación
  (con cálculo de tiempo en servicio).
- **Asignación y trazabilidad** — cada ítem se asigna a un bombero o ubicación;
  todo movimiento queda registrado en su historial.
- **Bomberos** — gestión con RUT y N° de registro únicos, cargo y ficha con sus
  ítems asignados.
- **Ubicaciones** — gestión con código QR generado automáticamente (`UBIC-XXXX`),
  descargable como etiqueta PNG imprimible que enlaza a la ficha de la ubicación.
- **Material de Trauma** — control de fechas de recepción/vencimiento, estado de
  vencimiento y registro de usos para reposición.
- **Controles / revisiones** — inspecciones y mantenciones con alertas de vencidos
  y próximos.
- **Reportes y dashboard** — resumen por estado, criticidad y categoría; alertas.
- **Importación / exportación Excel** — carga completa o parcial por sección,
  plantillas descargables, exportación filtrada y respaldo de la base de datos.
- **Autenticación con roles** — login de usuarios con roles **admin** y **operador**.

## Requisitos

- [Node.js](https://nodejs.org) 20.x – 26.x (probado en 24 LTS)
- npm

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd Inventariobomberos

# 2. Backend
cd backend
npm install
cp .env.example .env      # y editar los valores (ver abajo)

# 3. Frontend
cd ../frontend
npm install
```

### Variables de entorno (`backend/.env`)

| Variable       | Descripción                                                        |
|----------------|--------------------------------------------------------------------|
| `PORT`         | Puerto del backend (por defecto `3001`).                           |
| `FRONTEND_URL` | URL del frontend; se incrusta en los QR de ubicaciones.            |
| `JWT_SECRET`   | Clave para firmar los tokens de sesión. **Cámbiala en producción.**|

## Ejecución

En dos terminales separadas:

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

### Primer acceso

Al arrancar el backend por primera vez (base de datos vacía) se crea un usuario
administrador inicial:

```
usuario:  admin
clave:    admin123
```

> **Cambia esta contraseña** tras el primer login, desde la pestaña **Usuarios →
> Editar**. Antes de desplegar, define también un `JWT_SECRET` propio.

### Roles

- **Admin** — todo lo del operador, además de eliminar registros y gestionar usuarios.
- **Operador** — ver y editar el inventario (no elimina ni gestiona usuarios).

## Tests

La suite cubre la API del backend (autenticación, permisos por rol, validaciones,
unicidad e integridad referencial). Usa el runner nativo de Node y una base de datos
temporal aislada (no toca la base real).

```bash
cd backend
npm test
```

## Uso de códigos QR en la red local

Para que los QR de las ubicaciones se puedan escanear desde teléfonos:

1. Asigna una **IP fija** al equipo servidor (o reserva DHCP en el router).
2. En `backend/.env`, pon esa IP en `FRONTEND_URL`, p.ej.
   `FRONTEND_URL=http://192.168.1.10:5173`.
3. Levanta el frontend exponiéndolo en la red: `npm run dev -- --host`.

## Respaldo y restauración

- **Respaldo**: pestaña *Importar → Descargar respaldo de la BD* (genera un `.db`).
- **Restaurar**: con el backend detenido, reemplaza `backend/data/inventario.db`
  por el archivo de respaldo.

## Estructura

```
backend/
├── server.js          Punto de entrada: monta routers y middleware de auth
├── db.js              Conexión SQLite, migraciones y seed del admin inicial
├── schema.sql         Definición de tablas
├── lib/
│   ├── helpers.js     Constantes, validaciones y utilidades compartidas
│   └── auth.js        Firma/verificación JWT y middlewares de rol
├── routes/            Un router por módulo (items, bomberos, trauma, ...)
└── test/api.test.js   Suite de tests de la API

frontend/
└── src/
    ├── pages/         Una página por vista (Login, Inventario, Trauma, ...)
    ├── components/    Componentes reutilizables (Modal, NavBar, ...)
    ├── context/       AuthContext y DialogContext
    ├── auth/          Manejo de token e interceptor de fetch
    └── api/           Cliente HTTP por módulo
```

## Stack

- **Backend**: Node.js, Express 5, better-sqlite3, JWT (jsonwebtoken), bcryptjs,
  multer + xlsx (Excel), qrcode.
- **Frontend**: React 19, Vite 7, React Router 7.
