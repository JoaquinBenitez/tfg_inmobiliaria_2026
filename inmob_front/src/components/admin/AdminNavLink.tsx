"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export function AdminNavLink() {
  const { data: session } = useSession()

  // Mostrar el link admin solo para usuarios autenticados admin/editor
  if (!session?.user || !['admin', 'editor'].includes(session.user.role)) {
    return null
  }

  return (
    <Link href="/admin/dashboard">
      <Button variant="ghost" className="flex items-center gap-1">
        <Settings className="h-4 w-4" />
        Admin
      </Button>
    </Link>
  )
}