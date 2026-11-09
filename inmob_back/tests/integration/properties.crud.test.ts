import { describe, it, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import app from '../../src/app';
import Property from '../../src/models/Property';
import { createTestUser, authHeader } from '../helpers/auth';
import { validPropertyPayload, validPersistencePayload, TINY_PNG, imageAsset } from '../helpers/fixtures';
import { LocalImageStorage } from '../../src/services/localImageStorage';

const uploadsBase = process.env.UPLOADS_BASE_DIR!;
let editor: any;

beforeEach(async () => {
    editor = await createTestUser({ role: 'editor' });
});

describe('GET /api/properties/all', () => {
    it('returns only available properties by default, with pagination metadata', async () => {
        await Property.create(validPersistencePayload({ title: 'Available One' }));
        await Property.create(validPersistencePayload({ title: 'Sold One', status: 'sold' }));

        const res = await request(app).get('/api/properties/all');

        expect(res.status).toBe(200);
        expect(res.body.properties).toHaveLength(1);
        expect(res.body.properties[0].title).toBe('Available One');
        expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 1, pages: 1 });
        expect(res.body.sort).toEqual({ field: 'createdAt', order: 'desc' });
    });

    it('filters by an explicit status', async () => {
        await Property.create(validPersistencePayload({ status: 'sold' }));

        const res = await request(app).get('/api/properties/all?status=sold');

        expect(res.status).toBe(200);
        expect(res.body.properties).toHaveLength(1);
    });

    it('filters by the listingType field (regression test)', async () => {
        await Property.create(validPersistencePayload({ listingType: 'sale' }));
        await Property.create(validPersistencePayload({ listingType: 'rent' }));

        const res = await request(app).get('/api/properties/all?listingType=rent');

        expect(res.status).toBe(200);
        expect(res.body.properties).toHaveLength(1);
        expect(res.body.properties[0].listingType).toBe('rent');
        expect(res.body.filters.listingType).toBe('rent');
    });

    it('filters by price range and bedrooms', async () => {
        await Property.create(validPersistencePayload({ price: 50000, bedrooms: 1 }));
        await Property.create(validPersistencePayload({ price: 150000, bedrooms: 3 }));
        await Property.create(validPersistencePayload({ price: 500000, bedrooms: 5 }));

        const res = await request(app).get('/api/properties/all?minPrice=100000&maxPrice=200000&minBedrooms=2');

        expect(res.status).toBe(200);
        expect(res.body.properties).toHaveLength(1);
        expect(res.body.properties[0].price).toBe(150000);
    });

    it('searches location by regex on address and city', async () => {
        await Property.create(validPersistencePayload({
            location: { type: 'Point', coordinates: [-60.7, -31.63], address: 'Avellaneda 123', city: 'Santa Fe' },
        }));
        await Property.create(validPersistencePayload({
            location: { type: 'Point', coordinates: [-60.2, -31.4], address: 'Other 456', city: 'Rosario' },
        }));

        const byCity = await request(app).get('/api/properties/all?location=Rosario');
        expect(byCity.body.properties).toHaveLength(1);

        const byAddress = await request(app).get('/api/properties/all?location=Avellaneda');
        expect(byAddress.body.properties).toHaveLength(1);
        expect(byAddress.body.properties[0].location.city).toBe('Santa Fe');
    });

    it('escapes regex metacharacters in location (ReDoS regression test)', async () => {
        const res = await request(app).get('/api/properties/all?location=' + encodeURIComponent('((a+)+)$'));

        expect(res.status).toBe(200);
        expect(res.body.properties).toEqual([]);
    });

    it('returns 400 for a location query longer than 200 characters', async () => {
        const long = 'a'.repeat(201);
        const res = await request(app).get('/api/properties/all?location=' + long);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('200 characters');
    });

    it('paginates results', async () => {
        for (let i = 0; i < 3; i++) {
            await Property.create(validPersistencePayload({ title: `Page test ${i}` }));
        }

        const res = await request(app).get('/api/properties/all?limit=1&page=2');

        expect(res.status).toBe(200);
        expect(res.body.properties).toHaveLength(1);
        expect(res.body.pagination).toMatchObject({ page: 2, limit: 1, total: 3, pages: 3, hasNext: true, hasPrev: true });
    });
});

