'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Property } from '@/types/property'
import { endpoints } from '@/config/endpoints'
import { Button } from '@/components/ui/button'
import { MapPin, X, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

// Import dinámico del componente de mapa para evitar problemas de SSR
const MapSearch = dynamic(() => import('@/components/shared/MapSearch'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
})

const DEFAULT_CENTER: [number, number] = [-29.15, -59.65]

interface MapFilters {
  listingType: 'all' | 'sale' | 'rent'
  propertyType: string
  minPrice: number
  maxPrice: number
  bedrooms: string
  status: 'available' | 'reserved' | 'all'
}

function readCenterFromUrl(): [number, number] {
  if (typeof window === 'undefined') return DEFAULT_CENTER
  const params = new URLSearchParams(window.location.search)
  const lat = params.get('lat')
  const lng = params.get('lng')
  if (lat && lng) {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return [latitude, longitude]
    }
  }
  return DEFAULT_CENTER
}

// Id de propiedad en deep link ("Ver en Mapa" desde una página de propiedad)
function readFocusFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get('propertyId') ?? undefined
}

export default function MapSearchPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Estado de los filtros
  const [showFilters, setShowFilters] = useState(true)
  const [filters, setFilters] = useState<MapFilters>({
    listingType: 'all',
    propertyType: 'all',
    minPrice: 0,
    maxPrice: 10000000,
    bedrooms: 'all',
    status: 'available',
  })

  // Centro del mapa (Santa Fe, Argentina por defecto; soporta deep links ?lat=&lng=)
  const [mapCenter, setMapCenter] = useState<[number, number]>(readCenterFromUrl)
  const [focusPropertyId] = useState<string | undefined>(readFocusFromUrl)

  const fetchAllProperties = useCallback(async (): Promise<Property[]> => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'
    const response = await fetch(`${API_URL}${endpoints.properties.all}?limit=1000`)

    if (!response.ok) throw new Error('Failed to fetch properties')

    const data = await response.json()
    return data.properties || []
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchAllProperties()
      .then((loaded) => {
        if (cancelled) return
        setProperties(loaded)
        setError('')
      })
      .catch((err) => {
        console.error('Error fetching properties:', err)
        if (!cancelled) setError('No se pudieron cargar las propiedades')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchAllProperties])

  // Derivado: filtrar propiedades cuando cambia la lista fuente o los filtros
  const filteredProperties = useMemo(() => {
    let filtered = [...properties]

    // Filtrar por tipo de operación
    if (filters.listingType !== 'all') {
      filtered = filtered.filter(p => p.listingType === filters.listingType)
    }

    // Filtrar por tipo de propiedad
    if (filters.propertyType !== 'all') {
      filtered = filtered.filter(p => p.propertyType === filters.propertyType)
    }

    // Filtrar por precio
    filtered = filtered.filter(
      p => p.price >= filters.minPrice && p.price <= filters.maxPrice
    )

    // Filtrar por dormitorios
    if (filters.bedrooms !== 'all') {
      const bedroomCount = parseInt(filters.bedrooms)
      if (filters.bedrooms === '4') {
        filtered = filtered.filter(p => p.bedrooms >= 4)
      } else {
        filtered = filtered.filter(p => p.bedrooms === bedroomCount)
      }
    }

    // Filtrar por estado
    if (filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === filters.status)
    }

    // La propiedad del deep link se muestra siempre, incluso cuando el filtro de
    // estado la ocultaría — "Ver en Mapa" debe caer en el pin desde donde vino el usuario
    if (focusPropertyId) {
      const focus = properties.find(p => p.id === focusPropertyId)
      if (focus && !filtered.some(p => p.id === focusPropertyId)) {
        filtered.push(focus)
      }
    }

    return filtered
  }, [properties, filters, focusPropertyId])

  const handleFilterChange = (key: keyof MapFilters, value: MapFilters[keyof MapFilters]) => {
    setFilters(prev => ({ ...prev, [key]: value }) as MapFilters)
  }

  const resetFilters = () => {
    setFilters({
      listingType: 'all',
      propertyType: 'all',
      minPrice: 0,
      maxPrice: 10000000,
      bedrooms: 'all',
      status: 'available',
    })
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold hover:text-primary transition-colors"
            title="Volver al inicio"
          >
            <MapPin className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">Inversiones Inmobiliarias</span>
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <div>
            <h1 className="text-xl font-bold">Buscar en Mapa</h1>
            <p className="text-sm text-muted-foreground">
              {filteredProperties.length} propiedades encontradas
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
        </Button>
      </div>

      <div className="flex-1 flex relative">
        {/* Filters Sidebar */}
        {showFilters && (
          <div className="w-80 bg-background border-r border-border p-4 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-3">Filtros</h3>
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo de operación
                </label>
                <select
                  value={filters.listingType}
                  onChange={(e) => handleFilterChange('listingType', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="all">Todas</option>
                  <option value="sale">Venta</option>
                  <option value="rent">Alquiler</option>
                </select>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo de propiedad
                </label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => handleFilterChange('propertyType', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="all">Todas</option>
                  <option value="casa">Casa</option>
                  <option value="departamento">Departamento</option>
                  <option value="terreno">Terreno</option>
                  <option value="oficina">Oficina</option>
                  <option value="local">Local comercial</option>
                </select>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Dormitorios
                </label>
                <select
                  value={filters.bedrooms}
                  onChange={(e) => handleFilterChange('bedrooms', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="all">Todos</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4+</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rango de precio
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Mínimo</label>
                    <input
                      type="number"
                      value={filters.minPrice}
                      onChange={(e) => handleFilterChange('minPrice', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Máximo</label>
                    <input
                      type="number"
                      value={filters.maxPrice}
                      onChange={(e) => handleFilterChange('maxPrice', parseInt(e.target.value) || 10000000)}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                      placeholder="Sin límite"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {formatCurrency(filters.minPrice)} - {formatCurrency(filters.maxPrice)}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Estado
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background"
                >
                  <option value="all">Todos</option>
                  <option value="available">Disponible</option>
                  <option value="reserved">Reservado</option>
                </select>
              </div>

              {/* Reset Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={resetFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg">
              {error}
            </div>
          )}

          <MapSearch
            properties={filteredProperties}
            center={mapCenter}
            onCenterChange={setMapCenter}
            isLoading={isLoading}
            focusPropertyId={focusPropertyId}
            zoom={focusPropertyId ? 15 : 12}
          />
        </div>
      </div>
    </div>
  )
}
