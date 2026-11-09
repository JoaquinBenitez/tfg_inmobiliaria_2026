export const VALID_PROPERTY_TYPES = ['departamento', 'casa', 'terreno', 'oficina', 'local'] as const;
export const VALID_LISTING_TYPES = ['sale', 'rent'] as const;
export const VALID_STATUSES = ['available', 'reserved', 'sold', 'rented'] as const;
export const VALID_CURRENCIES = ['USD', 'ARS'] as const;

export type PropertyTypeValue = (typeof VALID_PROPERTY_TYPES)[number];
export type ListingTypeValue = (typeof VALID_LISTING_TYPES)[number];
export type PropertyStatusValue = (typeof VALID_STATUSES)[number];
export type CurrencyValue = (typeof VALID_CURRENCIES)[number];
