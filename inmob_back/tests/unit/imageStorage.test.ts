import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { LocalImageStorage } from '../../src/services/localImageStorage';
import { ImageStorageFactory } from '../../src/services/imageStorageFactory';
import { CloudinaryImageStorage } from '../../src/services/cloudinaryImageStorage';
import { env } from '../../src/config/env';
import { TINY_PNG } from '../helpers/fixtures';

const uploadsBase = process.env.UPLOADS_BASE_DIR!;

describe('LocalImageStorage', () => {
    it('uploads an image inside the configured base directory', async () => {
        const storage = new LocalImageStorage();
        const result = await storage.uploadImage(TINY_PNG, 'properties/test-a');

        expect(result.url).toMatch(/\/uploads\/properties\/test-a\/.+\.png$/);
        expect(result.publicId).toMatch(/^properties\/test-a\/.+\.png$/);

        const filePath = path.join(uploadsBase, result.publicId);
        const stat = await fs.stat(filePath);
        expect(stat.size).toBe(TINY_PNG.length);
    });

    it('detects jpg buffers and uses the jpg extension', async () => {
        const storage = new LocalImageStorage();
        const jpgBuffer = Buffer.from('ffd8ffe000104a464946', 'hex'); // JPEG magic number prefix

        const result = await storage.uploadImage(jpgBuffer, 'properties/test-jpg');
        expect(result.publicId).toMatch(/\.jpg$/);
    });

    it('uploads multiple images', async () => {
        const storage = new LocalImageStorage();
        const results = await storage.uploadMultipleImages([TINY_PNG, TINY_PNG], 'properties/test-multi');

        expect(results).toHaveLength(2);
        expect(results[0].publicId).not.toBe(results[1].publicId);
    });

    it('deletes an uploaded image from disk', async () => {
        const storage = new LocalImageStorage();
        const result = await storage.uploadImage(TINY_PNG, 'properties/test-del');

        const filePath = path.join(uploadsBase, result.publicId);
        await fs.stat(filePath); // exists

        await storage.deleteImage(result.publicId);
        await expect(fs.stat(filePath)).rejects.toThrow();
    });

    it('does not throw when deleting a missing image', async () => {
        const storage = new LocalImageStorage();
        await expect(storage.deleteImage('properties/does-not-exist.png')).resolves.toBeUndefined();
    });
});

describe('ImageStorageFactory', () => {
    afterEach(() => {
        (env as any).IMAGE_STORAGE_TYPE = 'local';
        ImageStorageFactory.resetInstance();
    });

    it('returns the local storage provider when IMAGE_STORAGE_TYPE is local', () => {
        ImageStorageFactory.resetInstance();
        const provider = ImageStorageFactory.getStorageProvider();
        expect(provider).toBeInstanceOf(LocalImageStorage);
    });

    it('caches the provider instance', () => {
        ImageStorageFactory.resetInstance();
        const a = ImageStorageFactory.getStorageProvider();
        const b = ImageStorageFactory.getStorageProvider();
        expect(a).toBe(b);
    });

    it('returns the Cloudinary provider when IMAGE_STORAGE_TYPE is cloudinary', () => {
        ImageStorageFactory.resetInstance();
        (env as any).IMAGE_STORAGE_TYPE = 'cloudinary';
        const provider = ImageStorageFactory.getStorageProvider();
        expect(provider).toBeInstanceOf(CloudinaryImageStorage);
    });
});
