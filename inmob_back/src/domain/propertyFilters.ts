import { BadRequestError } from './appError';
import { PropertyCriteria, SortField, SortOrder, ListingTypeValue, PropertyStatusValue, PropertyTypeValue } from './property';

export interface PaginationParams {
    page: number;
    limit: number;
    skip: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
    return { page, limit, skip: (page - 1) * limit };
}

export interface PropertyListFilters {
    criteria: PropertyCriteria;
    sort: SortField;
    order: SortOrder;
    echo: {
        filters: Record<string, unknown>;
        sort: { field: string; order: string };
    };
}

export function buildListFilters(query: Record<string, any>): PropertyListFilters {
    const {
        propertyType,
        listingType,
        status,
        minPrice,
        maxPrice,
        minBedrooms,
        maxBedrooms,
        minBathrooms,
        maxBathrooms,
        location,
        featured,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = query;

    const criteria: PropertyCriteria = {};

    if (propertyType && propertyType !== 'all') {
        criteria.propertyType = propertyType as PropertyTypeValue;
    }

    if (listingType && listingType !== 'all') {
        criteria.listingType = listingType as ListingTypeValue;
    }

    // Política de visibilidad por defecto: solo propiedades disponibles salvo override explícito
    // status=all → sin filtro de estado (lo usa el panel admin para ver todo)
    if (status === 'all') {
        // sin filtro de estado
    } else if (status) {
        criteria.status = status as PropertyStatusValue;
    } else {
        criteria.status = 'available';
    }

    if (minPrice || maxPrice) {
        criteria.price = {
            ...(minPrice ? { min: parseFloat(minPrice as string) } : {}),
            ...(maxPrice ? { max: parseFloat(maxPrice as string) } : {})
        };
    }

    if (minBedrooms || maxBedrooms) {
        criteria.bedrooms = {
            ...(minBedrooms ? { min: parseInt(minBedrooms as string) } : {}),
            ...(maxBedrooms ? { max: parseInt(maxBedrooms as string) } : {})
        };
    }

    if (minBathrooms || maxBathrooms) {
        criteria.bathrooms = {
            ...(minBathrooms ? { min: parseFloat(minBathrooms as string) } : {}),
            ...(maxBathrooms ? { max: parseFloat(maxBathrooms as string) } : {})
        };
    }

    if (location) {
        const locationStr = location as string;
        if (locationStr.length > 200) {
            throw new BadRequestError('Location search query must not exceed 200 characters');
        }
        // Búsqueda de texto libre (palabras parciales en dirección/ciudad, por diseño).
        // Los filtros estructurados de ciudad usan el criterio `city` exacto en su lugar (C8).
        criteria.searchText = locationStr;
    }

    if (featured === 'true') {
        criteria.featured = true;
    }

    const validSortFields: SortField[] = ['createdAt', 'updatedAt', 'price', 'bedrooms', 'bathrooms', 'title'];
    const sort: SortField = validSortFields.includes(sortBy as SortField) ? sortBy as SortField : 'createdAt';
    const order: SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    return {
        criteria,
        sort,
        order,
        echo: {
            filters: {
                propertyType: propertyType || 'all',
                listingType: listingType || 'all',
                status: status || 'available',
                minPrice: minPrice ? parseFloat(minPrice as string) : null,
                maxPrice: maxPrice ? parseFloat(maxPrice as string) : null,
                minBedrooms: minBedrooms ? parseInt(minBedrooms as string) : null,
                maxBedrooms: maxBedrooms ? parseInt(maxBedrooms as string) : null,
                minBathrooms: minBathrooms ? parseFloat(minBathrooms as string) : null,
                maxBathrooms: maxBathrooms ? parseFloat(maxBathrooms as string) : null,
                location: location || null,
                featured: featured === 'true' ? true : null
            },
            sort: {
                field: sort,
                order: sortOrder
            }
        }
    };
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage: number | null;
    prevPage: number | null;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    return {
        page,
        limit,
        total,
        pages: totalPages,
        hasNext: hasNextPage,
        hasPrev: hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
    };
}

export function buildSimpleSearchCriteria(query: Record<string, unknown>): PropertyCriteria {
    const { listingType, propertyType, bedrooms, city } = query;
    const criteria: PropertyCriteria = {};

    if (listingType) {
        criteria.listingType = listingType as ListingTypeValue;
    }

    if (propertyType) {
        criteria.propertyType = propertyType as PropertyTypeValue;
    }

    if (city) {
        criteria.city = String(city);
    }

    if (bedrooms) {
        const bedroomValue = bedrooms.toString();
        if (bedroomValue === '4') {
            criteria.bedrooms = { min: 4 };
        } else {
            const exact = Number(bedroomValue);
            criteria.bedrooms = { min: exact, max: exact };
        }
    }

    return criteria;
}

export function buildAdvancedSearchCriteria(query: Record<string, any>): PropertyCriteria {
    const { listingType, propertyTypes, minPrice, maxPrice, minBedrooms, maxBedrooms, status, cities } = query;
    const criteria: PropertyCriteria = {};

    if (listingType) {
        criteria.listingType = listingType as ListingTypeValue;
    }

    if (status) {
        criteria.status = status as PropertyStatusValue;
    }

    if (propertyTypes) {
        criteria.propertyTypes = Array.isArray(propertyTypes)
            ? propertyTypes as PropertyTypeValue[]
            : (propertyTypes as string).split(',').map(t => t.trim()) as PropertyTypeValue[];
    }

    if (cities) {
        criteria.cities = Array.isArray(cities)
            ? cities as string[]
            : (cities as string).split(',').map(city => city.trim());
    }

    if (minBedrooms || maxBedrooms) {
        criteria.bedrooms = {
            ...(minBedrooms ? { min: Number(minBedrooms) } : {}),
            ...(maxBedrooms ? { max: Number(maxBedrooms) } : {})
        };
    }

    if (minPrice || maxPrice) {
        criteria.price = {
            ...(minPrice ? { min: Number(minPrice) } : {}),
            ...(maxPrice ? { max: Number(maxPrice) } : {})
        };
    }

    return criteria;
}

export interface NearbyParams {
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit: number;
}

export function parseNearbyParams(query: Record<string, any>): NearbyParams {
    const { lat, lng, radius = 10, limit = 50 } = query;

    if (!lat || !lng) {
        throw new BadRequestError('Latitude and longitude are required', {
            example: '/api/properties/nearby?lat=-29.1426&lng=-59.2446&radius=5'
        });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusKm = parseFloat(radius as string);
    const maxResults = parseInt(limit as string);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        throw new BadRequestError('Invalid latitude, longitude, or radius values');
    }

    return { latitude, longitude, radiusKm, limit: maxResults };
}

export interface BoundsParams {
    northEastLat: number;
    northEastLng: number;
    southWestLat: number;
    southWestLng: number;
}

export function parseBoundsParams(query: Record<string, any>): BoundsParams {
    const { neLat, neLng, swLat, swLng } = query;

    if (!neLat || !neLng || !swLat || !swLng) {
        throw new BadRequestError('All bounds coordinates are required (neLat, neLng, swLat, swLng)', {
            example: '/api/properties/bounds?neLat=-29.1&neLng=-59.2&swLat=-29.2&swLng=-59.3'
        });
    }

    const northEastLat = parseFloat(neLat as string);
    const northEastLng = parseFloat(neLng as string);
    const southWestLat = parseFloat(swLat as string);
    const southWestLng = parseFloat(swLng as string);

    if (isNaN(northEastLat) || isNaN(northEastLng) || isNaN(southWestLat) || isNaN(southWestLng)) {
        throw new BadRequestError('Invalid coordinate values');
    }

    return { northEastLat, northEastLng, southWestLat, southWestLng };
}

export const BEDROOM_OPTIONS = [
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4+' }
];

export const LOCATION_OPTIONS = [
    { id: 'avellaneda', label: 'Avellaneda' },
    { id: 'reconquista', label: 'Reconquista' },
    { id: 'santa-fe', label: 'Santa Fe' },
    { id: 'rosario', label: 'Rosario' },
    { id: 'rafaela', label: 'Rafaela' },
    { id: 'venado-tuerto', label: 'Venado Tuerto' },
    { id: 'san-lorenzo', label: 'San Lorenzo' },
    { id: 'esperanza', label: 'Esperanza' },
    { id: 'santo-tome', label: 'Santo Tomé' },
    { id: 'casilda', label: 'Casilda' }
];

export const PROPERTY_TYPE_OPTIONS = [
    { id: 'departamento', label: 'Departamento' },
    { id: 'casa', label: 'Casa' },
    { id: 'terreno', label: 'Terreno' },
    { id: 'oficina', label: 'Oficina' },
    { id: 'local', label: 'Local Comercial' }
];
