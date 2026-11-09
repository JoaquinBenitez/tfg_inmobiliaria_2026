import { PropertyEntity } from '../../domain/property';

/**
 * Ítem del feed canónico — el conjunto de campos normalizados acordado en el TFG
 * (Anexo 2, "Formato estructurado de sindicación para portales"). Los serializadores
 * por portal (ZonaProp/ArgenProp, cuando lleguen sus XSD) traducen DESDE esta forma;
 * los feeds canónicos XML/JSON la exponen tal cual.
 */
export interface CanonicalFeedItem {
    codigoInmueble: string;
    operacion: 'venta' | 'alquiler';
    tipoPropiedad: string;
    precio: number;
    moneda: string;
    ciudad: string;
    direccion: string;
    latitud?: number;
    longitud?: number;
    superficieTotal: number;
    dormitorios: number;
    banos: number;
    imagenes: string[];
    urlDetalle: string;
    /** ISO 8601 — permite a los portales diferir incrementalmente entre rastreos */
    fechaActualizacion: string;
}

export function toCanonicalItem(property: PropertyEntity, siteUrl: string): CanonicalFeedItem {
    return {
        codigoInmueble: property.id,
        operacion: property.listingType === 'sale' ? 'venta' : 'alquiler',
        tipoPropiedad: property.propertyType,
        precio: property.price.amount,
        moneda: property.price.currency,
        ciudad: property.location.city,
        direccion: property.location.address,
        latitud: property.location.lat,
        longitud: property.location.lng,
        superficieTotal: property.area,
        dormitorios: property.bedrooms,
        banos: property.bathrooms,
        imagenes: property.images.map(image => image.url),
        urlDetalle: `${siteUrl}/propiedades/${property.id}`,
        fechaActualizacion: new Date(property.updatedAt).toISOString()
    };
}
