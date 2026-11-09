import { FieldError } from './appError';

/**
 * Modelo de dominio del recorrido 360° (Requisito 1). Un tour es un grafo de escenas
 * conectadas por hotspots. Las escenas referencian variantes preprocesadas del
 * panorama (AVIF/WebP desktop + mobile + poster) generadas al subir.
 *
 * Panoramas parciales (ADR 0003 — panos de barrido de celular): una escena puede
 * declarar una ventana `coverage`; la navegación y la transformación de la textura
 * se clampean a ella. Sin coverage = esfera completa (fuente equirectangular 2:1 real).
 */

export const PITCH_LIMIT = 85; // grados, clamp de navegación en esfera completa
export const FOV_MIN = 30;
export const FOV_MAX = 100;
export const YAW_MIN = -180;
export const YAW_MAX = 180;

export const MAX_SCENES = 12;
export const MAX_HOTSPOTS_PER_SCENE = 20;
export const MAX_SCENE_NAME_LENGTH = 100;
export const MAX_HOTSPOT_LABEL_LENGTH = 60;

/** Ventana angular de un panorama parcial, en grados. */
export interface SceneCoverage {
    minYaw: number;
    maxYaw: number;
    minPitch: number;
    maxPitch: number;
}

export interface SceneInitialView {
    pitch: number;
    yaw: number;
    fov: number;
}

/** Variantes de panorama almacenadas para una escena. */
export interface SceneImage {
    url: string;
    publicId: string;
    avifUrl?: string;
    avifPublicId?: string;
    mobileUrl?: string;
    mobilePublicId?: string;
    mobileAvifUrl?: string;
    mobileAvifPublicId?: string;
    posterUrl: string;
    posterPublicId: string;
    width: number;
    height: number;
}

export interface TourHotspot {
    id: string;
    toScene: string;
    pitch: number;
    yaw: number;
    label: string;
}

export interface TourScene {
    id: string;
    name: string;
    image: SceneImage;
    coverage?: SceneCoverage;
    initialView: SceneInitialView;
    /** Anidados por escena (decisión cerrada 2026-09-05): un hotspot pertenece a exactamente una escena. */
    hotspots: TourHotspot[];
}

export interface Tour {
    enabled: boolean;
    scenes: TourScene[];
}

export const EMPTY_TOUR: Tour = { enabled: false, scenes: [] };

export function isFullSphereAspect(width: number, height: number): boolean {
    if (height <= 0) return false;
    const ratio = width / height;
    return ratio > 1.9 && ratio < 2.1;
}

/**
 * Heurística de coverage inicial para un panorama parcial (no 2:1). Los admins la
 * refinan con los sliders del TourBuilder — solo necesita ser razonable, no exacta.
 *
 * Un pano equirectangular tiene UNA escala angular (°/px): el span de pitch se deriva
 * del de yaw vía el aspecto de la imagen, o la textura queda estirada al mapearla.
 * // ponytail: heurística fija (60° base escalada por aspecto); auto-detección GPano/XMP si el ajuste manual resulta doloroso
 */
