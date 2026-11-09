/**
 * Semilla de datos demo (para la entrega al tutor / demo del TFG).
 *
 * Crea:
 *  - Usuarios: admin@inmob.com (admin) y editor@inmob.com (editor)
 *  - ~10 propiedades variadas con imágenes (fotos reales de `seed-assets/`, con
 *    prefijo `N-` para asignarlas por propiedad o pool general; si no hay,
 *    placeholders sintéticos) — Reconquista y Avellaneda, Santa Fe
 *  - Recorridos 360°: panorámicas reales de `seed-assets/tours/N-nombre.jpg`
 *    (hotspots encadenados automáticos); sin archivos, un tour sintético de
 *    2 escenas en la primera propiedad (ADR 0003)
 *  - Imágenes de fondo del hero del home desde `seed-assets/hero/` (máx 3)
 *  - Textos del hero del sitio
 *
 * Uso:
 *   npm run seed            # crea los datos si la base está vacía
 *   npm run seed -- --force # borra las propiedades existentes y vuelve a sembrar
 *
 * Requisito: MongoDB corriendo y .env configurado
 * (con IMAGE_STORAGE_TYPE=local no hace falta Cloudinary).
 */
import mongoose from 'mongoose';
import sharp from 'sharp';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { connectDB } from '../config/database';
import User from '../models/User';
import Property from '../models/Property';
import SiteSettings from '../models/SiteSettings';
import { ImageStorageFactory } from '../services/imageStorageFactory';
import { PropertyRepositoryFactory } from '../infrastructure/propertyRepositoryFactory';
import { tourService } from '../application/tourService';
import { MAX_SCENES, TourScene } from '../domain/tour';
import { ImageAsset } from '../domain/property';
import { DEMO_PROPERTIES, DemoProperty } from './demoProperties';

const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Generadores de imágenes placeholder (SVG → JPEG con sharp, sin dependencias)
// ---------------------------------------------------------------------------

const PALETTE = [
    ['#1e3a5f', '#4a7ba6'],
    ['#3a5f3a', '#7ba67b'],
    ['#5f3a1e', '#a67b4a'],
    ['#4a1e5f', '#8a4aa6'],
    ['#1e5f5f', '#4aa6a6']
];

/**
 * Fotos reales opcionales de `seed-assets/` (nada se descarga de internet):
 *  - `N-*.jpg` (N = 1..10, ver orden en los logs) → van a la propiedad N
 *  - sin prefijo → pool general que se reparte entre las propiedades sin fotos propias
 * Se re-escalan a máx 1200×800 y se corrige la orientación EXIF.
 */
interface UserPhotos {
    own: Map<number, Buffer[]>;
    pool: Buffer[];
}

async function loadUserPhotos(): Promise<UserPhotos> {
    const dir = path.join(process.cwd(), 'seed-assets');
    const result: UserPhotos = { own: new Map(), pool: [] };
    let files: string[];
    try {
        files = (await readdir(dir, { withFileTypes: true }))
            .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
            .map((e) => e.name)
            .sort();
    } catch {
        return result; // carpeta inexistente → placeholders sintéticos
    }
    for (const file of files) {
        const buffer = await readFile(path.join(dir, file));
        const match = file.match(/^(\d{1,2})[-_. ]/);
        const index = match ? parseInt(match[1], 10) - 1 : NaN;
        if (Number.isInteger(index) && index >= 0 && index < DEMO_PROPERTIES.length) {
            const list = result.own.get(index) ?? [];
            list.push(buffer);
            result.own.set(index, list);
        } else {
            result.pool.push(buffer);
        }
    }
    return result;
}

