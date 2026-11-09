"use server"

import { auth } from "@/lib/auth"
import { ApiError, fetchApi } from "@/lib/api"
import { endpoints } from "@/config/endpoints"
import { Property, ImageAsset, Tour, TourUpdatePayload } from "@/types/property"
import { HeroSettings } from "@/types/settings"
// Usar API_URL del env, con fallback del lado del servidor
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

/**
 * Server Actions para gestión de propiedades
 * Se pueden llamar desde componentes de cliente y tienen acceso al contexto del servidor
 */

/**
 * Verifica si un error es un 401 de autenticación y devuelve un resultado accionable
 */
function handle401(error: unknown): { success: false; error: string; requiresLogin?: boolean } | null {
  if (error instanceof ApiError && error.status === 401) {
    return { success: false, error: 'Your session has expired. Please log in again.', requiresLogin: true }
  }
  return null
}

interface PropertyData {
  title: string
  description: string
  price: number
  currency: 'USD' | 'ARS'
  location: {
    address: string
    city: string
    latitude: number
    longitude: number
  }
  bedrooms: number
  bathrooms: number
  area: number
  propertyType: 'departamento' | 'casa' | 'terreno' | 'oficina' | 'local'
  listingType: 'sale' | 'rent'
  status?: 'available' | 'reserved' | 'sold' | 'rented'
  featured?: boolean
  featuredImageId?: string
  images?: ImageAsset[]
}

/**
 * Valida y extrae el access token de la sesión
 */
function getAccessToken(session: { accessToken?: unknown } | null): string {
  const token = session?.accessToken
  if (!token || typeof token !== 'string') {
    throw new Error('Session access token is missing. Please log in again.')
  }
  return token
}

/**
 * Verifica si el usuario tiene permiso para una acción específica
 */
async function canAccess(resource: string, action: string): Promise<boolean> {
  const session = await auth()

  if (!session?.user) {
    return false
  }

  const { role } = session.user

  const permissions: Record<string, Record<string, string[]>> = {
    properties: {
      read: ['admin', 'editor'],
      create: ['admin', 'editor'],
      update: ['admin', 'editor'],
      delete: ['admin'],
    },
    settings: {
      read: ['admin'],
      update: ['admin'],
    },
  }

  return permissions[resource]?.[action]?.includes(role) || false
}

/**
 * Server action para crear una propiedad con imágenes
 */
export async function createPropertyAction(
  formData: FormData
): Promise<{ success: boolean; property?: Property; error?: string; requiresLogin?: boolean }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'create'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    // Reenviar el FormData a la API del backend
    const url = `${API_URL}${endpoints.properties.create}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.', requiresLogin: true }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: (typeof errorData.error === 'string' ? errorData.error : errorData.message) || `API Error: ${response.statusText}`
      }
    }

    const property = await response.json()
    return { success: true, property }
  } catch (error) {
    console.error('Error creating property:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create property'
    }
  }
}

/**
 * Server action para actualizar una propiedad (solo datos, sin imágenes nuevas)
 */
export async function updatePropertyAction(
  propertyId: string,
  propertyData: Partial<PropertyData>
): Promise<{ success: boolean; property?: Property; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const property = await fetchApi<Property>(endpoints.properties.update(propertyId), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(propertyData),
    })

    return { success: true, property }
  } catch (error) {
    console.error('Error updating property:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update property'
    }
  }
}

/**
 * Server action para subir imágenes a una propiedad existente
 */
export async function uploadPropertyImagesAction(
  propertyId: string,
  formData: FormData
): Promise<{ success: boolean; property?: Property; images?: ImageAsset[]; error?: string; requiresLogin?: boolean }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const url = `${API_URL}${endpoints.properties.uploadImages(propertyId)}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.', requiresLogin: true }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: (typeof errorData.error === 'string' ? errorData.error : errorData.message) || `API Error: ${response.statusText}`
      }
    }

    const result = await response.json()
    return { success: true, property: result.property, images: result.images }
  } catch (error) {
    console.error('Error uploading images:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload images'
    }
  }
}

/**
 * Server action para borrar una sola imagen de una propiedad
 */
