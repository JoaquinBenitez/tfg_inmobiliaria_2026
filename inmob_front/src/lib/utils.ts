import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'USD' | 'ARS' = 'ARS'): string {
    // es-AR: "." separa miles, "," decimales (convención española)
    const n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
    return currency === 'USD' ? `USD ${n}` : `$ ${n}`
}
