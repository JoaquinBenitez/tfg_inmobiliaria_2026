'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import type { PropertyMapProps } from './property-map';

// Fix para los marcadores por defecto en webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícono de marcador de propiedad personalizado
const createPropertyIcon = () => {
  return new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

export function PropertyMapView({
  property,
  height = '300px',
  className
}: PropertyMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const { lat: latitude, lng: longitude } = property.location;
  const position: [number, number] = [latitude, longitude];

  // Traducciones de tipo de propiedad
  const propertyTypeMap: { [key: string]: string } = {
    'departamento': 'Departamento',
    'casa': 'Casa',
    'terreno': 'Terreno',
    'oficina': 'Oficina',
    'local': 'Local Comercial'
  };

  const propertyTypeText = propertyTypeMap[property.propertyType] || property.propertyType;

  useEffect(() => {
    // Asegurar que el contenedor del mapa quede bien dimensionado tras el mount
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, []);

  return (
    <div
      // `relative z-0` creates a stacking context: Leaflet's internal panes use
      // z-index up to 1000, which otherwise escape and stack above page UI
      // (e.g. the back-to-top button rendering behind the map)
      className={cn(
        "relative z-0 rounded-lg overflow-hidden border border-border",
        className
      )}
      style={{ height }}
    >
      <MapContainer
        center={position}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={position}
          icon={createPropertyIcon()}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-sm text-foreground">
                {property.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {propertyTypeText}
              </p>
              <p className="text-xs text-muted-foreground">
                {property.location.address}
              </p>
              <p className="text-xs text-muted-foreground">
                {property.bedrooms} dorm. • {property.bathrooms} baños • {property.area} m²
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
