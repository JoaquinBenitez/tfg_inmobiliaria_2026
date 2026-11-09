import { PropertyRepository } from '../interfaces/propertyRepository';
import { ImageStorageProvider, ImageUploadResult } from '../interfaces/imageStorage';
import {
    PropertyEntity,
    NewProperty,
    PropertyUpdate,
    ImageAsset,
    GeoLocation,
    CurrencyValue,
    ListingTypeValue,
    PropertyStatusValue,
    PropertyTypeValue
} from '../domain/property';
import { BadRequestError, NotFoundError, ValidationFailedError } from '../domain/appError';
import { validatePropertyFields, ALLOWED_UPDATE_FIELDS } from '../domain/propertyValidation';
import { logger } from '../config/logger';
import { onPropertySaved, onPropertyDeleted } from './syndicationService';

async function deleteImagesByIds(storage: ImageStorageProvider, publicIds: string[]): Promise<void> {
    if (publicIds.length > 0) {
        await storage.deleteMultipleImages(publicIds);
    }
}

function toImageAssets(uploadResults: ImageUploadResult[]): ImageAsset[] {
    return uploadResults.map(({ url, publicId }) => ({ url, publicId }));
}

export interface CreatePropertyInput {
    data: Record<string, any>;
    imageBuffers: Buffer[];
}

/**
 * Construye el input de creación del dominio a partir de un payload de API validado.
 * Aquí los campos planos de la API (price + currency, DTO de location) se convierten
 * en objetos de valor del dominio (Money, GeoLocation).
 */
function toNewProperty(body: Record<string, any>): NewProperty {
    const loc = body.location;
    const location: GeoLocation = {
        address: String(loc.address).trim(),
        city: String(loc.city).trim(),
        lat: Number(loc.latitude),
        lng: Number(loc.longitude)
    };
    return {
        title: String(body.title).trim(),
        description: String(body.description).trim(),
        price: {
            amount: Number(body.price),
            currency: body.currency as CurrencyValue
        },
        location,
        bedrooms: Number(body.bedrooms),
        bathrooms: Number(body.bathrooms),
        area: Number(body.area),
        propertyType: body.propertyType as PropertyTypeValue,
        listingType: body.listingType as ListingTypeValue,
        status: (body.status ?? 'available') as PropertyStatusValue,
        images: Array.isArray(body.images) ? body.images as ImageAsset[] : [],
        featured: body.featured === true || body.featured === 'true',
        featuredImageId: typeof body.featuredImageId === 'string' ? body.featuredImageId : ''
    };
}

