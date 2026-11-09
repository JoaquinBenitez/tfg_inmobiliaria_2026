import { AdminLayout } from "@/components/admin/AdminLayout"
import { PropertyForm } from "@/components/admin/PropertyForm"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Crear nueva propiedad',
}

export default function CreatePropertyPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link 
            href="/admin/properties"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Propiedades
          </Link>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold text-foreground">Crear nueva propiedad</h1>
          <p className="text-muted-foreground">Agrega una nueva propiedad a tus listados</p>
        </div>

        {/* Property Form */}
        <PropertyForm />
      </div>
    </AdminLayout>
  )
}