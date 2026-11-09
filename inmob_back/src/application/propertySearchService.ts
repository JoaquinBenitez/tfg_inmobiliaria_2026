import { PropertyRepository } from '../interfaces/propertyRepository';
import { PropertyEntity } from '../domain/property';
import {
    parsePagination,
    buildListFilters,
    buildPaginationMeta,
    buildSimpleSearchCriteria,
    buildAdvancedSearchCriteria,
    parseNearbyParams,
    parseBoundsParams
} from '../domain/propertyFilters';

export interface PropertyListResponse {
    properties: PropertyEntity[];
    pagination: ReturnType<typeof buildPaginationMeta>;
    filters: Record<string, unknown>;
    sort: { field: string; order: string };
}

export interface NearbyResponse {
    center: { lat: number; lng: number };
    radius: number;
    count: number;
    properties: (PropertyEntity & { distance: number })[];
}

export interface BoundsResponse {
    bounds: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
    count: number;
    properties: PropertyEntity[];
}

export const propertySearchService = {
    async listProperties(
        repo: PropertyRepository,
        query: Record<string, unknown>
    ): Promise<PropertyListResponse> {
        const { page, limit, skip } = parsePagination(query);
        const { criteria, sort, order, echo } = buildListFilters(query);

        const { properties, total } = await repo.list({
            criteria,
            sort,
            order,
            skip,
            limit
        });

        return {
            properties,
            pagination: buildPaginationMeta(page, limit, total),
            filters: echo.filters,
            sort: echo.sort
        };
    },

    async searchProperties(repo: PropertyRepository, query: Record<string, unknown>): Promise<PropertyEntity[]> {
        const criteria = buildSimpleSearchCriteria(query);
        return repo.findByCriteria(criteria);
    },

    async advancedSearchProperties(repo: PropertyRepository, query: Record<string, unknown>): Promise<PropertyEntity[]> {
        const criteria = buildAdvancedSearchCriteria(query);
        return repo.findByCriteria(criteria);
    },

    async getFeaturedProperties(repo: PropertyRepository): Promise<PropertyEntity[]> {
        return repo.findFeatured();
    },

    async searchNearby(repo: PropertyRepository, query: Record<string, unknown>): Promise<NearbyResponse> {
        const { latitude, longitude, radiusKm, limit } = parseNearbyParams(query);

        const properties = await repo.aggregateNearby({
            center: { lat: latitude, lng: longitude },
            radiusInMeters: radiusKm * 1000,
            limit
        });

        return {
            center: { lat: latitude, lng: longitude },
            radius: radiusKm,
            count: properties.length,
            properties: properties.map(prop => ({
                ...prop,
                distance: Math.round(prop.distance * 100) / 100
            }))
        };
    },

    async searchInBounds(repo: PropertyRepository, query: Record<string, unknown>): Promise<BoundsResponse> {
        const { northEastLat, northEastLng, southWestLat, southWestLng } = parseBoundsParams(query);

        const properties = await repo.findInBounds({
            northEast: { lat: northEastLat, lng: northEastLng },
            southWest: { lat: southWestLat, lng: southWestLng }
        });

        return {
            bounds: {
                northeast: { lat: northEastLat, lng: northEastLng },
                southwest: { lat: southWestLat, lng: southWestLng }
            },
            count: properties.length,
            properties
        };
    }
};
