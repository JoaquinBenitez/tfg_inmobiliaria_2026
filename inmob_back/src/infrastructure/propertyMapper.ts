import {
    PropertyEntity,
    NewProperty,
    PropertyUpdate,
    PropertyCriteria,
    GeoLocation,
    ImageAsset,
    normalizeCity
} from '../domain/property';
import { Tour, toTourDomain } from '../domain/tour';

/**
 * Frontera de traducción entre el dominio y Mongoose. Este módulo es el ÚNICO
 * lugar donde:
 *   - se construye/desconstruye GeoJSON (el dominio habla lat/lng),
 *   - Money se aplana a los campos de documento `price` + `currency`,
 *   - se escriben operadores de consulta Mongo (criteria → filter),
 *   - se marca `cityLower` para los caminos de update (los saves del documento
 *     pasan por el hook pre-validate del schema, que comparte `normalizeCity`).
 */

type AnyRecord = Record<string, unknown>;

/**
 * Coerción de frontera: la entrada del mapper puede ser un documento Mongoose
 * hidratado, un objeto lean o un resultado de aggregation. Este único helper
 * contenido acepta cualquier cosa parecida a un record para que los llamadores
 * nunca casteen.
 */
function asRecord(value: unknown): AnyRecord {
    if (typeof value === 'object' && value !== null) {
        return value as AnyRecord;
    }
    return {};
}

/** Verdadero cuando un payload de ubicación usa la forma del dominio (no GeoJSON). */
function isLocationDto(location: unknown): location is { address: unknown; city: unknown; latitude: unknown; longitude: unknown } {
    return typeof location === 'object'
        && location !== null
        && !Array.isArray(location)
        && 'latitude' in location
        && 'longitude' in location;
}

function geoLocationToDocument(location: GeoLocation): AnyRecord {
    return {
        type: 'Point',
        coordinates: [location.lng, location.lat],
        address: location.address,
        city: location.city
    };
}

function documentToGeoLocation(doc: AnyRecord): GeoLocation {
    const geo = (doc.location ?? {}) as { coordinates?: [number, number]; address?: string; city?: string };
    return {
        address: geo.address ?? '',
        city: geo.city ?? '',
        lat: Array.isArray(geo.coordinates) ? geo.coordinates[1] : 0,
        lng: Array.isArray(geo.coordinates) ? geo.coordinates[0] : 0
    };
}

function toImageAssets(images: unknown): ImageAsset[] {
    if (!Array.isArray(images)) return [];
    return images.map((image) => {
        const asset = image as AnyRecord;
        return {
            url: String(asset.url ?? ''),
            publicId: String(asset.publicId ?? ''),
            ...(typeof asset.width === 'number' ? { width: asset.width } : {}),
            ...(typeof asset.alt === 'string' ? { alt: asset.alt } : {})
        };
    });
}

/** Documento persistido (hidratado o lean) → entidad del dominio. */
export function documentToProperty(doc: unknown): PropertyEntity {
    const toObject = asRecord(doc).toObject;
    const raw = typeof toObject === 'function' ? asRecord(toObject.call(doc)) : asRecord(doc);
    return {
        id: String(raw._id),
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        price: {
            amount: Number(raw.price ?? 0),
            currency: (raw.currency ?? 'USD') as PropertyEntity['price']['currency']
        },
        location: documentToGeoLocation(raw),
        bedrooms: Number(raw.bedrooms ?? 0),
        bathrooms: Number(raw.bathrooms ?? 0),
        area: Number(raw.area ?? 0),
        propertyType: raw.propertyType as PropertyEntity['propertyType'],
        listingType: raw.listingType as PropertyEntity['listingType'],
        status: raw.status as PropertyEntity['status'],
        images: toImageAssets(raw.images),
        ...(toTourDomain(raw.tour) ? { tour: toTourDomain(raw.tour) as Tour } : {}),
        featured: Boolean(raw.featured),
        featuredImageId: String(raw.featuredImageId ?? ''),
        deletedAt: raw.deletedAt instanceof Date ? raw.deletedAt : (raw.deletedAt ? new Date(raw.deletedAt as string) : null),
        createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(String(raw.createdAt ?? 0)),
        updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(String(raw.updatedAt ?? 0))
    };
}

