# Guía rápida — Cómo ejecutar el proyecto

Dos formas de levantar la plataforma completa con datos de demostración:

- **Opción A (recomendada): Docker** — un solo comando, no requiere instalar nada más.
- **Opción B: manual** — Node.js + MongoDB en tu máquina.

Ambas dejan el sitio en http://localhost:3001 con **6 propiedades demo en
Reconquista y Avellaneda (Santa Fe)**, imágenes, un recorrido virtual 360° y el
panel de administración listo para usar.

---

## Opción A — Docker (único requisito: tener Docker instalado)

```bash
docker compose up --build
```

Eso es todo. El compose levanta MongoDB, Redis, ejecuta la semilla de datos demo
y arranca la API y el sitio — con la difusión automática ya activa en modo
sandbox (Meta dry-run + feeds XML/JSON, sin publicar nada real). La primera vez
compila las imágenes (unos minutos); las siguientes es casi inmediato.

> Requiere Docker Compose v2 (incluido en Docker Desktop; se invoca como
> `docker compose`, con espacio). En segundo plano: `docker compose up --build -d`
> (logs con `docker compose logs -f web`). Con Ctrl+C en la terminal se detiene
> todo — normal si no usaste `-d`.

Esperá a ver en la consola los mensajes de la semilla (`🎉 Semilla completada`)
y luego abrí:

| URL | Qué es |
|-----|--------|
| **http://localhost:3001** | Sitio público (home con destacadas) |
| **http://localhost:3001/admin/login** | Panel de administración |
| http://localhost:3001/venta · /alquiler | Listados con filtros |
| http://localhost:3001/buscar-en-mapa | Búsqueda en mapa interactivo |
| http://localhost:3000/api/feeds/properties.xml | Feed XML de sindicación |

**Ingreso al panel:** `admin@inmob.com` / `admin123456`

Comandos útiles:

```bash
docker compose run --rm seed                          # volver a ejecutar la semilla
docker compose run --rm seed npm run seed -- --force  # re-sembrar desde cero
docker compose down                                   # detener todo
docker compose down -v                                # detener y borrar los datos
```

