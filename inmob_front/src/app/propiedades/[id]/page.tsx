import { fetchApi } from '@/lib/api';
import { config } from '@/config';
import { Property } from '@/types/property';
import Navbar from '@/components/layout/Navbar';
import PropertyImageGallery from '@/components/shared/PropertyImageGallery';
import { TourSection } from '@/components/tour/TourSection';
import PropertyDetailsSection from '@/components/shared/PropertyDetailsSection';
import PropertyContactForm from '@/components/shared/PropertyContactForm';
import { ShareButtons } from '@/components/shared/ShareButtons';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackToTop } from '@/components/shared/BackToTop';
import { ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next'
import { formatCurrency } from '@/lib/utils';

interface PropertyDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PropertyDetailPageProps): Promise<Metadata> {
    const resolvedParams = await params;
    
    try {
        const property = await fetchApi<Property>(config.endpoints.properties.detail(resolvedParams.id));
        
        // Determinar el tipo de operación para las keywords
        const transactionType = property.listingType === 'rent' ? 'alquiler' : 'venta';
        const transactionText = property.listingType === 'rent' ? 'en Alquiler' : 'en Venta';
        
        // Generar el tipo de propiedad en español
        const propertyTypeMap: { [key: string]: string } = {
            'departamento': 'Departamento',
            'casa': 'Casa', 
            'terreno': 'Terreno',
            'oficina': 'Oficina',
            'local': 'Local Comercial'
        };
        
        const propertyTypeText = propertyTypeMap[property.propertyType] || property.propertyType;
        
        // Crear título y descripción dinámicos
        const title = `${property.title} - ${propertyTypeText} ${transactionText}`;
        const priceText = formatCurrency(property.price, property.currency) + (property.listingType === 'rent' ? '/mes' : '');
        const description = `${propertyTypeText} ${transactionText} en ${property.location.address}. ${property.bedrooms} dormitorios, ${property.bathrooms} baños, ${property.area} m². Precio: ${priceText}. ${property.description.substring(0, 100)}...`;
        
        return {
            title,
            description,
            keywords: [
                propertyTypeText.toLowerCase(),
                transactionType,
                property.location.address,
                `${property.bedrooms} dormitorios`,
                property.propertyType,
                property.status
            ],
            openGraph: {
                title,
                description,
                url: `/propiedades/${resolvedParams.id}`,
                images: property.images.length > 0 ? [
                    {
                        url: property.images[0]?.url,
                        width: 1200,
                        height: 630,
                        alt: `${property.title} - ${propertyTypeText} ${transactionText}`,
                    }
                ] : [],
            },
            twitter: {
                title,
                description,
                images: property.images.length > 0 ? [property.images[0]?.url ?? ''] : [],
            },
        };
    } catch {
        // Metadata de fallback si falla el fetch de la propiedad
        return {
            title: 'Propiedad no encontrada',
            description: 'La propiedad solicitada no existe o no está disponible.',
        };
    }
}

export default async function PropertyDetailPage({ params, searchParams }: PropertyDetailPageProps) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;

    const property = await fetchApi<Property>(config.endpoints.properties.detail(resolvedParams.id));

    // Generar los datos estructurados JSON-LD para SEO
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: property.title,
        description: property.description.replace(/<[^>]*>/g, ''), // Strip HTML
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/propiedades/${property.id}`,
        image: property.images.length > 0 ? property.images.map(image => image.url) : undefined,
        offers: {
            '@type': 'Offer',
            price: property.price,
            priceCurrency: property.currency,
            availability: property.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            ...(property.listingType === 'rent' && { priceSpecification: { '@type': 'UnitPriceSpecification', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } } }),
        },
        address: {
            '@type': 'PostalAddress',
            streetAddress: property.location.address,
            addressLocality: property.location.city,
            addressCountry: 'AR',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: property.location.lat,
            longitude: property.location.lng,
        },
        numberOfRooms: property.bedrooms,
        numberOfBedrooms: property.bedrooms,
        numberOfBathroomsTotal: property.bathrooms,
        floorSize: {
            '@type': 'QuantitativeValue',
            value: property.area,
            unitCode: 'MTK', // Square meters
        },
        ...(property.featured && { additionalType: 'https://schema.org/Product' }),
    }

    // "Volver" target: the search the visitor came from (?from=, tagged by the
    // results grid), else the listing-type page. Only same-site absolute paths
    // are honored — never an absolute URL (open-redirect guard).
    const from = typeof resolvedSearch.from === 'string' ? resolvedSearch.from : '';
    const backHref = from.startsWith('/') && !from.startsWith('//')
        ? from
        : property.listingType === 'rent' ? '/alquiler' : '/venta';

    return (
        <>
            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Navbar />
            <main className="container mx-auto px-4 py-8 pt-24">
                {/* Back Navigation */}
                <div className="mb-6 flex items-center justify-between">
                    <Link
                        href={backHref}
                        className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver a las propiedades
                    </Link>
                    <Link
                        href={`/buscar-en-mapa?lat=${property.location.lat}&lng=${property.location.lng}&propertyId=${property.id}`}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <MapPin className="w-4 h-4 mr-2" />
                        Ver en Mapa
                    </Link>
                </div>

                {/* Title block — title, location, price (page order: title → photos → description → 360° → ubicación) */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">{property.title}</h1>
                    <div className="flex items-center text-muted-foreground mb-4">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span>{property.location.address}, {property.location.city}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-4xl font-bold text-primary">
                            {formatCurrency(property.price, property.currency)}
                            {property.listingType === 'rent' ? ' /mes' : ''}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2 py-1 text-xs font-medium">
                            {property.listingType === 'rent' ? 'Alquiler' : 'Venta'}
                        </span>
                        {property.status && (
                            <StatusBadge
                                status={property.status as 'available' | 'reserved' | 'sold' | 'rented'}
                                size="default"
                            />
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Image Gallery Section - Larger column */}
                    <div className="lg:col-span-2 space-y-6">
                        <PropertyImageGallery
                            images={property.images.map(image => image.url)}
                            title={property.title}
                        />

                        {/* Share Buttons - Below Gallery */}
                        <div className="bg-muted/50 rounded-lg p-4 border border-border">
                            <ShareButtons property={property} />
                        </div>

                        {/* Description — above the 360° tour */}
                        <div>
                            <h2 className="text-xl font-semibold mb-3">Descripción</h2>
                            <div className="prose prose-sm max-w-none">
                                <p className="text-foreground leading-relaxed">
                                    {property.description}
                                </p>
                            </div>
                        </div>

                        {/* 360° tour — renders nothing unless tour.enabled */}
                        {property.tour && <TourSection tour={property.tour} />}
                    </div>

                    {/* Contact Form - Sticky sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24">
                            <PropertyContactForm property={property} />
                        </div>
                    </div>
                </div>

                {/* Property Details Section - Full width below */}
                <div className="mt-12">
                    <PropertyDetailsSection property={property} />
                </div>
            </main>

            {/* Back to Top Button */}
            <BackToTop />
        </>
    );
}