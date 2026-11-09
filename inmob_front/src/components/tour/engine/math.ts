/**
 * Matemática esférica pura para el motor 360° (Requisito 1). Sin three.js, sin
 * DOM — testeable con unit tests. El visor consume estas funciones; la preview
 * del TourBuilder y el posicionamiento de hotspots las reutilizan.
 *
 * Convenciones (grados, matching con la cámara three.js que construye el visor):
 *   yaw   ∈ [-180, 180), rotación alrededor de Y (0 mira a -Z, +yaw gira a la izquierda)
 *   pitch ∈ [-90, 90], +pitch mira hacia arriba
 *   fov   campo de visión vertical ∈ [30, 100]
 */

import type { SceneCoverage } from '@/types/property';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const PITCH_LIMIT = 85;

export interface Angles {
  pitch: number;
  yaw: number;
}

export interface ViewAngles extends Angles {
  fov: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
}

/** Envuelve el yaw en [-180, 180). */
export function normalizeYaw(yaw: number): number {
  let y = (yaw + 180) % 360;
  if (y < 0) y += 360;
  return y - 180;
}

/** Vector de dirección unitario para ángulos esféricos (espacio de cámara three.js). */
export function directionVector(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const yawR = yaw * DEG2RAD;
  const pitchR = pitch * DEG2RAD;
  const cosPitch = Math.cos(pitchR);
  return {
    x: -Math.sin(yawR) * cosPitch,
    y: Math.sin(pitchR),
    z: -Math.cos(yawR) * cosPitch
  };
}

/** Base de la cámara (right/up/forward) para un estado de vista. */
export function cameraBasis(view: ViewAngles): {
  right: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
} {
  const yawR = view.yaw * DEG2RAD;
  const pitchR = view.pitch * DEG2RAD;
  const sy = Math.sin(yawR);
  const cy = Math.cos(yawR);
  const sp = Math.sin(pitchR);
  const cp = Math.cos(pitchR);
  return {
    right: { x: cy, y: 0, z: -sy },
    up: { x: sy * sp, y: cp, z: cy * sp },
    forward: { x: -sy * cp, y: sp, z: -cy * cp }
  };
}

