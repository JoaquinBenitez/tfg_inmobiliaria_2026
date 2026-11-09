import { PropertyRepository } from '../interfaces/propertyRepository';
import { ImageStorageProvider } from '../interfaces/imageStorage';
import { PropertyEntity, ImageAsset, PropertyUpdate } from '../domain/property';
import { BadRequestError, NotFoundError } from '../domain/appError';
import { logger } from '../config/logger';

export const propertyImageService = {
    async uploadImages(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        propertyId: string,
        imageBuffers: Buffer[]
    ): Promise<{ images: ImageAsset[]; property: PropertyEntity }> {
        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }

        if (imageBuffers.length === 0) {
            throw new BadRequestError('No images provided');
        }

        const folder = `properties/${propertyId}`;
        const uploadResults = await storage.uploadMultipleImages(imageBuffers, folder);
        const newImages: ImageAsset[] = uploadResults.map(({ url, publicId }) => ({ url, publicId }));

        const images = [...(property.images || []), ...newImages];
        const update: PropertyUpdate = { images };
        if (property.featured && !property.featuredImageId && newImages.length > 0) {
            update.featuredImageId = newImages[0].publicId;
        }

        const updatedProperty = await repo.findByIdAndUpdate(propertyId, update, { runValidators: true });
        if (!updatedProperty) {
            throw new NotFoundError('Property not found');
        }

        return { images: newImages, property: updatedProperty };
    },

    async deleteImage(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        propertyId: string,
        imageId: unknown
    ): Promise<{ images: ImageAsset[] }> {
        if (!imageId || typeof imageId !== 'string') {
            throw new BadRequestError('imageId is required');
        }

        const property = await repo.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property not found');
        }

        const target = property.images.find((image) => image.publicId === imageId);
        if (!target) {
            throw new NotFoundError('Image not found on this property');
        }

        try {
            await storage.deleteImage(target.publicId);
        } catch (imgErr) {
            logger.error({ err: imgErr }, 'Error deleting image from storage');
        }

        const images = property.images.filter((image) => image.publicId !== imageId);
        const update: PropertyUpdate = { images };
        if (property.featuredImageId === imageId) {
            // Quitar la imagen destacada des-destaca la propiedad (mantiene el invariante).
            update.featuredImageId = '';
            update.featured = false;
        }

        const updatedProperty = await repo.findByIdAndUpdate(propertyId, update, { runValidators: true });
        if (!updatedProperty) {
            throw new NotFoundError('Property not found');
        }

        return { images };
    }
};
