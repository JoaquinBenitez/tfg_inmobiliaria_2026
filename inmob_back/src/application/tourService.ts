import { randomUUID } from 'crypto';
import { PropertyRepository } from '../interfaces/propertyRepository';
import { ImageStorageProvider } from '../interfaces/imageStorage';
import { BadRequestError, NotFoundError, ValidationFailedError } from '../domain/appError';
import {
    EMPTY_TOUR,
    MAX_SCENES,
    Tour,
    TourScene,
    defaultCoverage,
    isFullSphereAspect,
    validateTourUpdate,
    TourUpdatePatch
} from '../domain/tour';
import { processPanorama } from '../services/panoramaProcessor';
import { logger } from '../config/logger';

/**
 * Servicio de aplicación del recorrido 360° (Requisito 1). Es dueño de las reglas
 * de negocio (límites de escenas, validación de metadatos, orquestación de variantes);
 * el preprocesamiento del panorama (sharp) y el almacenamiento de archivos son
 * adaptadores que se pasan como puertos.
 */
export const tourService = {
    async getTour(repo: PropertyRepository, propertyId: string): Promise<Tour> {
        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }
        return property.tour ?? EMPTY_TOUR;
    },

    async addScene(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        propertyId: string,
        file: { buffer: Buffer },
        rawName: unknown
    ): Promise<{ tour: Tour; scene: TourScene }> {
        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }
        const tour = property.tour ?? EMPTY_TOUR;
        if (tour.scenes.length >= MAX_SCENES) {
            throw new BadRequestError(`Un recorrido admite como máximo ${MAX_SCENES} escenas`);
        }

        const name = typeof rawName === 'string' && rawName.trim().length > 0
            ? rawName.trim().slice(0, 100)
            : `Escena ${tour.scenes.length + 1}`;

        const variants = await processPanorama(file.buffer);
        const folder = `tours/${propertyId}`;

        const [avif, webp, mobileAvif, mobileWebp, poster] = await Promise.all([
            storage.uploadImage(variants.desktop.avif, folder),
            storage.uploadImage(variants.desktop.webp, folder),
            storage.uploadImage(variants.mobile.avif, folder),
            storage.uploadImage(variants.mobile.webp, folder),
            storage.uploadImage(variants.poster.webp, folder)
        ]);

        const isPartial = !isFullSphereAspect(variants.width, variants.height);

        const scene: TourScene = {
            id: randomUUID(),
            name,
            hotspots: [],
            image: {
                url: webp.url,
                publicId: webp.publicId,
                avifUrl: avif.url,
                avifPublicId: avif.publicId,
                mobileUrl: mobileWebp.url,
                mobilePublicId: mobileWebp.publicId,
                mobileAvifUrl: mobileAvif.url,
                mobileAvifPublicId: mobileAvif.publicId,
                posterUrl: poster.url,
                posterPublicId: poster.publicId,
                width: variants.width,
                height: variants.height
            },
            ...(isPartial ? { coverage: defaultCoverage(variants.width, variants.height) } : {}),
            initialView: { pitch: 0, yaw: 0, fov: 75 }
        };

        const updatedTour: Tour = { ...tour, scenes: [...tour.scenes, scene] };
        const updated = await repo.findByIdAndUpdate(propertyId, { tour: updatedTour }, { runValidators: true });
        if (!updated) {
            throw new NotFoundError('Property not found');
        }
        logger.info({ propertyId, sceneId: scene.id, width: variants.width }, 'Tour scene added');
        return { tour: updatedTour, scene };
    },

    /** Guardado del TourBuilder: parche solo de metadatos (orden, nombres, initialView, coverage, hotspots, enabled). */
    async updateTour(repo: PropertyRepository, propertyId: string, patch: unknown): Promise<Tour> {
        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }
        const current = property.tour ?? EMPTY_TOUR;

        const errors = validateTourUpdate(current, patch);
        if (errors.length > 0) {
            throw new ValidationFailedError(errors);
        }
        const body = (patch ?? {}) as TourUpdatePatch;

        let scenes = current.scenes;
        if (body.scenes !== undefined) {
            const byId = new Map(current.scenes.map((s) => [s.id, s]));
            scenes = body.scenes.map((patched) => {
                const existing = byId.get(patched.id)!; // validado arriba
                return {
                    ...existing,
                    ...(patched.name !== undefined ? { name: patched.name.trim().slice(0, 100) } : {}),
                    ...(patched.initialView !== undefined ? { initialView: patched.initialView } : {}),
                    ...(patched.coverage !== undefined
                        ? (patched.coverage === null ? {} : { coverage: patched.coverage })
                        : {}),
                    ...(patched.hotspots !== undefined ? { hotspots: patched.hotspots } : {})
                };
            });
        }
        const enabled = body.enabled ?? current.enabled;
        if (enabled && scenes.length === 0) {
            throw new BadRequestError('No se puede habilitar un recorrido sin escenas');
        }

        const updatedTour: Tour = { enabled, scenes };
        const updated = await repo.findByIdAndUpdate(propertyId, { tour: updatedTour }, { runValidators: true });
        if (!updated) {
            throw new NotFoundError('Property not found');
        }
        return updatedTour;
    },

    async removeScene(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        propertyId: string,
        sceneId: string
    ): Promise<Tour> {
        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }
        const tour = property.tour ?? EMPTY_TOUR;
        const scene = tour.scenes.find((s) => s.id === sceneId);
        if (!scene) {
            throw new NotFoundError('Scene not found');
        }

        // Limpieza de variantes best-effort — refleja el comportamiento de propertyImageService
        const ids = [
            scene.image.publicId,
            scene.image.avifPublicId,
            scene.image.mobilePublicId,
            scene.image.mobileAvifPublicId,
            scene.image.posterPublicId
        ].filter((id): id is string => Boolean(id));
        try {
            await storage.deleteMultipleImages(ids);
        } catch (err) {
            logger.error({ err, sceneId }, 'Error deleting panorama variants from storage');
        }

        const updatedTour: Tour = {
            enabled: tour.scenes.length > 1 ? tour.enabled : false,
            scenes: tour.scenes
                .filter((s) => s.id !== sceneId)
                .map((s) => ({ ...s, hotspots: s.hotspots.filter((h) => h.toScene !== sceneId) }))
        };
        const updated = await repo.findByIdAndUpdate(propertyId, { tour: updatedTour }, { runValidators: true });
        if (!updated) {
            throw new NotFoundError('Property not found');
        }
        logger.info({ propertyId, sceneId }, 'Tour scene removed');
        return updatedTour;
    }
};