async function placeholderPhoto(title: string, index: number, seed: number): Promise<Buffer> {
    const [from, to] = PALETTE[seed % PALETTE.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <rect x="40" y="40" width="1120" height="720" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="4"/>
  <text x="600" y="400" font-family="sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle">${title}</text>
  <text x="600" y="470" font-family="sans-serif" font-size="36" fill="rgba(255,255,255,0.8)" text-anchor="middle">Imagen demo ${index + 1}</text>
</svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

/** Panorámica equirectangular sintética 2:1 (2048x1024) — idea del ADR 0003 / gen-panorama. */
function panoramaSvg(sceneName: string, seed: number): Buffer {
    const width = 2048;
    const height = 1024;
    const [from, to] = PALETTE[seed % PALETTE.length];
    const lines: string[] = [];
    for (let yaw = -180; yaw <= 180; yaw += 30) {
        const x = ((yaw + 180) / 360) * width;
        lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`);
    }
    for (const pitch of [-30, 0, 30]) {
        const y = ((90 - pitch) / 180) * height;
        lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,${pitch === 0 ? 0.6 : 0.25})" stroke-width="2"/>`);
    }
    const labels = [
        { yaw: -180, text: 'OESTE' }, { yaw: -90, text: 'SUR' },
        { yaw: 0, text: 'NORTE' }, { yaw: 90, text: 'ESTE' }
    ];
    for (const { yaw, text } of labels) {
        const x = ((yaw + 180) / 360) * width + 20;
        lines.push(`<text x="${x}" y="${height / 2 - 40}" font-family="sans-serif" font-size="48" fill="white" opacity="0.9">${text}</text>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${from}"/><stop offset="55%" stop-color="${to}"/><stop offset="100%" stop-color="#c9a86a"/>
  </linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  ${lines.join('\n')}
  <text x="${width / 2}" y="${height / 2 + 120}" font-family="sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">${sceneName}</text>
</svg>`;
    return Buffer.from(svg);
}

// ---------------------------------------------------------------------------
// Datos demo (Reconquista y Avellaneda, Santa Fe)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------

/** Imágenes de fondo del hero (home): seed-assets/hero/*.jpg|png|webp (máx 3). */
async function loadHeroImages(): Promise<Buffer[]> {
    const dir = path.join(process.cwd(), 'seed-assets', 'hero');
    try {
        const files = (await readdir(dir, { withFileTypes: true }))
            .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
            .map((e) => e.name)
            .sort()
            .slice(0, 3); // el esquema admite máx 3 (igual que el admin)
        return await Promise.all(files.map((f) => readFile(path.join(dir, f))));
    } catch {
        return [];
    }
}

/** Re-encode para fondos del hero: más anchos (1600px, paisaje). */
async function reencodeHero(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
}

async function ensureUser(email: string, password: string, name: string, role: 'admin' | 'editor'): Promise<void> {
    const existing = await User.findOne({ email });
    if (existing) {
        console.log(`👤 Usuario ya existente: ${email} (${existing.role})`);
        return;
    }
    await User.create({ email, password, name, role, isActive: true });
    console.log(`👤 Usuario creado: ${email} / ${password} (${role})`);
}

/** Re-encode uniforme de una foto real: EXIF auto-rotate + máx 1200×800. */
async function reencodePhoto(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .rotate()
        .resize({ width: 1200, height: 800, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
}

async function seedPropertyImages(
    p: DemoProperty,
    seed: number,
    userPhotos: UserPhotos
): Promise<{ assets: ImageAsset[]; source: string }> {
    const storage = ImageStorageFactory.getStorageProvider();
    const own = userPhotos.own.get(seed) ?? [];
    const buffers: Buffer[] | null = own.length > 0
        ? own // fotos propias: van todas, en orden alfabético
        : userPhotos.pool.length > 0
            ? Array.from({ length: p.photos }, (_, k) => userPhotos.pool[(seed + k) % userPhotos.pool.length])
            : null;
    const assets: ImageAsset[] = [];
    const count = buffers?.length ?? p.photos;
    for (let i = 0; i < count; i++) {
        const buffer = buffers
            ? await reencodePhoto(buffers[i])
            : await placeholderPhoto(p.title.slice(0, 28), i, seed + i);
        const { url, publicId } = await storage.uploadImage(buffer, 'properties');
        assets.push({ url, publicId, width: 1200, alt: `${p.title} — foto ${i + 1}` });
    }
    return { assets, source: buffers ? (own.length > 0 ? 'fotos propias (prefijo N-)' : 'pool seed-assets') : 'placeholders sintéticos' };
}

/**
 * Panorámicas para tours en `seed-assets/tours/`. Dos formatos:
 *
 *  1. Preset exacto `tour-N.json` (+ sus imágenes, generados por
 *     `npm run export-tour`): reproduce el tour tal como se configuró a mano
 *     (escenas, vistas iniciales, cobertura y hotspots con sus posiciones).
 *  2. Imágenes sueltas `N-nombre.jpg|png|webp` → la escena "Nombre" del tour
 *     de la propiedad N, con hotspots encadenados automáticamente.
 *
 * Deben ser equirectangulares (≥ 2048 px de ancho, relación ≥ 1.5:1, ≤ 40 MB).
 */
interface SceneSource {
    name: string;
    buffer: Buffer;
}

interface TourHotspotPlan {
    to: string; // nombre de la escena destino
    pitch: number;
    yaw: number;
    label: string;
}

interface TourScenePlan extends SceneSource {
    initialView?: { pitch: number; yaw: number; fov: number };
    coverage?: unknown;
    hotspots?: TourHotspotPlan[];
}

interface TourPlan {
    scenes: TourScenePlan[];
    preset: boolean; // true = reproducir config exacta; false = hotspots automáticos
}

interface TourPresetFile {
    scenes?: Array<{
        file?: string;
        name?: string;
        initialView?: { pitch: number; yaw: number; fov: number };
        coverage?: unknown;
        hotspots?: TourHotspotPlan[];
    }>;
}

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

async function loadTourPlans(): Promise<Map<number, TourPlan>> {
    const dir = path.join(process.cwd(), 'seed-assets', 'tours');
    const plans = new Map<number, TourPlan>();
    let entries: import('fs').Dirent[];
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return plans; // carpeta inexistente → tour sintético
    }

    // 1) Presets exportados (tour-N.json) — tienen prioridad
    for (const entry of entries.filter((e) => e.isFile() && /^tour-(\d{1,2})\.json$/i.test(e.name))) {
        const idx = parseInt(entry.name.match(/^tour-(\d{1,2})\.json$/i)![1], 10) - 1;
        if (idx < 0 || idx >= DEMO_PROPERTIES.length) {
            console.warn(`⚠️  seed-assets/tours/${entry.name}: N fuera de rango (1..${DEMO_PROPERTIES.length}) → ignorado`);
            continue;
        }
        let parsed: TourPresetFile;
        try {
            parsed = JSON.parse(await readFile(path.join(dir, entry.name), 'utf8')) as TourPresetFile;
        } catch (err) {
            console.warn(`⚠️  seed-assets/tours/${entry.name}: JSON inválido (${err instanceof Error ? err.message : err}) → ignorado`);
            continue;
        }
        const scenes: TourScenePlan[] = [];
        for (const scene of parsed.scenes ?? []) {
            if (typeof scene?.file !== 'string') {
                console.warn(`⚠️  ${entry.name}: escena sin "file" → ignorada`);
                continue;
            }
            try {
                scenes.push({
                    name: (scene.name ?? scene.file).toString().slice(0, 100),
                    buffer: await readFile(path.join(dir, scene.file)),
                    initialView: scene.initialView,
                    coverage: scene.coverage ?? null,
                    hotspots: Array.isArray(scene.hotspots) ? scene.hotspots : []
                });
            } catch {
                console.warn(`⚠️  ${entry.name}: no se pudo leer "${scene.file}" → escena ignorada`);
            }
        }
        if (scenes.length > 0) plans.set(idx, { scenes, preset: true });
    }

    // 2) Imágenes sueltas N-nombre.ext → hotspots automáticos
    const byProperty = new Map<number, TourScenePlan[]>();
    for (const entry of entries.filter((e) => e.isFile() && IMAGE_RE.test(e.name)).map((e) => e.name).sort()) {
        const stem = entry.replace(IMAGE_RE, '');
        const match = stem.match(/^(\d{1,2})[-_. ]+(.+)$/);
        const index = match ? parseInt(match[1], 10) - 1 : NaN;
        if (!Number.isInteger(index) || index < 0 || index >= DEMO_PROPERTIES.length) {
            console.warn(`⚠️  seed-assets/tours/${entry}: ignorada (usá prefijo N-nombre, N entre 1 y ${DEMO_PROPERTIES.length})`);
            continue;
        }
        const name = match![2].replace(/[-_]+/g, ' ').trim().slice(0, 100);
        const list = byProperty.get(index) ?? [];
        list.push({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            buffer: await readFile(path.join(dir, entry))
        });
        byProperty.set(index, list);
    }
    for (const [idx, scenes] of byProperty) {
        if (!plans.has(idx)) plans.set(idx, { scenes, preset: false });
    }
    return plans;
}

/**
 * Sube las escenas por el pipeline real (validación + variantes AVIF/WebP +
 * poster) y habilita el tour. Con `preset` reproduce la config exacta
 * (vistas, cobertura, hotspots por nombre de escena); sin él encadena
 * hotspots automáticamente (siguiente a yaw 90°, anterior a -90°).
 * Devuelve la cantidad de escenas creadas (0 si todas fallaron la validación).
 */
async function buildTour(propertyId: string, plan: TourPlan): Promise<number> {
    const repo = PropertyRepositoryFactory.getRepository();
    const storage = ImageStorageFactory.getStorageProvider();
    const scenes: TourScene[] = [];
    for (const source of plan.scenes.slice(0, MAX_SCENES)) {
        try {
            const { scene } = await tourService.addScene(repo, storage, propertyId, { buffer: source.buffer }, source.name);
            scenes.push(scene);
        } catch (err) {
            console.warn(`⚠️  Escena "${source.name}" descartada: ${err instanceof Error ? err.message : err}`);
        }
    }
    if (scenes.length === 0) return 0;

    let scenesPatch: Array<{
        id: string;
        initialView: { pitch: number; yaw: number; fov: number };
        coverage?: unknown;
        hotspots?: Array<{ id: string; toScene: string; pitch: number; yaw: number; label: string }>;
    }>;

    if (plan.preset) {
        // Config exacta: cada escena subida i ↔ plan.scenes[i]; hotspots por nombre
        const idByName = new Map(scenes.map((s) => [s.name, s.id]));
        scenesPatch = scenes.map((scene, i) => {
            const planned = plan.scenes[i];
            const hotspots = (planned.hotspots ?? [])
                .filter((h) => {
                    if (idByName.has(h.to)) return true;
                    console.warn(`⚠️  Hotspot "${h.label}" → escena "${h.to}" inexistente → descartado`);
                    return false;
                })
                .map((h, k) => ({
                    id: `${scene.id}-h${k}`,
                    toScene: idByName.get(h.to)!,
                    pitch: h.pitch,
                    yaw: h.yaw,
                    label: h.label.slice(0, 60)
                }));
            return {
                id: scene.id,
                initialView: planned.initialView ?? { pitch: 0, yaw: 0, fov: 75 },
                ...(planned.coverage ? { coverage: planned.coverage } : {}),
                hotspots
            };
        });
    } else {
        scenesPatch = scenes.map((scene, i) => ({
            id: scene.id,
            initialView: { pitch: 0, yaw: 0, fov: 75 },
            hotspots: [
                ...(scenes[i + 1]
                    ? [{ id: `${scene.id}-next`, toScene: scenes[i + 1].id, pitch: 0, yaw: 90, label: `Ir a ${scenes[i + 1].name}`.slice(0, 60) }]
                    : []),
                ...(i > 0
                    ? [{ id: `${scene.id}-back`, toScene: scenes[i - 1].id, pitch: 0, yaw: -90, label: `Volver a ${scenes[i - 1].name}`.slice(0, 60) }]
                    : [])
            ]
        }));
    }

    await tourService.updateTour(repo, propertyId, { enabled: true, scenes: scenesPatch });
    return scenes.length;
}

/** Recorrido sintético de fallback (2 escenas con grilla, ADR 0003). */
async function seedSyntheticTour(propertyId: string, seed: number): Promise<number> {
    console.log('🌀 Generando recorrido 360° sintético (variantes AVIF/WebP + poster, puede tardar unos segundos)...');
    const sources = [
        { name: 'Living', buffer: await sharp(panoramaSvg('LIVING', seed)).jpeg({ quality: 85 }).toBuffer() },
        { name: 'Cocina', buffer: await sharp(panoramaSvg('COCINA', seed + 1)).jpeg({ quality: 85 }).toBuffer() }
    ];
    const created = await buildTour(propertyId, { scenes: sources, preset: false });
    if (created > 0) console.log(`🌀 Recorrido 360° creado y habilitado (${created} escenas sintéticas)`);
    return created;
}

async function main(): Promise<void> {
    await connectDB();

    const existing = await Property.countDocuments();
    if (existing > 0 && !FORCE) {
        console.log(`ℹ️  La base ya tiene ${existing} propiedades. Usá "npm run seed -- --force" para re-sembrar desde cero.`);
        return;
    }
    if (FORCE) {
        await Property.deleteMany({});
        console.log(`🗑️  Propiedades existentes eliminadas (--force)`);
    }

    // 1) Usuarios demo
    await ensureUser('admin@inmob.com', 'admin123456', 'Admin User', 'admin');
    await ensureUser('editor@inmob.com', 'editor123456', 'Editor User', 'editor');

    // 2) Hero del sitio: textos + imágenes de fondo (seed-assets/hero/, máx 3)
    const heroPhotos = await loadHeroImages();
    const heroImages: string[] = [];
    if (heroPhotos.length > 0) {
        const storage = ImageStorageFactory.getStorageProvider();
        for (const photo of heroPhotos) {
            const encoded = await reencodeHero(photo);
            const { url } = await storage.uploadImage(encoded, 'hero');
            heroImages.push(url);
        }
        console.log(`🌅 Hero: ${heroImages.length} imagen(es) de fondo de seed-assets/hero/`);
    } else {
        console.log('🌅 Hero: sin imágenes en seed-assets/hero/ (el fondo del home quedará liso)');
    }
    await SiteSettings.updateOne(
        { key: 'site_settings' },
        { $set: { heroTitle: 'Encontrá tu próximo hogar', heroSubtitle: 'Ventas y alquileres en Reconquista y Avellaneda, Santa Fe.', ...(heroImages.length > 0 ? { heroImages } : {}) } },
        { upsert: true }
    );

    // 3) Propiedades con imágenes
    const userPhotos = await loadUserPhotos();
    console.log(
        userPhotos.own.size > 0 || userPhotos.pool.length > 0
            ? `📷 seed-assets/: ${[...userPhotos.own.values()].reduce((n, l) => n + l.length, 0)} foto(s) con prefijo N- y ${userPhotos.pool.length} en pool`
            : '🎨 Sin fotos en seed-assets/ → placeholders sintéticos (meté fotos ahí para usar imágenes reales)'
    );
    console.log('   Orden de siembra (prefijo N- para asignar fotos a una propiedad):');
    DEMO_PROPERTIES.forEach((p, idx) => console.log(`     ${String(idx + 1).padStart(2)}. ${p.title}`));
    let tourPropertyId: string | null = null;
    const createdIds: string[] = [];
    for (let i = 0; i < DEMO_PROPERTIES.length; i++) {
        const p = DEMO_PROPERTIES[i];
        const { assets: images, source } = await seedPropertyImages(p, i, userPhotos);
        const created = await Property.create({
            title: p.title,
            description: p.description,
            price: p.price,
            currency: p.currency,
            location: {
                type: 'Point',
                coordinates: [p.lng, p.lat], // GeoJSON: [lng, lat]
                address: p.address,
                city: p.city
            },
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            area: p.area,
            propertyType: p.propertyType,
            listingType: p.listingType,
            status: p.status,
            featured: p.featured,
            featuredImageId: p.featured ? images[0].publicId : '',
            images
        });
        createdIds.push(created._id.toString());
        if (i === 0) tourPropertyId = created._id.toString();
        console.log(`🏠 [${i + 1}/${DEMO_PROPERTIES.length}] ${p.title} (${p.propertyType}, ${p.listingType === 'sale' ? 'venta' : 'alquiler'}) — ${images.length} ${source}`);
    }

    // 4) Recorridos 360°: presets exactos de seed-assets/tours/tour-N.json
    //    (export-tour) o panorámicas sueltas; si nada, tour sintético en la
    //    primera propiedad (la casa destacada)
    let toursCreated = 0;
    const tourPlans = await loadTourPlans();
    if (tourPlans.size > 0) console.log(`🌀 seed-assets/tours/: planes para ${tourPlans.size} propiedad(es)`);
    for (const [idx, plan] of tourPlans) {
        const propertyId = createdIds[idx];
        if (!propertyId) continue;
        const n = await buildTour(propertyId, plan);
        if (n > 0) {
            console.log(`🌀 Recorrido 360° de "${DEMO_PROPERTIES[idx].title}": ${n} escena(s)${plan.preset ? ' — preset exacto (export-tour)' : ' — hotspots automáticos'}`);
            toursCreated++;
        }
    }
    if (toursCreated === 0 && tourPropertyId) {
        if (await seedSyntheticTour(tourPropertyId, 0) > 0) toursCreated = 1;
    }

    console.log('');
    console.log('🎉 Semilla completada:');
    console.log(`   ${DEMO_PROPERTIES.length} propiedades (3 destacadas, ${toursCreated} con recorrido 360°)`);
    console.log('   Usuarios: admin@inmob.com / admin123456 · editor@inmob.com / editor123456');
    console.log('   Login en http://localhost:3001/admin/login');
}

main()
    .catch((error) => {
        console.error('❌ Error sembrando datos:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close();
        process.exit(process.exitCode ?? 0);
    });
