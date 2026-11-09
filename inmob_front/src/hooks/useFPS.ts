'use client';

import { useEffect } from 'react';
import { reportMetric } from '@/lib/metrics/collector';

const MIN_SAMPLES_PER_WINDOW = 10;

function percentileSorted(sorted: number[], p: number): number {
    const rank = Math.ceil((p / 100) * sorted.length);
    const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
    return Math.round(sorted[index] * 100) / 100;
}

function rateFps(avg: number): 'good' | 'needs-improvement' | 'poor' {
    if (avg >= 50) return 'good';
    if (avg >= 30) return 'needs-improvement';
    return 'poor';
}

/**
 * Mide frames por segundo vía deltas de requestAnimationFrame sobre una ventana
 * windows, reporting avg/p50/p95 to the metrics collector once per window.
 * Se pausa con la pestaña oculta para que el throttling en background no sesgue los datos.
 */
export function useFPS(windowMs: number = 5000): void {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let rafId = 0;
        let last = 0;
        let windowStart = 0;
        let samples: number[] = [];
        let running = false;

        const reportWindow = (): void => {
            if (samples.length < MIN_SAMPLES_PER_WINDOW) return;
            const sorted = [...samples].sort((a, b) => a - b);
            const avg = Math.round((samples.reduce((sum, v) => sum + v, 0) / samples.length) * 100) / 100;
            reportMetric({
                metric: 'FPS',
                value: avg,
                rating: rateFps(avg),
                detail: {
                    avg,
                    p50: percentileSorted(sorted, 50),
                    p95: percentileSorted(sorted, 95),
                },
            });
        };

        const tick = (t: number): void => {
            if (last > 0) {
                const delta = t - last;
                if (delta > 0) samples.push(1000 / delta);
            }
            last = t;
            if (t - windowStart >= windowMs) {
                reportWindow();
                samples = [];
                windowStart = t;
            }
            rafId = window.requestAnimationFrame(tick);
        };

        const start = (): void => {
            if (running) return;
            running = true;
            last = 0;
            windowStart = performance.now();
            rafId = window.requestAnimationFrame(tick);
        };

        const stop = (): void => {
            if (!running) return;
            running = false;
            window.cancelAnimationFrame(rafId);
            reportWindow();
            samples = [];
        };

        const handleVisibility = (): void => {
            if (document.visibilityState === 'visible') {
                start();
            } else {
                stop();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        start();

        return () => {
            stop();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [windowMs]);
}
