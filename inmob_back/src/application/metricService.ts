import { MetricRepository, MetricRecordInsert, MetricSummaryQuery, MetricSummary, MetricStatBucket } from '../interfaces/metricRepository';
import { MetricBatch, Rating } from '../domain/metricTypes';
import { ValidationFailedError } from '../domain/appError';
import { validateMetricBatch } from '../domain/metricValidation';
import { logger } from '../config/logger';

const RATINGS: Rating[] = ['good', 'needs-improvement', 'poor'];

export interface MetricIngestContext {
    userAgent: string;
    connection: string;
}

function percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const rank = Math.ceil((p / 100) * sortedValues.length);
    const index = Math.min(sortedValues.length - 1, Math.max(0, rank - 1));
    return sortedValues[index];
}

export const metricService = {
    async ingest(
        repo: MetricRepository,
        body: unknown,
        context: MetricIngestContext
    ): Promise<number> {
        const errors = validateMetricBatch(body);
        if (errors.length > 0) {
            throw new ValidationFailedError(errors);
        }

        const batch = body as MetricBatch;
        const timestamp = new Date();
        const records: MetricRecordInsert[] = batch.metrics.map((m) => ({
            metric: m.metric,
            value: m.value,
            rating: m.rating,
            pagePath: m.pagePath,
            sessionId: batch.sessionId,
            detail: m.detail,
            userAgent: context.userAgent,
            connection: context.connection,
            timestamp
        }));

        const inserted = await repo.insertBatch(records);
        logger.debug({ count: inserted, metrics: records.map(r => r.metric) }, 'Metrics ingested');
        return inserted;
    },

    async getSummary(repo: MetricRepository, query: MetricSummaryQuery): Promise<MetricSummary> {
        const docs = await repo.fetchSummaryWindow(query);

        const grouped = new Map<string, { values: number[]; ratings: Record<Rating, number> }>();
        for (const doc of docs) {
            let entry = grouped.get(doc.metric);
            if (!entry) {
                entry = { values: [], ratings: { good: 0, 'needs-improvement': 0, poor: 0 } };
                grouped.set(doc.metric, entry);
            }
            entry.values.push(doc.value);
            if (doc.rating in entry.ratings) {
                entry.ratings[doc.rating as Rating] += 1;
            }
        }

        const buckets: MetricStatBucket[] = Array.from(grouped.entries())
            .map(([metric, entry]) => {
                const sorted = [...entry.values].sort((a, b) => a - b);
                return {
                    metric,
                    count: sorted.length,
                    avg: sorted.length > 0 ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 100) / 100 : 0,
                    p50: percentile(sorted, 50),
                    p75: percentile(sorted, 75),
                    p95: percentile(sorted, 95),
                    ratingDistribution: entry.ratings
                };
            })
            .sort((a, b) => a.metric.localeCompare(b.metric));

        return {
            since: query.since,
            generatedAt: new Date(),
            total: docs.length,
            buckets
        };
    }
};
