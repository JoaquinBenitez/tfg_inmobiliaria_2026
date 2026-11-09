import { FieldError } from './appError';
import { VALID_PROPERTY_TYPES, VALID_LISTING_TYPES, VALID_STATUSES, VALID_CURRENCIES } from './propertyTypes';
import { ImageAsset } from './property';

export const MAX_IMAGES = 30;

export const ALLOWED_UPDATE_FIELDS = [
    'title', 'description', 'price', 'currency', 'location', 'bedrooms', 'bathrooms',
    'area', 'propertyType', 'listingType', 'status', 'images', 'featured', 'featuredImageId'
] as const;

export function validateImageAssets(images: unknown): FieldError[] {
    const errors: FieldError[] = [];
    if (!Array.isArray(images)) {
        return [{ field: 'images', message: 'Images must be an array' }];
    }
    if (images.length > MAX_IMAGES) {
        return [{ field: 'images', message: `Images must not exceed ${MAX_IMAGES} entries` }];
    }
    images.forEach((image, index) => {
        if (typeof image !== 'object' || image === null) {
            errors.push({ field: `images[${index}]`, message: 'Each image must be an object' });
            return;
        }
        const asset = image as Partial<ImageAsset>;
        if (typeof asset.url !== 'string' || asset.url.trim().length === 0) {
            errors.push({ field: `images[${index}].url`, message: 'Image url is required' });
        }
        if (typeof asset.publicId !== 'string' || asset.publicId.trim().length === 0) {
            errors.push({ field: `images[${index}].publicId`, message: 'Image publicId is required' });
        }
        if (asset.width !== undefined && (typeof asset.width !== 'number' || !Number.isFinite(asset.width) || asset.width <= 0)) {
            errors.push({ field: `images[${index}].width`, message: 'Image width must be a positive number' });
        }
        if (asset.alt !== undefined && (typeof asset.alt !== 'string' || asset.alt.length > 200)) {
            errors.push({ field: `images[${index}].alt`, message: 'Image alt must be a string of at most 200 characters' });
        }
    });
    return errors;
}

