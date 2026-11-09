'use client';

/**
 * Visor del tour 360° (Requisito 1). Importado dinámicamente con ssr:false desde
 * TourSection — three.js nunca bloquea el primer paint. Este chunk es dueño de:
 *   - poster hasta la primera interacción (protección del LCP),
 *   - inicialización del motor gated por IntersectionObserver,
 *   - el overlay DOM de hotspots (actualizado imperativamente por frame, sin re-render),
 *   - la instrumentación del visor vía MetricsProvider.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useMetrics } from '@/contexts/MetricsContext';
import { projectToScreen, type ViewAngles } from './engine/math';
import type { PanoramaViewer, ViewerSceneConfig, ViewerMetrics } from './engine/viewer';
import type { Tour, TourScene } from '@/types/property';
import { Move3d, AlertTriangle } from 'lucide-react';

function sceneToConfig(scene: TourScene): ViewerSceneConfig {
  return {
    sceneId: scene.id,
    url: scene.image.url,
    avifUrl: scene.image.avifUrl,
    mobileUrl: scene.image.mobileUrl,
    mobileAvifUrl: scene.image.mobileAvifUrl,
    posterUrl: scene.image.posterUrl,
    coverage: scene.coverage,
    initialView: scene.initialView
  };
}

interface TourViewerProps {
  tour: Tour;
}

export default function TourViewer({ tour }: TourViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PanoramaViewer | null>(null);
  const hotspotEls = useRef(new Map<string, HTMLElement>());
  const activeSceneIdRef = useRef(tour.scenes[0]?.id ?? '');
  const { reportCustomMetric } = useMetrics();

  const [activeSceneId, setActiveSceneId] = useState(tour.scenes[0]?.id ?? '');
  const [interacted, setInteracted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false); // viewport approached
  const [engineReady, setEngineReady] = useState(false);

  const activeScene = tour.scenes.find((s) => s.id === activeSceneId) ?? tour.scenes[0];
  const hotspots = activeScene?.hotspots ?? [];

  const reportMetrics = useCallback(
    (m: ViewerMetrics) => {
      if (m.initMs !== undefined) {
        reportCustomMetric({
          metric: 'VIEWER_INIT',
          value: m.initMs,
          rating: m.initMs < 1000 ? 'good' : m.initMs < 3000 ? 'needs-improvement' : 'poor'
        });
      }
      if (m.textureMs !== undefined) {
        reportCustomMetric({
          metric: 'VIEWER_TEXTURE',
          value: m.textureMs,
          rating: m.textureMs < 1500 ? 'good' : m.textureMs < 4000 ? 'needs-improvement' : 'poor'
        });
      }
      if (m.interactionFps !== undefined) {
        reportCustomMetric({
          metric: 'FPS',
          value: m.interactionFps,
          rating: m.interactionFps >= 50 ? 'good' : m.interactionFps >= 30 ? 'needs-improvement' : 'poor',
          detail: { interaction: 1 }
        });
      }
    },
    [reportCustomMetric]
  );

  // Sincronización imperativa del overlay de hotspots — corre en cada frame renderizado, nunca re-renderiza React
  const syncHotspots = useCallback((view: ViewAngles) => {
    const viewport = { width: containerRef.current?.clientWidth ?? 0, height: containerRef.current?.clientHeight ?? 0 };
    const sceneId = activeSceneIdRef.current;
    const scene = tour.scenes.find((s) => s.id === sceneId);
    for (const hotspot of scene?.hotspots ?? []) {
      const el = hotspotEls.current.get(hotspot.id);
      if (!el) continue;
      const p = projectToScreen({ pitch: hotspot.pitch, yaw: hotspot.yaw }, view, viewport);
      el.style.display = p.visible ? '' : 'none';
      el.style.transform = `translate(-50%, -50%) translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    }
  }, [tour.scenes]);

  // IntersectionObserver → iniciar el motor solo cuando el tour se acerca al viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [failed]);

  // Ciclo de vida del motor: init cuando está listo, dispose al desmontar (contrato estricto)
  useEffect(() => {
    if (!ready || engineRef.current || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { PanoramaViewer: Engine } = await import('./engine/viewer');
        if (cancelled || !containerRef.current) return;
        const engine = new Engine(containerRef.current, {
          onFrame: syncHotspots,
          onFirstInteract: () => setInteracted(true),
          onContextLost: () => setFailed(true),
          onMetrics: reportMetrics
        });
        engineRef.current = engine;
        setEngineReady(true);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Carga de escenas — corre cuando el motor está listo y al navegar por hotspots
  useEffect(() => {
    const engine = engineRef.current;
    if (!engineReady || !engine || !activeScene) return;
    void engine.loadScene(sceneToConfig(activeScene)).catch(() => setFailed(true));
  }, [activeScene, engineReady]);

  if (!activeScene) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      {/* Engine canvas mount point */}
      <div ref={containerRef} className="absolute inset-0" aria-label={`Recorrido 360° — escena ${activeScene.name}`} role="img" />

      {/* Hotspot overlay (imperatively positioned each frame) */}
      <div className="pointer-events-none absolute inset-0">
        {hotspots.map((hotspot) => (
          <button
            key={hotspot.id}
            ref={(el) => {
              if (el) hotspotEls.current.set(hotspot.id, el);
              else hotspotEls.current.delete(hotspot.id);
            }}
            onClick={() => {
              activeSceneIdRef.current = hotspot.toScene;
              setActiveSceneId(hotspot.toScene);
            }}
            className="pointer-events-auto absolute left-0 top-0 z-10 flex flex-col items-center gap-1"
            style={{ transform: 'translate(-50%, -50%)' }}
            aria-label={`Ir a ${hotspot.label}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg ring-2 ring-background/60 transition-transform hover:scale-110">
              <Move3d className="h-4 w-4" aria-hidden />
            </span>
            <span className="rounded bg-background/80 px-2 py-0.5 text-xs text-foreground backdrop-blur-sm">
              {hotspot.label}
            </span>
          </button>
        ))}
      </div>

      {/* Poster overlay: LCP-safe stand-in until the user interacts */}
      {!interacted && !failed && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <Image
            src={activeScene.image.posterUrl}
            alt={`Vista previa del recorrido — ${activeScene.name}`}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-lg">
              <Move3d className="h-4 w-4" aria-hidden />
              Arrastrá para explorar en 360°
            </span>
          </div>
        </div>
      )}

      {/* WebGL failure fallback: poster + notice, tour degrades to a static image */}
      {failed && (
        <div className="absolute inset-0 z-30">
          <Image
            src={activeScene.image.posterUrl}
            alt={`Vista del recorrido — ${activeScene.name}`}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover"
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded bg-background/90 px-3 py-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            El navegador no pudo iniciar el visor 3D
          </div>
        </div>
      )}

      {/* Scene name chip */}
      {interacted && tour.scenes.length > 1 && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
          {activeScene.name}
        </div>
      )}
    </div>
  );
}
