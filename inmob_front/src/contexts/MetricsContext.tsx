'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Metric as WebVitalMetric } from 'web-vitals';
import {
    initMetricsCollector,
    reportMetric,
    type ClientMetricInput,
    type ClientMetricName
} from '@/lib/metrics/collector';
import { useFPS } from '@/hooks/useFPS';

export interface MetricsApi {
    reportCustomMetric: (metric: ClientMetricInput) => void;
}

const defaultApi: MetricsApi = {
    reportCustomMetric: (metric) => reportMetric(metric),
};

const MetricsContext = createContext<MetricsApi>(defaultApi);

export function MetricsProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const cleanupCollector = initMetricsCollector();
        let disposed = false;

        void import('web-vitals').then((webVitals) => {
            const handle = (m: WebVitalMetric): void => {
                if (disposed) return;
                reportMetric({
                    metric: m.name as ClientMetricName,
                    value: m.value,
                    rating: m.rating,
                });
            };
            webVitals.onLCP(handle);
            webVitals.onCLS(handle);
            webVitals.onINP(handle);
            webVitals.onTTFB(handle);
            webVitals.onFCP(handle);
        });

        return () => {
            disposed = true;
            cleanupCollector();
        };
    }, []);

    useFPS();

    return <MetricsContext.Provider value={defaultApi}>{children}</MetricsContext.Provider>;
}

export function useMetrics(): MetricsApi {
    return useContext(MetricsContext);
}