export const propertyService = {
    async createProperty(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        input: CreatePropertyInput
    ): Promise<PropertyEntity> {
        const body = { ...input.data };

        // Campo extra del multipart: índice (sobre los archivos subidos) de la imagen a destacar.
        // No es un campo del schema — se extrae aquí y se elimina antes de validar/persistir.
        const featuredImageIndex = Number(body.featuredImageIndex);
        delete body.featuredImageIndex;

        const validationErrors = validatePropertyFields(body, false);
        if (validationErrors.length > 0) {
            throw new ValidationFailedError(validationErrors);
        }

        // Invariante de destacadas (la capa de aplicación es dueña): una propiedad destacada
        // necesita al menos una imagen para poder resolver su imagen destacada tras la subida.
        if (body.featured === true && input.imageBuffers.length === 0) {
            throw new ValidationFailedError([
                { field: 'featured', message: 'Featured properties require at least one image' }
            ]);
        }

        let savedProperty = await repo.create(toNewProperty(body));

        if (input.imageBuffers.length > 0) {
            const folder = `properties/${savedProperty.id}`;
            const uploadResults = await storage.uploadMultipleImages(input.imageBuffers, folder);
            const images = toImageAssets(uploadResults);

            const update: PropertyUpdate = { images };
            if (savedProperty.featured && images.length > 0) {
                const chosen = Number.isInteger(featuredImageIndex)
                    && featuredImageIndex >= 0 && featuredImageIndex < images.length
                    ? images[featuredImageIndex]
                    : images[0];
                update.featuredImageId = chosen.publicId;
            }
            savedProperty = (await repo.findByIdAndUpdate(savedProperty.id, update, { runValidators: true })) ?? savedProperty;
        }

        // Fase 3: el encolado de sindicación ocurre fuera del camino del request (fire-and-forget);
        // es un no-op hasta que el bootstrap del wire conecte la cola (server.ts).
        void onPropertySaved(savedProperty);

        return savedProperty;
    },

    async getPropertyById(repo: PropertyRepository, id: string): Promise<PropertyEntity> {
        const property = await repo.findById(id);
        if (!property) {
            throw new NotFoundError('Property not found');
        }
        return property;
    },

    async updateProperty(
        repo: PropertyRepository,
        storage: ImageStorageProvider,
        id: string,
        body: Record<string, any>
    ): Promise<PropertyEntity> {
        const updateData: Record<string, any> = {};
        for (const field of ALLOWED_UPDATE_FIELDS) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            throw new BadRequestError('No valid fields provided for update');
        }

        const validationErrors = validatePropertyFields(updateData, true);
        if (validationErrors.length > 0) {
            throw new ValidationFailedError(validationErrors);
        }

        const existingProperty = await repo.findById(id);
        if (!existingProperty) {
            throw new NotFoundError('Property not found');
        }

        if (updateData.images) {
            const keptIds = new Set((updateData.images as ImageAsset[]).map(image => image.publicId));
            const removedImages = existingProperty.images.filter(image => !keptIds.has(image.publicId));

            if (removedImages.length > 0) {
                try {
                    await deleteImagesByIds(storage, removedImages.map(image => image.publicId));
                } catch (imgErr) {
                    logger.error({ err: imgErr }, 'Error deleting removed images from storage');
                }
            }
        }

        // Invariante de destacadas sobre el estado fusionado (post-actualización): las propiedades
        // destacadas deben referenciar una imagen destacada que exista en el array de imágenes resultante.
        const effectiveFeatured = updateData.featured !== undefined ? updateData.featured : existingProperty.featured;
        const effectiveImages = (updateData.images as ImageAsset[] | undefined) ?? existingProperty.images;
        const effectiveFeaturedImageId = updateData.featuredImageId !== undefined
            ? updateData.featuredImageId
            : existingProperty.featuredImageId;

        if (effectiveFeatured) {
            const resolves = effectiveFeaturedImageId.length > 0
                && effectiveImages.some(image => image.publicId === effectiveFeaturedImageId);
            if (!resolves) {
                throw new ValidationFailedError([
                    {
                        field: 'featuredImageId',
                        message: 'Featured properties must have a featured image present in the images array'
                    }
                ]);
            }
        }

        // Construir la actualización del dominio — precio y moneda cambian juntos (Money es atómico).
        const update: PropertyUpdate = {};
        if (updateData.title !== undefined) update.title = String(updateData.title).trim();
        if (updateData.description !== undefined) update.description = String(updateData.description).trim();
        if (updateData.price !== undefined || updateData.currency !== undefined) {
            update.price = {
                amount: updateData.price !== undefined ? Number(updateData.price) : existingProperty.price.amount,
                currency: (updateData.currency ?? existingProperty.price.currency) as CurrencyValue
            };
        }
        if (updateData.location !== undefined) {
            const loc = updateData.location;
            update.location = {
                address: String(loc.address).trim(),
                city: String(loc.city).trim(),
                lat: Number(loc.latitude),
                lng: Number(loc.longitude)
            };
        }
        if (updateData.bedrooms !== undefined) update.bedrooms = Number(updateData.bedrooms);
        if (updateData.bathrooms !== undefined) update.bathrooms = Number(updateData.bathrooms);
        if (updateData.area !== undefined) update.area = Number(updateData.area);
        if (updateData.propertyType !== undefined) update.propertyType = updateData.propertyType;
        if (updateData.listingType !== undefined) update.listingType = updateData.listingType;
        if (updateData.status !== undefined) update.status = updateData.status;
        if (updateData.images !== undefined) update.images = updateData.images as ImageAsset[];
        if (updateData.featured !== undefined) update.featured = updateData.featured;
        if (updateData.featuredImageId !== undefined) update.featuredImageId = updateData.featuredImageId;

        const property = await repo.findByIdAndUpdate(id, update, { runValidators: true });
        if (!property) {
            throw new NotFoundError('Property not found');
        }

        void onPropertySaved(property);

        return property;
    },

    /**
     * Soft delete: el documento se marca con `deletedAt` y se oculta de todos los caminos
     * de lectura (filtro base del repositorio). Las imágenes del storage se conservan a
     * propósito para poder restaurar la propiedad; una purga con hard delete (con limpieza
     * de imágenes) puede venir más adelante.
     * Nota Fase 3: setear `deletedAt` es el disparador de los jobs de unpublish de sindicación.
     */
    async deleteProperty(
        repo: PropertyRepository,
        _storage: ImageStorageProvider,
        id: string
    ): Promise<PropertyEntity> {
        const property = await repo.softDelete(id);
        if (!property) {
            throw new NotFoundError('Property not found');
        }

        void onPropertyDeleted(property);

        return property;
    }
};
