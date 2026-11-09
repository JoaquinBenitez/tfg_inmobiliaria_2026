import Link from "next/link"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navbar from "@/components/layout/Navbar"

export default function NotFound() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center pt-24">
          <Search className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Pagina no encontrada
          </h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Lo sentimos, la pagina que buscas no existe o ha sido movida.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button>Ir al inicio</Button>
            </Link>
            <Link href="/venta">
              <Button variant="outline">Ver propiedades</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