export function validatePropertyFields(data: Record<string, any>, isPartial: boolean): FieldError[] {
    const errors: FieldError[] = [];

    // Parsear location si llega como string JSON (multipart/form-data)
    if (typeof data.location === 'string') {
        try {
            data.location = JSON.parse(data.location);
        } catch {
            errors.push({ field: 'location', message: 'Location must be a valid JSON object' });
            return errors;
        }
    }

    // Título
    if (!isPartial || data.title !== undefined) {
        if (!isPartial && (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0)) {
            errors.push({ field: 'title', message: 'Title is required and must be a non-empty string' });
        } else if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
            errors.push({ field: 'title', message: 'Title must be a non-empty string' });
        } else if (data.title && data.title.length > 200) {
            errors.push({ field: 'title', message: 'Title must not exceed 200 characters' });
        }
    }

    // Descripción
    if (!isPartial || data.description !== undefined) {
        if (!isPartial && (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0)) {
            errors.push({ field: 'description', message: 'Description is required and must be a non-empty string' });
        } else if (data.description !== undefined && (typeof data.description !== 'string' || data.description.trim().length === 0)) {
            errors.push({ field: 'description', message: 'Description must be a non-empty string' });
        } else if (data.description && data.description.length > 10000) {
            errors.push({ field: 'description', message: 'Description must not exceed 10000 characters' });
        }
    }

    // Precio
    if (!isPartial || data.price !== undefined) {
        const price = Number(data.price);
        if (!isPartial && (data.price === undefined || data.price === null || data.price === '')) {
            errors.push({ field: 'price', message: 'Price is required' });
        } else if (data.price !== undefined && data.price !== null && data.price !== '') {
            if (isNaN(price) || price <= 0) {
                errors.push({ field: 'price', message: 'Price must be a number greater than 0' });
            } else if (price > 1000000000000) {
                errors.push({ field: 'price', message: 'Price must not exceed 1000000000000' });
            }
        }
    }

    // Dormitorios
    if (!isPartial || data.bedrooms !== undefined) {
        const bedrooms = Number(data.bedrooms);
        if (!isPartial && (data.bedrooms === undefined || data.bedrooms === null || data.bedrooms === '')) {
            errors.push({ field: 'bedrooms', message: 'Bedrooms is required' });
        } else if (data.bedrooms !== undefined && data.bedrooms !== null && data.bedrooms !== '') {
            if (isNaN(bedrooms) || bedrooms < 0 || !Number.isInteger(bedrooms)) {
                errors.push({ field: 'bedrooms', message: 'Bedrooms must be a non-negative integer' });
            } else if (bedrooms > 50) {
                errors.push({ field: 'bedrooms', message: 'Bedrooms must not exceed 50' });
            }
        }
    }

    // Baños
    if (!isPartial || data.bathrooms !== undefined) {
        const bathrooms = Number(data.bathrooms);
        if (!isPartial && (data.bathrooms === undefined || data.bathrooms === null || data.bathrooms === '')) {
            errors.push({ field: 'bathrooms', message: 'Bathrooms is required' });
        } else if (data.bathrooms !== undefined && data.bathrooms !== null && data.bathrooms !== '') {
            if (isNaN(bathrooms) || bathrooms < 0 || !Number.isInteger(bathrooms)) {
                errors.push({ field: 'bathrooms', message: 'Bathrooms must be a non-negative integer' });
            } else if (bathrooms > 50) {
                errors.push({ field: 'bathrooms', message: 'Bathrooms must not exceed 50' });
            }
        }
    }

    // Superficie
    if (!isPartial || data.area !== undefined) {
        const area = Number(data.area);
        if (!isPartial && (data.area === undefined || data.area === null || data.area === '')) {
            errors.push({ field: 'area', message: 'Area is required' });
        } else if (data.area !== undefined && data.area !== null && data.area !== '') {
            if (isNaN(area) || area <= 0) {
                errors.push({ field: 'area', message: 'Area must be a number greater than 0' });
            } else if (area > 999999) {
                errors.push({ field: 'area', message: 'Area must not exceed 999999' });
            }
        }
    }

    // Tipo de propiedad
    if (!isPartial || data.propertyType !== undefined) {
        if (!isPartial && !data.propertyType) {
            errors.push({ field: 'propertyType', message: 'Property type is required' });
        } else if (data.propertyType !== undefined && !VALID_PROPERTY_TYPES.includes(data.propertyType)) {
            errors.push({ field: 'propertyType', message: `Property type must be one of: ${VALID_PROPERTY_TYPES.join(', ')}` });
        }
    }

    // Moneda
    if (!isPartial || data.currency !== undefined) {
        if (!isPartial && !data.currency) {
            errors.push({ field: 'currency', message: 'Currency is required' });
        } else if (data.currency !== undefined && !VALID_CURRENCIES.includes(data.currency)) {
            errors.push({ field: 'currency', message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}` });
        }
    }

    // Tipo de operación
    if (!isPartial || data.listingType !== undefined) {
        if (!isPartial && !data.listingType) {
            errors.push({ field: 'listingType', message: 'Listing type is required' });
        } else if (data.listingType !== undefined && !VALID_LISTING_TYPES.includes(data.listingType)) {
            errors.push({ field: 'listingType', message: `Listing type must be one of: ${VALID_LISTING_TYPES.join(', ')}` });
        }
    }

    // Imágenes (se validan siempre que estén presentes, tanto en create como en update)
    if (data.images !== undefined) {
        errors.push(...validateImageAssets(data.images));
    }

    // Status (opcional en create, se valida si está presente)
    if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
        errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Ubicación (obligatoria en create, se valida si está presente en update).
    // Forma del DTO del dominio: { address, city, latitude, longitude } — el GeoJSON
    // lo construye el repositorio (detalle de persistencia, C6).
    if (!isPartial || data.location !== undefined) {
        if (!isPartial && !data.location) {
            errors.push({ field: 'location', message: 'Location is required' });
        } else if (data.location) {
            const loc = data.location;
            if (typeof loc !== 'object' || Array.isArray(loc)) {
                errors.push({ field: 'location', message: 'Location must be an object with address, city, latitude and longitude' });
            } else {
                if (!loc.address || typeof loc.address !== 'string' || loc.address.trim().length === 0) {
                    errors.push({ field: 'location.address', message: 'Address is required and must be a non-empty string' });
                } else if (loc.address.length > 500) {
                    errors.push({ field: 'location.address', message: 'Address must not exceed 500 characters' });
                }
                if (!loc.city || typeof loc.city !== 'string' || loc.city.trim().length === 0) {
                    errors.push({ field: 'location.city', message: 'City is required and must be a non-empty string' });
                } else if (loc.city.length > 100) {
                    errors.push({ field: 'location.city', message: 'City must not exceed 100 characters' });
                }
                const lat = Number(loc.latitude);
                if (loc.latitude === undefined || isNaN(lat) || lat < -90 || lat > 90) {
                    errors.push({ field: 'location.latitude', message: 'Latitude must be a number between -90 and 90' });
                }
                const lng = Number(loc.longitude);
                if (loc.longitude === undefined || isNaN(lng) || lng < -180 || lng > 180) {
                    errors.push({ field: 'location.longitude', message: 'Longitude must be a number between -180 and 180' });
                }
            }
        }
    }

    return errors;
}