> La cola de difusión (BullMQ sobre Redis) arranca incluida — ver la sección
> [«Difusión automática con colas»](#difusión-automática-con-colas-demo-sandbox).
> Para desactivarla del todo: `SYNDICATION_CHANNELS= docker compose up --build -d`.

---

## Agregar una escena al recorrido 360° (opcional)

Para demostrar la carga de panorámicas con el TourBuilder:

1. **Generar la panorámica de prueba** (desde la raíz del repo, con Node instalado):
   ```bash
   cd inmob_back
   npm run gen-panorama
   ```
   Crea `demo-panorama.jpg` (4096×2048). También sirve cualquier foto
   equirectangular real de ≥ 2048 px de ancho.
2. Iniciar sesión en el **panel admin** → editar la propiedad
   **"Casa grande con quincho en Reconquista"** → sección **Recorrido 360°**.
3. **Subir** el archivo desde el TourBuilder (el backend valida y genera las
   variantes AVIF/WebP + póster; tarda unos segundos).
4. Renombrar la escena (ej. "Dormitorio"), agregar un **hotspot** haciendo clic
   sobre la panorámica (destino: Living, etiqueta "Volver al living") y, si se
   quiere, reordenar escenas o ajustar la vista inicial.
5. **Guardar recorrido** y abrir la propiedad en el sitio público: el visor
   navega entre las 3 escenas.

Límites que valida el dominio: máx. 12 escenas, 20 hotspots por escena,
etiquetas ≤ 60 caracteres, panorámica ≥ 2048×720 con relación ≥ 1.5:1, ≤ 40 MB.

## Usar fotos reales en las propiedades (opcional)

Por defecto la semilla genera imágenes placeholder (gradiente + rótulo). Para
usar fotos reales:

1. Descargar fotos (jpg/png/webp) y copiarlas en `inmob_back/seed-assets/`
   (crear la carpeta). Asignación por nombre de archivo:
   - **`N-...jpg`** (N según el orden de siembra, 1..6) → van a la propiedad N;
     el orden lo imprime la semilla al correr (ej.: `01-frente.jpg` y
     `01-patio.jpg` → la casa de barrio centro). Van **todas** las fotos con
     ese prefijo, en orden alfabético.
   - **sin prefijo** (ej. `quincho.jpg`) → pool general que se reparte entre
     las propiedades sin fotos propias.
   - Sin carpeta o vacía → placeholders sintéticos (gradiente + rótulo).
   - **`tours/N-nombre.jpg`** (subcarpeta `seed-assets/tours/`) → panorámicas
     equirectangulares **reales** para el recorrido 360° de la propiedad N;
     "nombre" se convierte en el nombre de la escena (ej.: `1-living.jpg`,
     `1-cocina.jpg`, `1-patio.jpg` → tour de 3 escenas en la casa de barrio
     centro, con hotspots encadenados automáticamente). Requisitos: ≥ 2048 px
     de ancho, relación ≥ 1.5:1, ≤ 40 MB; las inválidas se descartan con aviso.
     Tip: `npm run gen-panorama seed-assets/tours/1-living.jpg 4096 2048`
     genera una panorámica válida de prueba.
   - **`hero/...jpg`** (subcarpeta `seed-assets/hero/`) → imágenes de fondo
     del home (máx 3, carrusel). Recomendado: el repo no trae imagen de fondo
     por defecto, así que sin ellas el home queda liso.
   Se re-escalan solas a máx 1200×800 (fotos) o 1600px de ancho (hero), con
   corrección de orientación EXIF.

## Guardar un tour configurado a mano (export)

Si armaste o retocaste el recorrido 360° en el TourBuilder (hotspots en su
lugar, vistas iniciales, etc.), exportalo para que la semilla lo reproduzca
**exacto** en cualquier instalación (incluida la de los profesores):

```bash
# Manual
npm run export-tour

# Docker (escribe directo a inmob_back/seed-assets/ gracias al bind mount)
docker compose run --rm seed npm run export-tour
```

Genera `seed-assets/tours/tour-N.json` (la configuración exacta) más las
panorámicas de cada escena (`N-*.webp`). A partir de ahí, cada `npm run seed
-- --force` — o el `docker compose up` de otra persona — reconstruye el tour
tal como lo dejaste. Si volvés a retocar el tour, repetí el export.
2. Volver a sembrar:
   ```bash
   # Docker (seed-assets va montado desde el repo → no hace falta rebuild)
   docker compose run --rm seed npm run seed -- --force

   # Manual
   cd inmob_back && npm run seed -- --force
   ```
3. Recargar el sitio (Ctrl+F5). Con menos fotos que propiedades, las fotos se
   reutilizan entre propiedades — con 10–20 variadas queda mejor.

---

## Difusión automática con colas (demo sandbox)

El sistema de publicación multicanal (BullMQ + Redis) se puede demostrar **sin
publicar nada real**: Meta corre en modo *dry-run* y los canales de feed solo
generan los XML/JSON locales.

### Levantar

Nada especial: es el mismo `docker compose up --build` de siempre — Redis y los
tres canales vienen incluidos por defecto. Para desactivar la difusión:
`SYNDICATION_CHANNELS= docker compose up --build -d`.

### Disparar publicaciones

Editar cualquier propiedad en el panel admin y **guardar**: se encolan
automáticamente 3 jobs (uno por canal) — nunca en el hilo del request. Lo
mismo al crear una propiedad, y al eliminar (unpublish en los canales push).

### Dónde mirar

1. **Tablero de publicación** — http://localhost:3001/admin/syndication (login
   admin): estado por propiedad × canal, intento, duración y `externalRef` de
   cada job, con botón **Reintentar**.
2. **Bull Board** (la cola desde adentro) —
   http://localhost:3000/api/admin/queue-board?token=demo-tfg — jobs en
   espera, activos, completados y fallados.
3. **Feeds generados** — http://localhost:3000/api/feeds/properties.xml y
   `.json` (formato canónico del Anexo 2, cacheados 15 min).
4. **Traza de ejecución** — `docker compose logs -f api`: dry-runs de Meta con
   su caption, y por cada intento un registro en JobLog con `durationMs`.

### Para mostrar validación y reintentos

- Crear una propiedad **sin fotos** y guardarla: el job de `meta-graph` falla
  la validación del canal (va directo a fallados, sin quemar reintentos)
  mientras los feeds se publican igual → el tablero queda con estados mixtos.
- El botón **Reintentar** del tablero re-encola el job con un id fresco
  (idempotencia) y se lo ve pasar de nuevo por la cola.

> Publicar de verdad en Meta requiere `META_SANDBOX=false` más credenciales
> reales en el `.env` del backend — fuera del alcance de la demo.

