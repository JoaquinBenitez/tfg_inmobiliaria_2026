/**
 * Migración de datos del Batch 2 (correctness-process-plan.md, C8).
 *
 * Backfill del campo normalizado e indexado `cityLower` a partir de `location.city`
 * para cada documento de propiedad existente.
 *
 * Idempotente: los documentos con cityLower no vacío se saltean.
 * Ejecutar: npm run migrate:batch2
 */
import mongoose from 'mongoose';


function normalizeCity(city: string): string {
    return city.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function main(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is required');
        process.exit(1);
    }

    await mongoose.connect(uri);
    const collection = mongoose.connection.collection('properties');

    const docs = await collection.find(
        {},
        { projection: { 'location.city': 1, cityLower: 1 } }
    ).toArray() as unknown as { _id: mongoose.Types.ObjectId; location?: { city?: string }; cityLower?: string }[];

    let backfilled = 0, skipped = 0;

    for (const doc of docs) {
        const city = doc.location?.city;
        if (!city) {
            skipped++;
            continue;
        }
        const normalized = normalizeCity(city);
        if (doc.cityLower === normalized) {
            skipped++;
            continue;
        }
        await collection.updateOne({ _id: doc._id }, { $set: { cityLower: normalized } });
        backfilled++;
    }

    console.log(`Migration complete: ${docs.length} documents`);
    console.log(`  cityLower backfilled: ${backfilled}`);
    console.log(`  already normalized (skipped): ${skipped}`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
