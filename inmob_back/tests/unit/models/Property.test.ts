import { describe, it, expect } from 'vitest';
import Property from '../../../src/models/Property';
import { validPersistencePayload, validPersistencePayload as validPropertyPayload } from '../../helpers/fixtures';

describe('Property model', () => {
    it('saves a valid property with defaults', async () => {
        const property = await Property.create(validPersistencePayload());

        expect(property._id).toBeDefined();
        expect(property.status).toBe('available');
        expect(property.featured).toBe(false);
        expect(property.images).toEqual([]);
        expect(property.createdAt).toBeDefined();
        expect(property.updatedAt).toBeDefined();
    });

    it('rejects a negative price', async () => {
        await expect(
            Property.create(validPersistencePayload({ price: -100 }))
        ).rejects.toThrow(/Price must be non-negative/);
    });

    it('rejects a price above the maximum', async () => {
        await expect(
            Property.create(validPersistencePayload({ price: 1000000000001 }))
        ).rejects.toThrow(/Price must not exceed/);
    });

    it('rejects bedrooms above 50', async () => {
        await expect(
            Property.create(validPersistencePayload({ bedrooms: 51 }))
        ).rejects.toThrow(/Bedrooms must not exceed/);
    });

    it('rejects negative bathrooms', async () => {
        await expect(
            Property.create(validPersistencePayload({ bathrooms: -1 }))
        ).rejects.toThrow(/Bathrooms must be non-negative/);
    });

    it('rejects an area above the maximum', async () => {
        await expect(
            Property.create(validPersistencePayload({ area: 1000000 }))
        ).rejects.toThrow(/Area must not exceed/);
    });

    it('rejects an invalid property type', async () => {
        await expect(
            Property.create(validPersistencePayload({ propertyType: 'penthouse' }))
        ).rejects.toThrow();
    });

    it('rejects an invalid listing type', async () => {
        await expect(
            Property.create(validPersistencePayload({ listingType: 'auction' }))
        ).rejects.toThrow();
    });

    it('rejects an invalid status', async () => {
        await expect(
            Property.create(validPersistencePayload({ status: 'hidden' }))
        ).rejects.toThrow();
    });

    describe('soft delete and featured defaults', () => {
        it('defaults deletedAt to null and featuredImageId to an empty string', async () => {
            const property = await Property.create(validPersistencePayload());

            expect(property.deletedAt).toBeNull();
            expect(property.featuredImageId).toBe('');
            expect(property.featured).toBe(false);
        });

        it('stores a deletedAt timestamp for soft-deleted documents', async () => {
            const property = await Property.create(validPersistencePayload());
            await Property.updateOne({ _id: property._id }, { $set: { deletedAt: new Date() } });

            const updated = await Property.findById(property._id);
            expect(updated!.deletedAt).toBeInstanceOf(Date);
        });
    });

    describe('image assets (C1)', () => {
        it('stores image objects with url and publicId', async () => {
            const images = [{ url: 'https://cdn.example.com/a.webp', publicId: 'properties/1/a' }];
            const property = await Property.create(validPersistencePayload({ images }));

            expect(property.images).toHaveLength(1);
            expect(property.images[0].url).toBe(images[0].url);
            expect(property.images[0].publicId).toBe(images[0].publicId);
        });

        it('rejects image entries without a publicId', async () => {
            await expect(
                Property.create(validPersistencePayload({ images: [{ url: 'https://cdn.example.com/a.webp' }] }))
            ).rejects.toThrow();
        });
        // (Max-30 images is a domain rule — see propertyValidation.test.ts; C7/C14)
    });

    describe('currency (C3)', () => {
        it('requires a currency', async () => {
            const { currency, ...payload } = validPropertyPayload();
            void currency;
            await expect(Property.create(payload)).rejects.toThrow();
        });

        it('rejects an unsupported currency', async () => {
            await expect(
                Property.create(validPersistencePayload({ currency: 'EUR' }))
            ).rejects.toThrow();
        });
    });
});
