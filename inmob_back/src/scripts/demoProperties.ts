/**
 * Datos de las propiedades demo (Reconquista y Avellaneda, Santa Fe).
 *
 * El orden del array define el número N usado por la semilla para los prefijos
 * de `seed-assets/` (`N-*.jpg` fotos, `tours/N-*.jpg` panorámicas) y por
 * `npm run export-tour`. Al editar/eliminar entradas, ese numerado cambia.
 */

export interface DemoProperty {
    title: string;
    description: string;
    price: number;
    currency: 'USD' | 'ARS';
    lat: number;
    lng: number;
    address: string;
    city: string;
    bedrooms: number;
    bathrooms: number;
    area: number;
    propertyType: 'departamento' | 'casa' | 'terreno' | 'oficina' | 'local';
    listingType: 'sale' | 'rent';
    status: 'available' | 'reserved' | 'sold';
    featured: boolean;
    photos: number;
}

export const DEMO_PROPERTIES: DemoProperty[] = [
    {
        title: 'Casa con jardín en barrio centro',
        description: 'Amplia casa de una planta con jardín, parrilla y cochera. Living-comedor integrado, cocina, 2 dormitorios (principal en suite) y galería.',
        price: 95000, currency: 'USD', lat: -29.1501, lng: -59.6475,
        address: 'Belgrano 1250', city: 'Reconquista', bedrooms: 2, bathrooms: 1,
        area: 180, propertyType: 'casa', listingType: 'sale', status: 'available',
        featured: true, photos: 2
    },
    {
        title: 'Casa a estrenar en barrio Padre Celso',
        description: 'Casa a estrenar de 160 m² cubiertos en lote de 500 m², en uno de los barrios más tranquilos de Avellaneda. 3 dormitorios, 2 baños, galería con parrilla y espacio para pileta. Terminaciones de primera calidad.',
        price: 128000, currency: 'USD', lat: -29.1104, lng: -59.6613,
        address: 'Calle 306 99', city: 'Avellaneda', bedrooms: 3, bathrooms: 2,
        area: 160, propertyType: 'casa', listingType: 'sale', status: 'available',
        featured: true, photos: 3
    },
    {
        title: 'Casa grande con quincho en Reconquista - tiene 360°',
        description: 'Casa de 220 m² sobre lote de 600 m². 4 dormitorios, 3 baños, living con hogar, quincho independiente con parrilla y piscina. Parque con añosos árboles. Esta propiedad incluye un recorrido virtual 360° de demostración.',
        price: 155000, currency: 'USD', lat: -29.1424, lng: -59.6546,
        address: 'San Lorenzo 600', city: 'Reconquista', bedrooms: 4, bathrooms: 3,
        area: 220, propertyType: 'casa', listingType: 'sale', status: 'available',
        featured: false, photos: 3
    },
    {
        title: 'Departamento luminoso en el centro de Reconquista',
        description: 'Departamento de 2 ambientes. Balcón con vista abierta, cocina equipada, baño completo y lavadero independiente. Ideal para estudiantes o inversores.',
        price: 420000, currency: 'ARS', lat: -29.1466, lng: -59.6455,
        address: 'San Martín 890', city: 'Reconquista', bedrooms: 1, bathrooms: 1,
        area: 58, propertyType: 'departamento', listingType: 'rent', status: 'available',
        featured: true, photos: 3
    },
    {
        title: 'Local comercial en Reconquista centro',
        description: 'Local de 120 m² con frente de 8 m ubicado en el centro de Reconquista. Depósito posterior y baño. Excelente para retail o gastronomía.',
        price: 2550000, currency: 'ARS', lat: -29.1483, lng: -59.6468,
        address: 'Roca 1057', city: 'Reconquista', bedrooms: 0, bathrooms: 1,
        area: 120, propertyType: 'local', listingType: 'rent', status: 'available',
        featured: false, photos: 2
    },
    {
        title: 'Terreno de 21x25 en Reconquista',
        description: 'Lote de 525 m² en zona residencial consolidada de Reconquista, a pocas cuadras de ruta nacional. Todos los servicios en el lote (luz, agua, gas, cloacas).',
        price: 38000, currency: 'USD', lat: -29.16277, lng: -59.6563,
        address: 'Lucas Funes 2502', city: 'Reconquista', bedrooms: 0, bathrooms: 0,
        area: 525, propertyType: 'terreno', listingType: 'sale', status: 'available',
        featured: false, photos: 2
    }
];
