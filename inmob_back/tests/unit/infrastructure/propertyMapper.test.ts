import { describe, it, expect } from 'vitest';
import {
    documentToProperty,
    newPropertyToDocument,
    propertyUpdateToDocument,
    criteriaToFilter,
    notDeletedFilter
} from '../../../src/infrastructure/propertyMapper';
import { NewProperty } from '../../../src/domain/property';

const newProperty: NewProperty = {
    title: 'Casa Test',
    description: 'Desc',
    price: { amount: 150000, currency: 'USD' },
    location: { address: 'San Martín 123', city: '  Santa   Fe ', lat: -31.63, lng: -60.7 },
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    propertyType: 'casa',
    listingType: 'sale',
    status: 'available',
    images: [{ url: 'https://cdn.example.com/a.webp', publicId: 'properties/1/a' }],
    featured: true,
    featuredImageId: 'properties/1/a'
};

const persistedDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Casa Test',
    description: 'Desc',
    price: 150000,
    currency: 'USD',
    location: { type: 'Point', coordinates: [-60.7, -31.63], address: 'San Martín 123', city: 'Santa Fe' },
    cityLower: 'santa fe',
    bedrooms: 3,
    bathrooms: 2,
    area: 120,
    propertyType: 'casa',
    listingType: 'sale',
    status: 'available',
    images: [{ url: 'https://cdn.example.com/a.webp', publicId: 'properties/1/a' }],
    featured: true,
    featuredImageId: 'properties/1/a',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z')
};

describe('documentToProperty', () => {
    it('maps a persisted document to the domain entity', () => {
        const entity = documentToProperty(persistedDoc);

        expect(entity.id).toBe('507f1f77bcf86cd799439011');
        expect(entity.price).toEqual({ amount: 150000, currency: 'USD' });
        expect(entity.location).toEqual({ address: 'San Martín 123', city: 'Santa Fe', lat: -31.63, lng: -60.7 });
        expect(entity.images).toEqual([{ url: 'https://cdn.example.com/a.webp', publicId: 'properties/1/a' }]);
        expect(entity.deletedAt).toBeNull();
    });

    it('never leaks persistence details (cityLower, GeoJSON) into the entity', () => {
        const entity = documentToProperty(persistedDoc) as unknown as Record<string, unknown>;

        expect('cityLower' in entity).toBe(false);
        expect(entity.location).not.toHaveProperty('type');
        expect(entity.location).not.toHaveProperty('coordinates');
    });

    it('round-trips: document → entity → document fields', () => {
        const entity = documentToProperty(persistedDoc);
        const back = newPropertyToDocument({
            ...entity,
            price: entity.price,
            location: entity.location
        });

        expect(back.price).toBe(150000);
        expect(back.currency).toBe('USD');
        expect(back.location).toEqual(persistedDoc.location);
        expect(back.cityLower).toBe('santa fe');
    });
});

describe('newPropertyToDocument', () => {
    it('flattens Money, builds GeoJSON and stamps cityLower (normalized)', () => {
        const doc = newPropertyToDocument(newProperty);

        expect(doc.price).toBe(150000);
        expect(doc.currency).toBe('USD');
        expect(doc.location).toEqual({
            type: 'Point',
            coordinates: [-60.7, -31.63],
            address: 'San Martín 123',
            city: '  Santa   Fe '
        });
        expect(doc.cityLower).toBe('santa fe');
    });
});

describe('propertyUpdateToDocument', () => {
    it('maps a price update (Money is atomic: amount + currency together)', () => {
        const doc = propertyUpdateToDocument({ price: { amount: 1, currency: 'ARS' } });

        expect(doc.price).toBe(1);
        expect(doc.currency).toBe('ARS');
    });

    it('maps a location update with GeoJSON + cityLower', () => {
        const doc = propertyUpdateToDocument({
            location: { address: 'New 1', city: 'Rosario', lat: -32.95, lng: -60.64 }
        });

        expect(doc.location).toEqual({ type: 'Point', coordinates: [-60.64, -32.95], address: 'New 1', city: 'Rosario' });
        expect(doc.cityLower).toBe('rosario');
    });

    it('only includes provided fields', () => {
        const doc = propertyUpdateToDocument({ title: 'Only Title' });

        expect(Object.keys(doc)).toEqual(['title']);
    });
});

describe('criteriaToFilter (golden filters)', () => {
    it('empty criteria → empty filter', () => {
        expect(criteriaToFilter({})).toEqual({});
    });

    it('equality criteria map directly', () => {
        expect(criteriaToFilter({
            propertyType: 'casa',
            listingType: 'sale',
            status: 'available',
            currency: 'USD',
            featured: true
        })).toEqual({
            propertyType: 'casa',
            listingType: 'sale',
            status: 'available',
            currency: 'USD',
            featured: true
        });
    });

    it('ranges map to $gte/$lte (only bounds present in criteria)', () => {
        expect(criteriaToFilter({ price: { min: 100, max: 200 } })).toEqual({ price: { $gte: 100, $lte: 200 } });
        expect(criteriaToFilter({ bedrooms: { min: 4 } })).toEqual({ bedrooms: { $gte: 4 } });
        expect(criteriaToFilter({ bathrooms: { max: 2 } })).toEqual({ bathrooms: { $lte: 2 } });
    });

    it('exact city maps to normalized cityLower (case/whitespace-insensitive)', () => {
        expect(criteriaToFilter({ city: '  SANTA   fe ' })).toEqual({ cityLower: 'santa fe' });
    });

    it('city arrays map to cityLower $in (normalized)', () => {
        expect(criteriaToFilter({ cities: ['Rosario', 'Esperanza'] }))
            .toEqual({ cityLower: { $in: ['rosario', 'esperanza'] } });
    });

    it('property type arrays map to $in', () => {
        expect(criteriaToFilter({ propertyTypes: ['casa', 'departamento'] }))
            .toEqual({ propertyType: { $in: ['casa', 'departamento'] } });
    });

    it('searchText builds an escaped, case-insensitive $or over address and city', () => {
        const filter = criteriaToFilter({ searchText: 'a+b*c' });

        const [address, city] = filter.$or as [{ 'location.address': RegExp }, { 'location.city': RegExp }];
        expect(address['location.address'].source).toBe('a\\+b\\*c');
        expect(address['location.address'].flags).toBe('i');
        expect(city['location.city'].source).toBe('a\\+b\\*c');
    });
});

describe('notDeletedFilter', () => {
    it('excludes deleted by default', () => {
        expect(notDeletedFilter({})).toEqual({ deletedAt: null });
        expect(notDeletedFilter({ includeDeleted: false })).toEqual({ deletedAt: null });
    });

    it('includes deleted only when explicitly requested', () => {
        expect(notDeletedFilter({ includeDeleted: true })).toEqual({});
    });
});