function dot(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export interface Projection {
  /** Posición en píxeles en el viewport. */
  x: number;
  y: number;
  /** Profundidad sobre el eje de vista (para pistas de escala). */
  depth: number;
  /** Producto punto con forward — negativo significa detrás de la cámara. */
  forwardDot: number;
  /** Verdadero cuando está delante de la cámara y dentro del viewport (+margen). */
  visible: boolean;
}

/**
 * Proyecta una posición esférica (hotspot) a la pantalla para una vista dada.
 * Equivalente puro del `Vector3.project(camera)` de three.js + frustum culling.
 */
export function projectToScreen(
  target: Angles,
  view: ViewAngles,
  viewport: Viewport,
  marginPx = 64
): Projection {
  const basis = cameraBasis(view);
  const v = directionVector(target.yaw, target.pitch);
  const forwardDot = dot(v, basis.forward);
  const rightDot = dot(v, basis.right);
  const upDot = dot(v, basis.up);

  const tanHalfV = Math.tan(view.fov * DEG2RAD / 2);
  const aspect = viewport.width / viewport.height;

  // Proyección pinhole con longitud focal unitaria
  const u = (rightDot / forwardDot) / (tanHalfV * aspect);
  const w = (upDot / forwardDot) / tanHalfV;

  const x = (u / 2 + 0.5) * viewport.width;
  const y = (0.5 - w / 2) * viewport.height;
  const visible =
    forwardDot > 0 &&
    x >= -marginPx && x <= viewport.width + marginPx &&
    y >= -marginPx && y <= viewport.height + marginPx;

  return { x, y, depth: forwardDot, forwardDot, visible };
}

/**
 * Proyección inversa: píxel del viewport → ángulos esféricos bajo un estado de vista.
 * La usa el TourBuilder para colocar hotspots con click y "fijar vista inicial".
 */
export function screenToAngles(px: number, py: number, view: ViewAngles, viewport: Viewport): Angles {
  const basis = cameraBasis(view);
  const tanHalfV = Math.tan(view.fov * DEG2RAD / 2);
  const aspect = viewport.width / viewport.height;
  const u = (px / viewport.width * 2 - 1) * tanHalfV * aspect;
  const w = (0.5 - py / viewport.height) * 2 * tanHalfV;

  const ray = {
    x: basis.forward.x + basis.right.x * u + basis.up.x * w,
    y: basis.forward.y + basis.right.y * u + basis.up.y * w,
    z: basis.forward.z + basis.right.z * u + basis.up.z * w
  };
  const pitch = Math.asin(clamp(ray.y / Math.hypot(ray.x, ray.y, ray.z), -1, 1)) * RAD2DEG;
  const yaw = Math.atan2(-ray.x, -ray.z) * RAD2DEG;
  return { pitch, yaw: normalizeYaw(yaw) };
}

/**
 * Damping exponencial: mueve `current` hacia `target` con suavizado independiente
 * del framerate. `lambda` ≈ respuesta (mayor = más ágil).
 */
export function damp(current: number, target: number, lambda: number, dtSeconds: number): number {
  if (dtSeconds <= 0) return current;
  const t = 1 - Math.exp(-lambda * dtSeconds);
  return current + (target - current) * t;
}

export interface NavigationBounds {
  minYaw: number;
  maxYaw: number;
  minPitch: number;
  maxPitch: number;
}

/**
 * Límites de clampeo para el *centro* de la vista según el coverage de la escena y el
 * fov actual. Esfera completa: yaw libre, pitch ±85 (contrato del roadmap). Panorama
 * parcial: margen = frustum COMPLETO — el borde exterior de la vista frena exactamente
 * en el borde de la imagen, así nunca se ve negro más allá del fade. Si la ventana es
 * más angosta que el frustum, colapsa al centro (el negro simétrico restante es
 * inevitable; con zoom el panorama vuelve a ser navegable).
 */
export function navigationBounds(
  coverage: SceneCoverage | undefined,
  fov: number,
  aspect: number
): NavigationBounds {
  const halfV = (fov / 2) * DEG2RAD;
  const halfH = Math.atan(Math.tan(halfV) * aspect);

  if (!coverage) {
    return { minYaw: -180, maxYaw: 180, minPitch: -PITCH_LIMIT, maxPitch: PITCH_LIMIT };
  }

  const centerYaw = (coverage.minYaw + coverage.maxYaw) / 2;
  const centerPitch = (coverage.minPitch + coverage.maxPitch) / 2;

  const minYaw = Math.min(coverage.minYaw + halfH * RAD2DEG, centerYaw);
  const maxYaw = Math.max(coverage.maxYaw - halfH * RAD2DEG, centerYaw);
  const minPitch = Math.min(clamp(coverage.minPitch + halfV * RAD2DEG, -PITCH_LIMIT, PITCH_LIMIT), centerPitch);
  const maxPitch = Math.max(clamp(coverage.maxPitch - halfV * RAD2DEG, -PITCH_LIMIT, PITCH_LIMIT), minPitch);

  return {
    minYaw,
    maxYaw: Math.max(maxYaw, minYaw),
    minPitch,
    maxPitch: Math.max(maxPitch, minPitch)
  };
}

export interface TextureTransform {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Transformación UV que mapea un panorama (posiblemente parcial) a la esfera para
 * que la imagen cubra exactamente su ventana de coverage, centrada en ella.
 *
 * Derivada de la SphereGeometry de three.js (u = 0.75 − yaw/360 mod 1 en el
 * ecuador, uv.y = (90+pitch)/180 con flipY por defecto — el tope de la imagen
 * apunta arriba):
 *   la u=0 de la imagen (borde izquierdo) queda en maxYaw y u crece cuando el
 *   yaw decrece (girar a la derecha en el pano = girar a la derecha en pantalla),
 *   de ahí repeat = span-total/span-ventana y el offset anclado al borde de la ventana.
 * Esfera completa → { repeat 1, offset (−0.25, 0) }: las imágenes equirect estándar
 * quedan 90° rotadas bajo la identidad, esto lo corrige para que el yaw sea absoluto.
 */
export function coverageToTextureTransform(coverage: SceneCoverage | undefined): TextureTransform {
  if (!coverage) return { repeatX: 1, repeatY: 1, offsetX: -0.25, offsetY: 0 };
  const yawSpan = clamp(coverage.maxYaw - coverage.minYaw, 1, 360);
  const pitchSpan = clamp(coverage.maxPitch - coverage.minPitch, 1, 180);
  const repeatX = 360 / yawSpan;
  const repeatY = 180 / pitchSpan;
  return {
    repeatX,
    repeatY,
    offsetX: (coverage.maxYaw / 360 - 0.75) * repeatX,
    offsetY: -((90 + coverage.minPitch) / 180) * repeatY
  };
}
