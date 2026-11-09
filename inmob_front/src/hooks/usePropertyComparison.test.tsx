import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePropertyComparison } from './usePropertyComparison'
import { Property } from '@/types/property'

const makeProperty = (id: string): Property => ({
    id,
    title: `Property ${id}`,
    description: 'desc',
    price: 100000,
    location: { address: 'Addr 123', city: 'Rosario', lat: -31.63, lng: -60.7 },
    bedrooms: 2,
    bathrooms: 1,
    area: 80,
    propertyType: 'casa',
    listingType: 'sale',
    currency: 'USD',
    status: 'available',
    images: [],
    featuredImageId: '',
    featured: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
})

describe('usePropertyComparison', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('starts with an empty comparison list', () => {
        const { result } = renderHook(() => usePropertyComparison())

        expect(result.current.comparisonList).toEqual([])
        expect(result.current.count).toBe(0)
        expect(result.current.canAddMore).toBe(true)
    })

    it('adds properties up to the max of 3', () => {
        const { result } = renderHook(() => usePropertyComparison())

        act(() => result.current.addToComparison(makeProperty('a')))
        act(() => result.current.addToComparison(makeProperty('b')))
        act(() => result.current.addToComparison(makeProperty('c')))
        act(() => result.current.addToComparison(makeProperty('d')))

        expect(result.current.count).toBe(3)
        expect(result.current.canAddMore).toBe(false)
        expect(result.current.comparisonList.map(p => p.id)).toEqual(['a', 'b', 'c'])
    })

    it('ignores duplicates', () => {
        const { result } = renderHook(() => usePropertyComparison())

        act(() => result.current.addToComparison(makeProperty('a')))
        act(() => result.current.addToComparison(makeProperty('a')))

        expect(result.current.count).toBe(1)
    })

    it('removes a property by id', () => {
        const { result } = renderHook(() => usePropertyComparison())

        act(() => result.current.addToComparison(makeProperty('a')))
        act(() => result.current.addToComparison(makeProperty('b')))
        act(() => result.current.removeFromComparison('a'))

        expect(result.current.comparisonList.map(p => p.id)).toEqual(['b'])
    })

    it('reports membership via isInComparison', () => {
        const { result } = renderHook(() => usePropertyComparison())

        act(() => result.current.addToComparison(makeProperty('a')))

        expect(result.current.isInComparison('a')).toBe(true)
        expect(result.current.isInComparison('b')).toBe(false)
    })

    it('persists the list to localStorage and clears the key when empty', () => {
        const { result, unmount } = renderHook(() => usePropertyComparison())

        act(() => result.current.addToComparison(makeProperty('a')))
        expect(JSON.parse(localStorage.getItem('property_comparison')!)).toHaveLength(1)

        act(() => result.current.clearComparison())
        expect(localStorage.getItem('property_comparison')).toBeNull()
        unmount()
    })

    it('restores the list from localStorage on mount', () => {
        localStorage.setItem('property_comparison', JSON.stringify([makeProperty('stored')]))

        const { result } = renderHook(() => usePropertyComparison())

        expect(result.current.comparisonList.map(p => p.id)).toEqual(['stored'])
    })

    it('discards corrupted localStorage data and removes the key', () => {
        localStorage.setItem('property_comparison', '{invalid json')

        const { result } = renderHook(() => usePropertyComparison())

        expect(result.current.comparisonList).toEqual([])
        expect(localStorage.getItem('property_comparison')).toBeNull()
    })
})
