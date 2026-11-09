import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import Metric from '../../src/models/Metric';
import { createTestUser, authHeader } from '../helpers/auth';

let admin: any;
let editor: any;

beforeEach(async () => {
    admin = await createTestUser({ role: 'admin' });
    editor = await createTestUser({ role: 'editor' });
});

const validBatch = {
    sessionId: 'session-int-1',
    metrics: [
        { metric: 'LCP', value: 1800, rating: 'good', pagePath: '/venta' },
        { metric: 'CLS', value: 0.05, rating: 'good', pagePath: '/venta' },
        { metric: 'FPS', value: 48, rating: 'needs-improvement', pagePath: '/venta', detail: { p50: 50, p95: 38 } },
    ],
};

describe('POST /api/metrics', () => {
    it('ingests a valid batch and returns 201 with inserted count', async () => {
        const res = await request(app)
            .post('/api/metrics')
            .set('User-Agent', 'Mozilla/5.0 (Test Agent)')
            .send(validBatch);

        expect(res.status).toBe(201);
        expect(res.body.inserted).toBe(3);

        const docs = await Metric.find({ sessionId: 'session-int-1' });
        expect(docs).toHaveLength(3);
    });

    it('captures user agent and connection server-side', async () => {
        await request(app)
            .post('/api/metrics')
            .set('User-Agent', 'Mozilla/5.0 (Test Agent)')
            .set('ect', '4g')
            .send(validBatch);

        const doc = await Metric.findOne({ sessionId: 'session-int-1' });
        expect(doc!.userAgent).toBe('Mozilla/5.0 (Test Agent)');
        expect(doc!.connection).toBe('4g');
    });

    it('stores FPS detail map', async () => {
        await request(app).post('/api/metrics').send(validBatch);

        const doc = await Metric.findOne({ sessionId: 'session-int-1', metric: 'FPS' });
        const detail = doc!.detail as unknown as Map<string, number>;
        expect(detail.get('p50')).toBe(50);
        expect(detail.get('p95')).toBe(38);
    });

    it('returns 400 with field errors for an invalid batch', async () => {
        const res = await request(app)
            .post('/api/metrics')
            .send({ sessionId: '', metrics: [{ metric: 'NOPE', value: -1, rating: 'bad', pagePath: 'venta' }] });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(Array.isArray(res.body.errors)).toBe(true);
        expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('returns 400 for a non-array metrics field', async () => {
        const res = await request(app).post('/api/metrics').send({ sessionId: 's', metrics: 'nope' });

        expect(res.status).toBe(400);
    });

    it('returns 400 for a batch exceeding max size', async () => {
        const metrics = Array.from({ length: 51 }, () => ({
            metric: 'LCP', value: 100, rating: 'good', pagePath: '/',
        }));
        const res = await request(app).post('/api/metrics').send({ sessionId: 's', metrics });

        expect(res.status).toBe(400);
        expect(res.body.errors.some((e: any) => e.field === 'metrics')).toBe(true);
    });
});

describe('GET /api/metrics/summary', () => {
    beforeEach(async () => {
        await Metric.insertMany([
            { metric: 'LCP', value: 1000, rating: 'good', pagePath: '/venta', sessionId: 's1', timestamp: new Date() },
            { metric: 'LCP', value: 2000, rating: 'needs-improvement', pagePath: '/venta', sessionId: 's2', timestamp: new Date() },
            { metric: 'LCP', value: 5000, rating: 'poor', pagePath: '/venta', sessionId: 's3', timestamp: new Date() },
            { metric: 'LCP', value: 4000, rating: 'poor', pagePath: '/venta', sessionId: 's4', timestamp: new Date() },
            { metric: 'CLS', value: 0.1, rating: 'good', pagePath: '/', sessionId: 's1', timestamp: new Date() },
        ]);
    });

    it('returns 401 without authentication', async () => {
        const res = await request(app).get('/api/metrics/summary');
        expect(res.status).toBe(401);
    });

    it('returns 403 for a non-admin user', async () => {
        const res = await request(app).get('/api/metrics/summary').set(authHeader(editor));
        expect(res.status).toBe(403);
    });

    it('returns aggregated percentiles for admin', async () => {
        const res = await request(app).get('/api/metrics/summary').set(authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);

        const lcp = res.body.buckets.find((b: any) => b.metric === 'LCP');
        expect(lcp.count).toBe(4);
        expect(lcp.avg).toBe(3000);
        expect(lcp.p50).toBe(2000);
        expect(lcp.p75).toBe(4000);
        expect(lcp.p95).toBe(5000);
        expect(lcp.ratingDistribution).toEqual({ good: 1, 'needs-improvement': 1, poor: 2 });

        const cls = res.body.buckets.find((b: any) => b.metric === 'CLS');
        expect(cls.count).toBe(1);
    });

    it('filters by metric and pagePath', async () => {
        const res = await request(app)
            .get('/api/metrics/summary?metric=LCP&pagePath=/venta')
            .set(authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(4);
        expect(res.body.buckets).toHaveLength(1);
        expect(res.body.buckets[0].metric).toBe('LCP');
    });

    it('rejects unknown metric filter', async () => {
        const res = await request(app)
            .get('/api/metrics/summary?metric=NOPE')
            .set(authHeader(admin));

        expect(res.status).toBe(400);
    });

    it('respects the days window', async () => {
        await Metric.insertMany([
            { metric: 'LCP', value: 9999, rating: 'good', pagePath: '/old', sessionId: 's9', timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        ]);

        const res = await request(app)
            .get('/api/metrics/summary?days=7')
            .set(authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);
        expect(res.body.buckets.some((b: any) => b.count === 1 && b.metric === 'LCP' && b.avg === 9999)).toBe(false);
    });
});
