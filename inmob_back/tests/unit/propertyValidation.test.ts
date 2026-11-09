import { describe, it, expect } from 'vitest';
import { validatePropertyFields, ALLOWED_UPDATE_FIELDS } from '../../src/domain/propertyValidation';
import { VALID_PROPERTY_TYPES, VALID_LISTING_TYPES, VALID_STATUSES } from '../../src/domain/propertyTypes';

const validPayload = (overrides: Record<string, any> = {}) => ({
    title: 'Casa en venta',
    description: 'Una descripción válida',
    price: 150000,
    currency: 'USD',
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    propertyType: 'casa',
    listingType: 'sale',
    location: {
        address: 'San Martín 123',
        city: 'Rosario',
        latitude: -31.63,
        longitude: -60.7
    },
    ...overrides
});

describe('validatePropertyFields (create mode)', () => {
    it('accepts a valid payload', () => {
        expect(validatePropertyFields(validPayload(), false)).toEqual([]);
    });

    it('requires all mandatory fields', () => {
        const errors = validatePropertyFields({}, false);

        const fields = errors.map(e => e.field);
        expect(fields).toContain('title');
        expect(fields).toContain('description');
        expect(fields).toContain('price');
        expect(fields).toContain('bedrooms');
        expect(fields).toContain('bathrooms');
        expect(fields).toContain('area');
        expect(fields).toContain('propertyType');
        expect(fields).toContain('listingType');
        expect(fields).toContain('currency');
        expect(fields).toContain('location');
    });

    it('rejects invalid enum values', () => {
        const errors = validatePropertyFields(validPayload({
            propertyType: 'penthouse',
            listingType: 'swap',
            currency: 'EUR',
            status: 'ghosted'
        }), false);

        const fields = errors.map(e => e.field);
        expect(fields).toContain('propertyType');
        expect(fields).toContain('listingType');
        expect(fields).toContain('currency');
        expect(fields).toContain('status');
        expect(errors.find(e => e.field === 'propertyType')?.message)
            .toContain(VALID_PROPERTY_TYPES.join(', '));
        expect(errors.find(e => e.field === 'listingType')?.message)
            .toContain(VALID_LISTING_TYPES.join(', '));
        expect(errors.find(e => e.field === 'status')?.message)
            .toContain(VALID_STATUSES.join(', '));
    });

    it('validates coordinate ranges independently for lat and lng', () => {
        const errors = validatePropertyFields(validPayload({
            location: { address: 'x', city: 'y', latitude: -95, longitude: -200 }
        }), false);

        const fields = errors.map(e => e.field);
        expect(fields).toContain('location.latitude');
        expect(fields).toContain('location.longitude');
    });

    it('rejects location payloads that are not objects', () => {
        const errors = validatePropertyFields(validPayload({ location: 'not-an-object' }), false);

        expect(errors.map(e => e.field)).toEqual(['location']);
    });

    it('rejects malformed location JSON strings from multipart forms', () => {
        const errors = validatePropertyFields(validPayload({ location: '{not json' }), false);

        expect(errors).toEqual([{ field: 'location', message: 'Location must be a valid JSON object' }]);
    });

    it('parses location JSON strings from multipart forms', () => {
        const payload = validPayload({ location: JSON.stringify(validPayload().location) });

        expect(validatePropertyFields(payload, false)).toEqual([]);
    });

    it('rejects non-positive prices and non-integer bedrooms', () => {
        const errors = validatePropertyFields(validPayload({ price: -5, bedrooms: 1.5 }), false);

        const fields = errors.map(e => e.field);
        expect(fields).toContain('price');
        expect(fields).toContain('bedrooms');
    });
});

describe('validatePropertyFields (partial mode)', () => {
    it('skips missing optional fields', () => {
        expect(validatePropertyFields({ title: 'Nuevo título' }, true)).toEqual([]);
    });

    it('still validates provided values', () => {
        const errors = validatePropertyFields({ price: 0, listingType: 'nonsense' }, true);

        expect(errors.map(e => e.field)).toEqual(['price', 'listingType']);
    });

    it('validates image assets whenever present', () => {
        const errors = validatePropertyFields(validPayload({
            images: [
                { url: 'https://cdn.example.com/a.webp', publicId: 'properties/1/a' },
                { url: '', publicId: '' },
                'https://not-an-object.example.com/b.jpg'
            ]
        }), false);

        expect(errors.map(e => e.field)).toEqual([
            'images[1].url',
            'images[1].publicId',
            'images[2]'
        ]);
    });

    it('rejects more than 30 images', () => {
        const images = Array.from({ length: 31 }, (_, i) => ({ url: `u${i}`, publicId: `p${i}` }));
        const errors = validatePropertyFields(validPayload({ images }), false);

        expect(errors.map(e => e.field)).toEqual(['images']);
    });
});

describe('ALLOWED_UPDATE_FIELDS', () => {
    it('does not whitelist internal or role fields', () => {
        expect(ALLOWED_UPDATE_FIELDS).not.toContain('_id');
        expect(ALLOWED_UPDATE_FIELDS).not.toContain('createdAt');
        expect(ALLOWED_UPDATE_FIELDS).toContain('images');
        expect(ALLOWED_UPDATE_FIELDS).toContain('featured');
    });
});
