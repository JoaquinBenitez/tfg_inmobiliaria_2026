'use client'

import { usePropertyComparison } from '@/hooks/usePropertyComparison'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ArrowLeft, X, Bed, Bath, Maximize2, MapPin, DollarSign, Home, Building2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/layout/Navbar'
import { formatCurrency } from '@/lib/utils'

export default function ComparePage() {
  const { comparisonList, removeFromComparison, clearComparison } = usePropertyComparison()

  if (comparisonList.length === 0) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="bg-muted rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h1 className="text-3xl font-bold mb-4">No hay propiedades para comparar</h1>
            <p className="text-muted-foreground mb-8">
              Agrega propiedades a tu lista de comparación desde las páginas de búsqueda para compararlas aquí.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Propiedades
              </Button>
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-primary hover:text-primary/80 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a las propiedades
            </Link>
            <h1 className="text-3xl font-bold">Comparar propiedades</h1>
            <p className="text-muted-foreground mt-1">
              Comparando {comparisonList.length} {comparisonList.length === 1 ? 'propiedad' : 'propiedades'}
            </p>
          </div>
          <Button variant="destructive" onClick={clearComparison}>
            <X className="h-4 w-4 mr-2" />
            Limpiar Todo
          </Button>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-border p-4 bg-muted text-left font-semibold min-w-[200px]">
                  Característica
                </th>
                {comparisonList.map((property) => (
                  <th key={property.id} className="border border-border p-4 bg-background min-w-[280px]">
                    <div className="space-y-3">
                      {/* Property Image */}
                      {property.images && property.images.length > 0 ? (
                        <div className="relative w-full h-40 rounded-lg overflow-hidden">
                          <Image
                            src={property.images[0]?.url}
                            alt={property.title}
                            fill
                            className="object-cover"
                            sizes="280px"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-40 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}

                      {/* Property Title */}
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                          {property.title}
                        </h3>
                        <Link href={`/propiedades/${property.id}`} target="_blank">
                          <Button variant="outline" size="sm" className="w-full">
                            Ver Detalles
                          </Button>
                        </Link>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromComparison(property.id)}
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Quitar
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price */}
              <tr>
                <td className="border border-border p-4 bg-muted font-medium">
                  <DollarSign className="h-4 w-4 inline mr-2" />
                  Precio
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{formatCurrency(property.price, property.currency)}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {property.listingType === 'sale' ? 'Venta' : 'Alquiler'}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Status */}
              <tr className="bg-muted/30">
                <td className="border border-border p-4 bg-muted font-medium">Estado</td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center">
                    <StatusBadge status={property.status} />
                  </td>
                ))}
              </tr>

              {/* Property Type */}
              <tr>
                <td className="border border-border p-4 bg-muted font-medium">
                  <Home className="h-4 w-4 inline mr-2" />
                  Tipo de Propiedad
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center capitalize">
                    {property.propertyType}
                  </td>
                ))}
              </tr>

              {/* Location */}
              <tr className="bg-muted/30">
                <td className="border border-border p-4 bg-muted font-medium">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Ubicación
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center">
                    <div className="text-sm">
                      <div className="font-medium">{property.location.address}</div>
                      <div className="text-muted-foreground">{property.location.city}</div>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Bedrooms */}
              <tr>
                <td className="border border-border p-4 bg-muted font-medium">
                  <Bed className="h-4 w-4 inline mr-2" />
                  Dormitorios
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center text-lg font-semibold">
                    {property.bedrooms}
                  </td>
                ))}
              </tr>

              {/* Bathrooms */}
              <tr className="bg-muted/30">
                <td className="border border-border p-4 bg-muted font-medium">
                  <Bath className="h-4 w-4 inline mr-2" />
                  Baños
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center text-lg font-semibold">
                    {property.bathrooms}
                  </td>
                ))}
              </tr>

              {/* Area */}
              <tr>
                <td className="border border-border p-4 bg-muted font-medium">
                  <Maximize2 className="h-4 w-4 inline mr-2" />
                  Superficie
                </td>
                {comparisonList.map((property) => (
                  <td key={property.id} className="border border-border p-4 text-center text-lg font-semibold">
                    {property.area} m²
                  </td>
                ))}
              </tr>

              {/* Price per m² */}
              <tr className="bg-muted/30">
                <td className="border border-border p-4 bg-muted font-medium">Precio por m²</td>
                {comparisonList.map((property) => {
                  const pricePerSqm = Math.round(property.price / property.area)
                  return (
                    <td key={property.id} className="border border-border p-4 text-center">
                      <div className="font-semibold">{formatCurrency(pricePerSqm)}/m²</div>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Warning */}
        <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg md:hidden">
          <p className="text-sm text-warning-foreground">
            💡 Para una mejor experiencia de comparación, te recomendamos usar una pantalla más grande.
          </p>
        </div>
      </main>
    </>
  )
}
