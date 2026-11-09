import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import app from '../../src/app';
import Property from '../../src/models/Property';
import { createTestUser, authHeader } from '../helpers/auth';
import { validPersistencePayload } from '../helpers/fixtures';

const uploadsBase = process.env.UPLOADS_BASE_DIR!;

let editor: any;
let property: any;
let fullPano: Buffer;
let partialPano: Buffer;

async function syntheticPanorama(width: number, height: number): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 90, g: 120, b: 160 }
        }
    }).jpeg({ quality: 80 }).toBuffer();
}

beforeEach(async () => {
    editor = await createTestUser({ role: 'editor' });
    property = await Property.create(validPersistencePayload());
    fullPano = await syntheticPanorama(2048, 1024); // 2:1 → full sphere
    partialPano = await syntheticPanorama(3072, 1024); // 3:1 → partial coverage
});

describe('POST /api/properties/:id/tour/scenes', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .attach('panorama', fullPano, 'pano.jpg');

        expect(res.status).toBe(401);
    });

    it('returns 404 for a nonexistent property', async () => {
        const res = await request(app)
            .post('/api/properties/507f1f77bcf86cd799439011/tour/scenes')
            .set(authHeader(editor))
            .attach('panorama', fullPano, 'pano.jpg');

        expect(res.status).toBe(404);
    });

    it('returns 400 when no file is attached', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .field('name', 'Living');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/panorama/i);
    });

    it('rejects a non-panoramic image with a domain error', async () => {
        const small = await syntheticPanorama(1200, 800);
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .attach('panorama', small, 'photo.jpg');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/chica|panorámica/);
    });

    it('uploads a full-sphere scene with 5 variants on disk and no coverage', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .field('name', 'Living')
            .attach('panorama', fullPano, 'pano.jpg');

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Scene uploaded');
        const scene = res.body.scene;
        expect(scene.name).toBe('Living');
        expect(scene.coverage).toBeUndefined(); // 2:1 source → full sphere
        expect(scene.initialView).toEqual({ pitch: 0, yaw: 0, fov: 75 });
        expect(scene.image.width).toBe(2048);
        expect(scene.image.height).toBe(1024);

        // All 5 variants stored under tours/<propertyId>/ with real files
        const urls = [
            scene.image.url,
            scene.image.avifUrl,
            scene.image.mobileUrl,
            scene.image.mobileAvifUrl,
            scene.image.posterUrl
        ];
        for (const url of urls) {
            expect(url).toMatch(new RegExp(`^http://localhost:3000/uploads/tours/${property._id}/`));
            const relative = url.match(/\/uploads\/(.+)$/)?.[1];
            await fs.stat(path.join(uploadsBase, relative!));
        }
        expect(scene.image.publicId.endsWith('.webp')).toBe(true);
        expect(scene.image.avifPublicId!.endsWith('.avif')).toBe(true);

        // Tour visible en el DTO de la propiedad
        const detail = await request(app).get(`/api/properties/getOne/${property._id}`);
        expect(detail.body.tour.scenes).toHaveLength(1);
    });

    it('assigns default coverage to a partial panorama', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .attach('panorama', partialPano, 'pano.jpg');

        expect(res.status).toBe(201);
        const coverage = res.body.scene.coverage;
        expect(coverage).toBeDefined();
        expect(coverage.minYaw).toBeLessThan(coverage.maxYaw);
        expect(coverage.maxPitch - coverage.minPitch).toBeGreaterThan(0);
    });

    it('defaults scene names when not provided', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .attach('panorama', fullPano, 'pano.jpg');

        expect(res.status).toBe(201);
        expect(res.body.scene.name).toBe('Escena 1');
    });
});

describe('GET /api/properties/:id/tour', () => {
    it('returns an empty tour when none exists', async () => {
        const res = await request(app).get(`/api/properties/${property._id}/tour`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ enabled: false, scenes: [] });
    });

    it('returns 404 for a nonexistent property', async () => {
        const res = await request(app).get('/api/properties/507f1f77bcf86cd799439011/tour');
        expect(res.status).toBe(404);
    });
});

