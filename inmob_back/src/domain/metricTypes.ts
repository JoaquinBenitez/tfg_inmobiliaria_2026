export const METRIC_NAMES = ['LCP', 'CLS', 'INP', 'TTFB', 'FCP', 'FPS', 'VIEWER_INIT', 'VIEWER_TEXTURE'] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

export const RATINGS = ['good', 'needs-improvement', 'poor'] as const;
export type Rating = (typeof RATINGS)[number];

export interface MetricInput {
    metric: MetricName;
    value: number;
    rating: Rating;
    pagePath: string;
    detail?: Record<string, number>;
}

export interface MetricBatch {
    sessionId: string;
    metrics: MetricInput[];
}

export const MAX_BATCH_SIZE = 50;
export const MAX_PAGE_PATH_LENGTH = 200;
export const MAX_SESSION_ID_LENGTH = 64;
export const MAX_DETAIL_KEYS = 10;
export const METRIC_TTL_DAYS = 90;

export function isMetricName(value: unknown): value is MetricName {
    return typeof value === 'string' && (METRIC_NAMES as readonly string[]).includes(value);
}

export function isRating(value: unknown): value is Rating {
    return typeof value === 'string' && (RATINGS as readonly string[]).includes(value);
}
