'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { usePathname } from 'next/navigation'

export interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  autoGenerate?: boolean
}

export function Breadcrumbs({ items, autoGenerate = false }: BreadcrumbsProps) {
  const pathname = usePathname()

  // Auto-generar breadcrumbs desde el pathname si no se proveen
  const breadcrumbItems = items || (autoGenerate ? generateBreadcrumbs(pathname) : [])

  if (breadcrumbItems.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-muted-foreground">
      {/* Home */}
      <Link
        href="/"
        className="hover:text-foreground transition-colors flex items-center"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1

        return (
          <div key={item.href} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-foreground font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}

// Función helper para generar breadcrumbs desde el pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const paths = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Mapeos de nombres de rutas
  const routeNames: Record<string, string> = {
    'propiedades': 'Propiedades',
    'venta': 'Venta',
    'alquiler': 'Alquiler',
    'nosotros': 'Nosotros',
    'contacto': 'Contacto',
    'admin': 'Admin',
    'dashboard': 'Dashboard',
    'properties': 'Propiedades',
    'create': 'Crear',
    'edit': 'Editar',
    'buscar-en-mapa': 'Buscar en Mapa',
    'comparar': 'Comparar',
  }

  let currentPath = ''

  paths.forEach((path) => {
    currentPath += `/${path}`

    // Saltear parámetros de rutas dinámicas (como [id])
    if (path.startsWith('[') && path.endsWith(']')) {
      return
    }

    // Saltear IDs (los IDs de MongoDB tienen 24 caracteres)
    if (path.length === 24 && /^[a-f0-9]+$/.test(path)) {
      breadcrumbs.push({
        label: 'Detalle',
        href: currentPath,
      })
      return
    }

    breadcrumbs.push({
      label: routeNames[path] || capitalize(path),
      href: currentPath,
    })
  })

  return breadcrumbs
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
