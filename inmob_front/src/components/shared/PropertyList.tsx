'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Property } from '@/types/property';
import { config } from '@/config';
import PropertyCard from './PropertyCard';
import { SelectableItem } from '@/components/ui/selectable-item';
import { ChevronDown } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { createPortal } from 'react-dom';
import AdvancedFiltersModal from './AdvancedFiltersModal';

interface PropertyListProps {
    properties: Property[];
    type: 'rent' | 'sale';
}

interface FilterOption {
    id: string;
    label: string;
}

interface ButtonPosition {
    top: number;
    left: number;
    width: number;
    height: number;
}

// Opciones de filtro por defecto
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
];



const emptySubscribe = () => () => {};

export default function PropertyList({ properties, type }: PropertyListProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Flag client-only para portals (false durante SSR/hidratación)
    const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    // Estados de los filtros
    const [propertyTypes, setPropertyTypes] = useState<FilterOption[]>([]);
    const [bedrooms, setBedrooms] = useState<FilterOption[]>([]);
    const [locations, setLocations] = useState<FilterOption[]>([]);
    
    // Valores de filtro seleccionados - inicializan con los parámetros de URL
    const [selectedPropertyType, setSelectedPropertyType] = useState<string>(searchParams.get('propertyType') || '');
    const [selectedBedrooms, setSelectedBedrooms] = useState<string>(searchParams.get('bedrooms') || '');
    const [selectedLocation, setSelectedLocation] = useState<string>(searchParams.get('city') || '');
    
    // Estado de filtros avanzados - inicializa desde los parámetros de URL
    const [advancedFilters, setAdvancedFilters] = useState({
        propertyTypes: searchParams.get('propertyTypes')?.split(',') || [],
        cities: searchParams.get('cities')?.split(',') || [],
        minBedrooms: searchParams.get('minBedrooms') || '',
        maxBedrooms: searchParams.get('maxBedrooms') || '',
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || '',
        status: searchParams.get('status') || ''
    });
    
    // Estados de apertura de los dropdowns
    const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
    const [bedroomsOpen, setBedroomsOpen] = useState(false);
    const [locationOpen, setLocationOpen] = useState(false);
    
    // Estado del modal de búsqueda avanzada
    const [showAdvancedModal, setShowAdvancedModal] = useState(false);

    // Contar filtros avanzados activos
    const getActiveFiltersCount = () => {
        let count = 0;
        
        // Verificar parámetros de URL con filtros avanzados activos (no filtros de búsqueda simple)
        if (searchParams.get('propertyTypes')) count++;
        if (searchParams.get('cities')) count++;
        if (searchParams.get('minBedrooms')) count++;
        if (searchParams.get('maxBedrooms')) count++;
        if (searchParams.get('minPrice')) count++;
        if (searchParams.get('maxPrice')) count++;
        if (searchParams.get('status')) count++;
        
        return count;
    };

    // Estados de posición de los botones
    const [propertyButtonPos, setPropertyButtonPos] = useState<ButtonPosition>({ 
        top: 0, left: 0, width: 0, height: 0 
    });
    const [bedroomsButtonPos, setBedroomsButtonPos] = useState<ButtonPosition>({ 
        top: 0, left: 0, width: 0, height: 0 
    });
    const [locationButtonPos, setLocationButtonPos] = useState<ButtonPosition>({ 
        top: 0, left: 0, width: 0, height: 0 
    });

    // Refs de los contenedores y botones de los dropdowns
    const propertyTypeRef = useRef<HTMLDivElement>(null);
    const bedroomsRef = useRef<HTMLDivElement>(null);
    const locationRef = useRef<HTMLDivElement>(null);
    const propertyButtonRef = useRef<HTMLButtonElement>(null);
    const bedroomsButtonRef = useRef<HTMLButtonElement>(null);
    const locationButtonRef = useRef<HTMLButtonElement>(null);

    /**
     * Cerrar los dropdowns al hacer click afuera
     */
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            
            if (propertyTypeOpen && propertyTypeRef.current && !propertyTypeRef.current.contains(target)) {
                const portalElements = document.querySelectorAll('[data-dropdown-portal]');
                let clickedOnPortal = false;
                portalElements.forEach(portal => {
                    if (portal.contains(target)) {
                        clickedOnPortal = true;
                    }
                });
                if (!clickedOnPortal) {
                    setPropertyTypeOpen(false);
                }
            }
            
            if (bedroomsOpen && bedroomsRef.current && !bedroomsRef.current.contains(target)) {
                const portalElements = document.querySelectorAll('[data-dropdown-portal]');
                let clickedOnPortal = false;
                portalElements.forEach(portal => {
                    if (portal.contains(target)) {
                        clickedOnPortal = true;
                    }
                });
                if (!clickedOnPortal) {
                    setBedroomsOpen(false);
                }
            }
            
            if (locationOpen && locationRef.current && !locationRef.current.contains(target)) {
                const portalElements = document.querySelectorAll('[data-dropdown-portal]');
                let clickedOnPortal = false;
                portalElements.forEach(portal => {
                    if (portal.contains(target)) {
                        clickedOnPortal = true;
                    }
                });
                if (!clickedOnPortal) {
                    setLocationOpen(false);
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [propertyTypeOpen, bedroomsOpen, locationOpen]);

    /**
     * Actualizar las posiciones de los botones al abrir los dropdowns
     */
    useEffect(() => {
        if (propertyTypeOpen && propertyButtonRef.current) {
            const rect = propertyButtonRef.current.getBoundingClientRect();
            setPropertyButtonPos({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    }, [propertyTypeOpen]);

    useEffect(() => {
        if (bedroomsOpen && bedroomsButtonRef.current) {
            const rect = bedroomsButtonRef.current.getBoundingClientRect();
            setBedroomsButtonPos({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    }, [bedroomsOpen]);

    useEffect(() => {
        if (locationOpen && locationButtonRef.current) {
            const rect = locationButtonRef.current.getBoundingClientRect();
            setLocationButtonPos({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    }, [locationOpen]);

    // Sincronizar los filtros seleccionados cuando cambian los parámetros de URL (ajustar estado durante el render)
    const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
    if (searchParams !== prevSearchParams) {
        setPrevSearchParams(searchParams);
        setSelectedPropertyType(searchParams.get('propertyType') || '');
        setSelectedBedrooms(searchParams.get('bedrooms') || '');
        setSelectedLocation(searchParams.get('city') || '');

        setAdvancedFilters({
            propertyTypes: searchParams.get('propertyTypes')?.split(',') || [],
            cities: searchParams.get('cities')?.split(',') || [],
            minBedrooms: searchParams.get('minBedrooms') || '',
            maxBedrooms: searchParams.get('maxBedrooms') || '',
            minPrice: searchParams.get('minPrice') || '',
            maxPrice: searchParams.get('maxPrice') || '',
            status: searchParams.get('status') || ''
        });
    }

    /**
     * Obtener opciones de filtros desde la API
     */
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                try {
                    const types = await fetchApi<FilterOption[]>('/properties/filters/property-types');
                    setPropertyTypes(types);
                } catch (error) {
                    console.error('Error fetching property type options:', error);
                    setPropertyTypes(DEFAULT_PROPERTY_TYPES);
                }
                
                try {
                    const beds = await fetchApi<FilterOption[]>('/properties/filters/bedrooms');
                    setBedrooms(beds);
                } catch (error) {
                    console.error('Error fetching bedroom options:', error);
                    setBedrooms(DEFAULT_BEDROOMS);
                }
                
                try {
                    const locs = await fetchApi<FilterOption[]>('/properties/filters/locations');
                    setLocations(locs);
                } catch (error) {
                    console.error('Error fetching location options:', error);
                    setLocations(DEFAULT_LOCATIONS);
                }
            } catch (error) {
                console.error('Error in fetchFilterOptions:', error);
                setPropertyTypes(DEFAULT_PROPERTY_TYPES);
                setBedrooms(DEFAULT_BEDROOMS);
                setLocations(DEFAULT_LOCATIONS);
            }
        };

        fetchFilterOptions();
    }, []);

    /**
     * Generar el texto a mostrar para tipos de propiedad
     */
    const getPropertyTypeDisplayText = (): string => {
        if (advancedFilters.propertyTypes.length === 0) {
            return selectedPropertyType ? 
                propertyTypes.find(p => p.id === selectedPropertyType)?.label || 'TIPO PROPIEDAD' : 
                'TIPO PROPIEDAD';
        }
        
        if (advancedFilters.propertyTypes.length === 1) {
            const type = propertyTypes.find(p => p.id === advancedFilters.propertyTypes[0]);
            return type?.label || 'TIPO PROPIEDAD';
        }
        
        if (advancedFilters.propertyTypes.length <= 2) {
            const labels = advancedFilters.propertyTypes
                .map(id => propertyTypes.find(p => p.id === id)?.label)
                .filter(Boolean);
            return labels.join(', ');
        }
        
        return `${advancedFilters.propertyTypes.length} tipos seleccionados`;
    };

    /**
     * Generar el texto a mostrar para dormitorios
     */
    const getBedroomsDisplayText = (): string => {
        if (advancedFilters.minBedrooms || advancedFilters.maxBedrooms) {
            if (advancedFilters.minBedrooms && advancedFilters.maxBedrooms) {
                if (advancedFilters.minBedrooms === advancedFilters.maxBedrooms) {
                    const bedroom = bedrooms.find(b => b.id === advancedFilters.minBedrooms);
                    return bedroom?.label || 'DORMITORIOS';
                }
                return `${advancedFilters.minBedrooms}-${advancedFilters.maxBedrooms} dorm.`;
            } else if (advancedFilters.minBedrooms) {
                return `${advancedFilters.minBedrooms}+ dorm.`;
            } else {
                return `Hasta ${advancedFilters.maxBedrooms} dorm.`;
            }
        }
        
        return selectedBedrooms ? 
            bedrooms.find(b => b.id === selectedBedrooms)?.label || 'DORMITORIOS' : 
            'DORMITORIOS';
    };

    /**
     * Generar el texto a mostrar para ubicaciones
     */
    const getLocationDisplayText = (): string => {
        if (advancedFilters.cities.length === 0) {
            return selectedLocation ? 
                locations.find(l => l.id === selectedLocation)?.label || 'UBICACIÓN' : 
                'UBICACIÓN';
        }
        
        if (advancedFilters.cities.length === 1) {
            const location = locations.find(l => l.id === advancedFilters.cities[0]);
            return location?.label || 'UBICACIÓN';
        }
        
        if (advancedFilters.cities.length <= 2) {
            const labels = advancedFilters.cities
                .map(id => locations.find(l => l.id === id)?.label)
                .filter(Boolean);
            return labels.join(', ');
        }
        
        return `${advancedFilters.cities.length} ubicaciones`;
    };

    /**
     * Manejar el envío del formulario de búsqueda
     */
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const currentRoute = type === 'sale' ? config.routes.sale.base : config.routes.rent.base;

        // Construir los query params - priorizar los filtros avanzados si existen
        const params = new URLSearchParams();
        params.append('type', type);
        
        // Tipos de propiedad - usar filtros avanzados si hay, si no la selección simple
        if (advancedFilters.propertyTypes.length > 0) {
            params.append('propertyTypes', advancedFilters.propertyTypes.join(','));
        } else if (selectedPropertyType) {
            params.append('propertyType', selectedPropertyType);
        }
        
        // Dormitorios - usar filtros avanzados si hay, si no la selección simple
        if (advancedFilters.minBedrooms || advancedFilters.maxBedrooms) {
            if (advancedFilters.minBedrooms) params.append('minBedrooms', advancedFilters.minBedrooms);
            if (advancedFilters.maxBedrooms) params.append('maxBedrooms', advancedFilters.maxBedrooms);
        } else if (selectedBedrooms) {
            params.append('bedrooms', selectedBedrooms);
        }
        
        // Ciudades - usar filtros avanzados si hay, si no la selección simple
        if (advancedFilters.cities.length > 0) {
            params.append('cities', advancedFilters.cities.join(','));
        } else if (selectedLocation) {
            params.append('city', selectedLocation);
        }
        
        // Agregar el resto de los filtros avanzados si existen
        if (advancedFilters.minPrice) params.append('minPrice', advancedFilters.minPrice);
        if (advancedFilters.maxPrice) params.append('maxPrice', advancedFilters.maxPrice);
        if (advancedFilters.status) params.append('status', advancedFilters.status);

        // Agregar el flag advanced si se está usando algún filtro avanzado
        const hasAdvancedFilters = advancedFilters.propertyTypes.length > 0 || 
                                 advancedFilters.cities.length > 0 ||
                                 advancedFilters.minBedrooms || 
                                 advancedFilters.maxBedrooms ||
                                 advancedFilters.minPrice || 
                                 advancedFilters.maxPrice || 
                                 advancedFilters.status;
        
        if (hasAdvancedFilters) {
            params.append('advanced', 'true');
        }

        const queryString = params.toString() ? `?${params.toString()}` : '';
        router.push(`${currentRoute}${queryString}`);
    };



    /**
     * Alternar la visibilidad de un dropdown
     */
    const handleDropdownToggle = (dropdown: 'property' | 'bedrooms' | 'location') => {
        if (dropdown === 'property') {
            setPropertyTypeOpen(!propertyTypeOpen);
            setBedroomsOpen(false);
            setLocationOpen(false);
        } else if (dropdown === 'bedrooms') {
            setBedroomsOpen(!bedroomsOpen);
            setPropertyTypeOpen(false);
            setLocationOpen(false);
        } else {
            setLocationOpen(!locationOpen);
            setPropertyTypeOpen(false);
            setBedroomsOpen(false);
        }
    };

    /**
     * Renderizar el contenido del dropdown con portal
     */
    const renderDropdownPortal = (
        isOpen: boolean,
        options: FilterOption[],
        buttonPos: ButtonPosition,
        selectedValue: string,
        setSelectedValue: (value: string) => void,
        setIsOpen: (isOpen: boolean) => void
    ) => {
        if (!isOpen || !isMounted) return null;

        return createPortal(
            <div
                data-dropdown-portal
                className="fixed bg-white border rounded-lg shadow-xl max-h-[200px] overflow-y-auto pointer-events-auto"
                style={{
                    zIndex: 2147483647,
                    position: 'fixed',
                    top: buttonPos.top + buttonPos.height + 5,
                    left: buttonPos.left,
                    width: buttonPos.width,
                }}
            >
                <SelectableItem
                    isSelected={selectedValue === ''}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedValue('');
                        setIsOpen(false);
                    }}
                >
                    Todos
                </SelectableItem>
                
                {options.map(option => (
                    <SelectableItem
                        key={option.id}
                        isSelected={selectedValue === option.id}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedValue(option.id);
                            setIsOpen(false);
                        }}
                    >
                        {option.label}
                    </SelectableItem>
                ))}
            </div>,
            document.body
        );
    };

    return (
        <main className="container mx-auto px-4 py-8 pt-24">
            <h1 className="text-3xl font-bold mb-8">
                Propiedades en {type === 'rent' ? 'Alquiler' : 'Venta'}
            </h1>
            
            {/* Sección de búsqueda y filtros mejorada */}
            <div className="mb-8 bg-white rounded-lg shadow-lg overflow-visible relative z-[5]" style={{ isolation: 'isolate' }}>
                <form onSubmit={handleSearch} className="p-4 flex flex-wrap md:flex-nowrap gap-3">
                    {/* Dropdown de tipo de propiedad */}
                    <div ref={propertyTypeRef} className="relative w-full md:w-1/3">
                        <button
                            ref={propertyButtonRef}
                            type="button"
                            onClick={() => handleDropdownToggle('property')}
                            className="w-full flex items-center justify-between py-3 px-4 border rounded-lg bg-white text-muted-foreground hover:border-input"
                        >
                            <span className="truncate">{getPropertyTypeDisplayText()}</span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        </button>

                        {renderDropdownPortal(
                            propertyTypeOpen,
                            propertyTypes,
                            propertyButtonPos,
                            selectedPropertyType,
                            setSelectedPropertyType,
                            setPropertyTypeOpen
                        )}
                    </div>
                    
                    {/* Dropdown de dormitorios */}
                    <div ref={bedroomsRef} className="relative w-full md:w-1/3">
                        <button
                            ref={bedroomsButtonRef}
                            type="button"
                            onClick={() => handleDropdownToggle('bedrooms')}
                            className="w-full flex items-center justify-between py-3 px-4 border rounded-lg bg-white text-muted-foreground hover:border-input"
                        >
                            <span className="truncate">{getBedroomsDisplayText()}</span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        </button>

                        {renderDropdownPortal(
                            bedroomsOpen,
                            bedrooms,
                            bedroomsButtonPos,
                            selectedBedrooms,
                            setSelectedBedrooms,
                            setBedroomsOpen
                        )}
                    </div>
                    
                    {/* Dropdown de ubicación */}
                    <div ref={locationRef} className="relative w-full md:w-1/3">
                        <button
                            ref={locationButtonRef}
                            type="button"
                            onClick={() => handleDropdownToggle('location')}
                            className="w-full flex items-center justify-between py-3 px-4 border rounded-lg bg-white text-muted-foreground hover:border-input"
                        >
                            <span className="truncate">{getLocationDisplayText()}</span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        </button>

                        {renderDropdownPortal(
                            locationOpen,
                            locations,
                            locationButtonPos,
                            selectedLocation,
                            setSelectedLocation,
                            setLocationOpen
                        )}
                    </div>
                    
                    {/* Botón de búsqueda */}
                    <button
                        type="submit"
                        className="w-full md:w-auto mt-2 md:mt-0 bg-warning text-warning-foreground hover:bg-warning/90 font-bold py-3 px-8 md:ml-2 rounded-lg transition-colors"
                    >
                        BUSCAR
                    </button>
                </form>

                {/* Botón de filtros avanzados */}
                <div className="px-4 pb-4">
                    <button
                        type="button"
                        onClick={() => setShowAdvancedModal(true)}
                        className="w-full text-center text-primary hover:text-primary/80 font-medium py-2 border-t border-gray-200 transition-colors"
                    >
                        Filtros Avanzados {getActiveFiltersCount() > 0 && (
                            <span className="text-sm">({getActiveFiltersCount()})</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Contador de resultados */}
            <div className="mb-6">
                <p className="text-muted-foreground">
                    Se encontraron <span className="font-semibold">{properties.length}</span> propiedades
                </p>
            </div>

            {/* Grilla de propiedades — cada tarjeta etiqueta la URL de búsqueda actual para que
                el "Volver" de la página de detalle pueda volver a este set exacto de resultados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property) => (
                    <PropertyCard 
                        key={property.id}
                        property={property}
                        type={type}
                        href={`/propiedades/${property.id}?from=${encodeURIComponent(
                            `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
                        )}`}
                    />
                ))}
            </div>

            {/* Mensaje sin resultados */}
            {properties.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-muted-foreground/80 text-lg">No se encontraron propiedades que coincidan con tu búsqueda.</p>
                    <p className="text-muted-foreground/60 mt-2">Intenta ajustar los filtros para ver más resultados.</p>
                </div>
            )}

            {/* Modal de búsqueda avanzada */}
            <AdvancedFiltersModal
                isOpen={showAdvancedModal}
                onClose={(updatedFilters) => {
                    if (updatedFilters) {
                        setAdvancedFilters(prev => ({
                            ...prev,
                            ...updatedFilters
                        }));
                    }
                    setShowAdvancedModal(false);
                }}
                searchType={type === 'sale' ? 'buy' : 'rent'}
                initialFilters={advancedFilters}
            />
        </main>
    );
} 