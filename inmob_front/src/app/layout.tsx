// src/app/layout.tsx
import { MetricsProvider } from '@/contexts/MetricsContext'
import { AdminProvider } from '@/components/admin/AdminProvider'
import { FilterCacheProvider } from '@/contexts/FilterCacheContext'
import './globals.css';
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Inmobiliaria - Propiedades en Venta y Alquiler',
    template: '%s | Inmobiliaria'
  },
  description: 'Encuentra la propiedad perfecta para ti. Casas, departamentos, terrenos y locales comerciales en venta y alquiler en Avellaneda y Reconquista.',
  keywords: [
    'inmobiliaria', 'propiedades', 'venta', 'alquiler', 'casas', 'departamentos', 
    'terrenos', 'oficinas', 'locales comerciales', 'Avellaneda', 'Reconquista',
    'bienes raíces', 'real estate'
  ],
  authors: [{ name: 'Inmobiliaria' }],
  creator: 'Inmobiliaria',
  publisher: 'Inmobiliaria',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('http://localhost:3001'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: '/',
    siteName: 'Inmobiliaria',
    title: 'Inmobiliaria - Propiedades en Venta y Alquiler',
    description: 'Encuentra la propiedad perfecta para ti. Casas, departamentos, terrenos y locales comerciales en venta y alquiler.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Inmobiliaria - Propiedades en Venta y Alquiler',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inmobiliaria - Propiedades en Venta y Alquiler',
    description: 'Encuentra la propiedad perfecta para ti. Casas, departamentos, terrenos y locales comerciales.',
    images: ['/og-image.jpg'],
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0F766E',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <MetricsProvider>
          <AdminProvider>
            <FilterCacheProvider>
              {children}
            </FilterCacheProvider>
          </AdminProvider>
        </MetricsProvider>
      </body>
    </html>
  );
}