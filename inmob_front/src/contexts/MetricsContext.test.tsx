import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricsProvider, useMetrics } from './MetricsContext'
import { reportMetric, resetMetricsCollectorForTests } from '@/lib/metrics/collector'

type VitalCallback = (metric: { name: string; value: number; rating: string }) => void

const subscribers: Record<string, VitalCallback> = {}
const onLCP = vi.fn((cb: VitalCallback) => { subscribers.LCP = cb; return vi.fn() })
const onCLS = vi.fn((cb: VitalCallback) => { subscribers.CLS = cb; return vi.fn() })
const onINP = vi.fn((cb: VitalCallback) => { subscribers.INP = cb; return vi.fn() })
const onTTFB = vi.fn((cb: VitalCallback) => { subscribers.TTFB = cb; return vi.fn() })
const onFCP = vi.fn((cb: VitalCallback) => { subscribers.FCP = cb; return vi.fn() })

vi.mock('web-vitals', () => ({
    onLCP: (...args: unknown[]) => onLCP(...(args as [VitalCallback])),
    onCLS: (...args: unknown[]) => onCLS(...(args as [VitalCallback])),
    onINP: (...args: unknown[]) => onINP(...(args as [VitalCallback])),
    onTTFB: (...args: unknown[]) => onTTFB(...(args as [VitalCallback])),
    onFCP: (...args: unknown[]) => onFCP(...(args as [VitalCallback])),
}))

vi.mock('@/lib/metrics/collector', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/metrics/collector')>()
    return {
        ...actual,
        reportMetric: vi.fn(),
    }
})

const mockReport = vi.mocked(reportMetric)

vi.mock('@/hooks/useFPS', () => ({
    useFPS: vi.fn(),
}))

describe('MetricsProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetMetricsCollectorForTests()
        window.sessionStorage.clear()
        window.sessionStorage.setItem('metrics.sampled', '1')
    })

    it('renders children', () => {
        render(
            <MetricsProvider>
                <p>content</p>
            </MetricsProvider>
        )

        expect(screen.getByText('content')).toBeDefined()
    })

    it('registers all web-vitals callbacks on mount and reports captured metrics', async () => {
        render(
            <MetricsProvider>
                <p>content</p>
            </MetricsProvider>
        )

        await vi.waitFor(() => {
            expect(onLCP).toHaveBeenCalledTimes(1)
            expect(onCLS).toHaveBeenCalledTimes(1)
            expect(onINP).toHaveBeenCalledTimes(1)
            expect(onTTFB).toHaveBeenCalledTimes(1)
            expect(onFCP).toHaveBeenCalledTimes(1)
        })

        subscribers.LCP({ name: 'LCP', value: 1800, rating: 'good' })

        expect(mockReport).toHaveBeenCalledWith(
            expect.objectContaining({ metric: 'LCP', value: 1800, rating: 'good' })
        )
    })

    it('exposes reportCustomMetric through useMetrics', () => {
        let captured: ReturnType<typeof useMetrics> | undefined
        function Probe() {
            captured = useMetrics()
            return null
        }

        render(
            <MetricsProvider>
                <Probe />
            </MetricsProvider>
        )

        captured!.reportCustomMetric({ metric: 'FPS', value: 60, rating: 'good' })

        expect(mockReport).toHaveBeenCalledWith({ metric: 'FPS', value: 60, rating: 'good' })
    })
})
