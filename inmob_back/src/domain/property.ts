import {
    CurrencyValue,
    ListingTypeValue,
    PropertyStatusValue,
    PropertyTypeValue
} from './propertyTypes';
import { Tour } from './tour';

export { CurrencyValue, ListingTypeValue, PropertyStatusValue, PropertyTypeValue };

/**
 * Objeto de valor: un monto con una moneda explícita. Nunca guardar un número pelado —
 * los precios sin moneda no tienen sentido en este dominio.
 */
export interface Money {
    amount: number;
    currency: CurrencyValue;
}

/**
 * Objeto de valor de ubicación del dominio. Usa nombres explícitos `lat`/`lng` — el
 * GeoJSON (`{ type: 'Point', coordinates: [lng, lat] }`) es un detalle de persistencia
 * que vive solo en el schema Mongoose / traducción del repositorio.
 */
export interface GeoLocation {
    address: string;
    city: string;
    lat: number;
    lng: number;
}

/**
 * Un asset de imagen almacenado. `publicId` es el identificador del proveedor de
 * storage y la referencia estable usada para borrar y elegir la imagen destacada —
 * nunca la URL (las URLs son asunto de visualización y pueden cambiar entre
 * proveedores/formatos).
 */
export interface ImageAsset {
    url: string;
    publicId: string;
    width?: number;
    alt?: string;
}

/** Campos que un llamador puede setear al crear una propiedad. La identidad y los campos de auditoría son de la capa de persistencia. */
export interface NewProperty {
    title: string;
    description: string;
    price: Money;
    location: GeoLocation;
    bedrooms: number;
    bathrooms: number;
    area: number;
    propertyType: PropertyTypeValue;
    listingType: ListingTypeValue;
    status: PropertyStatusValue;
    images: ImageAsset[];
    /** Recorrido 360° (Requisito 1). Ausente en propiedades sin tour. */
    tour?: Tour;
    featured: boolean;
    featuredImageId: string;
}

/** Actualización parcial expresada en términos del dominio. */
export type PropertyUpdate = Partial<NewProperty>;

/** La raíz del agregado: una propiedad como la ve el dominio. */
export interface PropertyEntity extends NewProperty {
    id: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export type PropertyLean = Record<string, unknown>;

/**
 * Normaliza un nombre de ciudad para filtrado por coincidencia exacta: trim,
 * colapsar espacios internos, minúsculas. Se guarda en `cityLower` y lo usa todo
 * filtro estructurado de ciudad (C8) para que las consultas de los dropdowns peguen
 * al índice en vez de hacer regex scans.
 */
export function normalizeCity(city: string): string {
    return city.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ---------------------------------------------------------------------------
// Criterios de consulta (C12) — lenguaje de consulta puro del dominio. El
// repositorio los traduce a la sintaxis del motor de persistencia; los operadores
// Mongo nunca deben aparecer acá.
// ---------------------------------------------------------------------------

export type SortField = 'createdAt' | 'updatedAt' | 'price' | 'bedrooms' | 'bathrooms' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface RangeFilter {
    min?: number;
    max?: number;
}

export interface PropertyCriteria {
    propertyType?: PropertyTypeValue;
    /** Múltiples tipos de propiedad permitidos (búsqueda avanzada) */
    propertyTypes?: PropertyTypeValue[];
    listingType?: ListingTypeValue;
    status?: PropertyStatusValue;
    currency?: CurrencyValue;
    price?: RangeFilter;
    bedrooms?: RangeFilter;
    bathrooms?: RangeFilter;
    /** Coincidencia exacta de ciudad (case-insensitive; normalizada contra el `cityLower` guardado) */
    city?: string;
    /** Múltiples ciudades permitidas (búsqueda avanzada, coincidencia exacta) */
    cities?: string[];
    /** Búsqueda de texto libre sobre dirección y ciudad (coincidencias parciales por diseño) */
    searchText?: string;
    featured?: boolean;
    /** Solo admin: incluir propiedades con soft delete en los resultados */
    includeDeleted?: boolean;
}