export function defaultCoverage(width: number, height: number): SceneCoverage {
    const yawSpan = Math.min(360, Math.max(90, Math.round((width / height) * 60)));
    const pitchSpan = Math.min(180, Math.max(10, (yawSpan * height) / width));
    return {
        minYaw: -Math.min(180, yawSpan / 2),
        maxYaw: Math.min(180, yawSpan / 2),
        minPitch: -Math.min(90, pitchSpan / 2),
        maxPitch: Math.min(90, pitchSpan / 2)
    };
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function checkAngle(errors: FieldError[], field: string, value: unknown, min: number, max: number): void {
    if (!isFiniteNumber(value) || value < min || value > max) {
        errors.push({ field, message: `${field} must be a number between ${min} and ${max}` });
    }
}

export function validateCoverage(coverage: unknown, field: string, errors: FieldError[]): void {
    if (typeof coverage !== 'object' || coverage === null) {
        errors.push({ field, message: `${field} must be an object` });
        return;
    }
    const c = coverage as Record<string, unknown>;
    checkAngle(errors, `${field}.minYaw`, c.minYaw, YAW_MIN, YAW_MAX);
    checkAngle(errors, `${field}.maxYaw`, c.maxYaw, YAW_MIN, YAW_MAX);
    checkAngle(errors, `${field}.minPitch`, c.minPitch, -90, 90);
    checkAngle(errors, `${field}.maxPitch`, c.maxPitch, -90, 90);
    if (
        isFiniteNumber(c.minYaw) && isFiniteNumber(c.maxYaw)
        && c.maxYaw - c.minYaw >= 20 && c.maxYaw - c.minYaw <= 360
    ) {
        // rango de yaw válido
    } else if (isFiniteNumber(c.minYaw) && isFiniteNumber(c.maxYaw)) {
        errors.push({ field: `${field}.yawSpan`, message: 'yaw span must be between 20 and 360 degrees' });
    }
    if (
        isFiniteNumber(c.minPitch) && isFiniteNumber(c.maxPitch)
        && c.maxPitch - c.minPitch >= 10 && c.maxPitch - c.minPitch <= 180
    ) {
        // rango de pitch válido
    } else if (isFiniteNumber(c.minPitch) && isFiniteNumber(c.maxPitch)) {
        errors.push({ field: `${field}.pitchSpan`, message: 'pitch span must be between 10 and 180 degrees' });
    }
}

/**
 * Valida un parche de metadatos del tour (guardado del TourBuilder). Los datos de
 * imagen de las escenas son del servidor: el parche solo puede reordenar escenas y
 * editar name / initialView / coverage / hotspots; los hotspots van anidados por
 * escena (decisión cerrada) y se reemplazan completos por escena cuando se envían.
 */
export interface TourUpdatePatch {
    enabled?: boolean;
    scenes?: Array<{
        id: string;
        name?: string;
        initialView?: { pitch: number; yaw: number; fov: number };
        coverage?: SceneCoverage | null;
        hotspots?: TourHotspot[];
    }>;
}

export function validateTourUpdate(current: Tour | undefined, patch: unknown): FieldError[] {
    const errors: FieldError[] = [];
    if (typeof patch !== 'object' || patch === null) {
        return [{ field: 'body', message: 'Request body must be an object' }];
    }
    const body = patch as Record<string, unknown>;

    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
        errors.push({ field: 'enabled', message: 'enabled must be a boolean' });
    }

    const existingIds = new Set((current?.scenes ?? []).map((s) => s.id));

    if (body.scenes !== undefined) {
        if (!Array.isArray(body.scenes)) {
            errors.push({ field: 'scenes', message: 'scenes must be an array' });
        } else if (new Set(body.scenes.map((s) => (s as Record<string, unknown>).id)).size !== body.scenes.length) {
            errors.push({ field: 'scenes', message: 'scene ids must be unique' });
        } else {
            body.scenes.forEach((entry: unknown, index: number) => {
                const prefix = `scenes[${index}]`;
                if (typeof entry !== 'object' || entry === null) {
                    errors.push({ field: prefix, message: 'Scene must be an object' });
                    return;
                }
                const scene = entry as Record<string, unknown>;
                if (typeof scene.id !== 'string' || !existingIds.has(scene.id)) {
                    errors.push({ field: `${prefix}.id`, message: 'Unknown scene id — upload scenes before referencing them' });
                }
                if (scene.name !== undefined) {
                    if (typeof scene.name !== 'string' || scene.name.trim().length === 0) {
                        errors.push({ field: `${prefix}.name`, message: 'name must be a non-empty string' });
                    } else if (scene.name.length > MAX_SCENE_NAME_LENGTH) {
                        errors.push({ field: `${prefix}.name`, message: `name must not exceed ${MAX_SCENE_NAME_LENGTH} characters` });
                    }
                }
                if (scene.initialView !== undefined) {
                    const view = scene.initialView as Record<string, unknown>;
                    checkAngle(errors, `${prefix}.initialView.pitch`, view?.pitch, -PITCH_LIMIT, PITCH_LIMIT);
                    checkAngle(errors, `${prefix}.initialView.yaw`, view?.yaw, YAW_MIN, YAW_MAX);
                    checkAngle(errors, `${prefix}.initialView.fov`, view?.fov, FOV_MIN, FOV_MAX);
                }
                if (scene.coverage !== undefined && scene.coverage !== null) {
                    validateCoverage(scene.coverage, `${prefix}.coverage`, errors);
                }
                if (scene.hotspots !== undefined) {
                    if (!Array.isArray(scene.hotspots)) {
                        errors.push({ field: `${prefix}.hotspots`, message: 'hotspots must be an array' });
                    } else {
                        if (scene.hotspots.length > MAX_HOTSPOTS_PER_SCENE) {
                            errors.push({ field: `${prefix}.hotspots`, message: `must not exceed ${MAX_HOTSPOTS_PER_SCENE} hotspots` });
                        }
                        const hotspotIds = new Set<string>();
                        scene.hotspots.forEach((entry: unknown, hIndex: number) => {
                            const hPrefix = `${prefix}.hotspots[${hIndex}]`;
                            if (typeof entry !== 'object' || entry === null) {
                                errors.push({ field: hPrefix, message: 'Hotspot must be an object' });
                                return;
                            }
                            const hotspot = entry as Record<string, unknown>;
                            if (typeof hotspot.id !== 'string' || hotspot.id.length === 0 || hotspot.id.length > 64) {
                                errors.push({ field: `${hPrefix}.id`, message: 'id must be a string of 1-64 characters' });
                            } else if (hotspotIds.has(hotspot.id)) {
                                errors.push({ field: `${hPrefix}.id`, message: 'Hotspot ids must be unique' });
                            } else {
                                hotspotIds.add(hotspot.id);
                            }
                            if (typeof hotspot.toScene !== 'string' || !existingIds.has(hotspot.toScene)) {
                                errors.push({ field: `${hPrefix}.toScene`, message: 'toScene must reference an existing scene' });
                            }
                            checkAngle(errors, `${hPrefix}.pitch`, hotspot.pitch, -90, 90);
                            checkAngle(errors, `${hPrefix}.yaw`, hotspot.yaw, YAW_MIN, YAW_MAX);
                            if (typeof hotspot.label !== 'string' || hotspot.label.trim().length === 0) {
                                errors.push({ field: `${hPrefix}.label`, message: 'label must be a non-empty string' });
                            } else if (hotspot.label.length > MAX_HOTSPOT_LABEL_LENGTH) {
                                errors.push({ field: `${hPrefix}.label`, message: `label must not exceed ${MAX_HOTSPOT_LABEL_LENGTH} characters` });
                            }
                        });
                    }
                }
            });
        }
    }

    return errors;
}

