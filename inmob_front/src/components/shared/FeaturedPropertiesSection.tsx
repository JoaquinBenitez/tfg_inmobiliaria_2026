'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { config } from '@/config';
import { fetchApi } from '@/lib/api';
import { Property } from '@/types/property';
import PropertyCard from '@/components/shared/PropertyCard';

export default function FeaturedPropertiesSection() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

    const updateScrollState = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }, []);

    useEffect(() => {
        const fetchFeatured = async () => {
            try {
                const data = await fetchApi<Property[]>(
                    config.endpoints.properties.featured
                );
                setProperties(data);
            } catch {
                // Fallar en silencio - la sección quedará oculta
            } finally {
                setIsLoading(false);
            }
        };

        fetchFeatured();
    }, []);

    const scroll = useCallback((direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const cardWidth = container.firstElementChild
            ? (container.firstElementChild as HTMLElement).offsetWidth + 24 // gap-6 = 24px
            : 400;
        const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }, []);

    // Actualizar el estado de scroll después de cargar las propiedades
    useEffect(() => {
        updateScrollState();
    }, [properties, updateScrollState]);

    // Avanzar automáticamente cada 5s
    useEffect(() => {
        if (properties.length <= 3) return;

        autoAdvanceRef.current = setInterval(() => {
            if (!scrollRef.current) return;
            const container = scrollRef.current;
            const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
            if (isAtEnd) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                scroll('right');
            }
        }, 5000);

        return () => {
            if (autoAdvanceRef.current) {
                clearInterval(autoAdvanceRef.current);
            }
        };
    }, [properties, scroll]);

    // Skeleton de carga
    if (isLoading) {
        return (
            <section className="bg-muted py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
                        Propiedades Destacadas
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-skeleton rounded-lg h-80 animate-pulse" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Ocultar la sección si no hay propiedades destacadas
    if (properties.length === 0) {
        return null;
    }

    const showArrows = properties.length > 3;

    return (
        <section className="bg-muted py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
                    Propiedades Destacadas
                </h2>
            </div>

            {/* Full-width wrapper so arrows sit in the page margins, clear of the cards */}
            <div className="relative">
                {/* Left Arrow */}
                {showArrows && (
                    <button
                        onClick={() => scroll('left')}
                        className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-background/90 hover:bg-background text-foreground p-2 rounded-full shadow-md transition-all duration-200 ${!canScrollLeft ? 'opacity-50 cursor-default pointer-events-none' : ''}`}
                        aria-label="Previous properties"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                {/* Cards container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div
                        ref={scrollRef}
                        className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        onScroll={updateScrollState}
                        onMouseEnter={() => {
                            if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
                        }}
                        onMouseLeave={() => {
                            if (properties.length <= 3) return;
                            autoAdvanceRef.current = setInterval(() => {
                                if (!scrollRef.current) return;
                                const container = scrollRef.current;
                                const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
                                if (isAtEnd) {
                                    container.scrollTo({ left: 0, behavior: 'smooth' });
                                } else {
                                    scroll('right');
                                }
                            }, 5000);
                        }}
                    >
                        {properties.map((property) => (
                            <div
                                key={property.id}
                                className="flex-shrink-0 w-[calc(100%-2rem)] sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
                            >
                                <PropertyCard property={property} type={property.listingType} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Arrow */}
                {showArrows && (
                    <button
                        onClick={() => scroll('right')}
                        className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-background/90 hover:bg-background text-foreground p-2 rounded-full shadow-md transition-all duration-200 ${!canScrollRight ? 'opacity-50 cursor-default pointer-events-none' : ''}`}
                        aria-label="Next properties"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}
            </div>
        </section>
    );
}
