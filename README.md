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
  todo movimiento queda registrado en su historial a nombre del usuario que lo hizo.
- **Acta de recepción firmada** — al entregar uno o varios ítems a un bombero
  (un kit completo de EPP en una sola acta), el sistema genera el acta de
  recepción oficial de la compañía en PDF; la entrega queda pendiente hasta
  subir el documento firmado (foto o escaneo), que se guarda ligado al
  movimiento de cada ítem.
- **Bomberos** — gestión con RUT y N° de registro únicos, cargo y ficha con sus
  ítems asignados.
- **Carros** — módulo aparte con los ítems asignados a los carros de bomberos,
  su gaveta/compartimiento exacto y el historial de revisiones físicas. La
  revisión la puede registrar cualquier bombero **sin cuenta en el sistema**,
  escaneando el QR de revisión pegado en el carro.
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

> **Cambia esta contraseña** tras el primer login: haz clic en tu nombre en la
> cabecera (o pide a un admin editarla en **Usuarios**). Antes de desplegar,
> define también un `JWT_SECRET` propio.

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

## Acta de recepción y firma

El acta reproduce el formato oficial de la 10° Compañía (Cuerpo de Bomberos de
Temuco): encabezado institucional, tabla de elementos con Talla/Cantidad/Marca,
y dos firmas (voluntario que recibe y Capitán de Compañía). Se puede entregar
un solo ítem o un kit completo (ej. uniforme + botas + casco) en una sola acta:

1. Desde la ficha de un ítem (*Asignar a bombero*) o la ficha de un bombero
   (*Entregar equipo*) se abre el mismo formulario: elegir el bombero y agregar
   uno o varios ítems (buscador con checklist). Al generar, el sistema arma el
   **acta de recepción** en PDF con todos los ítems en la tabla y la abre en una
   pestaña nueva para imprimirla. Los ítems **todavía no cambian de dueño** —
   quedan marcados como *pendientes de firma*.
2. Se imprime el acta y la firman el voluntario y quien la emite.
3. Desde la ficha del ítem o del bombero, *Subir documento firmado* — una foto o
   escaneo (PDF, JPG o PNG) del acta ya firmada. Recién en ese momento **todos**
   los ítems del acta quedan asignados, y el documento firmado queda disponible
   desde el historial de movimientos de cada uno (*Ver acta firmada*).

Mientras una solicitud está pendiente, esos ítems no admiten una segunda
solicitud (se puede cancelar la pendiente desde el mismo banner). El listado
completo de actas pendientes de firma está en **Reportes**.

**Escudo de la compañía**: si se coloca una imagen en
`backend/assets/escudo.png` (PNG, fondo transparente recomendado), el acta la
incluye automáticamente en el encabezado; si no existe el archivo, el
encabezado se genera solo con texto.

## Carros y revisión física

El módulo **Carros** (menú superior) muestra solo las ubicaciones tipo `CARRO`
con sus ítems, la gaveta/compartimiento donde va cada uno (se indica al mover
un ítem a una ubicación) y cuántos ítems no están operativos ahora mismo.

La revisión física la hace cualquier bombero, sin necesidad de cuenta:

1. Desde el módulo Carros (o la ficha de un carro), un admin/operador descarga
   el **QR de revisión** — distinto del QR de ficha — y lo pega dentro del carro.
2. Cualquier bombero lo escanea con su teléfono y llega directo a un formulario
   público (`/revision-carro/:id`) con la lista de ítems de ese carro.
3. Marca cada ítem como OK / Falla / Faltante, agrega una observación si
   corresponde, escribe su nombre y guarda. No necesita usuario ni clave.

La revisión queda como un registro histórico aparte (no cambia el `estado`
oficial del ítem): el encargado de material la revisa desde la ficha
autenticada del carro y decide si corresponde cambiar el estado de algún ítem
por el flujo normal.

> **Nota de seguridad**: `/revision-carro/:id` es la única ruta pública del
> sistema fuera de `/auth/login`. Solo permite leer los ítems de ESE carro y
> registrar una revisión (no edita inventario ni expone otros datos), pero no
> valida quién la envía más allá del nombre que la persona escribe — cualquiera
> con el enlace o una foto del QR puede hacerlo. Es un riesgo aceptado para una
> red interna de cuartel, no para un despliegue expuesto a internet.

## Respaldo y restauración

- **Automático**: al arrancar y cada 24 h el servidor guarda una copia en
  `backend/data/backups/` (conserva las 14 más recientes). Antes de cada carga
  completa desde Excel se guarda además un respaldo `pre_carga_completa_*`.
- **Manual** *(solo admin)*: pestaña *Importar → Descargar respaldo de la BD*
  (genera un `.db`). Recomendado para guardar copias fuera del equipo.
- **Restaurar**: con el servidor detenido, reemplaza `backend/data/inventario.db`
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
  multer + xlsx (Excel), qrcode, pdfkit (actas de entrega).
- **Frontend**: React 19, Vite 7, React Router 7.
