"use client"

import React, { ReactNode } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CanAccess } from "./ProtectedRoute"
import {
  LayoutDashboard,
  Building2,
  LogOut,
  Plus,
  Menu,
  X,
  Megaphone
} from "lucide-react"
import { useState } from "react"

interface AdminLayoutProps {
  children: ReactNode
}

const navigation = [
  {
    name: 'Panel',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    resource: 'dashboard',
    action: 'read'
  },
  {
    name: 'Propiedades',
    href: '/admin/properties',
    icon: Building2,
    resource: 'properties',
    action: 'read'
  },
  {
    name: 'Publicaciones',
    href: '/admin/syndication',
    icon: Megaphone,
    resource: 'syndication',
    action: 'read'
  },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' })
  }

  return (
    <div>
      <div className="min-h-screen bg-muted/30">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
              <h1 className="text-xl font-semibold text-foreground">
                Panel de Admin
              </h1>
              <button
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* User info */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {session?.user?.name?.charAt(0) || 'A'}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground/80 capitalize">
                    {session?.user?.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1">
              {navigation.map((item) => (
                <CanAccess 
                  key={item.name}
                  resource={item.resource}
                  action={item.action}
                >
                  <Link
                    href={item.href}
                    className={`
                      group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                      ${pathname === item.href
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      }
                    `}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </CanAccess>
              ))}
            </nav>

            {/* Quick actions */}
            <div className="p-4 border-t border-gray-200">
              <CanAccess resource="properties" action="create">
                <Link href="/admin/properties/create">
                  <Button className="w-full mb-2" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar propiedad
                  </Button>
                </Link>
              </CanAccess>
              
              <Button 
                variant="outline" 
                className="w-full" 
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesion
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar */}
          <div className="sticky top-0 z-10 bg-white shadow-xs border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4">
              <button
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground/80">
                  Bienvenido, {session?.user?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}