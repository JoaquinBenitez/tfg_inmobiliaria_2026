import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import app from '../../src/app';
import Property from '../../src/models/Property';
import { createTestUser, authHeader } from '../helpers/auth';
import { validPropertyPayload, validPersistencePayload, TINY_PNG } from '../helpers/fixtures';

const uploadsBase = process.env.UPLOADS_BASE_DIR!;
let editor: any;
let property: any;

beforeEach(async () => {
    editor = await createTestUser({ role: 'editor' });
    property = await Property.create(validPersistencePayload());
});

describe('POST /api/properties/:id/images', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .attach('images', TINY_PNG, 'a.png');

        expect(res.status).toBe(401);
    });

    it('returns 404 for a nonexistent property', async () => {
        const res = await request(app)
            .post('/api/properties/507f1f77bcf86cd799439011/images')
            .set(authHeader(editor))
            .attach('images', TINY_PNG, 'a.png');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Property not found');
    });

    it('returns 400 when no files are provided', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .set(authHeader(editor));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No images provided');
    });

    it('uploads images as assets (url + publicId), appends them to the property, and writes files to disk', async () => {
        const res = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .attach('images', TINY_PNG, 'a.png')
            .attach('images', TINY_PNG, 'b.png');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Images uploaded successfully');
        expect(res.body.images).toHaveLength(2);
        expect(res.body.property.images).toHaveLength(2);

        for (const image of res.body.images) {
            expect(image.publicId).toMatch(new RegExp(`^properties/${property._id}/.+\\.png$`));
            const relative = image.url.match(/\/uploads\/(.+)$/)?.[1];
            expect(relative).toBeDefined();
            const stat = await fs.stat(path.join(uploadsBase, relative!));
            expect(stat.size).toBe(TINY_PNG.length);
        }
    });

    it('rejects non-image files', async () => {
        const textBuffer = Buffer.from('this is not an image', 'utf-8');

        const res = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .attach('images', textBuffer, { filename: 'notes.txt', contentType: 'text/plain' });

        // error del fileFilter de multer -> handler de errores global (documenta el comportamiento actual)
        expect(res.status).toBe(500);
    });
});

describe('DELETE /api/properties/:id/images', () => {
    it('returns 400 when imageId is missing', async () => {
        const res = await request(app)
            .delete(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('imageId is required');
    });

    it('returns 404 when the image is not on the property', async () => {
        const res = await request(app)
            .delete(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .send({ imageId: 'properties/nope/ghost.png' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Image not found on this property');
    });

    it('deletes the image record and the local file', async () => {
        // Sembrar un archivo real vía el endpoint de subida
        const uploadRes = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .attach('images', TINY_PNG, 'a.png');
        const image = uploadRes.body.images[0];
        const relative = image.url.match(/\/uploads\/(.+)$/)?.[1]!;
        await fs.stat(path.join(uploadsBase, relative)); // exists

        const res = await request(app)
            .delete(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .send({ imageId: image.publicId });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Image deleted');
        expect(res.body.images).toEqual([]);

        await expect(fs.stat(path.join(uploadsBase, relative))).rejects.toThrow();
    });

    it('clears featuredImageId and featured when the featured image is deleted', async () => {
        const uploadRes = await request(app)
            .post(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .attach('images', TINY_PNG, 'a.png');
        const image = uploadRes.body.images[0];

        // Marcar la imagen como destacada
        await Property.findByIdAndUpdate(property._id, { featured: true, featuredImageId: image.publicId });

        const res = await request(app)
            .delete(`/api/properties/${property._id}/images`)
            .set(authHeader(editor))
            .send({ imageId: image.publicId });

        expect(res.status).toBe(200);

        const updated = await Property.findById(property._id);
        expect(updated!.featured).toBe(false);
        expect(updated!.featuredImageId).toBe('');
    });
});
