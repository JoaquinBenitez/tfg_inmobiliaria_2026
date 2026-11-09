import { describe, it, expect } from 'vitest';
import { toCanonicalItem } from '../../../src/services/syndication/canonicalFeed';
import { PropertyEntity } from '../../../src/domain/property';

export const makeProperty = (overrides: Partial<PropertyEntity> = {}): PropertyEntity => ({
    id: '507f1f77bcf86cd799439011',
    title: 'Casa con jardín',
    description: 'Descripción',
    price: { amount: 120000, currency: 'USD' },
    location: { address: 'San Martín 123', city: 'Reconquista', lat: -29.15, lng: -59.65 },
    bedrooms: 3,
    bathrooms: 2,
    area: 140,
    propertyType: 'casa',
    listingType: 'sale',
    status: 'available',
    images: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/properties/a.jpg', publicId: 'a' },
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/properties/b.jpg', publicId: 'b' }
    ],
    featured: false,
    featuredImageId: '',
    deletedAt: null,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-05T12:00:00Z'),
    ...overrides
});

describe('canonicalFeed mapper (Anexo 2)', () => {
    it('maps all canonical fields from the domain entity', () => {
        const item = toCanonicalItem(makeProperty(), 'https://inmob.test');

        expect(item.codigoInmueble).toBe('507f1f77bcf86cd799439011');
        expect(item.operacion).toBe('venta');
        expect(item.tipoPropiedad).toBe('casa');
        expect(item.precio).toBe(120000);
        expect(item.moneda).toBe('USD');
        expect(item.ciudad).toBe('Reconquista');
        expect(item.direccion).toBe('San Martín 123');
        expect(item.latitud).toBe(-29.15);
        expect(item.longitud).toBe(-59.65);
        expect(item.superficieTotal).toBe(140);
        expect(item.dormitorios).toBe(3);
        expect(item.banos).toBe(2);
        expect(item.imagenes).toHaveLength(2);
        expect(item.urlDetalle).toBe('https://inmob.test/propiedades/507f1f77bcf86cd799439011');
        expect(item.fechaActualizacion).toBe('2026-09-05T12:00:00.000Z');
    });

    it('translates rent listings to alquiler and passes ARS through', () => {
        const item = toCanonicalItem(
            makeProperty({ listingType: 'rent', price: { amount: 250000, currency: 'ARS' } }),
            'https://inmob.test'
        );
        expect(item.operacion).toBe('alquiler');
        expect(item.moneda).toBe('ARS');
    });

    it('falls back to no coordinates when lat/lng are zero/undefined', () => {
        const item = toCanonicalItem(
            makeProperty({ location: { address: 'X 1', city: 'Y', lat: undefined as unknown as number, lng: 0 } }),
            'https://inmob.test'
        );
        expect(item.latitud).toBeUndefined();
        expect(item.longitud).toBe(0);
    });
});
