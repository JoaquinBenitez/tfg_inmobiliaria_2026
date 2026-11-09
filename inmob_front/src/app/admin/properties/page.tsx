import { AdminLayout } from "@/components/admin/AdminLayout"
import { PropertyTable } from "@/components/admin/PropertyTable"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestión de Propiedades',
}

export default function PropertiesPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Propiedades</h1>
          <p className="text-muted-foreground">Gestiona tus listados de propiedades</p>
        </div>

        {/* Property Table */}
        <PropertyTable />
      </div>
    </AdminLayout>
  )
}