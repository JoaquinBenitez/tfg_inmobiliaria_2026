import { describe, it, expect } from 'vitest'
import { cn, formatCurrency } from './utils'

describe('cn', () => {
    it('joins conditional class names', () => {
        expect(cn('a', false && 'b', 'c')).toBe('a c')
    })

    it('merges conflicting tailwind classes with the last one winning', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4')
    })

    it('returns an empty string for no inputs', () => {
        expect(cn()).toBe('')
    })
})

describe('formatCurrency', () => {
    it('formats amounts as ARS currency without decimals', () => {
        expect(formatCurrency(150000)).toMatch(/^\$\s*150\.000$/)
    })

    it('rounds decimal amounts to whole pesos', () => {
        expect(formatCurrency(150000.99)).toMatch(/^\$\s*150\.001$/)
    })

    it('handles zero', () => {
        expect(formatCurrency(0)).toMatch(/^\$\s*0$/)
    })

    it('formats USD with USD prefix and dot as thousands separator', () => {
        expect(formatCurrency(100000, 'USD')).toBe('USD 100.000')
    })
})
