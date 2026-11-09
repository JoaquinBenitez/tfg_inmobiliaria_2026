'use client';

import { Property } from '@/types/property';
import { formatCurrency } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePropertyComparison } from '@/hooks/usePropertyComparison';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Check } from 'lucide-react';

interface PropertyCardProps {
    property: Property;
    type: 'rent' | 'sale';
    /** Card target — lets the results grid tag the current search URL. */
    href?: string;
}

export default function PropertyCard({ property, type, href }: PropertyCardProps) {
    const { addToComparison, removeFromComparison, isInComparison, canAddMore } = usePropertyComparison();

    const inComparison = isInComparison(property.id);

    const handleCompareClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        if (inComparison) {
            removeFromComparison(property.id);
        } else if (canAddMore) {
            addToComparison(property);
        }
    };

    return (
        <div
            className="relative flex flex-col h-full border rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
            <div className="relative h-48 overflow-hidden shrink-0">
                <Image
                    src={property.images[0]?.url || '/placeholder-property.jpg'}
                    alt={property.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    priority={property.featured || false}
                />

                {/* Compare Button - Top Left (above the stretched link) */}
                <button
                    onClick={handleCompareClick}
                    disabled={!inComparison && !canAddMore}
                    className={`absolute top-2 left-2 z-10 p-2 rounded-full transition-all ${
                        inComparison
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background/80 text-foreground hover:bg-background'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={inComparison ? 'Quitar de comparación' : 'Agregar a comparación'}
                >
                    {inComparison ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>

                {/* Status Badge - Top Right */}
                <div className="absolute top-2 right-2">
                    <StatusBadge
                        status={property.status as 'available' | 'reserved' | 'sold' | 'rented'}
                        size="sm"
                    />
                </div>
            </div>
            <div className="flex flex-col flex-1 p-4">
                <h2 className="text-xl font-semibold mb-2 line-clamp-2 break-words group-hover:text-primary transition-colors">
                    {property.title}
                </h2>
                <p className="text-muted-foreground mb-2 line-clamp-1">{property.location.address}</p>
                <p className="text-foreground mb-4 line-clamp-2">{property.description}</p>
                <div className="mt-auto">
                    <p className="text-xl font-bold text-primary">
                        {formatCurrency(property.price, property.currency)} {type === 'rent' ? '/mes' : ''}
                    </p>
                    <div className="flex justify-between mt-4 text-muted-foreground">
                        <span>{property.bedrooms} hab.</span>
                        <span>{property.bathrooms} baños</span>
                        <span>{property.area} m²</span>
                    </div>
                </div>
            </div>

            {/* Stretched link — whole card is a real anchor, so middle-click /
                ctrl+click / shift+click open in a new tab natively */}
            <Link
                href={href ?? `/propiedades/${property.id}`}
                className="absolute inset-0"
                aria-label={`Ver ${property.title}`}
            />
        </div>
    );
}