/** Convierte un documento persistido al Tour del dominio (permisivo — los datos de la DB son de confianza). */
export function toTourDomain(raw: unknown): Tour | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const t = raw as Record<string, unknown>;
    const scenes = Array.isArray(t.scenes) ? t.scenes.map((s) => {
        const scene = s as Record<string, unknown>;
        const image = (scene.image ?? {}) as Record<string, unknown>;
        const initialView = (scene.initialView ?? {}) as Record<string, unknown>;
        return {
            id: String(scene.id ?? ''),
            name: String(scene.name ?? ''),
            image: {
                url: String(image.url ?? ''),
                publicId: String(image.publicId ?? ''),
                ...(typeof image.avifUrl === 'string' ? { avifUrl: image.avifUrl } : {}),
                ...(typeof image.avifPublicId === 'string' ? { avifPublicId: image.avifPublicId } : {}),
                ...(typeof image.mobileUrl === 'string' ? { mobileUrl: image.mobileUrl } : {}),
                ...(typeof image.mobilePublicId === 'string' ? { mobilePublicId: image.mobilePublicId } : {}),
                ...(typeof image.mobileAvifUrl === 'string' ? { mobileAvifUrl: image.mobileAvifUrl } : {}),
                ...(typeof image.mobileAvifPublicId === 'string' ? { mobileAvifPublicId: image.mobileAvifPublicId } : {}),
                posterUrl: String(image.posterUrl ?? ''),
                posterPublicId: String(image.posterPublicId ?? ''),
                width: Number(image.width ?? 0),
                height: Number(image.height ?? 0)
            },
            ...(typeof scene.coverage === 'object' && scene.coverage !== null
                ? { coverage: scene.coverage as SceneCoverage }
                : {}),
            initialView: {
                pitch: Number(initialView.pitch ?? 0),
                yaw: Number(initialView.yaw ?? 0),
                fov: Number(initialView.fov ?? 75)
            },
            hotspots: Array.isArray(scene.hotspots) ? scene.hotspots.map((h) => {
                const hotspot = h as Record<string, unknown>;
                return {
                    id: String(hotspot.id ?? ''),
                    toScene: String(hotspot.toScene ?? ''),
                    pitch: Number(hotspot.pitch ?? 0),
                    yaw: Number(hotspot.yaw ?? 0),
                    label: String(hotspot.label ?? '')
                } satisfies TourHotspot;
            }) : []
        } satisfies TourScene;
    }) : [];
    return { enabled: Boolean(t.enabled), scenes };
}
