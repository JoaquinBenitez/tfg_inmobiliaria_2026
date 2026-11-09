import {
    PropertyEntity,
    NewProperty,
    PropertyUpdate,
    PropertyCriteria,
    SortField,
    SortOrder
} from '../domain/property';

export interface PropertyListOptions {
    criteria: PropertyCriteria;
    sort: SortField;
    order: SortOrder;
    skip: number;
    limit: number;
}

export interface PropertyListResult {
    properties: PropertyEntity[];
    total: number;
}

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface NearbyQuery {
    center: GeoPoint;
    radiusInMeters: number;
    limit: number;
}

export interface BoundsQuery {
    northEast: GeoPoint;
    southWest: GeoPoint;
}

export interface UpdateOptions {
    runValidators?: boolean;
}

/**
 * Puerto: persistencia de propiedades. Habla solo en tipos del dominio (entidades,
 * criterios). Cualquier dialecto del motor de persistencia (operadores Mongo,
 * GeoJSON, documentos lean) pertenece exclusivamente al adaptador que lo implementa.
 */
export interface PropertyRepository {
    list(options: PropertyListOptions): Promise<PropertyListResult>;
    findById(id: string): Promise<PropertyEntity | null>;
    create(data: NewProperty): Promise<PropertyEntity>;
    findByIdAndUpdate(id: string, update: PropertyUpdate, options?: UpdateOptions): Promise<PropertyEntity | null>;
    findByCriteria(criteria: PropertyCriteria): Promise<PropertyEntity[]>;
    findFeatured(): Promise<PropertyEntity[]>;
    findInBounds(query: BoundsQuery): Promise<PropertyEntity[]>;
    aggregateNearby(query: NearbyQuery): Promise<(PropertyEntity & { distance: number })[]>;
    /** Soft delete: marca `deletedAt` y devuelve la entidad actualizada (null si no existe o ya estaba borrada) */
    softDelete(id: string): Promise<PropertyEntity | null>;
}
