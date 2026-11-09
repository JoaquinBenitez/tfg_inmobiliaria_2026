"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImageManager } from "@/components/admin/ImageManager"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { PropertyPreview } from "@/components/admin/PropertyPreview"
import { createPropertyAction, updatePropertyWithImagesAction, deletePropertyImageAction } from "@/lib/actions"
import { signOut } from "next-auth/react"
import { Property, ImageAsset } from "@/types/property"
import { useUnsavedChanges, useFormDirty } from "@/hooks/useUnsavedChanges"
import { Loader2, AlertCircle, Save, Edit } from "lucide-react"
import dynamic from "next/dynamic"

const CoordinatePicker = dynamic(
  () => import("@/components/admin/CoordinatePicker"),
  { ssr: false, loading: () => <div className="h-[300px] rounded-lg border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">Cargando mapa...</div> }
)

interface PropertyFormData {
  title: string
  description: string
  price: string
  currency: 'USD' | 'ARS'
  coordinates: string // "longitude,latitude"
  address: string
  city: string
  bedrooms: string
  bathrooms: string
  area: string
  propertyType: 'departamento' | 'casa' | 'terreno' | 'oficina' | 'local'
  listingType: 'sale' | 'rent'
  status: 'available' | 'reserved' | 'sold' | 'rented'
  featured: boolean
}

const initialFormData: PropertyFormData = {
  title: '',
  description: '',
  price: '',
  currency: 'USD',
  coordinates: '',
  address: '',
  city: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  propertyType: 'casa',
  listingType: 'sale',
  status: 'available',
  featured: false
}

function toFormData(p: Property): PropertyFormData {
  return {
    title: p.title,
    description: p.description,
    price: p.price.toString(),
    currency: p.currency ?? 'USD',
    coordinates: `${p.location.lng},${p.location.lat}`,
    address: p.location.address,
    city: p.location.city,
    bedrooms: p.bedrooms.toString(),
    bathrooms: p.bathrooms.toString(),
    area: p.area.toString(),
    propertyType: p.propertyType,
    listingType: p.listingType,
    status: p.status,
    featured: p.featured || false
  }
}

const propertyTypes = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'local', label: 'Local Comercial' }
]

const cities = [
  'Avellaneda', 'Reconquista', 'Santa Fe', 'Rosario', 'Rafaela',
  'Venado Tuerto', 'San Lorenzo', 'Esperanza', 'Santo Tomé', 'Casilda'
]

// Centros aproximados de ciudades ("lng,lat" — el formato de valor de CoordinatePicker) usados para
// recenter the map when the city changes. Only applied while the coordinates are
// still "auto" (empty or equal to a city center) so a manually placed pin is never wiped.
const CITY_COORDINATES: Record<string, string> = {
  'Avellaneda': '-59.658000,-29.117000',
  'Reconquista': '-59.660000,-29.150000',
  'Santa Fe': '-60.700000,-31.633300',
  'Rosario': '-60.639300,-32.946800',
  'Rafaela': '-61.483300,-31.250000',
  'Venado Tuerto': '-61.968900,-33.745800',
  'San Lorenzo': '-60.733300,-32.750000',
  'Esperanza': '-60.933300,-31.433300',
  'Santo Tomé': '-60.750000,-31.666700',
  'Casilda': '-61.166700,-33.033300',
}
const CITY_CENTER_VALUES = Object.values(CITY_COORDINATES)

interface PropertyFormProps {
  mode?: 'create' | 'edit'
  initialData?: Property
  propertyId?: string
  onSuccess?: () => void
}

