import { MetadataRoute } from 'next'
import { Property } from '@/types/property'

// Generación del sitemap para SEO
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

  // Buscar todas las propiedades para las URLs dinámicas
  let properties: Pick<Property, 'id' | 'updatedAt' | 'featured'>[] = []
  try {
    const response = await fetch(`${apiUrl}/properties/all?limit=1000`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    })
    if (response.ok) {
      const data = await response.json()
      properties = data.properties || []
    }
  } catch (error) {
    console.error('Error fetching properties for sitemap:', error)
  }

  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/venta`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/alquiler`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/buscar-en-mapa`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/comparar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
  ]

  // Páginas de propiedades
  const propertyPages: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${baseUrl}/propiedades/${property.id}`,
    lastModified: property.updatedAt ? new Date(property.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: property.featured ? 0.9 : 0.7,
  }))

  return [...staticPages, ...propertyPages]
}
