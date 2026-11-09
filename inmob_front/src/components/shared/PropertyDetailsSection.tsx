import { Property } from '@/types/property';
import { PropertyMapLazy } from '@/components/ui/property-map';
import { MapPin, Bed, Bath, Ruler, Home, Tag } from 'lucide-react';

interface PropertyDetailsSectionProps {
    property: Property;
}

export default function PropertyDetailsSection({ property }: PropertyDetailsSectionProps) {
    // (title/price header and description live on the property page itself —
    // page order: title → photos → description → 360° → details → ubicación)
    const getPropertyTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            departamento: 'Departamento',
            casa: 'Casa',
            terreno: 'Terreno',
            oficina: 'Oficina',
            local: 'Local Comercial'
        };
        return types[type] || type;
    };

    const getListingTypeLabel = (type: string) => {
        return type === 'rent' ? 'Alquiler' : 'Venta';
    };

    const getStatusLabel = (status: string) => {
        const statuses: Record<string, string> = {
            available: 'Disponible',
            reserved: 'Reservada',
            sold: 'Vendida',
            rented: 'Alquilada'
        };
        return statuses[status] || status;
    };

    return (
        <div className="space-y-6">
            {/* Key Features Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-background">
                    <Bed className="w-5 h-5 text-primary" />
                    <div>
                        <p className="font-semibold">{property.bedrooms}</p>
                        <p className="text-sm text-muted-foreground">Habitaciones</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-background">
                    <Bath className="w-5 h-5 text-primary" />
                    <div>
                        <p className="font-semibold">{property.bathrooms}</p>
                        <p className="text-sm text-muted-foreground">Baños</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-background">
                    <Ruler className="w-5 h-5 text-primary" />
                    <div>
                        <p className="font-semibold">{property.area}</p>
                        <p className="text-sm text-muted-foreground">m²</p>
                    </div>
                </div>
            </div>

            {/* Property Details */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Detalles de la Propiedad</h2>
                <div className="bg-muted/30 rounded-lg p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <div className="flex items-center space-x-2">
                                    <Home className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Tipo:</span>
                                </div>
                                <span className="font-medium">
                                    {getPropertyTypeLabel(property.propertyType)}
                                </span>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <div className="flex items-center space-x-2">
                                    <Tag className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Operación:</span>
                                </div>
                                <span className="font-medium">
                                    {getListingTypeLabel(property.listingType)}
                                </span>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <span className="text-muted-foreground">Estado:</span>
                                <span className="font-medium">
                                    {getStatusLabel(property.status)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <span className="text-muted-foreground">Superficie:</span>
                                <span className="font-medium">{property.area} m²</span>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <span className="text-muted-foreground">Habitaciones:</span>
                                <span className="font-medium">{property.bedrooms}</span>
                            </div>
                            
                            <div className="flex items-center justify-between py-3 border-b border-muted">
                                <span className="text-muted-foreground">Baños:</span>
                                <span className="font-medium">{property.bathrooms}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Location coordinates if available */}
                    {property.location && (
                        <div className="mt-6 pt-6 border-t border-muted">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Coordenadas:</span>
                                </div>
                                <span className="font-medium text-sm">
                                    {property.location.lat.toFixed(6)}, {property.location.lng.toFixed(6)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Additional Features */}
            {property.featured && (
                <div>
                    <h2 className="text-xl font-semibold mb-3">Características especiales</h2>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <span className="text-primary font-medium">Propiedad destacada</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Property Location Map — last section (ubicación) */}
            <div>
                <PropertyMapLazy 
                    property={property} 
                    height="400px"
                    className="shadow-xs"
                />
            </div>
        </div>
    );
}