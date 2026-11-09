import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFPS } from './useFPS'
import { reportMetric, resetMetricsCollectorForTests } from '@/lib/metrics/collector'

vi.mock('@/lib/metrics/collector', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/metrics/collector')>()
    return {
        ...actual,
        reportMetric: vi.fn(),
    }
})

const mockReport = vi.mocked(reportMetric)

let rafCallbacks: FrameRequestCallback[]
let rafTime: number

function stepFrame(deltaMs: number): void {
    rafTime += deltaMs
    const callbacks = rafCallbacks
    rafCallbacks = []
    callbacks.forEach((cb) => cb(rafTime))
}

describe('useFPS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetMetricsCollectorForTests()
        window.sessionStorage.clear()
        window.sessionStorage.setItem('metrics.sampled', '1')
        rafCallbacks = []
        rafTime = 0
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafCallbacks.push(cb)
            return rafCallbacks.length
        })
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal('performance', { ...performance, now: () => rafTime })
        vi.stubGlobal('navigator', { ...navigator })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reports an FPS window after enough frames at ~60fps and rates it good', () => {
        renderHook(() => useFPS(1000))

        stepFrame(0)
        for (let i = 0; i < 61; i++) {
            stepFrame(1000 / 60)
        }

        expect(mockReport).toHaveBeenCalledTimes(1)
        const call = mockReport.mock.calls[0][0]
        expect(call.metric).toBe('FPS')
        expect(call.rating).toBe('good')
        expect(call.value).toBeGreaterThan(55)
        expect(call.detail?.p50).toBeGreaterThan(0)
        expect(call.detail?.p95).toBeGreaterThan(0)
    })

    it('rates sustained ~20fps as poor', () => {
        renderHook(() => useFPS(2000))

        stepFrame(0)
        for (let i = 0; i < 40; i++) {
            stepFrame(50)
        }

        expect(mockReport).toHaveBeenCalledTimes(1)
        expect(mockReport.mock.calls[0][0].rating).toBe('poor')
    })

    it('does not report when the window has too few samples', () => {
        renderHook(() => useFPS(1000))

        stepFrame(0)
        for (let i = 0; i < 5; i++) {
            stepFrame(1000 / 60)
        }

        expect(mockReport).not.toHaveBeenCalled()
    })

    it('reports a partial window on unmount', () => {
        const { unmount } = renderHook(() => useFPS(5000))
        stepFrame(0)
        for (let i = 0; i < 30; i++) {
            stepFrame(1000 / 60)
        }

        unmount()

        expect(mockReport).toHaveBeenCalledTimes(1)
    })
})
