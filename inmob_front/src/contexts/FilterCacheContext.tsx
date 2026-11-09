'use client';

import React, { createContext, useContext, useSyncExternalStore, useEffect, useCallback, ReactNode } from 'react';
import { fetchApi } from '@/lib/api';

export interface FilterOption {
    id: string;
    label: string;
}

export interface FilterCache {
    propertyTypes: FilterOption[];
    bedrooms: FilterOption[];
    locations: FilterOption[];
    lastFetch: number;
    isLoading: boolean;
}

interface FilterCacheContextType {
    cache: FilterCache;
    refreshFilters: () => Promise<void>;
    isStale: boolean;
}

const FilterCacheContext = createContext<FilterCacheContextType | undefined>(undefined);

// TTL de la caché - 24 horas en milisegundos
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Opciones de filtro por defecto como fallbacks
const DEFAULT_PROPERTY_TYPES: FilterOption[] = [
    { id: 'departamento', label: 'Departamento' },
    { id: 'casa', label: 'Casa' },
    { id: 'terreno', label: 'Terreno' },
    { id: 'oficina', label: 'Oficina' },
    { id: 'local', label: 'Local Comercial' },
];

const DEFAULT_BEDROOMS: FilterOption[] = [
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4+' },
];

const DEFAULT_LOCATIONS: FilterOption[] = [
    { id: 'avellaneda', label: 'Avellaneda' },
    { id: 'reconquista', label: 'Reconquista' },
    { id: 'santa-fe', label: 'Santa Fe' },
    { id: 'rosario', label: 'Rosario' },
    { id: 'rafaela', label: 'Rafaela' },
    { id: 'venado-tuerto', label: 'Venado Tuerto' },
    { id: 'san-lorenzo', label: 'San Lorenzo' },
];

const CACHE_KEY = 'inmob_filter_cache';

const DEFAULT_CACHE: FilterCache = {
    propertyTypes: DEFAULT_PROPERTY_TYPES,
    bedrooms: DEFAULT_BEDROOMS,
    locations: DEFAULT_LOCATIONS,
    lastFetch: 0,
    isLoading: false,
};

// Store a nivel módulo: seguro para hidratación vía el server snapshot de useSyncExternalStore
let cacheState: FilterCache = DEFAULT_CACHE;
let staleState = true;
let refreshing = false;
const listeners = new Set<() => void>();

function setCacheState(next: FilterCache): void {
    cacheState = next;
    staleState = Date.now() - next.lastFetch > CACHE_TTL;
    listeners.forEach(listener => listener());
}

function loadPersistedCache(): void {
    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const parsed: FilterCache = JSON.parse(cachedData);
            if (Date.now() - parsed.lastFetch <= CACHE_TTL) {
                setCacheState({ ...parsed, isLoading: false });
            }
        }
    } catch (error) {
        console.error('FilterCache: Error loading from localStorage:', error);
    }
}

if (typeof window !== 'undefined') {
    loadPersistedCache();
}

const subscribe = (onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
    };
};

const getSnapshot = (): FilterCache => cacheState;
const getServerSnapshot = (): FilterCache => DEFAULT_CACHE;
const getStale = (): boolean => staleState;
const getServerStale = (): boolean => true;

interface FilterCacheProviderProps {
    children: ReactNode;
}

export const FilterCacheProvider: React.FC<FilterCacheProviderProps> = ({ children }) => {
    const cache = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const isStale = useSyncExternalStore(subscribe, getStale, getServerStale);

    const refreshFilters = useCallback(async (): Promise<void> => {
        if (refreshing) return;
        refreshing = true;

        try {
            const promises = [
                fetchApi<FilterOption[]>('/properties/filters/property-types').catch(() => DEFAULT_PROPERTY_TYPES),
                fetchApi<FilterOption[]>('/properties/filters/bedrooms').catch(() => DEFAULT_BEDROOMS),
                fetchApi<FilterOption[]>('/properties/filters/locations').catch(() => DEFAULT_LOCATIONS),
            ];

            const [propertyTypes, bedrooms, locations] = await Promise.all(promises);

            const newCache: FilterCache = {
                propertyTypes,
                bedrooms,
                locations,
                lastFetch: Date.now(),
                isLoading: false,
            };

            setCacheState(newCache);

            // Guardar en localStorage
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
                } catch (error) {
                    console.error('FilterCache: Error saving to localStorage:', error);
                }
            }

        } catch (error) {
            console.error('FilterCache: Error during refresh:', error);

            // Mantener la caché existente pero marcar como no loading
            setCacheState({ ...getSnapshot(), isLoading: false });
        } finally {
            refreshing = false;
        }
    }, []);

    // Auto-refrescar la caché vencida después del mount
    useEffect(() => {
        if (isStale) {
            refreshFilters();
        }
    }, [isStale, refreshFilters]);

    const value: FilterCacheContextType = {
        cache,
        refreshFilters,
        isStale,
    };

    return (
        <FilterCacheContext.Provider value={value}>
            {children}
        </FilterCacheContext.Provider>
    );
};

export const useFilterCache = (): FilterCacheContextType => {
    const context = useContext(FilterCacheContext);
    if (context === undefined) {
        throw new Error('useFilterCache must be used within a FilterCacheProvider');
    }
    return context;
};
