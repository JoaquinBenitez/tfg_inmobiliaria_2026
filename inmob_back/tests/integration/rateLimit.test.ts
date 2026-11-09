import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

/**
 * Los limitadores a nivel app se saltean a sí mismos cuando NODE_ENV=test,
 * así que el comportamiento del rate limiting se verifica acá contra una instancia fresca del limiter.
 */
function buildLimitedApp(max: number) {
    const app = express();
    app.use(
        rateLimit({
            windowMs: 60 * 1000,
            max,
            message: { error: 'Too many requests from this IP, please try again later.' },
            standardHeaders: true,
            legacyHeaders: false,
        })
    );
    app.get('/ping', (req, res) => res.json({ ok: true }));
    return app;
}

describe('rate limiting (fresh limiter instance)', () => {
    it('allows requests under the limit and blocks the request exceeding it', async () => {
        const app = buildLimitedApp(2);

        const first = await request(app).get('/ping');
        expect(first.status).toBe(200);
        expect(first.body).toEqual({ ok: true });

        const second = await request(app).get('/ping');
        expect(second.status).toBe(200);

        const third = await request(app).get('/ping');
        expect(third.status).toBe(429);
        expect(third.body.error).toBe('Too many requests from this IP, please try again later.');
    });

    it('exposes standard RateLimit headers', async () => {
        const app = buildLimitedApp(1);

        const res = await request(app).get('/ping');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit-limit']).toBe('1');
        expect(res.headers['ratelimit-remaining']).toBe('0');
    });
});
