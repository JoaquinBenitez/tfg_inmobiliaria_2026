import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import Property from '../../src/models/Property';
import { validPropertyPayload, validPersistencePayload } from '../helpers/fixtures';

let sfCenter: any, sfNearby: any, buenosAires: any;

beforeEach(async () => {
    sfCenter = await Property.create(validPersistencePayload({
        title: 'Santa Fe Center',
        location: { type: 'Point', coordinates: [-60.7, -31.6333], address: 'SF 1', city: 'Santa Fe' },
    }));
    sfNearby = await Property.create(validPersistencePayload({
        title: 'Santa Fe Nearby',
        location: { type: 'Point', coordinates: [-60.69, -31.63], address: 'SF 2', city: 'Santa Fe' },
    }));
    buenosAires = await Property.create(validPersistencePayload({
        title: 'Buenos Aires',
        location: { type: 'Point', coordinates: [-58.3816, -34.6038], address: 'BA 1', city: 'Buenos Aires' },
    }));
});

describe('GET /api/properties/nearby', () => {
    it('returns properties within a small radius, sorted by distance', async () => {
        const res = await request(app).get('/api/properties/nearby?lat=-31.6333&lng=-60.7&radius=5');

        expect(res.status).toBe(200);
        expect(res.body.center).toEqual({ lat: -31.6333, lng: -60.7 });
        expect(res.body.radius).toBe(5);
        expect(res.body.count).toBe(2);

        const titles = res.body.properties.map((p: any) => p.title);
        expect(titles[0]).toBe('Santa Fe Center'); // closest first
        expect(titles).toContain('Santa Fe Nearby');
        expect(titles).not.toContain('Buenos Aires');

        for (const prop of res.body.properties) {
            expect(prop.distance).toBeLessThanOrEqual(5);
            // distancia redondeada a 2 decimales
            expect(Number(prop.distance.toFixed(2))).toBe(prop.distance);
        }
    });

    it('includes distant properties when the radius is large', async () => {
        const res = await request(app).get('/api/properties/nearby?lat=-31.6333&lng=-60.7&radius=600');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(3);
        expect(res.body.properties[2].title).toBe('Buenos Aires'); // farthest last
    });

    it('returns 400 when lat or lng is missing', async () => {
        const res = await request(app).get('/api/properties/nearby?lat=-31.6333');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Latitude and longitude are required');
    });

    it('returns 400 for non-numeric coordinates', async () => {
        const res = await request(app).get('/api/properties/nearby?lat=abc&lng=-60.7');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid latitude, longitude, or radius values');
    });
});

describe('GET /api/properties/bounds', () => {
    it('returns properties inside the map viewport', async () => {
        // Caja alrededor de Santa Fe solamente
        const res = await request(app).get('/api/properties/bounds?neLat=-31.60&neLng=-60.68&swLat=-31.65&swLng=-60.72');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        const titles = res.body.properties.map((p: any) => p.title);
        expect(titles).not.toContain('Buenos Aires');
    });

    it('returns only Buenos Aires for a viewport around it', async () => {
        const res = await request(app).get('/api/properties/bounds?neLat=-34.5&neLng=-58.3&swLat=-34.7&swLng=-58.45');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.properties[0].title).toBe('Buenos Aires');
    });

    it('returns 400 when a bound is missing', async () => {
        const res = await request(app).get('/api/properties/bounds?neLat=-31.6&neLng=-60.7&swLat=-31.7');

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('All bounds coordinates are required');
    });

    it('returns 400 for non-numeric bounds', async () => {
        const res = await request(app).get('/api/properties/bounds?neLat=x&neLng=-60.7&swLat=-31.7&swLng=-60.8');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid coordinate values');
    });
});
