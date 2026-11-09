'use client';

/**
 * Sección pública del tour para la página de detalle de la propiedad. La implementación del visor
 * (three.js) is code-split behind next/dynamic — viewer JS never blocks first
 * paint (Requirement 1: LCP protection).
 */

import dynamic from 'next/dynamic';
import type { Tour } from '@/types/property';
import { Rotate3d } from 'lucide-react';

const TourViewer = dynamic(() => import('./TourViewer'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full animate-pulse rounded-lg bg-skeleton" aria-label="Cargando recorrido 360°" />
  )
});

interface TourSectionProps {
  tour: Tour;
}

export function TourSection({ tour }: TourSectionProps) {
  if (!tour.enabled || tour.scenes.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="tour-heading">
      <h2 id="tour-heading" className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
        <Rotate3d className="h-6 w-6 text-primary" aria-hidden />
        Recorrido virtual 360°
      </h2>
      <TourViewer tour={tour} />
      <p className="mt-2 text-sm text-muted-foreground">
        Arrastrá para mirar alrededor, usá la rueda o pellizcá para acercar. Tocá los puntos para cambiar de ambiente.
      </p>
    </section>
  );
}
