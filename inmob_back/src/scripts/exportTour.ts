/**
 * Exporta el recorrido 360° configurado a mano (TourBuilder) a `seed-assets/tours/`
 * para que la semilla lo reproduzca EXACTO en cualquier instalación (profesores,
 * docker compose, --force). Caso B de "guardarlo y usarlo".
 *
 * Uso:
 *   npm run export-tour                        # exporta el tour de la primera
 *                                              # propiedad que tenga escenas
 *   npm run export-tour -- <propertyId>        # exporta el de esa propiedad
 *   npm run export-tour -- <propertyId> 3      # ...forzando N° de propiedad (3)
 *
 * Genera:
 *   seed-assets/tours/tour-N.json   → config exacta (escenas, vistas, hotspots)
 *   seed-assets/tours/N-*.webp      → la panorámica de cada escena (variante
 *                                     desktop webp ya almacenada; se re-procesa
 *                                     al sembrar, sin pérdida funcional)
 *
 * Requiere IMAGE_STORAGE_TYPE=local (lee los archivos de ./uploads).
 * Después de exportar: `npm run seed -- --force` (o el equivalente Docker).
 */
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { connectDB } from '../config/database';
import Property from '../models/Property';
import { DEMO_PROPERTIES } from './demoProperties';
import { IProperty } from '../models/Property';

const [, , propertyArg, nArg] = process.argv;

const slugify = (text: string): string =>
    text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

async function main(): Promise<void> {
    await connectDB();

    const property: IProperty | null = propertyArg
        ? await Property.findById(propertyArg)
        : await Property.findOne({ 'tour.scenes.0': { $exists: true } });

    if (!property || !property.tour || property.tour.scenes.length === 0) {
        console.error('❌ No se encontró una propiedad con recorrido 360°. Pasá un id: npm run export-tour -- <propertyId>');
        process.exitCode = 1;
        return;
    }

    // N° de propiedad = posición en DEMO_PROPERTIES (por título). Si no coincide
    // (propiedad creada a mano), se puede forzar como segundo argumento.
    let n = DEMO_PROPERTIES.findIndex((p) => p.title === property.title) + 1;
    if (n === 0) {
        if (!nArg) {
            console.error(`❌ "${property.title}" no está en demoProperties.ts. Forzá el número: npm run export-tour -- ${property._id} <N>`);
            process.exitCode = 1;
            return;
        }
        n = parseInt(nArg, 10);
    }
    if (!Number.isInteger(n) || n < 1 || n > DEMO_PROPERTIES.length) {
        console.error(`❌ N inválido (1..${DEMO_PROPERTIES.length}).`);
        process.exitCode = 1;
        return;
    }

    const uploadsDir = process.env.UPLOADS_BASE_DIR || path.join(process.cwd(), 'uploads');
    const outDir = path.join(process.cwd(), 'seed-assets', 'tours');
    await fs.mkdir(outDir, { recursive: true });

    const nameById = new Map(property.tour.scenes.map((s) => [s.id, s.name]));
    const scenes: Array<{
        file: string;
        name: string;
        initialView: { pitch: number; yaw: number; fov: number };
        coverage: unknown;
        hotspots: Array<{ to: string; pitch: number; yaw: number; label: string }>;
    }> = [];
    const usedFiles = new Set<string>();

    for (const scene of property.tour.scenes) {
        const source = path.join(uploadsDir, scene.image.publicId); // variante desktop webp
        let buffer: Buffer;
        try {
            buffer = await fs.readFile(source);
        } catch {
            console.warn(`⚠️  Escena "${scene.name}": no se pudo leer ${scene.image.publicId} (¿storage no local o archivo borrado?) → se omite`);
            continue;
        }
        const ext = (path.extname(scene.image.publicId) || '.webp').slice(1);
        let file = `${n}-${slugify(scene.name) || 'escena'}.${ext}`;
        let i = 2;
        while (usedFiles.has(file)) file = `${n}-${slugify(scene.name) || 'escena'}-${i++}.${ext}`;
        usedFiles.add(file);
        await fs.writeFile(path.join(outDir, file), buffer);
        scenes.push({
            file,
            name: scene.name,
            initialView: scene.initialView,
            coverage: scene.coverage ?? null,
            hotspots: scene.hotspots.map((h) => ({
                to: nameById.get(h.toScene) ?? h.toScene,
                pitch: h.pitch,
                yaw: h.yaw,
                label: h.label
            }))
        });
    }

    if (scenes.length === 0) {
        console.error('❌ Ninguna escena pudo exportarse (¿storage no local?).');
        process.exitCode = 1;
        return;
    }

    // Hotspots que apuntan a escenas que no se exportaron → se descartan
    const exported = new Set(scenes.map((s) => s.name));
    for (const s of scenes) {
        const before = s.hotspots.length;
        s.hotspots = s.hotspots.filter((h) => exported.has(h.to));
        if (s.hotspots.length < before) {
            console.warn(`⚠️  Escena "${s.name}": ${before - s.hotspots.length} hotspot(s) apuntaban a escenas omitidas → descartados`);
        }
    }

    const json = {
        property: n,
        propertyTitle: property.title,
        exportedAt: new Date().toISOString(),
        scenes
    };
    const jsonFile = path.join(outDir, `tour-${n}.json`);
    await fs.writeFile(jsonFile, `${JSON.stringify(json, null, 2)}\n`);

    console.log(`✅ Tour de "${property.title}" exportado a seed-assets/tours/:`);
    console.log(`   tour-${n}.json (${scenes.length} escenas, ${scenes.reduce((a, s) => a + s.hotspots.length, 0)} hotspots)`);
    for (const s of scenes) console.log(`   ${s.file} → "${s.name}"`);
    console.log('');
    console.log('▶ Para reproducirlo en cualquier instalación:');
    console.log('   npm run seed -- --force        (manual)');
    console.log('   docker compose run --rm seed npm run seed -- --force   (Docker, con el bind de seed-assets)');
}

main()
    .catch((error) => {
        console.error('❌ Error exportando el tour:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close();
        process.exit(process.exitCode ?? 0);
    });
