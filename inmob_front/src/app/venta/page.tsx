import { fetchApi } from '@/lib/api';
import { config } from '@/config';
import { Property } from '@/types/property';
import PropertyList from '@/components/shared/PropertyList';
import Navbar from '@/components/layout/Navbar';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Propiedades en Venta',
  description: 'Encuentra tu propiedad ideal para comprar. Casas, departamentos, terrenos y locales comerciales en venta en Avellaneda y Reconquista. La mejor selección de propiedades.',
  keywords: [
    'propiedades venta', 'casas venta', 'departamentos venta', 'terrenos venta',
    'locales comerciales venta', 'comprar propiedad', 'Avellaneda', 'Reconquista'
  ],
  openGraph: {
    title: 'Propiedades en Venta',
    description: 'Encuentra tu propiedad ideal para comprar. Casas, departamentos, terrenos y locales comerciales en venta.',
    url: '/venta',
  },
  twitter: {
    title: 'Propiedades en Venta',
    description: 'Encuentra tu propiedad ideal para comprar. La mejor selección de propiedades en venta.',
  },
}

interface SearchParams {
    propertyType?: string;
    bedrooms?: string;
    city?: string;
    minPrice?: string;
    maxPrice?: string;
    propertyTypes?: string;
    cities?: string;
    minBedrooms?: string;
    maxBedrooms?: string;
    status?: string;
    advanced?: string;
}

interface SalePropertiesPageProps {
    searchParams: Promise<SearchParams>;
}

export default async function SalePropertiesPage({ searchParams }: SalePropertiesPageProps) {
    const resolvedSearchParams = await searchParams;

    // Construir el query string desde los parámetros de búsqueda
    // (listingType=sale ya viene en el endpoint base)
    const queryParams = new URLSearchParams();

    // Manejar parámetros de búsqueda simple
    if (resolvedSearchParams.propertyType) queryParams.append('propertyType', resolvedSearchParams.propertyType);
    if (resolvedSearchParams.bedrooms) queryParams.append('bedrooms', resolvedSearchParams.bedrooms);
    if (resolvedSearchParams.city) queryParams.append('city', resolvedSearchParams.city);
    if (resolvedSearchParams.minPrice) queryParams.append('minPrice', resolvedSearchParams.minPrice);
    if (resolvedSearchParams.maxPrice) queryParams.append('maxPrice', resolvedSearchParams.maxPrice);

    // Manejar parámetros de búsqueda avanzada
    if (resolvedSearchParams.propertyTypes) queryParams.append('propertyTypes', resolvedSearchParams.propertyTypes);
    if (resolvedSearchParams.cities) queryParams.append('cities', resolvedSearchParams.cities);
    if (resolvedSearchParams.minBedrooms) queryParams.append('minBedrooms', resolvedSearchParams.minBedrooms);
    if (resolvedSearchParams.maxBedrooms) queryParams.append('maxBedrooms', resolvedSearchParams.maxBedrooms);
    if (resolvedSearchParams.status) queryParams.append('status', resolvedSearchParams.status);

    const queryString = queryParams.toString();
    const endpoint = queryString
        ? `${config.endpoints.properties.search('sale')}&${queryString}`
        : config.endpoints.properties.search('sale');

    const properties = await fetchApi<Property[]>(endpoint);

    return (
        <>
            <Navbar />
            <PropertyList
                properties={properties}
                type="sale"
            />
        </>
    );
} 