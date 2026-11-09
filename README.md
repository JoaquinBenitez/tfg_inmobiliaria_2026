# Inmobiliaria — Plataforma web con recorridos virtuales 360°

Trabajo Final de Grado (Informática): plataforma web para inmobiliarias que permite publicar propiedades en venta y alquiler, con dos características diferenciadoras:

- **Recorridos virtuales 360°** con visor WebGL propio (navegación por coordenadas esféricas *pitch/yaw*, preprocesamiento de panorámicas en AVIF/WebP y carga progresiva para no penalizar el LCP).
- **Sindicación multicanal**: publicación automática hacia portales (feeds XML/JSON canónicos) y redes sociales (Meta Graph API), procesada en segundo plano mediante una cola de trabajos (BullMQ + Redis) con reintentos y retroceso exponencial.

## Estructura del repositorio

```
inmob/
├── inmob_back/          # API REST — Node.js + Express 5 + TypeScript + MongoDB (Mongoose)
├── inmob_front/         # Sitio web — Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
├── docs/                # Documentación del proyecto (plan de sindicación, métricas, memoria del TFG)
├── scripts/             # Verificación en contenedor (verify-container.sh)
├── docker-compose.yml   # Entorno Docker completo de prueba/demo (mongo + semilla + API + web)
└── GUIA-RAPIDA.md       # Cómo ejecutar el proyecto paso a paso
```

## Requisitos previos

