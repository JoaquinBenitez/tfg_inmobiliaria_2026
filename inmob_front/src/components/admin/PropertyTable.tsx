"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CanAccess } from "./ProtectedRoute"
import { fetchApi } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { Property } from "@/types/property"
import {
  Building2,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Plus,
  AlertCircle,
  Star,
  Check,
  X
} from "lucide-react"

interface PropertyTableProps {
  onPropertyDeleted?: () => void
}

interface PropertiesResponse {
  properties: Property[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function PropertyTable({ onPropertyDeleted }: PropertyTableProps) {
  const { data: session } = useSession()
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ propertyType: 'all', listingType: 'all', status: 'all' })
  const [pendingStatus, setPendingStatus] = useState<Record<string, 'available' | 'reserved' | 'sold' | 'rented'>>({})

  const accessToken = session?.accessToken

  const fetchProperties = useCallback(async (): Promise<Property[] | null> => {
    if (!accessToken) return null

    const response = await fetchApi<PropertiesResponse>('/properties/all?status=all', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    return response.properties
  }, [accessToken])

  useEffect(() => {
    let cancelled = false

    fetchProperties()
      .then((loaded) => {
        if (cancelled || loaded === null) return
        setProperties(loaded)
      })
      .catch((err) => {
        console.error('Error fetching properties:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load properties")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchProperties])

  const handleDelete = async (id: string, title: string) => {
    if (!session?.accessToken) return
    if (!confirm(`¿Estas seguro de que quieres eliminar "${title}"? Esta accion no se puede deshacer.`)) {
      return
    }

    try {
      setDeletingId(id)
      await fetchApi<{ message: string }>(`/properties/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })

      // Quitar del estado local
      setProperties(prev => prev.filter(p => p.id !== id))

      // Llamar al callback si se proveyó
      onPropertyDeleted?.()

    } catch (err) {
      console.error('Error deleting property:', err)
      setError(err instanceof Error ? err.message : "Failed to delete property")
    } finally {
      setDeletingId(null)
    }
  }

  const handleStatusChange = async (id: string, newStatus: 'available' | 'reserved' | 'sold' | 'rented') => {
    if (!session?.accessToken) return

    try {
      setUpdatingStatusId(id)
      setError("")

      // Update optimista
      setProperties(prev => prev.map(p =>
        p.id === id ? { ...p, status: newStatus } : p
      ))

      // Actualizar en el servidor
      await fetchApi<Property>(`/properties/update/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

    } catch (err) {
      console.error('Error updating property status:', err)
      setError(err instanceof Error ? err.message : "Failed to update property status")

      // Revertir el update optimista ante error
      setIsLoading(true)
      fetchProperties()
        .then((reloaded) => {
          if (reloaded) setProperties(reloaded)
        })
        .catch((reloadErr) => console.error('Error reloading properties:', reloadErr))
        .finally(() => setIsLoading(false))
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const filteredProperties = useMemo(() => properties.filter(p =>
    (filters.propertyType === 'all' || p.propertyType === filters.propertyType) &&
    (filters.listingType === 'all' || p.listingType === filters.listingType) &&
    (filters.status === 'all' || p.status === filters.status)
  ), [properties, filters])

  const confirmStatusChange = async (id: string) => {
    const next = pendingStatus[id]
    if (!next) return
    await handleStatusChange(id, next)
    setPendingStatus(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const cancelStatusChange = (id: string) => {
    setPendingStatus(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Propiedades</CardTitle>
            <CardDescription>
              Gestiona tus propiedades ({filteredProperties.length} de {properties.length})
            </CardDescription>
          </div>
          <CanAccess resource="properties" action="create">
            <Link href="/admin/properties/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Agregar propiedad
              </Button>
            </Link>
          </CanAccess>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filters.propertyType}
            onChange={(e) => setFilters(f => ({ ...f, propertyType: e.target.value }))}
            className="text-sm border border-input rounded px-2 py-1.5 bg-background hover:bg-accent cursor-pointer"
          >
            <option value="all">Todos los tipos</option>
            <option value="casa">Casa</option>
            <option value="departamento">Departamento</option>
            <option value="terreno">Terreno</option>
            <option value="oficina">Oficina</option>
            <option value="local">Local comercial</option>
          </select>
          <select
            value={filters.listingType}
            onChange={(e) => setFilters(f => ({ ...f, listingType: e.target.value }))}
            className="text-sm border border-input rounded px-2 py-1.5 bg-background hover:bg-accent cursor-pointer"
          >
            <option value="all">Todas las operaciones</option>
            <option value="sale">Venta</option>
            <option value="rent">Alquiler</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="text-sm border border-input rounded px-2 py-1.5 bg-background hover:bg-accent cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="reserved">Reservada</option>
            <option value="sold">Vendida</option>
                              <option value="rented">Alquilada</option>
          </select>
        </div>

        {filteredProperties.length === 0 && properties.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Ninguna propiedad coincide con los filtros.
          </div>
        )}

        {properties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Aun no hay propiedades</h3>
            <p className="text-muted-foreground mb-6">Comienza creando tu primer listado de propiedad.</p>
            <CanAccess resource="properties" action="create">
              <Link href="/admin/properties/create">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar propiedad
                </Button>
              </Link>
            </CanAccess>
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Propiedad</th>
                    <th className="w-8 py-3" aria-label="Destacada"></th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Ubicacion</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Precio</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {property.images && property.images.length > 0 ? (
                              <div className="relative h-12 w-12 rounded-lg overflow-hidden">
                                <Image 
                                  src={property.images[0]?.url} 
                                  alt={property.title}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                                <Building2 className="h-6 w-6 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{property.title}</p>
                            <p className="text-sm text-muted-foreground/80">
                              {property.bedrooms} hab • {property.bathrooms} baño • {property.area}m²
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        {property.featured && (
                          <Star className="h-4 w-4 text-warning fill-current inline" />
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium text-foreground capitalize">
                            {property.propertyType || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {property.listingType === 'sale' ? 'En venta' : 'En alquiler'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>{property.location.address}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {property.location.city || 'N/A'}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-medium text-foreground">
                          {formatCurrency(property.price, property.currency)}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <CanAccess
                          resource="properties"
                          action="update"
                          fallback={<StatusBadge status={property.status as 'available' | 'reserved' | 'sold' | 'rented'} />}
                        >
                          <div className="flex items-center gap-1">
                            <select
                              value={pendingStatus[property.id] ?? property.status}
                              onChange={(e) => setPendingStatus(prev => ({ ...prev, [property.id]: e.target.value as 'available' | 'reserved' | 'sold' | 'rented' }))}
                              disabled={updatingStatusId === property.id}
                              className="text-sm border border-input rounded px-2 py-1 bg-background hover:bg-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="available">Disponible</option>
                              <option value="reserved">Reservada</option>
                              <option value="sold">Vendida</option>
                              <option value="rented">Alquilada</option>
                            </select>
                            {pendingStatus[property.id] && pendingStatus[property.id] !== property.status && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Confirmar cambio"
                                  disabled={updatingStatusId === property.id}
                                  onClick={() => confirmStatusChange(property.id)}
                                >
                                  <Check className="h-3 w-3 text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Cancelar"
                                  disabled={updatingStatusId === property.id}
                                  onClick={() => cancelStatusChange(property.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </CanAccess>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end space-x-2">
                          <Link href={`/propiedades/${property.id}`} target="_blank">
                            <Button variant="outline" size="sm" title="Ver">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                          <CanAccess resource="properties" action="update">
                            <Link href={`/admin/properties/${property.id}/edit`}>
                              <Button variant="outline" size="sm" title="Editar">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </Link>
                          </CanAccess>
                          <CanAccess resource="properties" action="delete">
                            <Button 
                              variant="outline" 
                              size="sm"
                              title="Borrar"
                              onClick={() => handleDelete(property.id, property.title)}
                              disabled={deletingId === property.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </CanAccess>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {filteredProperties.map((property) => (
                <Card key={property.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {property.images && property.images.length > 0 ? (
                          <div className="relative h-16 w-16 rounded-lg overflow-hidden">
                            <Image 
                              src={property.images[0]?.url} 
                              alt={property.title}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-foreground truncate">{property.title}</h3>
                          {property.featured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {property.bedrooms} hab • {property.bathrooms} baño • {property.area}m²
                        </p>
                        <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <MapPin className="h-3 w-3 mr-1" />
                          {property.location.address}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">
                            {formatCurrency(property.price, property.currency)}
                          </p>
                          <StatusBadge status={property.status as 'available' | 'reserved' | 'sold' | 'rented'} />
                        </div>
                        <div className="flex items-center justify-end space-x-2 mt-3">
                          <Link href={`/propiedades/${property.id}`} target="_blank">
                            <Button variant="outline" size="sm" title="Ver">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                          <CanAccess resource="properties" action="update">
                            <Link href={`/admin/properties/${property.id}/edit`}>
                              <Button variant="outline" size="sm" title="Editar">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </Link>
                          </CanAccess>
                          <CanAccess resource="properties" action="delete">
                            <Button 
                              variant="outline" 
                              size="sm"
                              title="Borrar"
                              onClick={() => handleDelete(property.id, property.title)}
                              disabled={deletingId === property.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </CanAccess>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}