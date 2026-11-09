import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
    reportMetric,
    flushMetrics,
    initMetricsCollector,
    resetMetricsCollectorForTests,
    normalizePagePath,
} from './collector'

const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))

function beaconMock(ok = true): ReturnType<typeof vi.fn> {
    return vi.fn().mockReturnValue(ok)
}

function setSampledFlag(value: '1' | '0'): void {
    window.sessionStorage.setItem('metrics.sampled', value)
}

describe('metrics collector', () => {
    beforeEach(() => {
        resetMetricsCollectorForTests()
        window.sessionStorage.clear()
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockClear()
        window.history.replaceState(null, '', '/')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        document.removeEventListener('visibilitychange', () => undefined)
    })

    it('normalizes Mongo ObjectId and UUID path segments', () => {
        expect(normalizePagePath('/propiedades/507f1f77bcf86cd799439011')).toBe('/propiedades/:id')
        expect(normalizePagePath('/propiedades/550e8400-e29b-41d4-a716-446655440000')).toBe('/propiedades/:uuid')
        expect(normalizePagePath('/venta?foo=1'.split('?')[0])).toBe('/venta')
    })

    it('drops metrics when session is not sampled', () => {
        setSampledFlag('0')
        const beacon = beaconMock()
        vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })

        reportMetric({ metric: 'LCP', value: 1000, rating: 'good' })
        flushMetrics()

        expect(beacon).not.toHaveBeenCalled()
    })

    it('flushes buffer via sendBeacon with correct payload', () => {
        setSampledFlag('1')
        const beacon = beaconMock()
        vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })

        reportMetric({ metric: 'LCP', value: 1800, rating: 'good' })
        flushMetrics()

        expect(beacon).toHaveBeenCalledTimes(1)
        const [url, blob] = beacon.mock.calls[0]
        expect(url).toContain('/api/metrics')
        expect(blob).toBeInstanceOf(Blob)
    })

    it('falls back to fetch keepalive when sendBeacon is unavailable or refuses', async () => {
        setSampledFlag('1')
        vi.stubGlobal('navigator', { ...navigator })

        reportMetric({ metric: 'CLS', value: 0.05, rating: 'good' })
        flushMetrics()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toContain('/api/metrics')
        expect(init.method).toBe('POST')
        expect(init.keepalive).toBe(true)
        const body = JSON.parse(init.body as string)
        expect(body.metrics[0].metric).toBe('CLS')
        expect(body.sessionId).toEqual(expect.any(String))
    })

    it('auto-flushes when the buffer reaches its limit', () => {
        setSampledFlag('1')
        const beacon = beaconMock()
        vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })

        for (let i = 0; i < 10; i++) {
            reportMetric({ metric: 'INP', value: 100 + i, rating: 'good' })
        }

        expect(beacon).toHaveBeenCalledTimes(1)
    })

    it('flushes on visibilitychange to hidden', () => {
        setSampledFlag('1')
        const beacon = beaconMock()
        vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
        initMetricsCollector()

        reportMetric({ metric: 'TTFB', value: 300, rating: 'good' })
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        })
        document.dispatchEvent(new Event('visibilitychange'))

        expect(beacon).toHaveBeenCalledTimes(1)
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
        })
    })

    it('flushes on pagehide', () => {
        setSampledFlag('1')
        const beacon = beaconMock()
        vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
        initMetricsCollector()

        reportMetric({ metric: 'FCP', value: 900, rating: 'good' })
        window.dispatchEvent(new Event('pagehide'))

        expect(beacon).toHaveBeenCalledTimes(1)
    })

    it('reports the normalized page path with each metric', async () => {
        setSampledFlag('1')
        vi.stubGlobal('navigator', { ...navigator })
        window.history.replaceState(null, '', '/propiedades/507f1f77bcf86cd799439011')

        reportMetric({ metric: 'LCP', value: 1200, rating: 'good' })
        flushMetrics()

        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        expect(body.metrics[0].pagePath).toBe('/propiedades/:id')
    })

    it('reuses the same sessionId across reports in one session', () => {
        setSampledFlag('1')
        vi.stubGlobal('navigator', { ...navigator })

        reportMetric({ metric: 'LCP', value: 1, rating: 'good' })
        flushMetrics()
        reportMetric({ metric: 'CLS', value: 0.1, rating: 'good' })
        flushMetrics()

        const first = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        const second = JSON.parse(fetchMock.mock.calls[1][1].body as string)
        expect(first.sessionId).toBe(second.sessionId)
    })
})
