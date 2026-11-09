'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, MapPin } from 'lucide-react'

// Fix para los marcadores por defecto en webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

interface CoordinatePickerProps {
  value: string // "longitude,latitude"
  onChange: (value: string) => void
  disabled?: boolean
}

// Componente que maneja los eventos de click del mapa
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Componente que desplaza el mapa a una posición
function MapPanner({ position }: { position: [number, number] | null }) {
  const map = useMap()
  const lastPosition = useRef<string | null>(null)

  useEffect(() => {
    if (position) {
      const key = `${position[0]},${position[1]}`
      if (key !== lastPosition.current) {
        lastPosition.current = key
        map.setView(position, map.getZoom())
      }
    }
  }, [position, map])

  return null
}

// Componente de marcador arrastrable
function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number]
  onDragEnd: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker) {
          const latlng = marker.getLatLng()
          onDragEnd(latlng.lat, latlng.lng)
        }
      },
    }),
    [onDragEnd]
  )

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={redIcon}
    />
  )
}

function CoordinatePickerInner({ value, onChange, disabled }: CoordinatePickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Parsear las coordenadas actuales
  const parsed = parseCoordinates(value)
  const markerPosition: [number, number] | null = parsed
    ? [parsed.lat, parsed.lng]
    : null
  const defaultCenter: [number, number] = [-31.6333, -60.7]

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (disabled) return
      onChange(`${lng.toFixed(6)},${lat.toFixed(6)}`)
    },
    [disabled, onChange]
  )

  const handleDragEnd = useCallback(
    (lat: number, lng: number) => {
      if (disabled) return
      onChange(`${lng.toFixed(6)},${lat.toFixed(6)}`)
    },
    [disabled, onChange]
  )

  // Búsqueda en Nominatim con debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (query.trim().length < 3) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ar`,
          {
            headers: {
              'User-Agent': 'InmobAdmin/1.0',
            },
          }
        )
        const data: NominatimResult[] = await response.json()
        setSearchResults(data)
        setShowResults(data.length > 0)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  const handleSelectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    onChange(`${lng.toFixed(6)},${lat.toFixed(6)}`)
    setSearchQuery(result.display_name)
    setShowResults(false)
  }

  // Cerrar el dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-3">
      {/* Search box */}
      <div className="relative" ref={resultsRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar direccion..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            disabled={disabled}
          />
          {isSearching && (
            <div className="absolute right-2.5 top-2.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        {showResults && (
          <div className="absolute z-[1000] mt-1 w-full rounded-md border bg-card shadow-lg">
            {searchResults.map((result, index) => (
              <button
                key={index}
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                onClick={() => handleSelectResult(result)}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-border" style={{ height: '300px' }}>
        <MapContainer
          center={markerPosition || defaultCenter}
          zoom={13}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={handleMapClick} />
          <MapPanner position={markerPosition} />
          {markerPosition && (
            <DraggableMarker position={markerPosition} onDragEnd={handleDragEnd} />
          )}
        </MapContainer>
      </div>

      {/* Coordinate display */}
      <div>
        <Label htmlFor="coordinates" className="text-xs">
          Coordenadas
          <span className="text-muted-foreground/80 ml-1">longitud,latitud</span>
        </Label>
        <Input
          id="coordinates"
          name="coordinates"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="-60.7,-31.6"
          disabled={disabled}
          className="text-xs font-mono"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Hace clic en el mapa o busca una direccion para establecer la ubicacion. Tambien podes arrastrar el marcador.
      </p>
    </div>
  )
}

function parseCoordinates(value: string): { lng: number; lat: number } | null {
  if (!value.trim()) return null
  const parts = value.split(',')
  if (parts.length !== 2) return null
  const lng = parseFloat(parts[0].trim())
  const lat = parseFloat(parts[1].trim())
  if (isNaN(lng) || isNaN(lat)) return null
  return { lng, lat }
}

// Wrapper de import dinámico - debe importarse con next/dynamic ssr:false
export default CoordinatePickerInner
