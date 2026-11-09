"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Property } from '@/types/property'
import { Eye, X, MapPin, Maximize2, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatCurrency } from '@/lib/utils'

interface PropertyPreviewProps {
  property: Partial<Property> & {
    title: string
    description: string
    price: number
    currency: 'USD' | 'ARS'
    location: {
      address: string
      city: string
      lat: number
      lng: number
    }
    bedrooms: number
    bathrooms: number
    area: number
    propertyType: string
    listingType: 'sale' | 'rent'
    status: 'available' | 'reserved' | 'sold' | 'rented'
  }
  images?: string[]
  trigger?: React.ReactNode
  /** Present in edit mode — enables the "Ver página" link to the live property page. */
  propertyId?: string
}

export function PropertyPreview({ property, images = [], trigger, propertyId }: PropertyPreviewProps) {
  const [open, setOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Evitar el scroll del body cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const defaultTrigger = (
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
      <Eye className="h-4 w-4 mr-2" />
      Vista previa
    </Button>
  )

  if (!open) {
    return trigger ? (
      <div onClick={() => setOpen(true)}>{trigger}</div>
    ) : (
      defaultTrigger
    )
  }

  return (
    <>
      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative z-50 bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Vista previa de propiedad</h2>
                  <p className="text-sm text-muted-foreground">
                    Asi se vera tu propiedad para los visitantes
                  </p>
                </div>
                {propertyId && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/propiedades/${propertyId}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver página
                    </a>
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-6">

        <div className="space-y-6">
          {/* Images Section */}
          {images.length > 0 && (
            <div className="space-y-3">
              {/* Main Image */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image
                  src={images[selectedImageIndex]}
                  alt={`${property.title} - Image ${selectedImageIndex + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
                <button
                  className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background"
                  onClick={() => window.open(images[selectedImageIndex], '_blank')}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>

              {/* Image Thumbnails */}
              {images.length > 1 && (
                <div className="grid grid-cols-6 gap-2">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative aspect-video rounded overflow-hidden border-2 ${
                        index === selectedImageIndex
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/20'
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="100px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Property Info */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-3xl font-bold text-foreground">{property.title}</h2>
              <StatusBadge status={property.status as 'available' | 'reserved' | 'sold' | 'rented'} />
            </div>

            <div className="flex items-center text-muted-foreground mb-4">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{property.location.address}, {property.location.city}</span>
            </div>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold text-foreground">
                {formatCurrency(property.price, property.currency)}
              </span>
              <span className="text-muted-foreground capitalize">
                {property.listingType === 'sale' ? 'en venta' : 'en alquiler'}
              </span>
            </div>
          </div>

          {/* Property Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-semibold capitalize">{property.propertyType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Habitaciones</p>
              <p className="font-semibold">{property.bedrooms}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Baños</p>
              <p className="font-semibold">{property.bathrooms}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Superficie</p>
              <p className="font-semibold">{property.area} m²</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xl font-semibold mb-3">Descripcion</h3>
            <div
              className="prose prose-sm max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: property.description }}
            />
          </div>
        </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
