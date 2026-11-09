import { describe, it, expect } from 'vitest';
import { validateMetricBatch } from '../../src/domain/metricValidation';
import { MAX_BATCH_SIZE } from '../../src/domain/metricTypes';

const validMetric = {
    metric: 'LCP',
    value: 1234.5,
    rating: 'good',
    pagePath: '/venta',
};

const validBatch = {
    sessionId: 'session-abc-123',
    metrics: [validMetric],
};

describe('validateMetricBatch', () => {
    it('accepts a valid batch', () => {
        expect(validateMetricBatch(validBatch)).toEqual([]);
    });

    it('accepts optional numeric detail', () => {
        const errors = validateMetricBatch({
            ...validBatch,
            metrics: [{ ...validMetric, detail: { p50: 55, p95: 32 } }],
        });
        expect(errors).toEqual([]);
    });

    it('rejects non-object body', () => {
        const errors = validateMetricBatch('nope');
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe('body');
    });

    it('rejects missing sessionId', () => {
        const errors = validateMetricBatch({ metrics: [validMetric] });
        expect(errors.some(e => e.field === 'sessionId')).toBe(true);
    });

    it('rejects oversized sessionId', () => {
        const errors = validateMetricBatch({ sessionId: 'a'.repeat(65), metrics: [validMetric] });
        expect(errors.some(e => e.field === 'sessionId')).toBe(true);
    });

    it('rejects empty metrics array', () => {
        const errors = validateMetricBatch({ sessionId: 's', metrics: [] });
        expect(errors.some(e => e.field === 'metrics')).toBe(true);
    });

    it('rejects batch exceeding max size', () => {
        const metrics = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => validMetric);
        const errors = validateMetricBatch({ sessionId: 's', metrics });
        expect(errors.some(e => e.field === 'metrics' && e.message.includes('50'))).toBe(true);
    });

    it('rejects unknown metric name', () => {
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, metric: 'XYZ' }],
        });
        expect(errors.some(e => e.field === 'metrics[0].metric')).toBe(true);
    });

    it('rejects negative, NaN and non-number values', () => {
        for (const value of [-1, Number.NaN, '12', null]) {
            const errors = validateMetricBatch({
                sessionId: 's',
                metrics: [{ ...validMetric, value }],
            });
            expect(errors.some(e => e.field === 'metrics[0].value')).toBe(true);
        }
    });

    it('rejects unknown rating', () => {
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, rating: 'excellent' }],
        });
        expect(errors.some(e => e.field === 'metrics[0].rating')).toBe(true);
    });

    it('rejects pagePath not starting with slash', () => {
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, pagePath: 'venta' }],
        });
        expect(errors.some(e => e.field === 'metrics[0].pagePath')).toBe(true);
    });

    it('rejects oversized pagePath', () => {
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, pagePath: `/${'a'.repeat(200)}` }],
        });
        expect(errors.some(e => e.field === 'metrics[0].pagePath')).toBe(true);
    });

    it('rejects non-numeric detail values', () => {
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, detail: { p50: 'fast' } }],
        });
        expect(errors.some(e => e.field === 'metrics[0].detail.p50')).toBe(true);
    });

    it('rejects detail with too many keys', () => {
        const detail: Record<string, number> = {};
        for (let i = 0; i < 11; i++) detail[`k${i}`] = i;
        const errors = validateMetricBatch({
            sessionId: 's',
            metrics: [{ ...validMetric, detail }],
        });
        expect(errors.some(e => e.field === 'metrics[0].detail')).toBe(true);
    });
});
