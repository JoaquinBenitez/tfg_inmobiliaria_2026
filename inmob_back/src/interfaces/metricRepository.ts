import { Rating } from '../domain/metricTypes';

export interface MetricRecordInsert {
    metric: string;
    value: number;
    rating: string;
    pagePath: string;
    sessionId: string;
    detail?: Record<string, number>;
    userAgent: string;
    connection: string;
    timestamp: Date;
}

export interface MetricSummaryQuery {
    metric?: string;
    pagePath?: string;
    since: Date;
}

export interface MetricStatBucket {
    metric: string;
    count: number;
    avg: number;
    p50: number;
    p75: number;
    p95: number;
    ratingDistribution: Record<Rating, number>;
}

export interface MetricSummary {
    since: Date;
    generatedAt: Date;
    total: number;
    buckets: MetricStatBucket[];
}

export interface MetricRepository {
    insertBatch(records: MetricRecordInsert[]): Promise<number>;
    fetchSummaryWindow(query: MetricSummaryQuery): Promise<MetricRecordInsert[]>;
}
