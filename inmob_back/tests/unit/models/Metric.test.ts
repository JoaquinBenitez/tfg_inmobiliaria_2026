import { describe, it, expect } from 'vitest';
import Metric from '../../../src/models/Metric';
import { METRIC_TTL_DAYS } from '../../../src/domain/metricTypes';

describe('Metric model', () => {
    const baseMetric = {
        metric: 'LCP',
        value: 1500,
        rating: 'good',
        pagePath: '/venta',
        sessionId: 'session-1',
        userAgent: 'Mozilla/5.0 (test)',
        connection: '4g',
    };

    it('saves a valid metric with default timestamp', async () => {
        const before = Date.now();
        const doc = await Metric.create(baseMetric);

        expect(doc._id).toBeDefined();
        expect(doc.timestamp.getTime()).toBeGreaterThanOrEqual(before);
        expect(doc.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('rejects unknown metric names', async () => {
        await expect(Metric.create({ ...baseMetric, metric: 'NOT_A_METRIC' }))
            .rejects.toThrow();
    });

    it('rejects unknown ratings', async () => {
        await expect(Metric.create({ ...baseMetric, rating: 'perfect' }))
            .rejects.toThrow();
    });

    it('rejects negative values', async () => {
        await expect(Metric.create({ ...baseMetric, value: -5 }))
            .rejects.toThrow();
    });

    it('requires core fields', async () => {
        for (const field of ['metric', 'value', 'rating', 'pagePath', 'sessionId']) {
            const doc: Record<string, unknown> = { ...baseMetric };
            delete doc[field];
            await expect(Metric.create(doc)).rejects.toThrow();
        }
    });

    it('has a TTL index on timestamp set to 90 days', () => {
        const ttlIndexes = Metric.schema.indexes().filter(
            ([, options]) => (options as Record<string, unknown>)?.expireAfterSeconds !== undefined
        );
        expect(ttlIndexes).toHaveLength(1);
        const [keys, options] = ttlIndexes[0];
        expect((keys as Record<string, unknown>).timestamp).toBe(1);
        expect((options as Record<string, unknown>).expireAfterSeconds).toBe(METRIC_TTL_DAYS * 24 * 60 * 60);
    });

    it('has query indexes on {metric, timestamp} and {pagePath, timestamp}', () => {
        const indexKeys = Metric.schema.indexes().map(([keys]) => JSON.stringify(keys));
        expect(indexKeys).toContain(JSON.stringify({ metric: 1, timestamp: -1 }));
        expect(indexKeys).toContain(JSON.stringify({ pagePath: 1, timestamp: -1 }));
    });
});
