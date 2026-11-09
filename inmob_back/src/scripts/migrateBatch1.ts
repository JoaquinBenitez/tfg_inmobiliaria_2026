/**
 * Migración de datos del Batch 1 (correctness-process-plan.md, C1–C4).
 *
 * Transforma los documentos Property existentes al nuevo schema:
 *   - `type`            → `listingType`                      (C2)
 *   - `images: string[]`→ `images: [{ url, publicId }]`      (C1)
 *   - `featuredImage`   → `featuredImageId` (publicId ref)   (C1)
 *   - `currency`        → backfill (rent→ARS, sale→USD)      (C3)
 *   - `deletedAt`       → defaults to null via schema        (C4)
 *
 * Idempotente: los documentos ya migrados se saltean.
 * Ejecutar: npm run migrate:batch1
 */
import mongoose from 'mongoose';
import { extractStorageId } from '../domain/storageId';
import { logger } from '../config/logger';


interface LegacyProperty {
    _id: mongoose.Types.ObjectId;
    type?: string;
    listingType?: string;
    images?: unknown;
    featuredImage?: string;
    featuredImageId?: string;
    currency?: string;
    deletedAt?: unknown;
}

function toImageAssets(images: unknown): { url: string; publicId: string }[] | null {
    if (!Array.isArray(images) || images.length === 0) return null;
    const converted: { url: string; publicId: string }[] = [];
    for (const entry of images) {
        if (typeof entry !== 'string') return null; // ya son objetos → no es legacy
        const publicId = extractStorageId(entry);
        if (!publicId) {
            logger.warn({ url: entry }, 'Could not extract publicId — keeping URL string as publicId');
        }
        converted.push({ url: entry, publicId: publicId ?? entry });
    }
    return converted;
}

async function main(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is required');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const collection = mongoose.connection.collection('properties');

    const docs = await collection.find({}, { projection: { type: 1, listingType: 1, images: 1, featuredImage: 1, featuredImageId: 1, currency: 1 } }).toArray() as unknown as LegacyProperty[];

    let renamed = 0, imagesConverted = 0, featuredConverted = 0, currencySet = 0, deletedAtStamped = 0, skipped = 0;

    for (const doc of docs) {
        const update: Record<string, unknown> = {};
        const unset: Record<string, unknown> = {};

        if (doc.type && !doc.listingType) {
            update.listingType = doc.type;
            unset.type = '';
            renamed++;
        }

        const converted = toImageAssets(doc.images);
        if (converted) {
            update.images = converted;
            imagesConverted++;
        }

        // featuredImage (URL) → featuredImageId (publicId), resuelto contra el array de imágenes
        if (doc.featuredImage) {
            const source = (converted ?? (Array.isArray(doc.images) ? doc.images : [])) as Array<string | { url: string; publicId: string }>;
            const match = source.find((entry) => (typeof entry === 'string' ? entry === doc.featuredImage : entry.url === doc.featuredImage));
            update.featuredImageId = match ? (typeof match === 'string' ? (extractStorageId(match) ?? match) : match.publicId) : '';
            unset.featuredImage = '';
            featuredConverted++;
        }

        if (!doc.currency) {
            const listingType = (update.listingType as string | undefined) ?? doc.listingType ?? doc.type;
            update.currency = listingType === 'rent' ? 'ARS' : 'USD';
            currencySet++;
        }

        // Respuestas uniformes: las consultas lean() pisan los defaults de mongoose, así que se marca el campo explícitamente
        if (doc.deletedAt === undefined) {
            update.deletedAt = null;
            deletedAtStamped++;
        }

        if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
            skipped++;
            continue;
        }

        await collection.updateOne(
            { _id: doc._id },
            {
                ...(Object.keys(update).length > 0 ? { $set: update } : {}),
                ...(Object.keys(unset).length > 0 ? { $unset: unset } : {})
            }
        );
    }

    console.log(`Migration complete: ${docs.length} documents`);
    console.log(`  type → listingType:        ${renamed}`);
    console.log(`  images → objects:          ${imagesConverted}`);
    console.log(`  featuredImage → featuredImageId: ${featuredConverted}`);
    console.log(`  currency backfilled:       ${currencySet}`);
    console.log(`  deletedAt stamped:         ${deletedAtStamped}`);
    console.log(`  already migrated (skipped): ${skipped}`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
