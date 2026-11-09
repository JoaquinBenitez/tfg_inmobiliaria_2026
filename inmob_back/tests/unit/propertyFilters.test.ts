import { describe, it, expect } from 'vitest';
import {
    parsePagination,
    buildListFilters,
    buildPaginationMeta,
    buildSimpleSearchCriteria,
    buildAdvancedSearchCriteria,
    parseNearbyParams,
    parseBoundsParams,
    BEDROOM_OPTIONS,
    LOCATION_OPTIONS,
    PROPERTY_TYPE_OPTIONS
} from '../../src/domain/propertyFilters';
import { BadRequestError } from '../../src/domain/appError';

describe('parsePagination', () => {
    it('applies defaults for missing values', () => {
        expect(parsePagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
    });

    it('clamps page to >= 1 and limit to the 1..50 range', () => {
        expect(parsePagination({ page: '0', limit: '0' })).toEqual({ page: 1, limit: 10, skip: 0 });
        expect(parsePagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 50, skip: 100 });
    });

    it('falls back to defaults for non-numeric values', () => {
        expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 10, skip: 0 });
    });
});

describe('buildListFilters', () => {
    it('defaults status to available and echoes filters', () => {
        const result = buildListFilters({});

        expect(result.criteria).toEqual({ status: 'available' });
        expect(result.echo.filters.status).toBe('available');
        expect(result.echo.filters.listingType).toBe('all');
        expect(result.echo.sort).toEqual({ field: 'createdAt', order: 'desc' });
    });

    it('passes listingType through as domain criteria', () => {
        const result = buildListFilters({ listingType: 'rent' });

        expect(result.criteria.listingType).toBe('rent');
        expect(result.criteria.status).toBe('available');
    });

    it('builds range criteria for price, bedrooms and bathrooms', () => {
        const result = buildListFilters({
            minPrice: '100', maxPrice: '200',
            minBedrooms: '2', maxBedrooms: '4',
            minBathrooms: '1', maxBathrooms: '2'
        });

        expect(result.criteria.price).toEqual({ min: 100, max: 200 });
        expect(result.criteria.bedrooms).toEqual({ min: 2, max: 4 });
        expect(result.criteria.bathrooms).toEqual({ min: 1, max: 2 });
    });

    it('maps free-text location to searchText (no Mongo dialect in domain)', () => {
        const result = buildListFilters({ location: 'Rosario' });

        expect(result.criteria.searchText).toBe('Rosario');
    });

    it('rejects location queries longer than 200 characters', () => {
        expect(() => buildListFilters({ location: 'a'.repeat(201) }))
            .toThrowError(BadRequestError);
    });

    it('falls back to createdAt sort for invalid sort fields', () => {
        const result = buildListFilters({ sortBy: 'password; dropTables', sortOrder: 'asc' });

        expect(result.sort).toBe('createdAt');
        expect(result.order).toBe('asc');
        expect(result.echo.sort.field).toBe('createdAt');
    });

    it('supports valid sort fields with direction', () => {
        const result = buildListFilters({ sortBy: 'price', sortOrder: 'asc' });

        expect(result.sort).toBe('price');
        expect(result.order).toBe('asc');
    });

    it('only applies the featured criteria when featured === "true"', () => {
        expect(buildListFilters({ featured: 'true' }).criteria.featured).toBe(true);
        expect(buildListFilters({ featured: 'false' }).criteria.featured).toBeUndefined();
        expect(buildListFilters({}).criteria.featured).toBeUndefined();
    });
});

describe('buildPaginationMeta', () => {
    it('computes pages and navigation flags', () => {
        expect(buildPaginationMeta(2, 10, 35)).toEqual({
            page: 2, limit: 10, total: 35, pages: 4,
            hasNext: true, hasPrev: true, nextPage: 3, prevPage: 1
        });
    });

    it('handles the single page case', () => {
        expect(buildPaginationMeta(1, 10, 0)).toEqual({
            page: 1, limit: 10, total: 0, pages: 0,
            hasNext: false, hasPrev: false, nextPage: null, prevPage: null
        });
    });
});

describe('buildSimpleSearchCriteria', () => {
    it('translates the "4+" bedroom option to a min-only range', () => {
        const criteria = buildSimpleSearchCriteria({ bedrooms: '4' });

        expect(criteria.bedrooms).toEqual({ min: 4 });
    });

    it('uses exact bedroom matching (min === max) for 1-3', () => {
        expect(buildSimpleSearchCriteria({ bedrooms: '2' }).bedrooms).toEqual({ min: 2, max: 2 });
    });

    it('maps listingType, propertyType and city as domain criteria', () => {
        const criteria = buildSimpleSearchCriteria({ listingType: 'sale', propertyType: 'casa', city: '  Rosario  ' });

        expect(criteria).toEqual({
            listingType: 'sale',
            propertyType: 'casa',
            city: '  Rosario  '
        });
    });
});

describe('buildAdvancedSearchCriteria', () => {
    it('parses comma-separated property types and cities into arrays', () => {
        const criteria = buildAdvancedSearchCriteria({ propertyTypes: 'casa, departamento', cities: ['Rosario', 'Esperanza'] });

        expect(criteria.propertyTypes).toEqual(['casa', 'departamento']);
        expect(criteria.cities).toEqual(['Rosario', 'Esperanza']);
    });

    it('builds numeric range criteria for bedrooms and price', () => {
        const criteria = buildAdvancedSearchCriteria({ minBedrooms: '1', maxBedrooms: '3', minPrice: '1000' });

        expect(criteria.bedrooms).toEqual({ min: 1, max: 3 });
        expect(criteria.price).toEqual({ min: 1000 });
    });
});

describe('parseNearbyParams', () => {
    it('parses valid params with defaults', () => {
        const params = parseNearbyParams({ lat: '-31.63', lng: '-60.7' });

        expect(params).toEqual({ latitude: -31.63, longitude: -60.7, radiusKm: 10, limit: 50 });
    });

    it('rejects missing lat/lng with a 400 and an example', () => {
        try {
            parseNearbyParams({ lng: '-60.7' });
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestError);
            expect((error as BadRequestError).statusCode).toBe(400);
            expect((error as BadRequestError).extra?.example).toContain('/api/properties/nearby');
        }
    });

    it('rejects non-numeric values', () => {
        expect(() => parseNearbyParams({ lat: 'abc', lng: '-60.7' })).toThrowError(BadRequestError);
    });
});

describe('parseBoundsParams', () => {
    it('parses the four corners', () => {
        const params = parseBoundsParams({ neLat: '-29.1', neLng: '-59.2', swLat: '-29.2', swLng: '-59.3' });

        expect(params).toEqual({
            northEastLat: -29.1, northEastLng: -59.2,
            southWestLat: -29.2, southWestLng: -59.3
        });
    });

    it('rejects partial bounds', () => {
        expect(() => parseBoundsParams({ neLat: '-29.1' })).toThrowError(BadRequestError);
    });
});

describe('filter option constants', () => {
    it('exposes non-empty dropdown options', () => {
        expect(BEDROOM_OPTIONS.length).toBeGreaterThan(0);
        expect(LOCATION_OPTIONS.length).toBeGreaterThan(0);
        expect(PROPERTY_TYPE_OPTIONS.length).toBeGreaterThan(0);
        expect(PROPERTY_TYPE_OPTIONS.map(o => o.id)).toEqual([
            'departamento', 'casa', 'terreno', 'oficina', 'local'
        ]);
    });
});
