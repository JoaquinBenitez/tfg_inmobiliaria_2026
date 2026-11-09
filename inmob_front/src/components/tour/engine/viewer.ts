/**
 * Motor del visor de panoramas equirectangulares (Requisito 1). three.js puro, sin
 * React — el wrapper de React (../TourViewer) es dueño del timing de mount/dispose.
 *
 * Contrato de ciclo de vida (obligatorio para el trabajo final):
 *   - `dispose()` libera geometría, material, texturas y renderer, y fuerza la
 *     pérdida del contexto; es seguro llamarlo varias veces.
 *   - El render es on-demand: los frames se producen solo mientras la vista se
 *     anima (drag / inercia / zoom / cambio de escena), nunca un rAF libre.
 *   - Texturas progresivas: poster → baja resolución → resolución completa,
 *     intercambiadas vía `texture.needsUpdate` (protección del LCP — ver el wrapper de React).
 */

import * as THREE from 'three';
import {
  clamp,
  clampPitch,
  damp,
  navigationBounds,
  normalizeYaw,
  coverageToTextureTransform,
  type ViewAngles
} from './math';
import type { SceneCoverage } from '@/types/property';

export interface ViewerSceneConfig {
  sceneId: string;
  /** WebP a resolución completa. */
  url: string;
  avifUrl?: string;
  mobileUrl?: string;
  mobileAvifUrl?: string;
  posterUrl?: string;
  coverage?: SceneCoverage;
  initialView: ViewAngles;
}

export interface ViewerMetrics {
  initMs?: number;
  textureMs?: number;
  interactionFps?: number;
}

export interface ViewerCallbacks {
  /** Llamado una vez por frame renderizado — hook de sincronización de overlay/hotspots. */
  onFrame?: (view: ViewAngles, viewport: { width: number; height: number }) => void;
  onMetrics?: (metrics: ViewerMetrics) => void;
  /** Primera interacción de puntero (dispara el descarte del poster). */
  onFirstInteract?: () => void;
  /** Contexto WebGL perdido — el llamador debe disponer y volver al poster. */
  onContextLost?: () => void;
  onSceneLoaded?: (sceneId: string) => void;
}

const SPHERE_RADIUS = 500;
const INERTIA_LAMBDA = 3.2; // decaimiento de la inercia
const CONTROL_LAMBDA = 14; // respuesta del arrastre
const MIN_INERTIA = 0.5; // deg/s por debajo de los cuales la inercia se detiene

export class PanoramaViewer {
  private container: HTMLElement;
  private callbacks: ViewerCallbacks;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
  private geometry: THREE.SphereGeometry | null = null;
  private material: THREE.MeshBasicMaterial | null = null;
  private texture: THREE.Texture | null = null;
  private textureLoader = new THREE.TextureLoader();
  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;
  private disposed = false;
  private lastFrameTime = 0;
  private loadToken = 0;

  private view: ViewAngles = { pitch: 0, yaw: 0, fov: 75 };
  private target: ViewAngles = { pitch: 0, yaw: 0, fov: 75 };
  private velocity = { yaw: 0, pitch: 0 }; // inercia en deg/s
  private currentCoverage: SceneCoverage | undefined;
  private textureStage = 0; // 0 ninguna → 1 poster → 2 baja → 3 completa (monotónico por escena)
  private activePointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { distance: number; fov: number } | null = null;
  private lastDrag: { x: number; y: number; time: number } | null = null;
  private interacted = false;
  private frameCount = 0;
  private frameWindowStart = 0;
  private animating = false;

  constructor(container: HTMLElement, callbacks: ViewerCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    const initStart = performance.now();
    try {
      this.initGL();
    } catch (err) {
      this.dispose();
      throw err;
    }
    this.callbacks.onMetrics?.({ initMs: Math.round(performance.now() - initStart) });
  }