describe('PATCH /api/properties/:id/tour', () => {
    let sceneA: any;
    let sceneB: any;

    beforeEach(async () => {
        const resA = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .field('name', 'Living')
            .attach('panorama', fullPano, 'pano.jpg');
        const resB = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .field('name', 'Cocina')
            .attach('panorama', partialPano, 'pano.jpg');
        sceneA = resA.body.scene;
        sceneB = resB.body.scene;
    });

    it('returns 401 without authentication', async () => {
        const res = await request(app).patch(`/api/properties/${property._id}/tour`).send({});
        expect(res.status).toBe(401);
    });

    it('reorders scenes, sets initial views and hotspots, and enables the tour', async () => {
        const res = await request(app)
            .patch(`/api/properties/${property._id}/tour`)
            .set(authHeader(editor))
            .send({
                enabled: true,
                scenes: [
                    { id: sceneB.id, name: 'Cocina principal', initialView: { pitch: 10, yaw: -30, fov: 60 } },
                    { id: sceneA.id }
                ],
                scenes: [
                    { id: sceneB.id, name: 'Cocina principal', initialView: { pitch: 10, yaw: -30, fov: 60 } },
                    { id: sceneA.id, hotspots: [{ id: 'h1', toScene: sceneB.id, pitch: -5, yaw: 40, label: 'Ir a la cocina' }] }
                ]
            });

        expect(res.status).toBe(200);
        const tour = res.body.tour;
        expect(tour.enabled).toBe(true);
        expect(tour.scenes.map((s: any) => s.id)).toEqual([sceneB.id, sceneA.id]);
        expect(tour.scenes[0].name).toBe('Cocina principal');
        expect(tour.scenes[0].initialView).toEqual({ pitch: 10, yaw: -30, fov: 60 });
        expect(tour.scenes[1].name).toBe('Living'); // untouched metadata preserved
        expect(tour.scenes[1].hotspots).toHaveLength(1);

        // Presisted
        const stored = await Property.findById(property._id);
        expect(stored!.tour!.enabled).toBe(true);
        expect(stored!.tour!.scenes.map((s: any) => String(s.id))).toEqual([sceneB.id, sceneA.id]);
    });

    it('returns 400 with field errors for invalid angles', async () => {
        const res = await request(app)
            .patch(`/api/properties/${property._id}/tour`)
            .set(authHeader(editor))
            .send({ scenes: [{ id: sceneA.id, initialView: { pitch: 90, yaw: 0, fov: 75 } }] });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    it('returns 400 when a hotspot references an unknown scene', async () => {
        const res = await request(app)
            .patch(`/api/properties/${property._id}/tour`)
            .set(authHeader(editor))
            .send({ scenes: [{ id: sceneA.id, hotspots: [{ id: 'h1', toScene: 'ghost', pitch: 0, yaw: 0, label: 'x' }] }] });

        expect(res.status).toBe(400);
    });

    it('rejects enabling a tour with no scenes', async () => {
        await request(app)
            .delete(`/api/properties/${property._id}/tour/scenes/${sceneA.id}`)
            .set(authHeader(editor));
        await request(app)
            .delete(`/api/properties/${property._id}/tour/scenes/${sceneB.id}`)
            .set(authHeader(editor));

        const res = await request(app)
            .patch(`/api/properties/${property._id}/tour`)
            .set(authHeader(editor))
            .send({ enabled: true });

        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/properties/:id/tour/scenes/:sceneId', () => {
    it('removes the scene, its variant files, and dependent hotspots', async () => {
        const uploadA = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .attach('panorama', fullPano, 'pano.jpg');
        const uploadB = await request(app)
            .post(`/api/properties/${property._id}/tour/scenes`)
            .set(authHeader(editor))
            .attach('panorama', partialPano, 'pano.jpg');
        const sceneA = uploadA.body.scene;
        const sceneB = uploadB.body.scene;

        await request(app)
            .patch(`/api/properties/${property._id}/tour`)
            .set(authHeader(editor))
            .send({
                enabled: true,
                scenes: [
                    { id: sceneA.id, hotspots: [{ id: 'h1', toScene: sceneB.id, pitch: 0, yaw: 0, label: 'next' }] },
                    { id: sceneB.id }
                ]
            });

        const variants = [
            sceneA.image.url,
            sceneA.image.avifUrl,
            sceneA.image.mobileUrl,
            sceneA.image.mobileAvifUrl,
            sceneA.image.posterUrl
        ].map((url: string) => path.join(uploadsBase, url.match(/\/uploads\/(.+)$/)?.[1]!));
        for (const file of variants) {
            await fs.stat(file); // exist before
        }

        const res = await request(app)
            .delete(`/api/properties/${property._id}/tour/scenes/${sceneA.id}`)
            .set(authHeader(editor));

        expect(res.status).toBe(200);
        expect(res.body.tour.scenes.map((s: any) => s.id)).toEqual([sceneB.id]);
        expect(res.body.tour.scenes[0].hotspots).toEqual([]); // hotspot targeted the removed scene

        for (const file of variants) {
            await expect(fs.stat(file)).rejects.toThrow(); // files removed from storage
        }
    });

    it('returns 404 for an unknown scene', async () => {
        const res = await request(app)
            .delete(`/api/properties/${property._id}/tour/scenes/ghost`)
            .set(authHeader(editor));
        expect(res.status).toBe(404);
    });
});