---

## Opción B — Manual (Node.js + MongoDB)

### Requisitos

- **Node.js 20.19 o superior** → https://nodejs.org (verificar con `node -v`)
- **MongoDB** corriendo en `localhost:27017`:
  - Instalado como servicio: https://www.mongodb.com/try/download/community
  - …o con Docker: `docker run -d --name inmob-mongo -p 27017:27017 mongo:7`

> No hacen falta cuentas de Cloudinary, Redis ni Meta: la demo funciona con
> almacenamiento local y la sindicación desactivada por defecto.

### Paso 1 — Instalar dependencias

```bash
cd inmob_back
npm install

cd ../inmob_front
npm install
```

### Paso 2 — Crear los archivos de entorno

**`inmob_back/.env`** (crear el archivo con este contenido):

```env
MONGODB_URI=mongodb://localhost:27017/inmob
PORT=3000
JWT_SECRET=clave_secreta_demo_de_mas_de_32_caracteres
IMAGE_STORAGE_TYPE=local
SYNDICATION_CHANNELS=
```

**`inmob_front/.env.local`** (crear el archivo con este contenido):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api
AUTH_SECRET=otra_clave_secreta_demo_larga
NEXTAUTH_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

### Paso 3 — Sembrar la base de datos con datos demo

```bash
cd inmob_back
npm run seed
```

Esto crea:

- Usuario **admin** (`admin@inmob.com` / `admin123456`) y **editor** (`editor@inmob.com` / `editor123456`)
- **6 propiedades** de venta y alquiler (casas, departamentos, local y terreno) en **Reconquista y Avellaneda, Santa Fe**, con imágenes
- **Un recorrido virtual 360°** en la primera propiedad (sintético de 2 escenas,
  o con **panorámicas reales** desde `seed-assets/tours/`, ver abajo)
- Los textos del home

Para re-sembrar desde cero en cualquier momento: `npm run seed -- --force`

### Paso 4 — Iniciar los servidores (2 terminales)

```bash
# Terminal 1
cd inmob_back
npm run dev

# Terminal 2
cd inmob_front
npm run dev
```

### Paso 5 — Abrir el sitio

Las mismas URLs de la Opción A (http://localhost:3001 y http://localhost:3001/admin/login).

---

## Recorrido sugerido de la demo (5 minutos)

1. Home → abrir **"Casa grande con quincho en Reconquista"** → sección **Recorrido virtual 360°**: arrastrar para mirar alrededor y usar los *hotspots* para moverse entre escenas.
2. `/buscar-en-mapa`: buscar propiedades por radio alrededor de Reconquista y Avellaneda.
3. `/comparar`: comparar dos propiedades lado a lado (botón "Comparar" en las tarjetas).
4. Panel admin: crear/editar una propiedad, subir imágenes, y ver el **constructor de recorridos 360°** (para probarlo, `npm run gen-panorama` ejecutado en `inmob_back` genera una panorámica sintética que puede subirse al constructor).
5. Feed de sindicación: http://localhost:3000/api/feeds/properties.xml (formato canónico del Anexo 2).

## Si algo falla

| Síntoma | Causa probable |
|---------|----------------|
| Logs de mongo: `Connection not authenticating` (cada ~5 s) | **No es un error**: es el healthcheck conectándose sin credenciales (la base demo no usa auth). Ignorar; verificar el estado real con `docker compose ps` |
| Docker: el sitio carga pero sin propiedades | Verificar en los logs que la semilla terminó: `docker compose logs seed` |
| Docker: imágenes = solo colores sin texto | Normal con placeholders: la imagen base no tenía fuentes (ya corregido). Para fotos reales: sección "Usar fotos reales" |
| Docker: seed/api fallan con `Unauthorized` | Volumen viejo con auth de una corrida anterior: `docker compose down -v && docker compose up --build -d` |
| Docker: no se ven las imágenes | Verificar que el servicio `image-proxy` esté corriendo: `docker compose ps` |
| Manual: el backend no arranca | MongoDB no está corriendo, o falta/mal `JWT_SECRET` (mínimo 32 caracteres) |
| Manual: no entra al admin | Revisar `inmob_front/.env.local` (paso 2) y reiniciar `npm run dev` |
| `Cannot find module '...lightningcss...'` | Borrar `node_modules` del proyecto afectado y repetir `npm install` (solo opción manual) |

Más detalle: [README.md](./README.md)
