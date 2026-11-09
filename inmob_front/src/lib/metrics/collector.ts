import { endpoints } from '@/config/endpoints'

export type ClientMetricName = 'LCP' | 'CLS' | 'INP' | 'TTFB' | 'FCP' | 'FPS' | 'VIEWER_INIT' | 'VIEWER_TEXTURE'
export type ClientRating = 'good' | 'needs-improvement' | 'poor'

export interface ClientMetricInput {
  metric: ClientMetricName
  value: number
  rating: ClientRating
  detail?: Record<string, number>
}

interface QueuedMetric extends ClientMetricInput {
  pagePath: string
}

const BUFFER_FLUSH_LIMIT = 10
const SESSION_KEY = 'metrics.sessionId'
const SAMPLE_KEY = 'metrics.sampled'

const isEnabled = process.env.NEXT_PUBLIC_METRICS_ENABLED !== 'false'
const sampleRate = Math.max(0, Math.min(1, parseFloat(process.env.NEXT_PUBLIC_METRICS_SAMPLE_RATE ?? '1') || 0))

const isBrowser = typeof window !== 'undefined'

let buffer: QueuedMetric[] = []
let sessionId = ''
let sampled: boolean | null = null
let listenersBound = false

function getStorage(): Storage | null {
  try {
    return isBrowser ? window.sessionStorage : null
  } catch {
    return null
  }
}

function getSessionId(): string {
  if (sessionId) return sessionId
  const storage = getStorage()
  if (storage) {
    const existing = storage.getItem(SESSION_KEY)
    if (existing) {
      sessionId = existing
      return sessionId
    }
  }
  sessionId = isBrowser && typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  storage?.setItem(SESSION_KEY, sessionId)
  return sessionId
}

/**
 * Session-sticky sampling: decide once per session so a sampled user
 * contributes their whole journey (unbiased partial data), not a random
 * subset of metrics.
 */
function isSampled(): boolean {
  if (sampled !== null) return sampled
  const storage = getStorage()
  if (storage) {
    const existing = storage.getItem(SAMPLE_KEY)
    if (existing !== null) {
      sampled = existing === '1'
      return sampled
    }
  }
  sampled = Math.random() < sampleRate
  storage?.setItem(SAMPLE_KEY, sampled ? '1' : '0')
  return sampled
}

/**
 * Normaliza segmentos de path dinámicos (ObjectIds de Mongo, UUIDs) para que el resumen
 * aggregation agrupe las páginas de detalle en vez de explotar en paths únicos.
 */
export function normalizePagePath(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:uuid')
    .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
}

function sendPayload(payload: string): void {
  if (!isBrowser) return
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'}${endpoints.metrics.ingest}`
  const blob = new Blob([payload], { type: 'application/json' })
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, blob)) {
    return
  }
  void fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(() => {
    // Las métricas son best-effort; se descartan ante fallo en vez de encolar sin tope
  })
}

export function flushMetrics(): void {
  if (buffer.length === 0) return
  const batch = buffer
  buffer = []
  sendPayload(JSON.stringify({
    sessionId: getSessionId(),
    metrics: batch,
  }))
}

export function reportMetric(input: ClientMetricInput): void {
  if (!isBrowser || !isEnabled || !isSampled()) return
  buffer.push({
    ...input,
    pagePath: normalizePagePath(window.location.pathname),
  })
  if (buffer.length >= BUFFER_FLUSH_LIMIT) {
    flushMetrics()
  }
}

function scheduleInit(): void {
  if (!isBrowser) return
  const idle = (cb: () => void): void => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(cb, { timeout: 2000 })
    } else {
      window.setTimeout(cb, 1)
    }
  }
  idle(() => flushMetrics())
}

/**
 * Binda los listeners de flush del ciclo de vida. Idempotente; devuelve un cleanup que los desbindea.
 */
export function initMetricsCollector(): () => void {
  if (!isBrowser || listenersBound) return () => undefined
  listenersBound = true

  const handleVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      flushMetrics()
    }
  }
  const handlePageHide = (): void => flushMetrics()

  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pagehide', handlePageHide)
  scheduleInit()

  return () => {
    listenersBound = false
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('pagehide', handlePageHide)
  }
}

/** Test-only hook: reset module state between tests. */
export function resetMetricsCollectorForTests(): void {
  buffer = []
  sessionId = ''
  sampled = null
}
