"use client"

import { ReactNode } from "react"
import { useSession } from "next-auth/react"

interface CanAccessProps {
  children: ReactNode
  resource: string
  action: string
  fallback?: ReactNode
}

export function CanAccess({ 
  children, 
  resource, 
  action, 
  fallback = null 
}: CanAccessProps) {
  const { data: session } = useSession()

  if (!session?.user) {
    return <>{fallback}</>
  }

  const { role } = session.user

  // Definir la matriz de permisos (igual que data-access.ts)
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
    }
  }

  const hasPermission = permissions[resource]?.[action]?.includes(role) || false

  return hasPermission ? <>{children}</> : <>{fallback}</>
}