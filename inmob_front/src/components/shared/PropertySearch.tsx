'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { config } from '@/config';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { SelectableItem } from '@/components/ui/selectable-item';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { createPortal } from 'react-dom';
import AdvancedFiltersModal from './AdvancedFiltersModal';

/**
 * Definiciones de tipos del componente de búsqueda de propiedades
 */
type SearchTab = 'buy' | 'rent';

interface TabConfig {
    id: SearchTab;
    label: string;
    route: string;
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

interface AdvancedFilters {
    propertyTypes: string[];
    cities: string[];
    minBedrooms: string;
    maxBedrooms: string;
    minPrice: string;
    maxPrice: string;
    status: string;
}

interface PropertySearchProps {
    initialFilters?: Partial<AdvancedFilters>;
}



/**
 * Constantes
 */
const TABS: TabConfig[] = [
    {
        id: 'buy',
        label: 'COMPRAR',
        route: config.routes.sale.base,
    },
    {
        id: 'rent',
        label: 'ALQUILAR',
        route: config.routes.rent.base,
    }
];


const emptySubscribe = () => () => {};

const EMPTY_INITIAL_FILTERS: Partial<AdvancedFilters> = {};

/**
 * Componente PropertySearch para filtrar y buscar propiedades
 */
export default function PropertySearch({ initialFilters = EMPTY_INITIAL_FILTERS }: PropertySearchProps = {}) {
    const router = useRouter();

    // Estado de la pestaña activa
    const [activeTab, setActiveTab] = useState<SearchTab>('buy');

    // Estado responsive: flag client-only del portal + altura del viewport para posicionarlo
    const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [windowHeight, setWindowHeight] = useState(() =>
        typeof window === 'undefined' ? 0 : window.innerHeight
    );

    // Obtener opciones de filtros cacheadas
    const { propertyTypes, bedrooms, locations } = useFilterOptions();

    // Valores de filtro seleccionados
    const [selectedPropertyType, setSelectedPropertyType] = useState<string>('');
    const [selectedBedrooms, setSelectedBedrooms] = useState<string>('');
    const [selectedLocation, setSelectedLocation] = useState<string>('');

    // Estado de filtros avanzados - inicializa desde props o vacío
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        propertyTypes: initialFilters.propertyTypes || [],
        cities: initialFilters.cities || [],
        minBedrooms: initialFilters.minBedrooms || '',
        maxBedrooms: initialFilters.maxBedrooms || '',
        minPrice: initialFilters.minPrice || '',
        maxPrice: initialFilters.maxPrice || '',
        status: initialFilters.status || ''
    });

    // Estados de apertura de los dropdowns
    const [propertyTypeOpen, setPropertyTypeOpen] = useState(false);
    const [bedroomsOpen, setBedroomsOpen] = useState(false);
    const [locationOpen, setLocationOpen] = useState(false);

    // Estado del modal de búsqueda avanzada
    const [showAdvancedModal, setShowAdvancedModal] = useState(false);

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

    // Refs que espejan los estados de apertura para un handler de click-outside estable
    const propertyTypeOpenRef = useRef(false);
    const bedroomsOpenRef = useRef(false);
    const locationOpenRef = useRef(false);

    /**
     * Seguimiento de la altura del viewport para posicionar el portal
     */
    useEffect(() => {
        const handleResize = () => {
            setWindowHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    /**
     * Mantener los refs sincronizados con los estados de apertura
     */
    useEffect(() => { propertyTypeOpenRef.current = propertyTypeOpen; }, [propertyTypeOpen]);
    useEffect(() => { bedroomsOpenRef.current = bedroomsOpen; }, [bedroomsOpen]);
    useEffect(() => { locationOpenRef.current = locationOpen; }, [locationOpen]);

    /**
     * Cerrar los dropdowns al hacer click afuera (listener estable, sin re-adjuntar)
     */
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;

            // Verificar si el click fue sobre un elemento del portal
            const portalElements = document.querySelectorAll('[data-dropdown-portal]');
            let clickedOnPortal = false;
            portalElements.forEach(portal => {
                if (portal.contains(target)) {
                    clickedOnPortal = true;
                }
            });
            if (clickedOnPortal) return;

            if (propertyTypeOpenRef.current && propertyTypeRef.current && !propertyTypeRef.current.contains(target)) {
                setPropertyTypeOpen(false);
            }

            if (bedroomsOpenRef.current && bedroomsRef.current && !bedroomsRef.current.contains(target)) {
                setBedroomsOpen(false);
            }

            if (locationOpenRef.current && locationRef.current && !locationRef.current.contains(target)) {
                setLocationOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    /**
     * Actualizar la posición del botón de tipo al abrir el dropdown
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

    /**
     * Actualizar la posición del botón de dormitorios al abrir el dropdown
     */
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

    /**
     * Actualizar la posición del botón de ubicación al abrir el dropdown
     */
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
     * Manejar el envío del formulario de búsqueda simple
     */
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        const currentTab = TABS.find(tab => tab.id === activeTab)!;

        // Construir los query params - priorizar los filtros avanzados si existen
        const params = new URLSearchParams();
        params.append('type', activeTab === 'buy' ? 'sale' : 'rent');

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
        router.push(`${currentTab.route}${queryString}`);
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
                className="fixed bg-card border border-border rounded-lg shadow-xl max-h-[200px] overflow-y-auto pointer-events-auto"
                style={{
                    zIndex: 1000,
                    position: 'fixed',
                    // Abrir hacia ABAJO desde el botón: top anclado apenas debajo,
                    // altura limitada por el espacio restante del viewport por debajo
                    top: buttonPos.top + buttonPos.height + 10,
                    left: buttonPos.left,
                    width: buttonPos.width,
                    maxHeight: Math.min(200, windowHeight - buttonPos.top - buttonPos.height - 20)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <SelectableItem
                    isSelected={selectedValue === ''}
                    onMouseDown={(e) => {
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
                        onMouseDown={(e) => {
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
        <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-visible mt-4 sm:mt-8 relative z-10" style={{ isolation: 'isolate' }}>
            {/* Pestañas */}
            <div className="flex">
                {TABS.map((tab, index) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex-1 py-2 px-2 sm:py-4 text-sm font-semibold transition-colors",
                            index === 0 && "rounded-tl-2xl",
                            index === TABS.length - 1 && "rounded-tr-2xl",
                            activeTab === tab.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-accent/50"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filtros de búsqueda */}
            <form
                onSubmit={handleSearch}
                className="p-2 sm:p-4 flex flex-wrap md:flex-nowrap gap-2 sm:gap-3"
            >
                {/* Dropdown de tipo de propiedad */}
                <div ref={propertyTypeRef} className="relative w-full md:w-1/3">
                    <button
                        ref={propertyButtonRef}
                        type="button"
                        onClick={() => handleDropdownToggle('property')}
                        className="w-full flex items-center justify-between py-2 px-3 sm:py-3 sm:px-4 border rounded-lg bg-white text-muted-foreground"
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
                        className="w-full flex items-center justify-between py-2 px-3 sm:py-3 sm:px-4 border rounded-lg bg-white text-muted-foreground"
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
                        className="w-full flex items-center justify-between py-2 px-3 sm:py-3 sm:px-4 border rounded-lg bg-white text-muted-foreground"
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
                    className="w-full md:w-auto mt-2 md:mt-0 bg-warning text-warning-foreground hover:bg-warning/90 font-bold py-2 px-6 sm:py-3 sm:px-8 md:ml-2 rounded-lg transition-colors relative z-20"
                >
                    BUSCAR
                </button>
            </form>

            {/* Botón de filtros avanzados */}
            <div className="px-2 pb-2 sm:px-4 sm:pb-4">
                <button
                    type="button"
                    onClick={() => setShowAdvancedModal(true)}
                    className="w-full text-center text-primary hover:text-primary/80 font-medium py-1 sm:py-2 border-t border-gray-200 transition-colors"
                >
                    Filtros Avanzados
                </button>
            </div>

            {/* Modal de búsqueda avanzada */}
            <AdvancedFiltersModal
                isOpen={showAdvancedModal}
                onClose={(updatedFilters?: Partial<AdvancedFilters>) => {
                    if (updatedFilters) {
                        setAdvancedFilters(prev => ({
                            ...prev,
                            ...updatedFilters
                        }));
                    }
                    setShowAdvancedModal(false);
                }}
                searchType={activeTab}
                initialFilters={advancedFilters}
            />
        </div>
    );
} 