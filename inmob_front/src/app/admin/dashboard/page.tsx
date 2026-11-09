"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CanAccess } from "@/components/admin/ProtectedRoute"
import { StatusBadge } from "@/components/ui/status-badge"
import { fetchApi } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { endpoints } from "@/config/endpoints"
import { Property } from "@/types/property"
import { HeroSettings } from "@/types/settings"
import { updateHeroSettingsAction, deleteHeroImageAction } from "@/lib/actions"
import { ImageUpload } from "@/components/ui/image-upload"
import {
  Building2,
  TrendingUp,
  Eye,
  Plus,
  MapPin,
  DollarSign,
  Save,
  Loader2,
  Settings,
  Edit
} from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  totalProperties: number
  availableProperties: number
  reservedProperties: number
  featuredProperties: number
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

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    availableProperties: 0,
    reservedProperties: 0,
    featuredProperties: 0
  })
  const [recentProperties, setRecentProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Estado de los settings del hero
  const [heroTitle, setHeroTitle] = useState("")
  const [heroSubtitle, setHeroSubtitle] = useState("")
  const [heroExistingImages, setHeroExistingImages] = useState<string[]>([])
  const [heroNewFiles, setHeroNewFiles] = useState<File[]>([])
  const [heroSaving, setHeroSaving] = useState(false)
  const [heroMessage, setHeroMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Sesión resolviéndose aún (status "loading") → mantener el spinner.
      // Resuelta a null (p. ej. JWT expirado) → mandar a login en vez de colgar.
      if (status === "unauthenticated") {
        router.replace("/admin/login")
        return
      }
      if (!session?.accessToken) return

      try {
        const response = await fetchApi<PropertiesResponse>(`${endpoints.properties.all}?status=all`, {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
          },
        })
        const properties = response.properties

        // Calcular estadísticas
        const newStats: DashboardStats = {
          totalProperties: properties.length,
          availableProperties: properties.filter(p => p.status === 'available').length,
          reservedProperties: properties.filter(p => p.status === 'reserved').length,
          featuredProperties: properties.filter(p => p.featured === true).length,
        }
        setStats(newStats)

        // Obtener propiedades recientes (últimas 5)
        const recent = properties
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
        setRecentProperties(recent)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [session, status, router])

  // Buscar los settings del hero
  useEffect(() => {
    const fetchHeroSettings = async () => {
      try {
        const data = await fetchApi<HeroSettings>(endpoints.settings.hero)
        setHeroTitle(data.heroTitle || "")
        setHeroSubtitle(data.heroSubtitle || "")
        setHeroExistingImages(data.heroImages || [])
      } catch {
        // Settings aún no configurados
      }
    }

    fetchHeroSettings()
  }, [])

  const handleRemoveExistingImage = useCallback(async (index: number) => {
    const imageUrl = heroExistingImages[index]
    if (!imageUrl) return

    const result = await deleteHeroImageAction(imageUrl)
    if (result.success && result.data) {
      setHeroExistingImages(result.data.heroImages)
      setHeroMessage({ type: 'success', text: 'Imagen eliminada' })
    } else {
      setHeroMessage({ type: 'error', text: result.error || 'Error al eliminar imagen' })
    }
    setTimeout(() => setHeroMessage(null), 3000)
  }, [heroExistingImages])

  const handleSaveHeroSettings = async () => {
    setHeroSaving(true)
    setHeroMessage(null)

    try {
      const totalImages = heroExistingImages.length + heroNewFiles.length
      if (totalImages > 3) {
        setHeroMessage({ type: 'error', text: 'Maximo 3 imagenes permitidas' })
        setHeroSaving(false)
        return
      }

      const formData = new FormData()
      formData.append('heroTitle', heroTitle)
      formData.append('heroSubtitle', heroSubtitle)
      formData.append('existingImages', JSON.stringify(heroExistingImages))
      heroNewFiles.forEach(file => {
        formData.append('images', file)
      })

      const result = await updateHeroSettingsAction(formData)

      if (result.success && result.data) {
        setHeroExistingImages(result.data.heroImages)
        setHeroTitle(result.data.heroTitle)
        setHeroSubtitle(result.data.heroSubtitle || "")
        setHeroNewFiles([])
        setHeroMessage({ type: 'success', text: 'Configuracion guardada' })
      } else {
        setHeroMessage({ type: 'error', text: result.error || 'Error al guardar' })
      }
    } catch {
      setHeroMessage({ type: 'error', text: 'Error al guardar la configuracion' })
    } finally {
      setHeroSaving(false)
      setTimeout(() => setHeroMessage(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  const maxNewFiles = 3 - heroExistingImages.length

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel de control</h1>
            <p className="text-muted-foreground">Resumen de tus propiedades inmobiliarias</p>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de propiedades</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                Todas las propiedades en tu sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.availableProperties}</div>
              <p className="text-xs text-muted-foreground">
                Listas para venta/alquiler
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservadas</CardTitle>
              <Eye className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.reservedProperties}</div>
              <p className="text-xs text-muted-foreground">
                Actualmente reservadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Destacadas</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.featuredProperties}</div>
              <p className="text-xs text-muted-foreground">
                Propiedades destacadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Propiedades recientes</CardTitle>
            <CardDescription>
              Tus propiedades agregadas mas recientemente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentProperties.length > 0 ? (
              <div className="space-y-4">
                {recentProperties.map((property) => (
                  <div
                    key={property.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
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
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{property.title}</h4>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          {property.location.address}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {formatCurrency(property.price, property.currency)}
                        </p>
                        <StatusBadge status={property.status as 'available' | 'reserved' | 'sold' | 'rented'} size="sm" />
                      </div>
                      <div className="flex items-center space-x-2">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aun no hay propiedades</p>
                <CanAccess resource="properties" action="create">
                  <Link href="/admin/properties/create">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Agrega tu primera propiedad
                    </Button>
                  </Link>
                </CanAccess>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CanAccess resource="properties" action="create">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <Link href="/admin/properties/create">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Plus className="mr-2 h-5 w-5" />
                    Agregar propiedad
                  </CardTitle>
                  <CardDescription>
                    Crear un nuevo listado de propiedad
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </CanAccess>

          <CanAccess resource="properties" action="read">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <Link href="/admin/properties">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Gestionar propiedades
                  </CardTitle>
                  <CardDescription>
                    Ver y editar todas las propiedades
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </CanAccess>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link href="/">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="mr-2 h-5 w-5" />
                  Ver sitio web
                </CardTitle>
                <CardDescription>
                  Ver tu sitio web publico
                </CardDescription>
                </CardHeader>
              </Link>
            </Card>
        </div>

        {/* Hero Settings */}
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Configuracion del inicio
            </CardTitle>
            <CardDescription>
              Configura las imagenes y textos del hero de la pagina principal
            </CardDescription>
          </CardHeader>
          {heroSaving && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card shadow-lg border">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">
                  Subiendo imagenes...
                </p>
              </div>
            </div>
          )}
          <CardContent>
            <div className="space-y-6">
              {/* Hero Title */}
              <div className="space-y-2">
                <Label htmlFor="heroTitle">Titulo del hero</Label>
                <Input
                  id="heroTitle"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="Ej: Bienvenido a tu nueva casa"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">{heroTitle.length}/200 caracteres</p>
              </div>

              {/* Hero Subtitle */}
              <div className="space-y-2">
                <Label htmlFor="heroSubtitle">Subtitulo del hero</Label>
                <Input
                  id="heroSubtitle"
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  placeholder="Ej: Especialistas en venta y alquiler de propiedades"
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">{heroSubtitle.length}/300 caracteres</p>
              </div>

              {/* Hero Images */}
              <div className="space-y-2">
                <Label>Imagenes del hero (maximo 3)</Label>
                <ImageUpload
                  value={heroExistingImages}
                  onChange={(files) => setHeroNewFiles(files)}
                  onRemove={handleRemoveExistingImage}
                  maxFiles={maxNewFiles > 0 ? maxNewFiles : 0}
                  maxFileSize={10}
                  disabled={heroSaving}
                />
                <p className="text-xs text-muted-foreground">
                  {heroExistingImages.length + heroNewFiles.length}/3 imagenes
                </p>
              </div>

              {/* Mensaje de feedback */}
              {heroMessage && (
                <div className={`text-sm p-3 rounded-md ${
                  heroMessage.type === 'success'
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {heroMessage.text}
                </div>
              )}

              {/* Botón de guardar */}
              <Button
                onClick={handleSaveHeroSettings}
                disabled={heroSaving}
              >
                {heroSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {heroSaving ? 'Guardando...' : 'Guardar Configuracion'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
