'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { Property } from '@/types/property'

const COMPARISON_STORAGE_KEY = 'property_comparison'
const MAX_COMPARE = 3
const EMPTY: Property[] = []

let cachedRaw: string | null = null
let cachedList: Property[] = EMPTY
const listeners = new Set<() => void>()

function readStore(): Property[] {
    const raw = typeof window === 'undefined' ? null : localStorage.getItem(COMPARISON_STORAGE_KEY)
    if (raw === cachedRaw) return cachedList
    cachedRaw = raw
    if (!raw) {
        cachedList = EMPTY
        return cachedList
    }
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            cachedList = parsed
        } else {
            localStorage.removeItem(COMPARISON_STORAGE_KEY)
            cachedRaw = null
            cachedList = EMPTY
        }
    } catch (err) {
        console.error('Error loading comparison list:', err)
        localStorage.removeItem(COMPARISON_STORAGE_KEY)
        cachedRaw = null
        cachedList = EMPTY
    }
    return cachedList
}

function writeStore(list: Property[]) {
    if (list.length > 0) {
        localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(list))
    } else {
        localStorage.removeItem(COMPARISON_STORAGE_KEY)
    }
    listeners.forEach(listener => listener())
}

const subscribe = (onStoreChange: () => void) => {
    listeners.add(onStoreChange)
    return () => {
        listeners.delete(onStoreChange)
    }
}

const getServerSnapshot = (): Property[] => EMPTY

export function usePropertyComparison() {
    const comparisonList = useSyncExternalStore(subscribe, readStore, getServerSnapshot)

    const addToComparison = useCallback((property: Property) => {
        const current = readStore()
        // No agregar si ya está en la lista
        if (current.some(p => p.id === property.id)) {
            return
        }
        // No agregar si la lista está llena
        if (current.length >= MAX_COMPARE) {
            return
        }
        writeStore([...current, property])
    }, [])

    const removeFromComparison = useCallback((propertyId: string) => {
        writeStore(readStore().filter(p => p.id !== propertyId))
    }, [])

    const clearComparison = useCallback(() => {
        writeStore([])
    }, [])

    const isInComparison = useCallback((propertyId: string) => {
        return comparisonList.some(p => p.id === propertyId)
    }, [comparisonList])

    const canAddMore = comparisonList.length < MAX_COMPARE

    return {
        comparisonList,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        canAddMore,
        count: comparisonList.length,
        maxCompare: MAX_COMPARE,
    }
}
