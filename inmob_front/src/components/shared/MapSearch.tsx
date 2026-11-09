'use client'

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Property } from '@/types/property'
import Link from 'next/link'
import Image from 'next/image'
import { Building2, MapPin, Bed, Bath, Maximize2, ExternalLink } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { formatCurrency } from '@/lib/utils'

// Fix del ícono de marcador por defecto de Leaflet con Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface MapSearchProps {
  properties: Property[]
  center: [number, number]
  onCenterChange: (center: [number, number]) => void
  isLoading: boolean
  /** Deep-linked property (from "Ver en Mapa"): highlighted + raised. */
  focusPropertyId?: string
  /** Initial zoom — react-leaflet ignores later changes. */
  zoom?: number
}

// Componente para manejar los eventos del mapa
function MapEventHandler({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter()
      onCenterChange([center.lat, center.lng])
    },
  })

  return null
}

// Íconos de marcador personalizados según el tipo de propiedad
const getMarkerIcon = (property: Property, focused = false) => {
  const colors: Record<Property['propertyType'], string> = {
    casa: '#3b82f6', // blue
    departamento: '#10b981', // green
    terreno: '#f59e0b', // amber
    oficina: '#8b5cf6', // purple
    local: '#ef4444', // red
  }

  const color = colors[property.propertyType] || '#6b7280'

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${focused ? 44 : 32}px;
        height: ${focused ? 44 : 32}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: ${focused ? 5 : 3}px solid ${focused ? '#111827' : 'white'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); color: white; font-size: ${focused ? 20 : 16}px; font-weight: bold;">
          ${property.listingType === 'sale' ? '$' : 'A'}
        </div>
      </div>
    `,
    iconSize: [focused ? 44 : 32, focused ? 44 : 32],
    iconAnchor: [focused ? 22 : 16, focused ? 44 : 32],
    popupAnchor: [0, focused ? -44 : -32],
  })
}

function PropertyMarkers({ properties, focusPropertyId }: { properties: Property[]; focusPropertyId?: string }) {
  return (
    <>
      {properties.map((property) => {
        if (typeof property.location?.lat !== 'number' || typeof property.location?.lng !== 'number') {
          return null
        }

        const { lat, lng } = property.location

        return (
          <Marker
            key={property.id}
            position={[lat, lng]}
            icon={getMarkerIcon(property, property.id === focusPropertyId)}
            zIndexOffset={property.id === focusPropertyId ? 1000 : 0}
          >
            <Popup maxWidth={300} className="property-popup">
              <div className="p-2 min-w-[280px]">
                {/* Property Image */}
                {property.images && property.images.length > 0 ? (
                  <div className="relative w-full h-40 mb-3 rounded-lg overflow-hidden">
                    <Image
                      src={property.images[0]?.url}
                      alt={property.title}
                      fill
                      className="object-cover"
                      sizes="300px"
                    />
                  </div>
                ) : (
                  <div className="w-full h-40 mb-3 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}

                {/* Property Info */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground line-clamp-2">
                    {property.title}
                  </h3>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span className="line-clamp-1">{property.location.address}</span>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Bed className="h-3 w-3 mr-1" />
                      <span>{property.bedrooms}</span>
                    </div>
                    <div className="flex items-center">
                      <Bath className="h-3 w-3 mr-1" />
                      <span>{property.bathrooms}</span>
                    </div>
                    <div className="flex items-center">
                      <Maximize2 className="h-3 w-3 mr-1" />
                      <span>{property.area}m²</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(property.price, property.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {property.listingType === 'sale' ? 'Venta' : 'Alquiler'}
                      </p>
                    </div>

                    <Link
                      href={`/propiedades/${property.id}`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
                      target="_blank"
                    >
                      <span>Ver</span>
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export default function MapSearch({ properties, center, onCenterChange, isLoading, focusPropertyId, zoom = 12 }: MapSearchProps) {
  return (
    <div
      // `relative z-0` contains Leaflet's internal panes (z-index up to 1000)
      // so they can't stack above page-level UI
      className="relative z-0 w-full h-full"
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ background: '#f3f4f6' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventHandler onCenterChange={onCenterChange} />

        {!isLoading && <PropertyMarkers properties={properties} focusPropertyId={focusPropertyId} />}
      </MapContainer>

      <style jsx global>{`
        .custom-marker {
          background: transparent;
          border: none;
        }

        .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 8px;
          overflow: hidden;
        }

        .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }

        .property-popup .leaflet-popup-close-button {
          font-size: 20px;
          padding: 4px 8px;
        }
      `}</style>
    </div>
  )
}
