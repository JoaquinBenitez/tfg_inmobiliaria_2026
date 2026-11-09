import { PropertyEntity } from '../domain/property';
import { Tour } from '../domain/tour';

/**
 * Contrato de la API: la forma plana de la propiedad que se sirve a los clientes.
 * La entidad del dominio (con los objetos de valor `Money`/`GeoLocation` y el `id`)
 * se serializa acá — los controllers nunca filtran tipos de dominio o persistencia
 * directamente.
 */
export interface PropertyDto {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: PropertyEntity['price']['currency'];
    location: {
        address: string;
        city: string;
        lat: number;
        lng: number;
    };
    bedrooms: number;
    bathrooms: number;
    area: number;
    propertyType: PropertyEntity['propertyType'];
    listingType: PropertyEntity['listingType'];
    status: PropertyEntity['status'];
    images: PropertyEntity['images'];
    tour?: Tour;
    featured: boolean;
    featuredImageId: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export function toPropertyDto(property: PropertyEntity): PropertyDto {
    return {
        id: property.id,
        title: property.title,
        description: property.description,
        price: property.price.amount,
        currency: property.price.currency,
        location: property.location,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        area: property.area,
        propertyType: property.propertyType,
        listingType: property.listingType,
        status: property.status,
        images: property.images,
        ...(property.tour ? { tour: property.tour } : {}),
        featured: property.featured,
        featuredImageId: property.featuredImageId,
        deletedAt: property.deletedAt,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
    };
}
