'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/config';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { createPortal } from 'react-dom';

interface AdvancedFilters {
    propertyTypes: string[];
    cities: string[];
    minBedrooms: string;
    maxBedrooms: string;
    minPrice: string;
    maxPrice: string;
    status: string;
}

interface AdvancedFiltersModalProps {
    isOpen: boolean;
    onClose: (updatedFilters?: Partial<AdvancedFilters>) => void;
    searchType: 'buy' | 'rent';
    initialFilters?: Partial<AdvancedFilters>;
}

export default function AdvancedFiltersModal({
    isOpen,
    onClose,
    searchType,
    initialFilters = {}
}: AdvancedFiltersModalProps) {
    const router = useRouter();

    // Obtener opciones de filtros cacheadas
    const { propertyTypes, bedrooms, locations } = useFilterOptions();

    // Estado de filtros avanzados - inicializa con initialFilters si se proveen
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(() => ({
        propertyTypes: Array.isArray(initialFilters.propertyTypes) ? initialFilters.propertyTypes : [],
        cities: Array.isArray(initialFilters.cities) ? initialFilters.cities : [],
        minBedrooms: initialFilters.minBedrooms || '',
        maxBedrooms: initialFilters.maxBedrooms || '',
        minPrice: initialFilters.minPrice || '',
        maxPrice: initialFilters.maxPrice || '',
        status: initialFilters.status || ''
    }));

    // Cerrar con Escape (descartar sin guardar)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Sincronizar los filtros borrador cuando cambia initialFilters (ajustar estado durante el render)
    const [prevInitialFilters, setPrevInitialFilters] = useState(initialFilters);
    if (initialFilters !== prevInitialFilters) {
        setPrevInitialFilters(initialFilters);
        setAdvancedFilters({
            propertyTypes: Array.isArray(initialFilters.propertyTypes) ? initialFilters.propertyTypes : [],
            cities: Array.isArray(initialFilters.cities) ? initialFilters.cities : [],
            minBedrooms: initialFilters.minBedrooms || '',
            maxBedrooms: initialFilters.maxBedrooms || '',
            minPrice: initialFilters.minPrice || '',
            maxPrice: initialFilters.maxPrice || '',
            status: initialFilters.status || ''
        });
    }


    /**
     * Handle modal close without saving
     */
    const handleClose = () => {
        onClose();
    };


    /**
     * Handle advanced search form submission
     */
    const handleAdvancedSearch = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const currentRoute = searchType === 'buy' ? config.routes.sale.base : config.routes.rent.base;

        // Construir los query params para la búsqueda avanzada
        const params = new URLSearchParams();
        params.append('type', searchType === 'buy' ? 'sale' : 'rent');

        if (advancedFilters.propertyTypes.length > 0) {
            params.append('propertyTypes', advancedFilters.propertyTypes.join(','));
        }
        if (advancedFilters.cities.length > 0) {
            params.append('cities', advancedFilters.cities.join(','));
        }
        if (advancedFilters.minBedrooms) {
            params.append('minBedrooms', advancedFilters.minBedrooms);
        }
        if (advancedFilters.maxBedrooms) {
            params.append('maxBedrooms', advancedFilters.maxBedrooms);
        }
        if (advancedFilters.minPrice) {
            params.append('minPrice', advancedFilters.minPrice);
        }
        if (advancedFilters.maxPrice) {
            params.append('maxPrice', advancedFilters.maxPrice);
        }
        if (advancedFilters.status) {
            params.append('status', advancedFilters.status);
        }

        const queryString = params.toString() ? `?${params.toString()}&advanced=true` : '?advanced=true';

        // Cerrar el modal y navegar
        onClose(advancedFilters);
        router.push(`${currentRoute}${queryString}`);
    };

    /**
     * Handle advanced filter changes
     */
    const handleAdvancedFilterChange = (field: keyof AdvancedFilters, value: string | string[]) => {
        setAdvancedFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    /**
     * Toggle selection in multi-select arrays
     */
    const toggleArraySelection = (field: 'propertyTypes' | 'cities', value: string) => {
        setAdvancedFilters(prev => {
            const currentArray = prev[field];
            const newArray = currentArray.includes(value)
                ? currentArray.filter(item => item !== value)
                : [...currentArray, value];

            return {
                ...prev,
                [field]: newArray
            };
        });
    };

    /**
     * Clear all advanced filters
     */
    const clearAdvancedFilters = () => {
        setAdvancedFilters({
            propertyTypes: [],
            cities: [],
            minBedrooms: '',
            maxBedrooms: '',
            minPrice: '',
            maxPrice: '',
            status: ''
        });
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
            onMouseDown={(e) => {
                // El click en el fondo cierra — los clicks dentro del panel son hijos de él
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-foreground">Filtros avanzados</h2>
                        <button
                            onClick={handleClose}
                            className="text-muted-foreground hover:text-foreground text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Property Types - Multiple Selection */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Tipos de Propiedad
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {propertyTypes.map(type => (
                                    <label key={type.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={advancedFilters.propertyTypes.includes(type.id)}
                                            onChange={() => toggleArraySelection('propertyTypes', type.id)}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm">{type.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Cities - Multiple Selection */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Ciudades
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {locations.map(location => (
                                    <label key={location.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={advancedFilters.cities.includes(location.id)}
                                            onChange={() => toggleArraySelection('cities', location.id)}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm">{location.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Bedrooms Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Dormitorios Mínimos
                                </label>
                                <select
                                    value={advancedFilters.minBedrooms}
                                    onChange={(e) => handleAdvancedFilterChange('minBedrooms', e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="">Cualquiera</option>
                                    {bedrooms.map(bedroom => (
                                        <option key={bedroom.id} value={bedroom.id}>
                                            {bedroom.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Dormitorios Máximos
                                </label>
                                <select
                                    value={advancedFilters.maxBedrooms}
                                    onChange={(e) => handleAdvancedFilterChange('maxBedrooms', e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="">Cualquiera</option>
                                    {bedrooms.map(bedroom => (
                                        <option key={bedroom.id} value={bedroom.id}>
                                            {bedroom.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Price Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Precio Mínimo
                                </label>
                                <input
                                    type="number"
                                    value={advancedFilters.minPrice}
                                    onChange={(e) => handleAdvancedFilterChange('minPrice', e.target.value)}
                                    placeholder="0"
                                    className="w-full p-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Precio Máximo
                                </label>
                                <input
                                    type="number"
                                    value={advancedFilters.maxPrice}
                                    onChange={(e) => handleAdvancedFilterChange('maxPrice', e.target.value)}
                                    placeholder="Sin límite"
                                    className="w-full p-2 border rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Estado
                            </label>
                            <select
                                value={advancedFilters.status}
                                onChange={(e) => handleAdvancedFilterChange('status', e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="">Todos</option>
                                <option value="available">Disponible</option>
                                <option value="reserved">Reservado</option>
                            </select>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex justify-between mt-8">
                        <button
                            onClick={clearAdvancedFilters}
                            className="px-4 py-2 text-muted-foreground hover:text-foreground font-medium"
                        >
                            Limpiar Filtros
                        </button>
                        <div className="space-x-3">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 border border-input rounded-lg hover:bg-accent/50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleAdvancedSearch}
                                className="px-6 py-2 bg-warning text-warning-foreground hover:bg-warning/90 font-bold rounded-lg"
                            >
                                Buscar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
} 