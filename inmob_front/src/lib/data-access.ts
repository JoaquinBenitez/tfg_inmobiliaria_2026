import { auth } from "@/lib/auth"
import { fetchApi } from "@/lib/api"
import { endpoints } from "@/config/endpoints"
import { Property, ImageAsset } from "@/types/property"

/**
 * Data Access Layer - Centralized data access with authentication checks
 * Following 2025 Next.js security best practices
 */

interface CreatePropertyData {
  title: string
  description: string
  price: number
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
  currency: 'USD' | 'ARS'
  status?: 'available' | 'reserved'
  featured?: boolean
  featuredImageId?: string
}

/**
 * Verifica si el usuario tiene permiso para una acción específica
 */
export async function canAccess(resource: string, action: string): Promise<boolean> {
  const session = await auth()
  
  if (!session?.user) {
    return false
  }

  const { role } = session.user

  // Definir la matriz de permisos
  const permissions: Record<string, Record<string, string[]>> = {
    properties: {
      read: ['admin', 'editor'],
      create: ['admin', 'editor'],
      update: ['admin', 'editor'],
      delete: ['admin'],
    },
    users: {
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    },
    dashboard: {
      read: ['admin', 'editor'],
    },
    syndication: {
      read: ['admin'],
    },
    settings: {
      read: ['admin'],
      update: ['admin'],
    }
  }

  return permissions[resource]?.[action]?.includes(role) || false
}

/**
 * Obtener todas las propiedades con verificación de autenticación
 */
export async function getProperties(): Promise<Property[]> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'read'))) {
    throw new Error('Insufficient permissions')
  }

  return fetchApi<Property[]>(endpoints.properties.all, {
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
    },
  })
}

/**
 * Obtener una sola propiedad con verificación de autenticación
 */
export async function getProperty(id: string): Promise<Property> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'read'))) {
    throw new Error('Insufficient permissions')
  }

  return fetchApi<Property>(endpoints.properties.detail(id), {
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
    },
  })
}

/**
 * Crear propiedad con verificación de autenticación
 */
export async function createProperty(
  propertyData: CreatePropertyData,
  images?: File[]
): Promise<Property> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'create'))) {
    throw new Error('Insufficient permissions')
  }

  if (images && images.length > 0) {
    // Usar la función uploadFiles existente de api.ts
    const { uploadFiles } = await import('./api')
    return uploadFiles<Property>(endpoints.properties.create, images, propertyData, {
      'Authorization': `Bearer ${session.accessToken}`,
    })
  } else {
    // Crear sin imágenes
    return fetchApi<Property>(endpoints.properties.create, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(propertyData),
    })
  }
}

/**
 * Actualizar propiedad con verificación de autenticación
 */
export async function updateProperty(
  id: string,
  propertyData: Partial<CreatePropertyData>
): Promise<Property> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'update'))) {
    throw new Error('Insufficient permissions')
  }

  return fetchApi<Property>(endpoints.properties.update(id), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(propertyData),
  })
}

/**
 * Borrar propiedad con verificación de autenticación
 */
export async function deleteProperty(id: string): Promise<{ message: string }> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'delete'))) {
    throw new Error('Insufficient permissions')
  }

  return fetchApi<{ message: string }>(endpoints.properties.delete(id), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
    },
  })
}

/**
 * Subir imágenes a una propiedad existente con verificación de autenticación
 */
export async function uploadPropertyImages(
  propertyId: string,
  images: File[]
): Promise<{ message: string; images: ImageAsset[]; property: Property }> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'update'))) {
    throw new Error('Insufficient permissions')
  }

  const { uploadFiles } = await import('./api')
  return uploadFiles<{ message: string; images: ImageAsset[]; property: Property }>(
    endpoints.properties.uploadImages(propertyId),
    images,
    undefined,
    { 'Authorization': `Bearer ${session.accessToken}` }
  )
}

/**
 * Actualizar propiedad con imágenes - maneja tanto la actualización de datos como la gestión de imágenes
 * Multi-step approach:
 * 1. Update property data with corrected images array (existing images to keep)
 * 2. Upload new images if provided
 */
export async function updatePropertyWithImages(
  propertyId: string,
  propertyData: Partial<CreatePropertyData>,
  existingImages: ImageAsset[],
  newImages?: File[]
): Promise<Property> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Authentication required')
  }

  if (!(await canAccess('properties', 'update'))) {
    throw new Error('Insufficient permissions')
  }

  // Paso 1: actualizar los datos de la propiedad con el array de imágenes corregido
  const updatedData = {
    ...propertyData,
    images: existingImages, // Only the existing images we're keeping
  }

  let property = await updateProperty(propertyId, updatedData)

  // Paso 2: subir imágenes nuevas si se proveyeron
  if (newImages && newImages.length > 0) {
    const result = await uploadPropertyImages(propertyId, newImages)
    property = result.property
  }

  return property
}

/**
 * Obtener la sesión del usuario actual con tipado seguro
 */
export async function getCurrentUser() {
  const session = await auth()
  return session?.user || null
}

/**
 * Verificar si el usuario actual es admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth()
  return session?.user?.role === 'admin'
}

/**
 * Verificar si el usuario actual puede gestionar propiedades
 */
export async function canManageProperties(): Promise<boolean> {
  return canAccess('properties', 'create')
}