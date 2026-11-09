// PNG válido mínimo de 1x1 (70 bytes)
export const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

interface PropertyOverrides {
    [key: string]: unknown;
}

export const validPropertyPayload = (overrides: PropertyOverrides = {}) => ({
    title: 'Test Property',
    description: 'A nice test property',
    price: 100000,
    currency: 'USD',
    location: {
        address: 'Test Street 123',
        city: 'Santa Fe',
        latitude: -31.6333,
        longitude: -60.7
    },
    bedrooms: 2,
    bathrooms: 1,
    area: 50,
    propertyType: 'casa',
    listingType: 'sale',
    ...overrides,
});

/**
 * Persistence-shape payload (GeoJSON location) for tests and scripts that write
 * via the Mongoose model directly, bypassing the repository translation layer.
 */
export const validPersistencePayload = (overrides: PropertyOverrides = {}) => ({
    ...validPropertyPayload(),
    location: {
        type: 'Point',
        coordinates: [-60.7, -31.6333],
        address: 'Test Street 123',
        city: 'Santa Fe',
    },
    ...overrides,
});

export const imageAsset = (publicId: string, url?: string) => ({
    publicId,
    url: url ?? `http://localhost:3000/uploads/${publicId}.webp`,
});
