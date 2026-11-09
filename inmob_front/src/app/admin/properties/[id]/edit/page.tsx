import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { PropertyForm } from '@/components/admin/PropertyForm'
import { TourBuilder } from '@/components/admin/TourBuilder'
import { getProperty } from '@/lib/data-access'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface EditPropertyPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const resolvedParams = await params
  let property

  try {
    property = await getProperty(resolvedParams.id)
  } catch (error) {
    console.error('Error fetching property:', error)
    notFound()
  }

  if (!property) {
    notFound()
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/admin/properties"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a propiedades
            </Link>
            <h1 className="text-3xl font-bold">Editar propiedad</h1>
            <p className="text-muted-foreground mt-1">
              Actualizar detalles de: {property.title}
            </p>
          </div>
        </div>

        {/* Property Form (keyed by id so navigating between properties remounts it) */}
        <PropertyForm
          key={resolvedParams.id}
          mode="edit"
          initialData={property}
          propertyId={resolvedParams.id}
        />

        {/* 360° tour builder (Phase 2) — scenes live on the persisted property */}
        <TourBuilder propertyId={resolvedParams.id} initialTour={property.tour ?? { enabled: false, scenes: [] }} />
      </div>
    </AdminLayout>
  )
}
