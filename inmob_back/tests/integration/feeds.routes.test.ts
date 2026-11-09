import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import Property from '../../src/models/Property';
import mongoose from 'mongoose';
import { validPersistencePayload, imageAsset } from '../helpers/fixtures';

// Ids fijos: la caché del feed sobrevive entre tests (TTL a nivel módulo), así que los seeds
// deben ser estables en contenido para que las aserciones valgan contra un body cacheado.
const ID_A = new mongoose.Types.ObjectId('507f1f77bcf86cd7994390aa');
const ID_B = new mongoose.Types.ObjectId('507f1f77bcf86cd7994390bb');
const ID_SOLD = new mongoose.Types.ObjectId('507f1f77bcf86cd7994390cc');
const ID_DELETED = new mongoose.Types.ObjectId('507f1f77bcf86cd7994390dd');

const withImages = (overrides: Record<string, unknown> = {}) => ({
    ...validPersistencePayload({
        title: 'Feed Property',
        images: [imageAsset('feed-1'), imageAsset('feed-2')],
        ...overrides
    })
});

// setup.ts clears collections after each test — reseed before every test
async function seed(): Promise<{ availableIds: string[]; excludedIds: string[] }> {
    await Property.deleteMany({});
    await Property.create([
        withImages({ _id: ID_A, title: 'Casa disponible', location: { type: 'Point', coordinates: [-59.65, -29.15], address: 'Av. San Martín & Cía <123>', city: 'Reconquista' } }),
        withImages({ _id: ID_B, title: 'Depto disponible', listingType: 'rent', price: 250000, currency: 'ARS' })
    ]);
    await Property.create([
        withImages({ _id: ID_SOLD, title: 'Casa vendida', status: 'sold' }),
        withImages({ _id: ID_DELETED, title: 'Casa eliminada', deletedAt: new Date() })
    ]);
    return {
        availableIds: [String(ID_A), String(ID_B)],
        excludedIds: [String(ID_SOLD), String(ID_DELETED)]
    };
}

describe('GET /api/feeds', () => {
    beforeEach(async () => {
        await seed();
    });

    it('serves the XML feed with available properties only', async () => {
        const ids = { availableIds: [String(ID_A), String(ID_B)], excludedIds: [String(ID_SOLD), String(ID_DELETED)] };
        const res = await request(app).get('/api/feeds/properties.xml');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('xml');
        expect(res.headers['cache-control']).toBe('public, max-age=900');
        expect(res.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(res.text.endsWith('</inmuebles>')).toBe(true);

        for (const id of ids.availableIds) {
            expect(res.text).toContain(`<codigoInmueble>${id}</codigoInmueble>`);
        }
        for (const id of ids.excludedIds) {
            expect(res.text).not.toContain(`<codigoInmueble>${id}</codigoInmueble>`);
        }
        // Escapado XML de caracteres inseguros en el texto de la dirección
        expect(res.text).toContain('Av. San Martín &amp; Cía &lt;123&gt;');
        // Traducción de enums en el listado de alquiler
        expect(res.text).toContain('<operacion>alquiler</operacion>');
    });

    it('serves the JSON feed as a parseable canonical document', async () => {
        const ids = { availableIds: [String(ID_A), String(ID_B)] };
        const res = await request(app).get('/api/feeds/properties.json');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=900');

        const doc = JSON.parse(res.text);
        expect(doc.total).toBe(2);
        expect(doc.inmuebles).toHaveLength(2);
        const codes = doc.inmuebles.map((item: { codigoInmueble: string }) => item.codigoInmueble);
        for (const id of ids.availableIds) {
            expect(codes).toContain(id);
        }
        for (const item of doc.inmuebles) {
            expect(item).toMatchObject({
                operacion: expect.any(String),
                tipoPropiedad: expect.any(String),
                precio: expect.any(Number),
                moneda: expect.stringMatching(/^(USD|ARS)$/),
                imagenes: expect.arrayContaining([expect.stringContaining('feed-1')]),
                urlDetalle: expect.stringContaining('/propiedades/')
            });
        }
    });

    it('caches the rendered feed within the TTL window', async () => {
        const first = await request(app).get('/api/feeds/properties.json');
        const second = await request(app).get('/api/feeds/properties.json');
        expect(second.text).toBe(first.text);
    });
});
