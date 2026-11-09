'use client';

import { useMetrics } from '@/contexts/MetricsContext';
import type { ClientMetricInput } from '@/lib/metrics/collector';

/**
 * Opt-in hook for modules that need to report additional measurements
 * (e.g. the 360° viewer will report init/texture times through this).
 */
export function useWebVitals(): { reportCustomMetric: (metric: ClientMetricInput) => void } {
    return useMetrics();
}
