import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import Property from '../../src/models/Property';
import { validPropertyPayload, validPersistencePayload } from '../helpers/fixtures';

let p1: any, p2: any, p3: any, p4: any, p5: any, p6: any;

beforeEach(async () => {
    p1 = await Property.create(validPersistencePayload({
        title: 'Casa Santa Fe', propertyType: 'casa', listingType: 'sale', price: 100000, bedrooms: 2,
        location: { type: 'Point', coordinates: [-60.7, -31.6333], address: 'Uno 123', city: 'Santa Fe' },
    }));
    p2 = await Property.create(validPersistencePayload({
        title: 'Casa Rosario destacada', propertyType: 'casa', listingType: 'sale', price: 200000, bedrooms: 3,
        featured: true, images: [{ url: 'http://example.com/p2.jpg', publicId: 'p2' }], featuredImageId: 'p2',
        location: { type: 'Point', coordinates: [-60.64, -32.95], address: 'Dos 456', city: 'Rosario' },
    }));
    p3 = await Property.create(validPersistencePayload({
        title: 'Depto Santa Fe', propertyType: 'departamento', listingType: 'rent', price: 500, bedrooms: 1,
        location: { type: 'Point', coordinates: [-60.71, -31.64], address: 'Tres 789', city: 'Santa Fe' },
    }));
    p4 = await Property.create(validPersistencePayload({
        title: 'Casa reservada', propertyType: 'casa', listingType: 'sale', price: 300000, bedrooms: 5, status: 'reserved',
        location: { type: 'Point', coordinates: [-60.7, -31.63], address: 'Cuatro 000', city: 'Santa Fe' },
    }));
    p5 = await Property.create(validPersistencePayload({
        title: 'Oficina Rosario', propertyType: 'oficina', listingType: 'rent', price: 800, bedrooms: 2,
        location: { type: 'Point', coordinates: [-60.63, -32.94], address: 'Cinco 111', city: 'Rosario' },
    }));
    p6 = await Property.create(validPersistencePayload({
        title: 'Terreno Esperanza', propertyType: 'terreno', listingType: 'sale', price: 50000, bedrooms: 0,
        location: { type: 'Point', coordinates: [-60.9, -31.44], address: 'Seis 222', city: 'Esperanza' },
    }));
});

describe('GET /api/properties/search (simple)', () => {
    it('filters by listing type and property type', async () => {
        const res = await request(app).get('/api/properties/search?listingType=sale&propertyType=casa');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const ids = res.body.map((p: any) => p.id);
        expect(ids).toEqual(expect.arrayContaining([p1._id.toString(), p2._id.toString(), p4._id.toString()]));
        expect(ids).not.toContain(p5._id.toString());
    });

    it('treats bedrooms=4 as 4 or more', async () => {
        const res = await request(app).get('/api/properties/search?bedrooms=4');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Casa reservada');
    });

    it('filters by exact city (case-insensitive via cityLower)', async () => {
        const res = await request(app).get('/api/properties/search?city=santa fe');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });
});

describe('GET /api/properties/search/advanced', () => {
    it('filters by type and status', async () => {
        const res = await request(app).get('/api/properties/search/advanced?listingType=sale&status=available');

        expect(res.status).toBe(200);
        const ids = res.body.map((p: any) => p.id);
        expect(ids).toEqual(expect.arrayContaining([p1._id.toString(), p2._id.toString(), p6._id.toString()]));
        expect(ids).not.toContain(p4._id.toString()); // reserved
        expect(ids).not.toContain(p3._id.toString()); // rent
    });

    it('accepts multiple property types (comma-separated)', async () => {
        const res = await request(app).get('/api/properties/search/advanced?propertyTypes=casa,departamento');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(4); // p1, p2, p3, p4
    });

    it('accepts multiple cities', async () => {
        const res = await request(app).get('/api/properties/search/advanced?cities=Santa Fe,Rosario');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(5); // p1..p5
    });

    it('filters by price range', async () => {
        const res = await request(app).get('/api/properties/search/advanced?minPrice=80000&maxPrice=250000');

        expect(res.status).toBe(200);
        const titles = res.body.map((p: any) => p.title);
        expect(titles).toEqual(expect.arrayContaining(['Casa Santa Fe', 'Casa Rosario destacada']));
        expect(titles).not.toContain('Terreno Esperanza');
    });

    it('filters by bedroom range', async () => {
        const res = await request(app).get('/api/properties/search/advanced?minBedrooms=2&maxBedrooms=3');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3); // p1, p2, p5
    });

    it('combines multiple filters', async () => {
        const res = await request(app).get('/api/properties/search/advanced?listingType=rent&cities=Rosario&minPrice=600');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Oficina Rosario');
    });
});

describe('GET /api/properties/featured', () => {
    it('returns only featured properties', async () => {
        const res = await request(app).get('/api/properties/featured');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Casa Rosario destacada');
        expect(res.body[0].featured).toBe(true);
    });
});

describe('filter option endpoints', () => {
    it('GET /filters/locations returns the city list', async () => {
        const res = await request(app).get('/api/properties/filters/locations');

        expect(res.status).toBe(200);
        const ids = res.body.map((o: any) => o.id);
        expect(ids).toContain('santa-fe');
        expect(ids).toContain('rosario');
    });

    it('GET /filters/bedrooms returns the bedroom options', async () => {
        const res = await request(app).get('/api/properties/filters/bedrooms');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(4);
        expect(res.body[3]).toEqual({ id: '4', label: '4+' });
    });

    it('GET /filters/property-types returns all five types', async () => {
        const res = await request(app).get('/api/properties/filters/property-types');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(5);
    });
});