  private initGL(): void {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(this.container.clientWidth || 640, this.container.clientHeight || 360);
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    this.geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 60, 40).scale(-1, 1, 1); // invertida: se ve desde adentro
    this.material = new THREE.MeshBasicMaterial(); // sin iluminación — el panorama ES la luz
    const mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(mesh);

    this.camera.position.set(0, 0, 0.001); // en el centro de la esfera

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    const el = renderer.domElement;
    el.addEventListener('pointerdown', this.handlePointerDown);
    el.addEventListener('pointermove', this.handlePointerMove);
    el.addEventListener('pointerup', this.handlePointerUp);
    el.addEventListener('pointercancel', this.handlePointerUp);
    el.addEventListener('wheel', this.handleWheel, { passive: false });

    this.handleResize();
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault(); // permitiría restaurar; optamos por fallback
    this.callbacks.onContextLost?.();
  };

  private handleResize = (): void => {
    if (!this.renderer || this.disposed) return;
    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 360;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  };

  // ------------------------------------------------------------------
  // Pipeline de texturas (progresivo: poster → baja → completa)
  // ------------------------------------------------------------------

  private applyTexture(texture: THREE.Texture, coverage: SceneCoverage | undefined, stage: number): void {
    if (stage < this.textureStage) {
      texture.dispose(); // ya se aplicó una etapa de mejor calidad
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    // Esfera completa: repeat para la costura ±180°. Parcial: clamp — pasado el borde de
    // la ventana se estira el último píxel en vez de repetir la imagen (la "vuelta a empezar").
    texture.wrapS = coverage ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter; // sin regeneración de mipmaps en swaps en caliente
    texture.generateMipmaps = false;
    const t = coverageToTextureTransform(coverage);
    texture.repeat.set(t.repeatX, t.repeatY);
    texture.offset.set(t.offsetX, t.offsetY);
    if (this.texture) this.texture.dispose();
    this.texture = texture;
    this.textureStage = stage;
    this.material!.map = texture;
    this.material!.needsUpdate = true;
    this.requestRender();
  }

  private async loadTexture(url: string): Promise<THREE.Texture> {
    return this.textureLoader.loadAsync(url);
  }

  /** URL a resolución completa con intento AVIF → fallback WebP, tier de ancho según dispositivo. */
  private pickFullResUrl(scene: ViewerSceneConfig): { url: string; lowUrl: string } {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 900 || (navigator.hardwareConcurrency ?? 8) <= 4);
    const full = isMobile
      ? (scene.mobileAvifUrl ?? scene.mobileUrl ?? scene.url)
      : (scene.avifUrl ?? scene.url);
    const low = isMobile
      ? (scene.mobileUrl ?? scene.url)
      : (scene.mobileUrl ?? scene.url);
    return { url: full, lowUrl: low };
  }

  async loadScene(scene: ViewerSceneConfig, options: { fade?: boolean } = {}): Promise<void> {
    const token = ++this.loadToken;
    this.currentCoverage = scene.coverage;
    this.textureStage = 0;
    const textureStart = performance.now();

    // 1) poster (barato, típicamente ya cacheado por el <Image> del wrapper)
    if (scene.posterUrl) {
      try {
        const poster = await this.loadTexture(scene.posterUrl);
        if (this.disposed || token !== this.loadToken) { poster.dispose(); return; }
        this.applyTexture(poster, scene.coverage, 1);
      } catch {
        // el poster es una optimización — seguir a resolución completa
      }
    }

    // 2) variante de baja resolución (blur-up rápido), luego 3) resolución completa
    const { url, lowUrl } = this.pickFullResUrl(scene);
    const lowPromise: Promise<THREE.Texture | null> =
      lowUrl && lowUrl !== url
        ? this.loadTexture(lowUrl).catch(() => null)
        : Promise.resolve(null);
    const fullPromise: Promise<THREE.Texture | null> = this.loadTexture(url).catch(() =>
      url !== scene.url ? this.loadTexture(scene.url) : Promise.reject(new Error('texture failed'))
    ).catch(() => null);

    const [low, full] = await Promise.all([lowPromise, fullPromise]);
    if (this.disposed || token !== this.loadToken) {
      low?.dispose();
      full?.dispose();
      return;
    }
    if (low) this.applyTexture(low, scene.coverage, 2);
    if (full) {
      this.applyTexture(full, scene.coverage, 3);
      this.callbacks.onMetrics?.({ textureMs: Math.round(performance.now() - textureStart) });
    }

    this.setView(scene.initialView);
    this.callbacks.onSceneLoaded?.(scene.sceneId);
    if (options.fade !== false) {
      this.container.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
  }

  // ------------------------------------------------------------------
  // Estado de vista + controles
  // ------------------------------------------------------------------

  /**
   * Actualiza en vivo la ventana de coverage parcial sin recargar texturas —
   * lo usa la preview del admin mientras se mueven los sliders de coverage.
   */
  updateCoverage(coverage: SceneCoverage | undefined): void {
    this.currentCoverage = coverage;
    if (this.texture) {
      const t = coverageToTextureTransform(coverage);
      this.texture.repeat.set(t.repeatX, t.repeatY);
      this.texture.offset.set(t.offsetX, t.offsetY);
      const wrapS = coverage ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      if (this.texture.wrapS !== wrapS) {
        this.texture.wrapS = wrapS;
        this.texture.needsUpdate = true; // el wrap es parámetro GL de la textura, no uniform
      }
    }
    this.clampViewToCoverage();
    this.view = { ...this.target };
    this.applyView();
    this.requestRender();
  }

  getView(): ViewAngles {
    return { ...this.view, yaw: normalizeYaw(this.view.yaw) };
  }

  setView(next: ViewAngles): void {
    this.view = { ...next };
    this.target = { ...next };
    this.velocity = { yaw: 0, pitch: 0 };
    this.clampViewToCoverage();
    this.view = { ...this.target };
    this.applyView();
    this.requestRender();
  }

  /** Ángulos actuales clampeados contra el coverage de la escena cargada. */
  private clampViewToCoverage(): void {
    const aspect = this.camera.aspect || 16 / 9;
    const bounds = navigationBounds(this.currentCoverage, this.target.fov, aspect);
    if (this.currentCoverage) {
      // Panorama parcial: mantener el centro dentro de la ventana cubierta. Los valores
      // quedan acotados tras setView(), así que el clampeo directo es seguro para la costura.
      this.target.yaw = clamp(this.target.yaw, bounds.minYaw, bounds.maxYaw);
    }
    this.target.pitch = clampPitch(clamp(this.target.pitch, bounds.minPitch, bounds.maxPitch));
    this.target.fov = clamp(this.target.fov, 30, 100);
  }

  private applyView(): void {
    this.camera.fov = this.view.fov;
    this.camera.rotation.set(this.view.pitch * (Math.PI / 180), this.view.yaw * (Math.PI / 180), 0, 'YXZ');
    this.camera.updateProjectionMatrix();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.velocity = { yaw: 0, pitch: 0 };
    this.lastDrag = { x: event.clientX, y: event.clientY, time: performance.now() };
    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      this.pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), fov: this.target.fov };
    }
    if (!this.interacted) {
      this.interacted = true;
      this.callbacks.onFirstInteract?.();
    }
    this.frameCount = 0;
    this.frameWindowStart = performance.now();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.disposed || !this.activePointers.has(event.pointerId)) return;
    const previous = this.activePointers.get(event.pointerId)!;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2 && this.pinchStart) {
      const [a, b] = [...this.activePointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = this.pinchStart.distance / Math.max(distance, 1);
      this.target.fov = clamp(this.pinchStart.fov * scale, 30, 100);
      this.clampViewToCoverage();
      this.requestRender();
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    const degPerPx = this.view.fov / Math.max(this.container.clientHeight, 1);
    // el yaw queda sin acotar — directionVector/projection son periódicos, y el damping
    // a través de la costura ±180° giraría por el camino largo.
    // Semántica de agarre: arrastrar a la derecha mueve la imagen a la derecha → la cámara gira a la izquierda (+yaw).
    this.target.yaw = this.target.yaw + dx * degPerPx;
    this.target.pitch = this.target.pitch + dy * degPerPx;
    this.clampViewToCoverage();

    const now = performance.now();
    const dt = Math.max((now - (this.lastDrag?.time ?? now)) / 1000, 0.001);
    if (this.lastDrag) {
      this.velocity = {
        yaw: clamp((dx * degPerPx) / dt, -400, 400),
        pitch: clamp((dy * degPerPx) / dt, -400, 400)
      };
    }
    this.lastDrag = { x: event.clientX, y: event.clientY, time: now };
    this.requestRender();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) this.pinchStart = null;
    if (this.activePointers.size === 0 && this.lastDrag) {
      // FPS de interacción: frames renderizados durante esta ráfaga de arrastre
      const elapsed = (performance.now() - this.frameWindowStart) / 1000;
      if (elapsed > 0.2 && this.frameCount > 1) {
        this.callbacks.onMetrics?.({ interactionFps: Math.round(this.frameCount / elapsed) });
      }
      this.lastDrag = null;
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    if (this.disposed) return;
    event.preventDefault();
    this.target.fov = clamp(this.target.fov + event.deltaY * 0.05, 30, 100);
    this.clampViewToCoverage();
    this.requestRender();
  };

  // ------------------------------------------------------------------
  // Loop de render on-demand
  // ------------------------------------------------------------------

  private requestRender(): void {
    if (this.disposed || this.animating) return;
    this.animating = true;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // inercia
    if (this.activePointers.size === 0 && (Math.abs(this.velocity.yaw) > MIN_INERTIA || Math.abs(this.velocity.pitch) > MIN_INERTIA)) {
      this.target.yaw = this.target.yaw + this.velocity.yaw * dt;
      this.target.pitch = this.target.pitch + this.velocity.pitch * dt;
      this.clampViewToCoverage();
      const decay = Math.exp(-INERTIA_LAMBDA * dt);
      this.velocity.yaw *= decay;
      this.velocity.pitch *= decay;
    }

    // suavizado hacia el objetivo
    this.view.yaw = damp(this.view.yaw, this.target.yaw, CONTROL_LAMBDA, dt);
    this.view.pitch = clampPitch(damp(this.view.pitch, this.target.pitch, CONTROL_LAMBDA, dt));
    this.view.fov = damp(this.view.fov, this.target.fov, CONTROL_LAMBDA, dt);
    this.applyView();
    this.renderer!.render(this.scene, this.camera);
    this.frameCount++;

    this.callbacks.onFrame?.(
      { ...this.view },
      { width: this.container.clientWidth, height: this.container.clientHeight }
    );

    const settled =
      Math.abs(this.view.yaw - this.target.yaw) < 0.02 &&
      Math.abs(this.view.pitch - this.target.pitch) < 0.02 &&
      Math.abs(this.view.fov - this.target.fov) < 0.02 &&
      Math.abs(this.velocity.yaw) <= MIN_INERTIA &&
      Math.abs(this.velocity.pitch) <= MIN_INERTIA;

    if (settled) {
      this.animating = false;
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  // ------------------------------------------------------------------
  // Dispose — liberación completa de recursos WebGL (Requisito 1)
  // ------------------------------------------------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.animating = false;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.renderer) {
      const el = this.renderer.domElement;
      el.removeEventListener('webglcontextlost', this.handleContextLost);
      el.removeEventListener('pointerdown', this.handlePointerDown);
      el.removeEventListener('pointermove', this.handlePointerMove);
      el.removeEventListener('pointerup', this.handlePointerUp);
      el.removeEventListener('pointercancel', this.handlePointerUp);
      el.removeEventListener('wheel', this.handleWheel);
    }

    this.texture?.dispose();
    this.texture = null;
    this.material?.dispose();
    this.material = null;
    this.geometry?.dispose();
    this.geometry = null;
    this.scene.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
  }
}