- **Docker** (con Docker Compose) — único requisito para la [vía rápida](#puesta-en-marcha-opción-rápida-con-docker)
- O, para ejecutarlo sin Docker: **Node.js 20.19+** (recomendado 22 LTS) y **MongoDB** en local (por ejemplo `mongodb://localhost:27017`, o `docker run -d --name inmob-mongo -p 27017:27017 mongo:7`)
- Cuenta de **Cloudinary** (opcional — con `IMAGE_STORAGE_TYPE=local` no hace falta)

## Puesta en marcha (opción rápida con Docker)

La forma más simple de probar el proyecto completo: un solo comando levanta MongoDB, ejecuta la semilla de datos demo y arranca la API y el sitio.

```bash
docker compose up --build
```

- Sitio: http://localhost:3001 · Panel admin: http://localhost:3001/admin/login · API: http://localhost:3000/api
- Usuarios: `admin@inmob.com` / `admin123456` (o `editor@inmob.com` / `editor123456`)
- Datos: 6 propiedades en **Reconquista y Avellaneda (Santa Fe)** con imágenes y recorrido 360°

Comandos útiles:

```bash
docker compose run --rm seed                          # volver a ejecutar la semilla
docker compose run --rm seed npm run seed -- --force  # re-sembrar desde cero
docker compose down -v                                 # bajar todo y borrar los datos
```

> El optimizador de imágenes de Next.js corre dentro del contenedor `web`; el servicio `image-proxy` del compose se encarga de que las imágenes de `http://localhost:3000` (las URLs guardadas en la base) sean alcanzables desde ese contenedor. No requiere configuración adicional.

## Puesta en marcha (opción manual, sin Docker)

> Guía paso a paso con comandos listos para copiar: **[GUIA-RAPIDA.md](./GUIA-RAPIDA.md)**

### 1. Instalar dependencias

```bash
cd inmob_back && npm install
cd ../inmob_front && npm install
```

> ⚠️ Los `node_modules` son específicos de cada sistema operativo. Si clonás el repo en Windows y en WSL/Linux, instalá las dependencias por separado en cada uno (nunca copies la carpeta entre sistemas).

### 2. Configurar variables de entorno

**Backend — `inmob_back/.env`** (partir de `inmob_back/.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017/inmob
PORT=3000
JWT_SECRET=una_clave_secreta_de_32_caracteres_minimo

# Para la demo NO hace falta Cloudinary:
IMAGE_STORAGE_TYPE=local

# Sindicación (fase 3) — dejar vacío para desactivarla
SYNDICATION_CHANNELS=
```

**Frontend — `inmob_front/.env.local`** (partir de `inmob_front/.env.example`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api
AUTH_SECRET=un_secreto_aleatorio_largo
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

### 3. Sembrar la base de datos con datos demo

```bash
cd inmob_back
npm run seed
```

Esto crea **usuarios, 6 propiedades con imágenes y un recorrido 360°** (todo con contenido generado localmente, sin necesidad de servicios externos). Con `npm run seed -- --force` se re-siempra desde cero. Para usar fotos reales en vez de placeholders (propiedades, fondo del hero y panorámicas 360°), ver ["Usar fotos reales" en la guía rápida](./GUIA-RAPIDA.md#usar-fotos-reales-en-las-propiedades-opcional).

### 4. Iniciar los servidores

```bash
# Terminal 1 — backend (puerto 3000)
cd inmob_back && npm run dev

# Terminal 2 — frontend (puerto 3001)
cd inmob_front && npm run dev
```

### 5. Acceder

| URL | Descripción |
|-----|-------------|
| http://localhost:3001 | Sitio público |
| http://localhost:3001/admin/login | Panel de administración |
| http://localhost:3000/api | API REST |

### Usuarios demo (creados por la semilla)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@inmob.com` | `admin123456` | Administrador |
| `editor@inmob.com` | `editor123456` | Editor |

> 🔐 Cambiá estas contraseñas en cualquier entorno que no sea local.

## Qué mostrar en una demo

1. **Home** — carrusel de propiedades destacadas (las 3 marcadas como *featured* por la semilla).
2. **Recorrido 360°** — abrir *"Casa grande con quincho en Reconquista"* y entrar al visor: escenas enlazadas con *hotspots* colocados sobre los pasos reales; funciona con arrastre del mouse y en celular (giroscopio).
3. **Búsqueda en mapa** — `/buscar-en-mapa` con búsqueda por radio y por viewport alrededor de Reconquista y Avellaneda (índice geoespacial 2dsphere).
4. **Comparador** — `/comparar`, hasta 3 propiedades lado a lado.
5. **Panel admin** — CRUD de propiedades con carga de imágenes, editor de texto enriquecido y **constructor de recorridos 360°** (`TourBuilder`).
6. **Feeds de sindicación** — http://localhost:3000/api/feeds/properties.xml y `.json` (siempre disponibles, cacheados 15 min).

## Páginas del sitio público

| Ruta | Descripción |
|------|-------------|
| `/` | Inicio con destacadas y hero configurable |
| `/venta` · `/alquiler` | Listados con filtros avanzados y paginación |
| `/propiedades/[id]` | Detalle: galería, tour 360°, compartir, contacto por WhatsApp |
| `/buscar-en-mapa` | Búsqueda en mapa Leaflet con clustering |
| `/comparar` | Comparación de hasta 3 propiedades |
| `/contacto` · `/nosotros` | Páginas institucionales |

## Rutas del panel de administración

`/admin/login` · `/admin/dashboard` · `/admin/properties` · `/admin/properties/create` · `/admin/properties/[id]/edit`

Roles: **admin** (todo, incluida gestión de usuarios) y **editor** (ABM de propiedades).

## Comandos

### Backend (`cd inmob_back`)

| Comando | Descripción |
|---------|-------------|
| `docker compose up --build` | Entorno completo de prueba/demo: mongo + semilla + API + web |
| `npm run dev` | Servidor de desarrollo con recarga (puerto 3000) |
| `npm run seed` | Semilla de datos demo (`-- --force` para re-sembrar) |
| `npm run export-tour` | Exporta el tour 360° configurado a mano a `seed-assets/tours/tour-N.json` (la semilla lo reproduce exacto) |
| `npm run create-admin` | Crea solo el usuario admin por defecto |
| `npm run gen-panorama` | Genera una panorámica sintética JPEG para pruebas |
| `npm test` · `npm run test:unit` | Suite completa (Vitest + MongoDB en memoria) / solo unitarios |
| `npm run test:coverage` | Cobertura de tests |
| `npm run build` · `npm start` | Compilación TypeScript / servidor de producción |
| `npm run export-metrics` | Exporta reporte de métricas CWV/FPS a `docs/metrics/` |

### Frontend (`cd inmob_front`)

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo en el puerto 3001 |
| `npm run build` · `npm start` | Build de producción / servidor de producción |
| `npm run lint` | ESLint |

## Tests

El backend tiene una suite automatizada (Vitest + Supertest) que corre contra un **MongoDB en memoria** — no requiere base de datos local ni credenciales de Cloudinary (la primera ejecución descarga un binario de ~70 MB que queda cacheado):

```bash
cd inmob_back && npm test
```

El frontend aún no tiene tests automatizados.

## Arquitectura (resumen)

- **Clean Architecture** en el backend: dominio → servicios de aplicación → infraestructura/adaptadores. Los proveedores externos (Cloudinary/almacenamiento local, visor 360°, Meta Graph API, generadores de feeds) son adaptadores detrás de interfaces (patrón `imageStorageFactory`).
- **Recorridos 360°**: las panorámicas se validan y preprocesan con `sharp` (variantes AVIF/WebP de escritorio y móvil + póster de 512 px) para que el visor nunca descargue la textura completa antes de la interacción. El ciclo de vida de WebGL se controla estrictamente (dispose de geometrías, materiales, texturas y renderer).
- **Métricas**: el frontend recolecta Core Web Vitals (LCP/INP/CLS) y FPS (`web-vitals`) y los envía al backend (`POST /api/metrics`), donde se agregan con percentiles.
- **Sindicación (fase 3)**: publicar/despublicar encola trabajos BullMQ; cada intento queda trazado en `JobLog` (estado, reintentos, duración, referencia externa). Desactivada por defecto (`SYNDICATION_CHANNELS=` vacío).
- Los inmuebles usan **borrado lógico** (`deletedAt`) y búsqueda geoespacial con índice `2dsphere`.

Documentación adicional: `docs/plan-syndication.md`, `docs/metrics/`, `docs/tfg/` (memoria del TFG), y los README detallados de [`inmob_back/`](./inmob_back/README.md) y [`inmob_front/`](./inmob_front/README.md).

> **Demo de difusión con colas:** incluida en `docker compose up --build` — publica en modo sandbox (Meta dry-run + feeds XML/JSON) sin credenciales ni publicaciones reales. Ver [`GUIA-RAPIDA.md`](GUIA-RAPIDA.md).

## Solución de problemas

| Problema | Solución |
|----------|----------|
| El backend no inicia | Verificá que MongoDB esté corriendo y que `MONGODB_URI`/`JWT_SECRET` (≥ 32 caracteres) estén en `inmob_back/.env`. La validación de variables falla al arrancar con mensajes concretos. |
| Error `Cannot find module '...lightningcss...'` | `node_modules` instalados en otro sistema operativo: borrá la carpeta y ejecutá `npm install` de nuevo en el sistema actual. |
| Las imágenes no se ven | Con `IMAGE_STORAGE_TYPE=local` las imágenes se sirven desde `http://localhost:3000/uploads/...` — el backend debe estar corriendo. |
| No puedo iniciar sesión en el admin | Verificá `AUTH_SECRET` y `NEXTAUTH_URL=http://localhost:3001` en `inmob_front/.env.local`, y que `API_URL` apunte al backend. |
| `npm run seed` no hace nada | La base ya tiene datos: usá `npm run seed -- --force`. |
| Puerto ocupado | Cambiá `PORT` (backend) o usá `npm run dev:default` (frontend, puerto 3000). |

## Despliegue a producción (notas)

- `JWT_SECRET` y `AUTH_SECRET` fuertes y distintos entre sí; contraseñas demo cambiadas.
- `FRONTEND_URLS` con los orígenes del frontend (CORS) y `NODE_ENV=production`.
- MongoDB con autenticación (p. ej. Atlas), Cloudinary configurado como almacenamiento, HTTPS.
- Sindicación: Redis (`REDIS_URL`) y canales en `SYNDICATION_CHANNELS`; el tablero Bull Board queda protegido por `QUEUE_BOARD_TOKEN`.
