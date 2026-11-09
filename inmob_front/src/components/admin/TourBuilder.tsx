'use client';

/**
 * TourBuilder (admin, Fase 2): subir escenas de panorama, ordenarlas, fijar la
 * vista inicial de cada escena y el coverage de panorama parcial, colocar
 * hotspots haciendo click en la preview en vivo, habilitar/deshabilitar y
 * guardar el recorrido.
 *
 * La preview reutiliza el motor de producción (`components/tour/engine/viewer`)
 * importado dinámicamente — la colocación por click convierte pantalla →
 * coordenadas esféricas con la misma matemática pura que usa el visor público
 * para la proyección.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadTourSceneAction, updateTourAction, deleteTourSceneAction } from '@/lib/actions';
import { screenToAngles, projectToScreen, clamp, type ViewAngles } from '@/components/tour/engine/math';
import type { PanoramaViewer } from '@/components/tour/engine/viewer';
import type { Tour, TourScene, TourHotspot } from '@/types/property';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload, Trash2, ArrowUp, ArrowDown, Crosshair, Save, Eye, Loader2, RadioTower
} from 'lucide-react';

interface TourBuilderProps {
  propertyId: string;
  initialTour: Tour;
}

function SliderField({ label, value, min, max, step = 1, onChange, suffix = '°' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs text-foreground">{Math.round(value)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        aria-label={label}
      />
    </div>
  );
}

export function TourBuilder({ propertyId, initialTour }: TourBuilderProps) {
  // normalizeTour: protege contra respuestas de actions malformadas (clase de bug
  // legacy — un envelope de API sin envolver llegó una vez a setTour y rompió el editor)
  const normalizeTour = (t: Tour | undefined | null): Tour =>
    t && Array.isArray(t.scenes) ? t : { enabled: false, scenes: [] };
  const [tour, setTour] = useState<Tour>(() => normalizeTour(initialTour));
  const [selectedId, setSelectedId] = useState<string>(initialTour.scenes?.[0]?.id ?? '');
  const [sceneName, setSceneName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PanoramaViewer | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  // engineReady: el import dinámico resuelve después del mount — la carga de la
  // escena inicial debe esperarlo o la preview queda en blanco (bug de la página de edición).
  const [engineReady, setEngineReady] = useState(false);

  // Overlay de hotspots (mismo patrón imperativo que el TourViewer público): refs,
  // nunca re-renderiza React por frame
  const hotspotEls = useRef(new Map<string, HTMLElement>());
  const selectedHotspotsRef = useRef<TourHotspot[]>([]);

  const syncHotspots = useCallback((view: ViewAngles) => {
    const container = previewRef.current;
    const viewport = { width: container?.clientWidth ?? 0, height: container?.clientHeight ?? 0 };
    for (const hotspot of selectedHotspotsRef.current) {
      const el = hotspotEls.current.get(hotspot.id);
      if (!el) continue;
      const p = projectToScreen({ pitch: hotspot.pitch, yaw: hotspot.yaw }, view, viewport);
      el.style.display = p.visible ? '' : 'none';
      el.style.transform = `translate(-50%, -50%) translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    }
  }, []);

  const selected = (tour.scenes ?? []).find((s) => s.id === selectedId) ?? null;
  const selectedHotspots = selected?.hotspots;

  const patchScene = useCallback((sceneId: string, patch: Partial<TourScene>) => {
    setTour((t) => ({ ...t, scenes: t.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) }));
  }, []);

  // ------------------------------------------------------------------
  // Ciclo de vida del motor de preview (mount → init, unmount → dispose)
  // ------------------------------------------------------------------
  // El init del motor debe re-ejecutarse cuando el contenedor de la preview aparece
  // por primera vez: con cero escenas el div de preview no está montado
  // (previewRef.current es null) — sin esta dependencia la primera escena subida
  // mostraría un cuadro gris hasta que un refresh de página creara el motor.
  const hasScenes = tour.scenes.length > 0;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { PanoramaViewer: Engine } = await import('@/components/tour/engine/viewer');
        if (cancelled || !previewRef.current) return;
        engineRef.current = new Engine(previewRef.current, { onFrame: syncHotspots });
        setEngineReady(true);
      } catch {
        setMessage({ kind: 'error', text: 'Este navegador no pudo iniciar el visor 3D (WebGL)' });
      }
    })();
    return () => {
      cancelled = true;
      setEngineReady(false);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [syncHotspots, hasScenes]);

  // Cargar la escena seleccionada en la preview — solo cuando el motor está listo
  // o cambia el ID de escena (no en cada patchScene, que recargaría y resetearía
  // la cámara en cada tick de los sliders)
  const selectedSceneId = selected?.id;
  useEffect(() => {
    const engine = engineRef.current;
    const scene = selected;
    if (!engine || !scene) return;
    void engine.loadScene(
      {
        sceneId: scene.id,
        url: scene.image.url,
        avifUrl: scene.image.avifUrl,
        mobileUrl: scene.image.mobileUrl,
        mobileAvifUrl: scene.image.mobileAvifUrl,
        posterUrl: scene.image.posterUrl,
        coverage: scene.coverage,
        initialView: scene.initialView
      },
      { fade: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `selected` object identity changes on every patch; we reload only on id/engineReady
  }, [engineReady, selectedSceneId]);

  // Los movimientos de los sliders de coverage actualizan la ventana en el lugar — sin recarga ni reset de vista
  const selectedCoverage = selected?.coverage;
  useEffect(() => {
    engineRef.current?.updateCoverage(selectedCoverage);
  }, [selectedCoverage]);

  // Mantener el ref del overlay al día y re-sincronizar las posiciones de los puntos
  // cuando cambian los hotspots sin movimiento de cámara (colocar un punto no renderiza frame por sí solo)
  useEffect(() => {
    selectedHotspotsRef.current = selectedHotspots ?? [];
    const engine = engineRef.current;
    if (engine) syncHotspots(engine.getView());
  }, [selectedHotspots, engineReady, syncHotspots]);

  // Colocar hotspots con click (distinguido del arrastre por el recorrido del puntero)
  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePreviewClick = (e: React.MouseEvent) => {
    if (!placing || !selected || !previewRef.current || !engineRef.current) return;
    const down = pointerDownRef.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; // fue un arrastre

    const rect = previewRef.current.getBoundingClientRect();
    const view = engineRef.current.getView();
    const angles = screenToAngles(
      e.clientX - rect.left,
      e.clientY - rect.top,
      view,
      { width: rect.width, height: rect.height }
    );
    const target = tour.scenes.find((s) => s.id !== selected.id);
    if (!target) {
      setMessage({ kind: 'error', text: 'Necesitás al menos dos escenas para crear un punto de navegación' });
      return;
    }
    const hotspot: TourHotspot = {
      id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `h-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      toScene: target.id,
      pitch: Math.round(angles.pitch * 10) / 10,
      yaw: Math.round(angles.yaw * 10) / 10,
      label: 'Nuevo ambiente'
    };
    patchScene(selected.id, { hotspots: [...(selected.hotspots ?? []), hotspot] });
    setPlacing(false);
  };

  // ------------------------------------------------------------------
  // Server actions
  // ------------------------------------------------------------------
  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('panorama', file);
      if (sceneName.trim()) formData.append('name', sceneName.trim());
      const result = await uploadTourSceneAction(propertyId, formData);
      if (result.success && result.tour) {
        const uploaded = normalizeTour(result.tour);
        setTour(uploaded);
        setSelectedId(uploaded.scenes[uploaded.scenes.length - 1]?.id ?? '');
        setSceneName('');
        setMessage({ kind: 'ok', text: 'Escena subida y procesada' });
      } else {
        setMessage({ kind: 'error', text: result.error ?? 'Error subiendo la escena' });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!window.confirm('¿Eliminar esta escena y sus imágenes?')) return;
    const result = await deleteTourSceneAction(propertyId, sceneId);
    if (result.success && result.tour) {
      const updated = normalizeTour(result.tour);
      setTour(updated);
      if (selectedId === sceneId) setSelectedId(updated.scenes[0]?.id ?? '');
      setMessage({ kind: 'ok', text: 'Escena eliminada' });
    } else {
      setMessage({ kind: 'error', text: result.error ?? 'Error eliminando la escena' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        enabled: tour.enabled,
        scenes: tour.scenes.map((s) => ({
          id: s.id,
          name: s.name,
          initialView: s.initialView,
          coverage: s.coverage ?? null,
          hotspots: s.hotspots ?? []
        }))
      };
      const result = await updateTourAction(propertyId, payload);
      if (result.success) {
        setMessage({ kind: 'ok', text: 'Recorrido guardado' });
      } else {
        setMessage({ kind: 'error', text: result.error ?? 'Error guardando el recorrido' });
      }
    } finally {
      setSaving(false);
    }
  };

  const moveScene = (index: number, direction: -1 | 1) => {
    setTour((t) => {
      const scenes = [...(t.scenes ?? [])];
      const target = index + direction;
      if (target < 0 || target >= scenes.length) return t;
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...t, scenes };
    });
  };

  const coverage = selected?.coverage;
  const covYawCenter = coverage ? (coverage.minYaw + coverage.maxYaw) / 2 : 0;
  const covYawSpan = coverage ? coverage.maxYaw - coverage.minYaw : 120;
  const covPitchCenter = coverage ? (coverage.minPitch + coverage.maxPitch) / 2 : 0;
  // Escala angular única (°/px): el alto se deriva del ancho vía el aspecto de la foto.
  // Desacoplarlos (o dejar que un clamp de centro recorte el span) estira la imagen.
  const imgAspect = selected ? selected.image.width / Math.max(selected.image.height, 1) : 2;

  const setCoverageWindow = (yawCenter: number, yawSpan: number, pitchCenter = covPitchCenter) => {
    if (!selected) return;
    const pitchSpan = Math.min(180, Math.max(10, yawSpan / imgAspect));
    const yc = clamp(yawCenter, -180 + yawSpan / 2, 180 - yawSpan / 2);
    const pc = clamp(pitchCenter, -90 + pitchSpan / 2, 90 - pitchSpan / 2);
    patchScene(selected.id, {
      coverage: {
        minYaw: yc - yawSpan / 2,
        maxYaw: yc + yawSpan / 2,
        minPitch: pc - pitchSpan / 2,
        maxPitch: pc + pitchSpan / 2
      }
    });
  };

  const setCoverage = (partial: boolean) => {
    if (!selected) return;
    if (partial) setCoverageWindow(0, 120);
    else patchScene(selected.id, { coverage: undefined });
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recorrido virtual 360°</h3>
          <p className="text-sm text-muted-foreground">
            Subí fotos panorámicas (modo panorama del celular), ordená las escenas y conectalas con puntos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={tour.enabled}
              onChange={(e) => setTour((t) => ({ ...t, enabled: e.target.checked }))}
              className="h-4 w-4 accent-primary"
              disabled={tour.scenes.length === 0}
            />
            Publicado
          </label>
          <Button onClick={handleSave} disabled={saving || tour.scenes.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
            Guardar
          </Button>
        </div>
      </div>

      {message && (
        <p className={`rounded-md px-3 py-2 text-sm ${message.kind === 'ok'
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive'}`} role="status">
          {message.text}
        </p>
      )}

      {/* Subida */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="flex-1 min-w-0"
          placeholder="Nombre de la escena (opcional)"
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          maxLength={100}
        />
        <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {uploading ? 'Procesando…' : 'Subir panorámica'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Mínimo 2048×720px, formato panorámico. Se generan variantes AVIF/WebP y una vista previa automáticamente.
        {uploading && <span className="ml-1 font-medium text-foreground">Procesando la panorámica (hasta ~15&nbsp;s), no cierres la página…</span>}
      </p>

      {/* Preview + editor de escenas */}
      {selected ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div
              ref={previewRef}
              onPointerDown={handlePreviewPointerDown}
              onClick={handlePreviewClick}
              className={`relative aspect-video w-full overflow-hidden rounded-lg bg-muted ${placing ? 'ring-2 ring-primary' : ''}`}
              aria-label="Vista previa del recorrido"
            >
              {/* Overlay de hotspots — los puntos son clickeables para probar la navegación entre escenas */}
              <div className="pointer-events-none absolute inset-0 z-10">
                {(selected.hotspots ?? []).map((hotspot) => (
                  <button
                    key={hotspot.id}
                    ref={(el) => {
                      if (el) hotspotEls.current.set(hotspot.id, el);
                      else hotspotEls.current.delete(hotspot.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // don't trigger placement
                      setSelectedId(hotspot.toScene);
                    }}
                    className={`absolute left-0 top-0 flex flex-col items-center gap-1 ${placing ? 'pointer-events-none' : 'pointer-events-auto'}`}
                    style={{ transform: 'translate(-50%, -50%)' }}
                    aria-label={`Ir a ${hotspot.label}`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg ring-2 ring-background/60 transition-transform hover:scale-110">
                      <RadioTower className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="max-w-24 truncate rounded bg-background/80 px-1.5 py-0.5 text-xs text-foreground">
                      {hotspot.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant={placing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlacing((p) => !p)}
                disabled={tour.scenes.length < 2}
              >
                <Crosshair className="mr-1 h-4 w-4" aria-hidden />
                {placing ? 'Tocá en la imagen…' : 'Colocar punto aquí'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const engine = engineRef.current;
                  if (!engine || !selected) return;
                  patchScene(selected.id, {
                    initialView: {
                      pitch: Math.round(engine.getView().pitch * 10) / 10,
                      yaw: Math.round(engine.getView().yaw * 10) / 10,
                      fov: Math.round(engine.getView().fov)
                    }
                  });
                }}
              >
                <Eye className="mr-1 h-4 w-4" aria-hidden />
                Usar vista actual como inicial
              </Button>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-2">
            {/* Lista de escenas */}
            <div className="space-y-2">
              {tour.scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className={`flex items-center gap-2 rounded-md border p-2 ${scene.id === selected.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border'}`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(scene.id)}
                  >
                    <span className="block truncate text-sm font-medium text-foreground">{scene.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {scene.image.width}×{scene.image.height}
                      {scene.coverage ? ' · parcial' : ' · esfera completa'}
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => moveScene(index, -1)} disabled={index === 0} aria-label="Subir escena">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveScene(index, 1)} disabled={index === tour.scenes.length - 1} aria-label="Bajar escena">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleDeleteScene(scene.id)} aria-label="Eliminar escena">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Nombre editable (también editable al subir; el guardado persiste scenes[].name) */}
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label htmlFor="scene-name" className="text-sm font-semibold text-foreground">Nombre de la escena</Label>
              <Input
                id="scene-name"
                value={selected.name}
                maxLength={100}
                onChange={(e) => patchScene(selected.id, { name: e.target.value })}
                aria-label="Nombre de la escena"
              />
            </div>

            {/* Vista inicial */}
            <div className="space-y-3 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold text-foreground">Vista inicial</h4>
              <SliderField
                label="Yaw (horizontal)"
                value={selected.initialView.yaw}
                min={-180}
                max={180}
                onChange={(v) => patchScene(selected.id, { initialView: { ...selected.initialView, yaw: v } })}
              />
              <SliderField
                label="Pitch (vertical)"
                value={selected.initialView.pitch}
                min={-85}
                max={85}
                onChange={(v) => patchScene(selected.id, { initialView: { ...selected.initialView, pitch: v } })}
              />
              <SliderField
                label="Zoom (FOV)"
                value={selected.initialView.fov}
                min={30}
                max={100}
                onChange={(v) => patchScene(selected.id, { initialView: { ...selected.initialView, fov: v } })}
              />
            </div>

            {/* Coverage */}
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(coverage)}
                  onChange={(e) => setCoverage(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Panorámica parcial
              </label>
              <p className="text-xs text-muted-foreground">
                Marcala si la foto no cubre los 360° (panorámica de barrido). Ajustá la ventana visible.
              </p>
              {coverage && (
                <>
                  <SliderField
                    label="Centro horizontal"
                    value={covYawCenter}
                    min={-180}
                    max={180}
                    onChange={(v) => setCoverageWindow(v, covYawSpan)}
                  />
                  <SliderField
                    label="Ancho horizontal"
                    value={covYawSpan}
                    min={20}
                    max={360}
                    onChange={(v) => setCoverageWindow(covYawCenter, v)}
                  />
                  <SliderField
                    label="Centro vertical"
                    value={covPitchCenter}
                    min={-90}
                    max={90}
                    onChange={(v) => setCoverageWindow(covYawCenter, covYawSpan, v)}
                  />
                  <p className="text-xs text-muted-foreground">
                    El alto vertical se calcula solo a partir del ancho y la proporción de la foto, para que la imagen no se deforme.
                  </p>
                </>
              )}
            </div>

            {/* Hotspots */}
            <div className="space-y-2 rounded-md border border-border p-3">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <RadioTower className="h-4 w-4 text-primary" aria-hidden />
                Puntos de navegación ({(selectedHotspots ?? []).length})
              </h4>
              {(selectedHotspots ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Usá “Colocar punto aquí” para marcar en la imagen dónde se pasa a otra escena.
                </p>
              )}
              {(selectedHotspots ?? []).map((hotspot) => (
                <div key={hotspot.id} className="flex items-center gap-2">
                  <Input
                    value={hotspot.label}
                    maxLength={60}
                    onChange={(e) => patchScene(selected.id, {
                      hotspots: (selected.hotspots ?? []).map((h) => (h.id === hotspot.id ? { ...h, label: e.target.value } : h))
                    })}
                    className="h-8 flex-1"
                    aria-label="Etiqueta del punto"
                  />
                  <select
                    value={hotspot.toScene}
                    onChange={(e) => patchScene(selected.id, {
                      hotspots: (selected.hotspots ?? []).map((h) => (h.id === hotspot.id ? { ...h, toScene: e.target.value } : h))
                    })}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    aria-label="Escena de destino"
                  >
                    {tour.scenes.filter((s) => s.id !== selected.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => patchScene(selected.id, {
                      hotspots: (selected.hotspots ?? []).filter((h) => h.id !== hotspot.id)
                    })}
                    aria-label="Eliminar punto"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Todavía no hay escenas. Subí la primera panorámica para armar el recorrido.
        </p>
      )}
    </div>
  );
}