/** Input de creación del dominio → campos de documento para `new Model(...)`. */
export function newPropertyToDocument(input: NewProperty): AnyRecord {
    return {
        title: input.title,
        description: input.description,
        price: input.price.amount,
        currency: input.price.currency,
        location: geoLocationToDocument(input.location),
        cityLower: normalizeCity(input.location.city),
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        area: input.area,
        propertyType: input.propertyType,
        listingType: input.listingType,
        status: input.status,
        images: input.images,
        featured: input.featured,
        featuredImageId: input.featuredImageId,
        ...(input.tour !== undefined ? { tour: input.tour } : {})
    };
}

/** Actualización parcial del dominio → campos actualizables de Mongo. */
export function propertyUpdateToDocument(update: PropertyUpdate): AnyRecord {
    const doc: AnyRecord = {};
    if (update.title !== undefined) doc.title = update.title;
    if (update.description !== undefined) doc.description = update.description;
    if (update.price !== undefined) {
        doc.price = update.price.amount;
        doc.currency = update.price.currency;
    }
    if (update.location !== undefined) {
        doc.location = geoLocationToDocument(update.location);
        doc.cityLower = normalizeCity(update.location.city);
    }
    if (update.bedrooms !== undefined) doc.bedrooms = update.bedrooms;
    if (update.bathrooms !== undefined) doc.bathrooms = update.bathrooms;
    if (update.area !== undefined) doc.area = update.area;
    if (update.propertyType !== undefined) doc.propertyType = update.propertyType;
    if (update.listingType !== undefined) doc.listingType = update.listingType;
    if (update.status !== undefined) doc.status = update.status;
    if (update.images !== undefined) doc.images = update.images;
    if (update.featured !== undefined) doc.featured = update.featured;
    if (update.featuredImageId !== undefined) doc.featuredImageId = update.featuredImageId;
    if (update.tour !== undefined) doc.tour = update.tour;
    return doc;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Criterios del dominio → filtro Mongo. El único lugar donde se escribe sintaxis de consulta Mongo. */
export function criteriaToFilter(criteria: PropertyCriteria): AnyRecord {
    const filter: AnyRecord = {};

    if (criteria.propertyType !== undefined) filter.propertyType = criteria.propertyType;
    if (criteria.propertyTypes !== undefined) filter.propertyType = { $in: criteria.propertyTypes };
    if (criteria.listingType !== undefined) filter.listingType = criteria.listingType;
    if (criteria.status !== undefined) filter.status = criteria.status;
    if (criteria.currency !== undefined) filter.currency = criteria.currency;
    if (criteria.featured !== undefined) filter.featured = criteria.featured;

    if (criteria.price !== undefined) {
        filter.price = {
            ...(criteria.price.min !== undefined ? { $gte: criteria.price.min } : {}),
            ...(criteria.price.max !== undefined ? { $lte: criteria.price.max } : {})
        };
    }
    if (criteria.bedrooms !== undefined) {
        filter.bedrooms = {
            ...(criteria.bedrooms.min !== undefined ? { $gte: criteria.bedrooms.min } : {}),
            ...(criteria.bedrooms.max !== undefined ? { $lte: criteria.bedrooms.max } : {})
        };
    }
    if (criteria.bathrooms !== undefined) {
        filter.bathrooms = {
            ...(criteria.bathrooms.min !== undefined ? { $gte: criteria.bathrooms.min } : {}),
            ...(criteria.bathrooms.max !== undefined ? { $lte: criteria.bathrooms.max } : {})
        };
    }

    if (criteria.city !== undefined) {
        filter.cityLower = normalizeCity(criteria.city);
    }
    if (criteria.cities !== undefined && criteria.cities.length > 0) {
        filter.cityLower = { $in: criteria.cities.map(normalizeCity) };
    }

    if (criteria.searchText !== undefined && criteria.searchText.length > 0) {
        const escaped = escapeRegex(criteria.searchText);
        filter.$or = [
            { 'location.address': new RegExp(escaped, 'i') },
            { 'location.city': new RegExp(escaped, 'i') }
        ];
    }

    return filter;
}

/** Filtro de visibilidad de soft delete — lo fusiona el repositorio en todo camino de lectura. */
export function notDeletedFilter(criteria: PropertyCriteria): AnyRecord {
    return criteria.includeDeleted === true ? {} : { deletedAt: null };
}