export async function deletePropertyImageAction(
  propertyId: string,
  imageId: string
): Promise<{ success: boolean; images?: ImageAsset[]; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const url = `${API_URL}${endpoints.properties.deleteImage(propertyId)}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageId }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.' }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `API Error: ${response.statusText}`
      }
    }

    const result = await response.json()
    return { success: true, images: result.images }
  } catch (error) {
    console.error('Error deleting property image:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete image'
    }
  }
}

/**
 * Server action para actualizar propiedad con imágenes
 * Multi-paso: actualizar datos, luego subir imágenes nuevas si las hay
 */
export async function updatePropertyWithImagesAction(
  propertyId: string,
  propertyData: Partial<PropertyData>,
  existingImages: ImageAsset[],
  imageFormData?: FormData,
  featuredNewImageIndex?: number | null
): Promise<{ success: boolean; property?: Property; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    getAccessToken(session)

    // Paso 1: actualizar los datos de la propiedad con el array de imágenes corregido
    const updatedData = {
      ...propertyData,
      images: existingImages,
    }

    const updateResult = await updatePropertyAction(propertyId, updatedData)

    if (!updateResult.success) {
      return updateResult
    }

    let property = updateResult.property

    // Paso 2: subir imágenes nuevas si se proveyeron
    let uploadedImages: ImageAsset[] | undefined
    if (imageFormData) {
      const hasFiles = imageFormData.has('images')
      if (hasFiles) {
        const uploadResult = await uploadPropertyImagesAction(propertyId, imageFormData)
        if (!uploadResult.success) {
          return uploadResult
        }
        property = uploadResult.property
        uploadedImages = uploadResult.images
      }
    }

    // Paso 3: si se seleccionó una imagen nueva como destacada, persistir su publicId
    if (featuredNewImageIndex != null && uploadedImages && uploadedImages[featuredNewImageIndex]) {
      const featuredResult = await updatePropertyAction(propertyId, {
        featuredImageId: uploadedImages[featuredNewImageIndex].publicId
      })
      if (featuredResult.success) {
        property = featuredResult.property
      }
    }

    return { success: true, property }
  } catch (error) {
    console.error('Error updating property with images:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update property'
    }
  }
}

/**
 * Server action para actualizar los settings del hero con imágenes
 */
export async function updateHeroSettingsAction(
  formData: FormData
): Promise<{ success: boolean; data?: HeroSettings; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('settings', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const url = `${API_URL}${endpoints.settings.hero}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.' }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `API Error: ${response.statusText}`
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error updating hero settings:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update hero settings'
    }
  }
}

/**
 * Server action para borrar una sola imagen del hero
 */
export async function deleteHeroImageAction(
  imageUrl: string
): Promise<{ success: boolean; data?: HeroSettings; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('settings', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const url = `${API_URL}${endpoints.settings.deleteHeroImage}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.' }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `API Error: ${response.statusText}`
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Error deleting hero image:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete hero image'
    }
  }
}

// ---------------------------------------------------------------------------
// Server actions del tour 360° (Requisito 1 — Fase 2)
// ---------------------------------------------------------------------------

/**
 * Server action para subir una escena de panorama (multipart, campo "panorama")
 */
export async function uploadTourSceneAction(
  propertyId: string,
  formData: FormData
): Promise<{ success: boolean; tour?: Tour; error?: string; requiresLogin?: boolean }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const url = `${API_URL}${endpoints.properties.tourScene(propertyId)}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Your session has expired. Please log in again.', requiresLogin: true }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: (typeof errorData.error === 'string' ? errorData.error : errorData.message) || `API Error: ${response.statusText}`
      }
    }

    const result = await response.json()
    return { success: true, tour: result.tour }
  } catch (error) {
    console.error('Error uploading tour scene:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload tour scene'
    }
  }
}

/**
 * Server action para guardar los metadatos del tour (orden/nombres/vistas/coverage de escenas, hotspots, enabled)
 */
export async function updateTourAction(
  propertyId: string,
  payload: TourUpdatePayload
): Promise<{ success: boolean; tour?: Tour; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const result = await fetchApi<{ message: string; tour: Tour }>(endpoints.properties.tour(propertyId), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    return { success: true, tour: result.tour }
  } catch (error) {
    console.error('Error updating tour:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tour'
    }
  }
}

/**
 * Server action para borrar una escena del tour (y sus variantes del storage)
 */
export async function deleteTourSceneAction(
  propertyId: string,
  sceneId: string
): Promise<{ success: boolean; tour?: Tour; error?: string }> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: 'Authentication required' }
    }

    if (!(await canAccess('properties', 'update'))) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const accessToken = getAccessToken(session)

    const result = await fetchApi<{ message: string; tour: Tour }>(endpoints.properties.tourSceneDelete(propertyId, sceneId), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    return { success: true, tour: result.tour }
  } catch (error) {
    console.error('Error deleting tour scene:', error)
    const authError = handle401(error)
    if (authError) return authError
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete tour scene'
    }
  }
}
