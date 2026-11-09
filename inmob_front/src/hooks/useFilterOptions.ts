'use client';

import { useFilterCache, FilterOption } from '@/contexts/FilterCacheContext';

export interface FilterOptions {
    propertyTypes: FilterOption[];
    bedrooms: FilterOption[];
    locations: FilterOption[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    isStale: boolean;
}

/**
 * Custom hook para acceder a las opciones de filtros cacheadas
 * 
 * Provee acceso fácil a opciones de tipos de propiedad, dormitorios y ubicaciones
 * con cacheo y refresco automáticos.
 * 
 * @returns {FilterOptions} Object containing all filter options and cache state
 * 
 * @example
 * ```tsx
 * const { propertyTypes, bedrooms, locations, isLoading } = useFilterOptions();
 * 
 * // Use in dropdown
 * {propertyTypes.map(type => (
 *   <option key={type.id} value={type.id}>{type.label}</option>
 * ))}
 * ```
 */
export const useFilterOptions = (): FilterOptions => {
    const { cache, refreshFilters, isStale } = useFilterCache();

    return {
        propertyTypes: cache.propertyTypes,
        bedrooms: cache.bedrooms,
        locations: cache.locations,
        isLoading: cache.isLoading,
        refresh: refreshFilters,
        isStale,
    };
};