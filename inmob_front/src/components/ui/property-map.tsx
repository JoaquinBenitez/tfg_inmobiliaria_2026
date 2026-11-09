'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PropertyMapProps {
  property: import('@/types/property').Property;
  height?: string;
  className?: string;
}

// Leaflet necesita `window`, así que el mapa nunca debe renderizarse en el servidor
const PropertyMap = dynamic(
  () => import('./property-map-view').then((m) => m.PropertyMapView),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center bg-muted rounded-lg border border-border text-muted-foreground"
        style={{ height: '300px' }}
      >
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2"></div>
          <p className="text-sm">Cargando mapa...</p>
        </div>
      </div>
    ),
  }
);

// Componente wrapper con lazy load e intersection observer
export function PropertyMapLazy(props: PropertyMapProps) {
  const [isInView, setIsInView] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (mapContainerRef.current) {
      observer.observe(mapContainerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-2" ref={mapContainerRef}>
      <h3 className="text-lg font-semibold text-foreground">
        Ubicación
      </h3>
      {isInView ? (
        <PropertyMap {...props} />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center bg-muted rounded-lg border",
            "text-muted-foreground"
          )}
          style={{ height: props.height || '300px' }}
        >
          <div className="text-center">
            <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm">Cargando mapa...</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          📍 {props.property.location.address}, {props.property.location.city}
        </p>
        <a
          href={`https://www.google.com/maps?q=${props.property.location.lat},${props.property.location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Ver en Google Maps
        </a>
      </div>
    </div>
  );
}
