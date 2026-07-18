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

| Variable       | Descripción                                                                          |
|----------------|--------------------------------------------------------------------------------------|
| `PORT`         | Puerto del servidor (por defecto `3001`). Sirve la app y la API en el mismo puerto.  |
| `JWT_SECRET`   | Clave para firmar los tokens de sesión. **Obligatoria**: el servidor no arranca sin ella. |
| `FRONTEND_URL` | *(Opcional)* Fuerza el origen de los QR de ubicaciones. Normalmente no hace falta: se usa la URL con la que se accede al sistema. |

## Ejecución

### Desarrollo

En dos terminales separadas:

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

El frontend de desarrollo redirige las llamadas `/api` al backend automáticamente
(proxy de Vite), igual que en producción.

### Producción (un solo puerto)

Se compila el frontend una vez y Express lo sirve junto con la API:

```bash
cd frontend
npm run build     # genera frontend/dist

cd ../backend
npm start
```

La aplicación completa queda disponible en `http://<ip-del-servidor>:3001` para
cualquier equipo o teléfono de la red local.

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

- **Admin** — todo lo del operador, además de eliminar registros, gestionar usuarios,
  hacer la carga completa desde Excel y descargar el respaldo de la base de datos.
- **Operador** — ver y editar el inventario (no elimina, no gestiona usuarios y no
  accede a la carga completa ni al respaldo).

## Tests

La suite cubre la API del backend (autenticación, permisos por rol, validaciones,
unicidad e integridad referencial). Usa el runner nativo de Node y una base de datos
temporal aislada (no toca la base real).

```bash
cd backend
npm test
```

## Uso de códigos QR en la red local

Los QR de las ubicaciones codifican la **misma URL con la que se accede al sistema**.
Basta con:

1. Asignar una **IP fija** al equipo servidor (o reserva DHCP en el router).
2. Usar el sistema desde esa IP (p.ej. `http://192.168.1.10:3001`) al descargar
   las etiquetas QR: cualquier teléfono de la red podrá escanearlas y abrir la ficha.

## Respaldo y restauración

- **Respaldo** *(solo admin)*: pestaña *Importar → Descargar respaldo de la BD* (genera un `.db`).
- **Restaurar**: con el backend detenido, reemplaza `backend/data/inventario.db`
  por el archivo de respaldo.

## Estructura

```
backend/
├── server.js          Punto de entrada: API bajo /api, auth y frontend compilado
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
