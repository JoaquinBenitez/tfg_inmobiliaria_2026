import fs from 'fs';
import os from 'os';
import path from 'path';

// Setear variables de entorno ANTES de importar cualquier módulo de src (src/config/env.ts valida al importar)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_that_is_at_least_32_characters_long_1234567890';
process.env.MONGODB_URI = 'mongodb://localhost:27017/inmob_test_placeholder';
process.env.IMAGE_STORAGE_TYPE = 'local';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

// Directorio de uploads aislado por corrida de test
const uploadsBase = path.join(os.tmpdir(), `inmob-test-uploads-${process.pid}-${Date.now()}`);
fs.mkdirSync(uploadsBase, { recursive: true });
process.env.UPLOADS_BASE_DIR = uploadsBase;

// Importar después de que el env esté configurado
const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = await import('mongoose');
const { default: Property } = await import('../src/models/Property');
const { default: User } = await import('../src/models/User');
const { default: SiteSettings } = await import('../src/models/SiteSettings');
const { default: Metric } = await import('../src/models/Metric');
const { default: JobLog } = await import('../src/models/JobLog');

let mongod: import('mongodb-memory-server').MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri('inmob_test');
    await mongoose.connect(uri);
    // Construir índices explícitamente (2dsphere lo requieren los tests geoespaciales)
    await Promise.all([
        Property.syncIndexes(),
        User.syncIndexes(),
        SiteSettings.syncIndexes(),
        Metric.syncIndexes(),
        JobLog.syncIndexes(),
    ]);
});

afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const name of Object.keys(collections)) {
            await collections[name].deleteMany({});
        }
    }
});

afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }
    if (mongod) {
        await mongod.stop();
    }
    fs.rmSync(uploadsBase, { recursive: true, force: true });
});
