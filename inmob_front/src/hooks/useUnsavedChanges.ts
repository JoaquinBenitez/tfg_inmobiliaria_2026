"use client"

import { useEffect, useState } from 'react'

/**
 * Hook para advertir al usuario sobre cambios sin guardar antes de navegar fuera
 *
 * @param hasUnsavedChanges - Boolean indicating if there are unsaved changes
 * @param message - Custom warning message (optional)
 */
export function useUnsavedChanges(
  hasUnsavedChanges: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) {
  useEffect(() => {
    // Advertir antes de cerrar/refrescar la pestaña del navegador
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        // Los navegadores modernos exigen que returnValue esté seteado
        e.returnValue = message
        return message
      }
    }

    // Agregar el event listener para la navegación del navegador
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges, message])

  // Nota: el App Router de Next.js aún no soporta interceptar cambios de ruta
  // Por ahora solo advertimos al cerrar/refrescar el navegador
  // En el futuro se pueden agregar advertencias de navegación custom cuando Next.js lo soporte
}

/**
 * Hook helper para trackear si los datos del formulario cambiaron respecto de los valores iniciales
 *
 * @param currentData - Current form data
 * @param initialData - Initial form data (optional, defaults to comparing with empty object)
 * @returns Boolean indicating if data has changed
 */
export function useFormDirty<T extends object>(
  currentData: T,
  initialData?: T
): boolean {
  // Snapshot del baseline sin leer refs durante el render
  const [initialSnapshot, setInitialSnapshot] = useState<T | null>(() => initialData ?? null)

  // Capturar el primer initialData no-null si llega después del mount
  if (initialSnapshot === null && initialData != null) {
    setInitialSnapshot(initialData)
  }

  const baseline = initialSnapshot
  if (!baseline) {
    // Sin datos iniciales, verificar si algún campo tiene valor
    return Object.values(currentData).some(value => {
      if (typeof value === 'string') return value.trim() !== ''
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'boolean') return value !== false
      if (Array.isArray(value)) return value.length > 0
      return value != null
    })
  }

  // Comparar los datos actuales con los iniciales
  const current = currentData as Record<string, unknown>
  const initial = baseline as Record<string, unknown>
  for (const key in current) {
    if (current[key] !== initial[key]) {
      return true
    }
  }

  return false
}
