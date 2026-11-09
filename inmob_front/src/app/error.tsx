'use client'

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center pt-24">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-destructive mb-4">
          Ha ocurrido un error
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          {error.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={reset}>Intentar nuevamente</Button>
          <Link href="/">
            <Button variant="outline">Ir al inicio</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
