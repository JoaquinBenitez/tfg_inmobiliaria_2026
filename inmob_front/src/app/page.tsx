// src/app/page.tsx
import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/layout/Hero';
import FeaturedPropertiesSection from '@/components/shared/FeaturedPropertiesSection';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inicio - Tu Inmobiliaria de Confianza',
  description: 'Bienvenido a nuestra inmobiliaria. Especialistas en venta y alquiler de propiedades en Avellaneda y Reconquista. Encuentra tu hogar ideal con nosotros.',
  openGraph: {
    title: 'Inicio - Tu Inmobiliaria de Confianza',
    description: 'Bienvenido a nuestra inmobiliaria. Especialistas en venta y alquiler de propiedades en Avellaneda y Reconquista.',
    url: '/',
  },
  twitter: {
    title: 'Inicio - Tu Inmobiliaria de Confianza',
    description: 'Bienvenido a nuestra inmobiliaria. Especialistas en venta y alquiler de propiedades en Avellaneda y Reconquista.',
  },
}

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <FeaturedPropertiesSection />
    </main>
  );
}