describe('GET /api/properties/getOne/:id', () => {
    it('returns a property by id', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app).get(`/api/properties/getOne/${property._id}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(property._id.toString());
        expect(res.body.title).toBe('Test Property');
    });

    it('returns 404 for a nonexistent id', async () => {
        const res = await request(app).get('/api/properties/getOne/507f1f77bcf86cd799439011');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Property not found');
    });

    it('returns 500 for a malformed id (documents current behavior)', async () => {
        const res = await request(app).get('/api/properties/getOne/not-an-id');

        expect(res.status).toBe(500);
    });
});

describe('POST /api/properties/create', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).post('/api/properties/create').send(validPropertyPayload());

        expect(res.status).toBe(401);
    });

    it('creates a property via JSON for an editor', async () => {
        const res = await request(app)
            .post('/api/properties/create')
            .set(authHeader(editor))
            .send(validPropertyPayload({ title: 'JSON Created' }));

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('JSON Created');
        expect(res.body.id).toBeDefined();

        const stored = await Property.findById(res.body.id);
        expect(stored).not.toBeNull();
    });

    it('returns 400 with field errors for invalid data', async () => {
        const res = await request(app)
            .post('/api/properties/create')
            .set(authHeader(editor))
            .send(validPropertyPayload({ price: -5, listingType: 'auction' }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        const fields = res.body.errors.map((e: any) => e.field);
        expect(fields).toContain('price');
        expect(fields).toContain('listingType');
    });

    it('creates a property with uploaded images via multipart and stores the files', async () => {
        const res = await request(app)
            .post('/api/properties/create')
            .set(authHeader(editor))
            .field('title', 'Multipart Created')
            .field('description', 'With images')
            .field('price', '120000')
            .field('bedrooms', '3')
            .field('bathrooms', '2')
            .field('area', '80')
            .field('propertyType', 'casa')
            .field('listingType', 'sale')
            .field('currency', 'USD')
            .field('location', JSON.stringify({ latitude: -31.63, longitude: -60.7, address: 'Mp 123', city: 'Santa Fe' }))
            .attach('images', TINY_PNG, 'a.png')
            .attach('images', TINY_PNG, 'b.png');

        expect(res.status).toBe(201);
        expect(res.body.images).toHaveLength(2);

        for (const image of res.body.images) {
            expect(image.publicId).toMatch(new RegExp(`^properties/${res.body.id}/.+`));
            const relative = image.url.match(/\/uploads\/(.+)$/)?.[1];
            expect(relative).toBeDefined();
            const stat = await fs.stat(path.join(uploadsBase, relative!));
            expect(stat.size).toBe(TINY_PNG.length);
        }
    });

    it('creates a featured property via multipart and resolves featuredImageId from the chosen upload', async () => {
        const res = await request(app)
            .post('/api/properties/create')
            .set(authHeader(editor))
            .field('title', 'Featured Multipart')
            .field('description', 'Featured with images')
            .field('price', '120000')
            .field('currency', 'USD')
            .field('bedrooms', '3')
            .field('bathrooms', '2')
            .field('area', '80')
            .field('propertyType', 'casa')
            .field('listingType', 'sale')
            .field('featured', 'true')
            .field('featuredImageIndex', '1')
            .field('location', JSON.stringify({ latitude: -31.63, longitude: -60.7, address: 'Mp 456', city: 'Santa Fe' }))
            .attach('images', TINY_PNG, 'a.png')
            .attach('images', TINY_PNG, 'b.png');

        expect(res.status).toBe(201);
        expect(res.body.featured).toBe(true);
        expect(res.body.featuredImageId).toBe(res.body.images[1].publicId);
    });

    it('rejects a featured property created without images', async () => {
        const res = await request(app)
            .post('/api/properties/create')
            .set(authHeader(editor))
            .send(validPropertyPayload({ featured: true }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.errors.map((e: any) => e.field)).toContain('featured');
    });
});

describe('PUT /api/properties/update/:id', () => {
    it('returns 401 without authentication', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app).put(`/api/properties/update/${property._id}`).send({ price: 1 });

        expect(res.status).toBe(401);
    });

    it('applies whitelisted field updates', async () => {
        const property = await Property.create(validPersistencePayload({ price: 100000 }));

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ price: 250000, status: 'reserved' });

        expect(res.status).toBe(200);
        expect(res.body.price).toBe(250000);
        expect(res.body.status).toBe('reserved');
    });

    it('ignores non-whitelisted fields (field whitelist)', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ price: 111111, createdAt: '2099-01-01T00:00:00.000Z', __v: 42 });

        expect(res.status).toBe(200);
        expect(res.body.price).toBe(111111);
        expect(res.body.createdAt).not.toBe('2099-01-01T00:00:00.000Z');
    });

    it('returns 400 when no valid fields are provided', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ unknownField: true });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No valid fields provided for update');
    });

    it('returns 400 for invalid update values', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ price: -10 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
    });

    it('returns 404 for a nonexistent id', async () => {
        const res = await request(app)
            .put('/api/properties/update/507f1f77bcf86cd799439011')
            .set(authHeader(editor))
            .send({ price: 100 });

        expect(res.status).toBe(404);
    });

    it('deletes removed image files from local storage when the images array is updated', async () => {
        const storage = new LocalImageStorage();
        const kept = await storage.uploadImage(TINY_PNG, 'properties/update-kept');
        const removed = await storage.uploadImage(TINY_PNG, 'properties/update-removed');

        const keptAsset = { url: kept.url, publicId: kept.publicId };
        const removedAsset = { url: removed.url, publicId: removed.publicId };
        const property = await Property.create(validPersistencePayload({ images: [keptAsset, removedAsset] }));
        const removedPath = path.join(uploadsBase, removed.publicId);
        await fs.stat(removedPath); // exists before update

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ images: [keptAsset] });

        expect(res.status).toBe(200);
        expect(res.body.images).toEqual([keptAsset]);
        await expect(fs.stat(removedPath)).rejects.toThrow(); // file deleted
    });
    it('rejects featuring a property whose featuredImageId is not in the images array', async () => {
        const property = await Property.create(validPersistencePayload({
            images: [imageAsset('properties/x/keep')]
        }));

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ featured: true, featuredImageId: 'properties/x/ghost' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.errors[0].field).toBe('featuredImageId');
    });

    it('accepts featuring a property when featuredImageId resolves against the merged images', async () => {
        const property = await Property.create(validPersistencePayload({
            images: [imageAsset('properties/x/a')]
        }));

        const res = await request(app)
            .put(`/api/properties/update/${property._id}`)
            .set(authHeader(editor))
            .send({ featured: true, featuredImageId: 'properties/x/a' });

        expect(res.status).toBe(200);
        expect(res.body.featured).toBe(true);
        expect(res.body.featuredImageId).toBe('properties/x/a');
    });
});

describe('DELETE /api/properties/delete/:id (soft delete)', () => {
    it('returns 401 without authentication', async () => {
        const property = await Property.create(validPersistencePayload());

        const res = await request(app).delete(`/api/properties/delete/${property._id}`);

        expect(res.status).toBe(401);
    });

    it('soft-deletes the property: hidden from reads, images kept, storage untouched', async () => {
        const storage = new LocalImageStorage();
        const upload = await storage.uploadImage(TINY_PNG, 'properties/delete-me');
        const filePath = path.join(uploadsBase, upload.publicId);
        await fs.stat(filePath); // exists

        const property = await Property.create(
            validPersistencePayload({ images: [{ url: upload.url, publicId: upload.publicId }] })
        );

        const res = await request(app)
            .delete(`/api/properties/delete/${property._id}`)
            .set(authHeader(editor));

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Property deleted successfully');

        // El documento sigue existiendo, marcado con deletedAt
        const stored = await Property.findById(property._id);
        expect(stored).not.toBeNull();
        expect(stored!.deletedAt).toBeInstanceOf(Date);

        // Excluido del listado por defecto y de las búsquedas por id
        const list = await request(app).get('/api/properties/all');
        expect(list.body.properties.map((p: any) => p.id)).not.toContain(property._id.toString());
        const byId = await request(app).get(`/api/properties/getOne/${property._id}`);
        expect(byId.status).toBe(404);

        // Las imágenes del storage se conservan (el soft delete es recuperable)
        await expect(fs.stat(filePath)).resolves.toBeDefined();
    });

    it('returns 404 for a nonexistent id or an already deleted property', async () => {
        const property = await Property.create(validPersistencePayload());
        await Property.updateOne({ _id: property._id }, { $set: { deletedAt: new Date() } });

        const res = await request(app)
            .delete(`/api/properties/delete/${property._id}`)
            .set(authHeader(editor));

        expect(res.status).toBe(404);

        const ghost = await request(app)
            .delete('/api/properties/delete/507f1f77bcf86cd799439011')
            .set(authHeader(editor));

        expect(ghost.status).toBe(404);
    });
});