export function PropertyForm({ mode = 'create', initialData, propertyId, onSuccess }: PropertyFormProps) {
  const [formData, setFormData] = useState<PropertyFormData>(() =>
    mode === 'edit' && initialData ? toFormData(initialData) : initialFormData
  )
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<ImageAsset[]>(initialData?.images || [])
  const [featuredImageId, setFeaturedImageId] = useState<string>(initialData?.featuredImageId || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [error, setError] = useState("")
  const [featuredError, setFeaturedError] = useState("")
  const [success, setSuccess] = useState("")
  const [featuredNewImageIndex, setFeaturedNewImageIndex] = useState<number | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const router = useRouter()

  // Trackear los cambios del formulario
  const isFormDirty = useFormDirty(formData, mode === 'edit' ? {
    title: initialData?.title || '',
    description: initialData?.description || '',
    price: initialData?.price.toString() || '',
    currency: initialData?.currency || 'USD',
    coordinates: initialData ? `${initialData.location.lng},${initialData.location.lat}` : '',
    address: initialData?.location.address || '',
    city: initialData?.location.city || '',
    bedrooms: initialData?.bedrooms.toString() || '',
    bathrooms: initialData?.bathrooms.toString() || '',
    area: initialData?.area.toString() || '',
    propertyType: initialData?.propertyType || 'casa',
    listingType: initialData?.listingType || 'sale',
    status: initialData?.status || 'available',
    featured: initialData?.featured || false
  } : initialFormData)

  const hasImageChanges = Boolean(selectedImages.length > 0 ||
    (mode === 'edit' && initialData && existingImages.length !== initialData.images.length))

  // Advertir sobre cambios sin guardar (pero no tras un envío exitoso)
  useUnsavedChanges(
    (isFormDirty || hasImageChanges) && !hasSubmitted && !isLoading,
    'You have unsaved changes. Are you sure you want to leave?'
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
      return
    }

    // Recentrar el mapa en la ciudad seleccionada mientras las coordenadas sigan "auto"
    // (empty or a city center) — a manually placed pin is preserved.
    if (name === 'city' && value && CITY_COORDINATES[value]) {
      const currentCoords = formData.coordinates.trim()
      if (currentCoords === '' || CITY_CENTER_VALUES.includes(currentCoords)) {
        setFormData(prev => ({ ...prev, city: value, coordinates: CITY_COORDINATES[value] }))
        return
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleExistingImagesChange = async (newImages: ImageAsset[]) => {
    if (mode !== 'edit' || !propertyId) {
      setExistingImages(newImages)
      return
    }

    // Encontrar las imágenes quitadas (por publicId — el identificador estable)
    const keptIds = new Set(newImages.map(image => image.publicId))
    const removedIds = existingImages
      .map(image => image.publicId)
      .filter(id => !keptIds.has(id))

    if (removedIds.length === 0) {
      // Solo un reordenamiento, no hace falta borrar
      setExistingImages(newImages)
      return
    }

    setIsDeletingImage(true)
    setError("")

    try {
      for (const imageId of removedIds) {
        const result = await deletePropertyImageAction(propertyId, imageId)
        if (!result.success) {
          setError(result.error || 'Failed to delete image')
          setIsDeletingImage(false)
          return
        }
      }
      setExistingImages(newImages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image')
    } finally {
      setIsDeletingImage(false)
    }
  }

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError("El titulo es obligatorio")
      return false
    }
    if (!formData.description.trim()) {
      setError("La descripcion es obligatoria")
      return false
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError("Se requiere un precio valido")
      return false
    }
    if (!formData.address.trim()) {
      setError("La direccion es obligatoria")
      return false
    }
    if (!formData.city.trim()) {
      setError("La ciudad es obligatoria")
      return false
    }
    if (!formData.bedrooms || parseInt(formData.bedrooms) < 0) {
      setError("Se requiere un numero valido de habitaciones")
      return false
    }
    if (!formData.bathrooms || parseInt(formData.bathrooms) < 0) {
      setError("Se requiere un numero valido de baños")
      return false
    }
    if (!formData.area || parseFloat(formData.area) <= 0) {
      setError("Se requiere un area valida")
      return false
    }
    
    // Validar coordenadas si se proveyeron
    if (formData.coordinates.trim()) {
      const coords = formData.coordinates.split(',')
      if (coords.length !== 2 || isNaN(parseFloat(coords[0])) || isNaN(parseFloat(coords[1]))) {
        setError("Las coordenadas deben tener el formato: longitud,latitud (ej: -60.7, -31.6)")
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!validateForm()) {
      return
    }

    // Validar que la propiedad destacada tenga imágenes y una imagen destacada seleccionada
    if (formData.featured) {
      const hasAnyImages = (mode === 'edit' ? existingImages.length : 0) + selectedImages.length > 0
      if (!hasAnyImages) {
        setFeaturedError("Las propiedades destacadas deben tener al menos una imagen")
        return
      }
      const hasFeaturedSelected = !!featuredImageId?.trim() || featuredNewImageIndex !== null
      if (!hasFeaturedSelected) {
        setFeaturedError("Las propiedades destacadas deben tener una imagen seleccionada como destacada")
        return
      }
    }
    setFeaturedError("")

    setIsLoading(true)

    try {
      // Parsear coordenadas o usar el default
      let longitude = -60.7, latitude = -31.6 // Default coordinates for Santa Fe province
      if (formData.coordinates.trim()) {
        const coords = formData.coordinates.split(',').map(c => parseFloat(c.trim()))
        longitude = coords[0]
        latitude = coords[1]
      }

      const effectiveFeaturedImageId = featuredImageId
      const effectiveFeaturedNewImageIndex = featuredNewImageIndex

      const propertyData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        currency: formData.currency,
        location: {
          address: formData.address.trim(),
          city: formData.city.trim(),
          latitude,
          longitude
        },
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        area: parseFloat(formData.area),
        propertyType: formData.propertyType,
        listingType: formData.listingType,
        status: formData.status,
        featured: formData.featured,
        ...(effectiveFeaturedImageId ? { featuredImageId: effectiveFeaturedImageId } : {}),
      }

      if (mode === 'create') {
        // Crear la propiedad nueva usando FormData para la server action
        const formDataToSend = new FormData()

        // Agregar los campos de datos de la propiedad
        formDataToSend.append('title', propertyData.title)
        formDataToSend.append('description', propertyData.description)
        formDataToSend.append('price', propertyData.price.toString())
        formDataToSend.append('currency', propertyData.currency)
        formDataToSend.append('location', JSON.stringify(propertyData.location))
        formDataToSend.append('bedrooms', propertyData.bedrooms.toString())
        formDataToSend.append('bathrooms', propertyData.bathrooms.toString())
        formDataToSend.append('area', propertyData.area.toString())
        formDataToSend.append('propertyType', propertyData.propertyType)
        formDataToSend.append('listingType', propertyData.listingType)
        formDataToSend.append('status', propertyData.status)
        formDataToSend.append('featured', propertyData.featured.toString())

        // Agregar el índice de imagen destacada para imágenes nuevas
        if (effectiveFeaturedNewImageIndex !== null) {
          formDataToSend.append('featuredImageIndex', effectiveFeaturedNewImageIndex.toString())
        }

        // Agregar imágenes
        selectedImages.forEach((file) => {
          formDataToSend.append('images', file)
        })

        const result = await createPropertyAction(formDataToSend)

        if (!result.success) {
          if ('requiresLogin' in result && result.requiresLogin) {
            signOut({ callbackUrl: '/admin/login' })
            return
          }
          throw new Error(result.error || 'Failed to create property')
        }

        setSuccess("¡Propiedad creada exitosamente!")

        // Resetear el formulario
        setFormData(initialFormData)
        setSelectedImages([])
      } else {
        // Actualizar la propiedad existente
        if (!propertyId) {
          throw new Error("Property ID is required for update")
        }

        // Construir el FormData para imágenes nuevas si las hay
        let imageFormData: FormData | undefined
        if (selectedImages.length > 0) {
          imageFormData = new FormData()
          selectedImages.forEach((file) => {
            imageFormData!.append('images', file)
          })
        }

        const result = await updatePropertyWithImagesAction(
          propertyId,
          propertyData,
          existingImages, // Keep only these existing images
          imageFormData, // Add new images if any
          effectiveFeaturedNewImageIndex // Index of new image to set as featured
        )

        if (!result.success) {
          if ('requiresLogin' in result && result.requiresLogin) {
            signOut({ callbackUrl: '/admin/login' })
            return
          }
          throw new Error(result.error || 'Failed to update property')
        }

        setSuccess("¡Propiedad actualizada exitosamente!")
      }

      // Marcar como enviado para evitar la advertencia de cambios sin guardar
      setHasSubmitted(true)

      // Llamar al callback de éxito o redirigir
      if (onSuccess) {
        onSuccess()
      } else {
        setTimeout(() => {
          router.push('/admin/properties')
        }, 1500)
      }

    } catch (err) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} property:`, err)
      setError(err instanceof Error ? err.message : `Error al ${mode === 'create' ? 'crear' : 'actualizar'} la propiedad`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-6">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card shadow-lg border">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {mode === 'create' ? 'Creando propiedad...' : 'Guardando propiedad...'}
            </p>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informacion basica</CardTitle>
          <CardDescription>Detalles esenciales de la propiedad</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Titulo de la Propiedad</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Ej: Hermosa casa de 3 habitaciones"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="description">Descripcion</Label>
            <RichTextEditor
              content={formData.description}
              onChange={(html) => setFormData(prev => ({ ...prev, description: html }))}
              placeholder="Descripcion detallada de la propiedad..."
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="price">Precio</Label>
              <Input
                id="price"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="150000"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full h-9 px-3 py-1 border border-input rounded-md"
                disabled={isLoading}
              >
                <option value="USD">USD (Dólar)</option>
                <option value="ARS">ARS (Peso argentino)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="listingType">Tipo de Listado</Label>
              <select
                id="listingType"
                name="listingType"
                value={formData.listingType}
                onChange={handleInputChange}
                className="w-full h-9 px-3 py-1 border border-input rounded-md"
                disabled={isLoading}
              >
                <option value="sale">En venta</option>
                <option value="rent">En alquiler</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full h-9 px-3 py-1 border border-input rounded-md"
                disabled={isLoading}
              >
                <option value="available">Disponible</option>
                <option value="reserved">Reservada</option>
                <option value="sold">Vendida</option>
                <option value="rented">Alquilada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Ubicacion</CardTitle>
          <CardDescription>Detalles de ubicacion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Direccion</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="123 Main Street"
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Ciudad</Label>
              <select
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full h-9 px-3 py-1 border border-input rounded-md"
                required
                disabled={isLoading}
              >
                <option value="">Selecciona una ciudad</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <Label>Coordenadas (opcional)</Label>
            <CoordinatePicker
              value={formData.coordinates}
              onChange={(value) => setFormData(prev => ({ ...prev, coordinates: value }))}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Propiedad</CardTitle>
          <CardDescription>Caracteristicas fisicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="propertyType">Tipo de Propiedad</Label>
            <select
              id="propertyType"
              name="propertyType"
              value={formData.propertyType}
              onChange={handleInputChange}
              className="w-full h-9 px-3 py-1 border border-input rounded-md"
              disabled={isLoading}
            >
              {propertyTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bedrooms">Habitaciones</Label>
              <Input
                id="bedrooms"
                name="bedrooms"
                type="number"
                min="0"
                value={formData.bedrooms}
                onChange={handleInputChange}
                placeholder="3"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="bathrooms">Baños</Label>
              <Input
                id="bathrooms"
                name="bathrooms"
                type="number"
                min="0"
                value={formData.bathrooms}
                onChange={handleInputChange}
                placeholder="2"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="area">Superficie (m²)</Label>
              <Input
                id="area"
                name="area"
                type="number"
                min="0"
                step="0.01"
                value={formData.area}
                onChange={handleInputChange}
                placeholder="150"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="featured"
              name="featured"
              checked={formData.featured}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-gray-300"
              disabled={isLoading}
            />
            <Label htmlFor="featured">Propiedad destacada</Label>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Imagenes de la Propiedad</CardTitle>
          <CardDescription>
            {mode === 'edit'
              ? "Gestiona las fotos - arrastra para reordenar, selecciona varias para eliminar o agrega nuevas"
              : "Subi fotos de la propiedad (hasta 30 imagenes)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageManager
            existingImages={mode === 'edit' ? existingImages : []}
            onImagesChange={handleExistingImagesChange}
            newImages={selectedImages}
            onNewImagesChange={setSelectedImages}
            featuredImageId={featuredImageId}
            onFeaturedImageChange={setFeaturedImageId}
            featuredNewImageIndex={featuredNewImageIndex}
            onFeaturedNewImageIndexChange={setFeaturedNewImageIndex}
            maxFiles={30}
            maxFileSize={10}
            disabled={isLoading || isDeletingImage}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-success">{success}</AlertDescription>
        </Alert>
      )}

      {/* Featured validation error (near submit button for visibility) */}
      {featuredError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{featuredError}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <div className="flex justify-between items-center">
        <div>
          {formData.title && formData.description && formData.price && (
            <PropertyPreview
              propertyId={propertyId}
              property={{
                title: formData.title,
                description: formData.description,
                price: parseFloat(formData.price) || 0,
                currency: formData.currency,
                location: {
                  address: formData.address,
                  city: formData.city,
                  lng: formData.coordinates.trim()
                    ? parseFloat(formData.coordinates.split(',')[0])
                    : -60.7,
                  lat: formData.coordinates.trim()
                    ? parseFloat(formData.coordinates.split(',')[1])
                    : -31.6
                },
                bedrooms: parseInt(formData.bedrooms) || 0,
                bathrooms: parseInt(formData.bathrooms) || 0,
                area: parseFloat(formData.area) || 0,
                propertyType: formData.propertyType,
                listingType: formData.listingType,
                status: formData.status
              }}
              images={mode === 'edit' ? existingImages.map(image => image.url) : []}
            />
          )}
        </div>

        <div className="flex space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creando...' : 'Actualizando...'}
              </>
            ) : (
              <>
                {mode === 'create' ? <Save className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                {mode === 'create' ? 'Crear Propiedad' : 'Actualizar Propiedad'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}