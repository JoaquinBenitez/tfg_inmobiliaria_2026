import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import app from '../../src/app';
import { createTestUser, authHeader } from '../helpers/auth';
import { TINY_PNG } from '../helpers/fixtures';

const uploadsBase = process.env.UPLOADS_BASE_DIR!;
let admin: any;
let editor: any;

beforeEach(async () => {
    admin = await createTestUser({ role: 'admin' });
    editor = await createTestUser({ role: 'editor' });
});

describe('GET /api/settings/hero', () => {
    it('returns default empty hero settings', async () => {
        const res = await request(app).get('/api/settings/hero');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ heroImages: [], heroTitle: '', heroSubtitle: '' });
    });
});

describe('PUT /api/settings/hero', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).put('/api/settings/hero').field('heroTitle', 'Nope');

        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const res = await request(app)
            .put('/api/settings/hero')
            .set(authHeader(editor))
            .field('heroTitle', 'Nope');

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Admin access required');
    });

    it('updates hero text and uploads an image (admin)', async () => {
        const res = await request(app)
            .put('/api/settings/hero')
            .set(authHeader(admin))
            .field('heroTitle', 'Bienvenidos')
            .field('heroSubtitle', 'Su hogar nos importa')
            .attach('images', TINY_PNG, 'hero.png');

        expect(res.status).toBe(200);
        expect(res.body.heroTitle).toBe('Bienvenidos');
        expect(res.body.heroSubtitle).toBe('Su hogar nos importa');
        expect(res.body.heroImages).toHaveLength(1);

        const relative = res.body.heroImages[0].match(/\/uploads\/(.+)$/)?.[1];
        expect(relative).toMatch(/^hero\/.+\.png$/);
        const stat = await fs.stat(path.join(uploadsBase, relative!));
        expect(stat.size).toBe(TINY_PNG.length);
    });

    it('rejects more than 3 total hero images', async () => {
        const existing = JSON.stringify([
            'http://localhost:3000/uploads/hero/a.png',
            'http://localhost:3000/uploads/hero/b.png',
            'http://localhost:3000/uploads/hero/c.png',
        ]);

        const res = await request(app)
            .put('/api/settings/hero')
            .set(authHeader(admin))
            .field('existingImages', existing)
            .attach('images', TINY_PNG, 'd.png');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Maximum 3 hero images allowed');
    });
});

describe('DELETE /api/settings/hero/images', () => {
    it('returns 400 when imageUrl is missing', async () => {
        const res = await request(app)
            .delete('/api/settings/hero/images')
            .set(authHeader(admin))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('imageUrl is required');
    });

    it('returns 404 when the image is not in hero settings', async () => {
        const res = await request(app)
            .delete('/api/settings/hero/images')
            .set(authHeader(admin))
            .send({ imageUrl: 'http://localhost:3000/uploads/hero/ghost.png' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Image not found in hero settings');
    });

    it('removes the image from settings and deletes the local file', async () => {
        // Sembrar vía PUT
        const putRes = await request(app)
            .put('/api/settings/hero')
            .set(authHeader(admin))
            .field('heroTitle', 'T')
            .attach('images', TINY_PNG, 'hero.png');
        const url = putRes.body.heroImages[0];
        const relative = url.match(/\/uploads\/(.+)$/)?.[1]!;
        await fs.stat(path.join(uploadsBase, relative)); // exists

        const res = await request(app)
            .delete('/api/settings/hero/images')
            .set(authHeader(admin))
            .send({ imageUrl: url });

        expect(res.status).toBe(200);
        expect(res.body.heroImages).toEqual([]);
        expect(res.body.heroTitle).toBe('T'); // preserved

        await expect(fs.stat(path.join(uploadsBase, relative))).rejects.toThrow();
    });
});
