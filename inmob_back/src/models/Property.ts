import mongoose, { Schema, Document } from 'mongoose';
import {
    VALID_PROPERTY_TYPES,
    VALID_LISTING_TYPES,
    VALID_STATUSES,
    VALID_CURRENCIES,
    PropertyTypeValue,
    ListingTypeValue,
    PropertyStatusValue,
    CurrencyValue
} from '../domain/propertyTypes';
import { ImageAsset, normalizeCity } from '../domain/property';
import { Tour } from '../domain/tour';

export interface IProperty extends Document {
    title: string;
    description: string;
    price: number;
    currency: CurrencyValue;
    location: {
        type: string;
        coordinates: [number, number]; // [longitud, latitud] en ese orden porque así se guardan las coordenadas en mongo
        address: string;
        city: string;
    };
    bedrooms: number;
    bathrooms: number;
    area: number;
    propertyType: PropertyTypeValue;
    listingType: ListingTypeValue;
    status: PropertyStatusValue;
    /** Ciudad normalizada (`normalizeCity(location.city)`) — campo indexado de coincidencia exacta para filtros estructurados de ciudad (C8) */
    cityLower: string;
    images: ImageAsset[];
    tour?: Tour;
    featured: boolean;
    featuredImageId: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const ImageAssetSchema = new Schema(
    {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        width: { type: Number, min: 1 },
        alt: { type: String, maxlength: 200 }
    },
    { _id: false }
);

const TourHotspotSchema = new Schema(
    {
        id: { type: String, required: true, maxlength: 64 },
        toScene: { type: String, required: true },
        pitch: { type: Number, required: true, min: -90, max: 90 },
        yaw: { type: Number, required: true, min: -180, max: 180 },
        label: { type: String, required: true, maxlength: [60, 'Hotspot label must not exceed 60 characters'] }
    },
    { _id: false }
);

const TourSceneSchema = new Schema(
    {
        id: { type: String, required: true },
        name: { type: String, required: true, maxlength: [100, 'Scene name must not exceed 100 characters'] },
        image: {
            type: {
                url: { type: String, required: true },
                publicId: { type: String, required: true },
                avifUrl: String,
                avifPublicId: String,
                mobileUrl: String,
                mobilePublicId: String,
                mobileAvifUrl: String,
                mobileAvifPublicId: String,
                posterUrl: { type: String, required: true },
                posterPublicId: { type: String, required: true },
                width: { type: Number, required: true, min: 1 },
                height: { type: Number, required: true, min: 1 }
            },
            required: true
        },
        coverage: {
            type: {
                minYaw: { type: Number, required: true, min: -180, max: 180 },
                maxYaw: { type: Number, required: true, min: -180, max: 180 },
                minPitch: { type: Number, required: true, min: -90, max: 90 },
                maxPitch: { type: Number, required: true, min: -90, max: 90 }
            },
            default: undefined
        },
        initialView: {
            type: {
                pitch: { type: Number, required: true, min: -85, max: 85 },
                yaw: { type: Number, required: true, min: -180, max: 180 },
                fov: { type: Number, required: true, min: 30, max: 100 }
            },
            required: true
        },
        hotspots: { type: [TourHotspotSchema], default: [] } // anidados por escena (decisión cerrada)
    },
    { _id: false }
);

const TourSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        scenes: { type: [TourSceneSchema], default: [] } // El tope de cantidad es del dominio (MAX_SCENES)
    },
    { _id: false }
);

const PropertySchema: Schema = new Schema({
    title: { type: String, required: true, maxlength: [200, 'Title must not exceed 200 characters'] },
    description: { type: String, required: true, maxlength: [10000, 'Description must not exceed 10000 characters'] },
    price: { type: Number, required: true, min: [0, 'Price must be non-negative'], max: [1000000000000, 'Price must not exceed 1000000000000'] },
    currency: {
        type: String,
        enum: [...VALID_CURRENCIES],
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        },
        address: {
            type: String,
            required: true,
            maxlength: [500, 'Address must not exceed 500 characters']
        },
        city: {
            type: String,
            required: true,
            maxlength: [100, 'City must not exceed 100 characters']
        }
    },
    bedrooms: { type: Number, required: true, min: [0, 'Bedrooms must be non-negative'], max: [50, 'Bedrooms must not exceed 50'] },
    bathrooms: { type: Number, required: true, min: [0, 'Bathrooms must be non-negative'], max: [50, 'Bathrooms must not exceed 50'] },
    area: { type: Number, required: true, min: [0, 'Area must be non-negative'], max: [999999, 'Area must not exceed 999999'] },
    propertyType: {
        type: String,
        enum: [...VALID_PROPERTY_TYPES],
        required: true
    },
    listingType: { type: String, enum: [...VALID_LISTING_TYPES], required: true },
    status: { type: String, enum: [...VALID_STATUSES], default: 'available' },
    cityLower: { type: String, default: '' },
    images: {
        type: [ImageAssetSchema],
        default: []
        // El tope de cantidad es una regla de negocio del dominio (MAX_IMAGES) — C7/C14
    },
    tour: { type: TourSchema, default: undefined },
    featured: { type: Boolean, default: false },
    featuredImageId: { type: String, default: '' },
    deletedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

PropertySchema.index({ location: '2dsphere' });
PropertySchema.index({ status: 1, listingType: 1, propertyType: 1 });
PropertySchema.index({ cityLower: 1 });
PropertySchema.index({ featured: 1 });
PropertySchema.index({ createdAt: -1 });
// C13: índices alineados con los patrones de consulta reales
// Listado por defecto: status=available (no borradas), ordenadas por más nuevas
PropertySchema.index(
    { status: 1, createdAt: -1 },
    { partialFilterExpression: { deletedAt: null } }
);
// Sección de destacadas ordenada por recencia
PropertySchema.index(
    { featured: 1, updatedAt: -1 },
    { partialFilterExpression: { deletedAt: null } }
);
PropertySchema.index(
    { deletedAt: 1 },
    { partialFilterExpression: { deletedAt: null } }
);

/**
 * Mantiene `cityLower` sincronizada con `location.city` en los caminos de guardado
 * del documento (create/save). La traducción DTO→GeoJSON ocurre solo en el repositorio
 * (Mongoose castea los subdocumentos antes de que corran los hooks, así que los campos
 * DTO ya fueron eliminados para cuando un hook podría verlos).
 */
PropertySchema.pre('validate', function (this: { location: { city?: string } | undefined; cityLower: string; isModified: (p: string) => boolean }) {
    if (this.isModified('location')) {
        const city = this.location?.city;
        if (typeof city === 'string') {
            this.cityLower = normalizeCity(city);
        }
    }
});

export default mongoose.model<IProperty>('Property', PropertySchema);
