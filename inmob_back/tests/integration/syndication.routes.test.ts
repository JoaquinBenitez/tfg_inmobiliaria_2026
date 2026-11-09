import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import JobLog from '../../src/models/JobLog';
import Property from '../../src/models/Property';
import mongoose from 'mongoose';
import { createTestUser, authHeader } from '../helpers/auth';
import { validPersistencePayload, imageAsset } from '../helpers/fixtures';
import { configureSyndication, SyndicationDeps } from '../../src/application/syndicationService';
import { JobLogRepositoryFactory } from '../../src/infrastructure/jobLogRepositoryFactory';
import { PropertyRepositoryFactory } from '../../src/infrastructure/propertyRepositoryFactory';

const PROPERTY_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd7994390ee');

const withImages = (overrides: Record<string, unknown> = {}) =>
    validPersistencePayload({
        title: 'Casa sindicada',
        images: [imageAsset('syn-1')],
        ...overrides
    });

// In-memory stand-in for the BullMQ queue (tests never touch Redis)
const enqueued: Array<{ data: { propertyId: string; channel: string; action: string }; jobId: string }> = [];
const fakeQueue = {
    enqueue: async (data: any, jobId: string) => { enqueued.push({ data, jobId }); },
    close: async () => {}
};

function configureWithDeps(): void {
    const deps: SyndicationDeps = {
        queue: fakeQueue,
        jobLogs: JobLogRepositoryFactory.getRepository(),
        channels: new Map([
            ['xml-feed', { name: 'xml-feed', validate: () => ({ ok: true }), publish: async () => ({}) } as any]
        ]),
        properties: PropertyRepositoryFactory.getRepository()
    };
    configureSyndication(deps);
}

async function seedAttempt(
    jobId: string,
    channel: string,
    attempt: number,
    status: string,
    updatedAt: Date,
    overrides: Record<string, unknown> = {}
): Promise<void> {
    await JobLog.create({
        jobId,
        channel,
        propertyId: PROPERTY_ID,
        propertyTitle: 'Casa sindicada',
        status,
        attempt,
        durationMs: 120,
        error: '',
        externalRef: '',
        createdAt: updatedAt,
        updatedAt,
        ...overrides
    });
}

describe('Admin syndication endpoints', () => {
    let admin: any;
    let editor: any;

    beforeEach(async () => {
        await Property.create(withImages({ _id: PROPERTY_ID }));
        admin = await createTestUser({ role: 'admin' });
        editor = await createTestUser({ role: 'editor' });
        enqueued.length = 0;
    });

    afterEach(() => {
        configureSyndication(null);
    });

    describe('GET /api/admin/syndication/status', () => {
        it('requires authentication', async () => {
            const res = await request(app).get('/api/admin/syndication/status');
            expect(res.status).toBe(401);
        });

        it('requires admin role', async () => {
            const res = await request(app).get('/api/admin/syndication/status').set(authHeader(editor));
            expect(res.status).toBe(403);
        });

        it('returns the latest attempt per property × channel', async () => {
            await seedAttempt('publish-p-1-meta-graph', 'meta-graph', 1, 'retrying', new Date('2026-09-07T10:00:00Z'));
            await seedAttempt('publish-p-1-meta-graph', 'meta-graph', 2, 'success', new Date('2026-09-07T10:05:00Z'), {
                externalRef: 'fb_123',
                durationMs: 800
            });
            await seedAttempt('publish-p-1-xml-feed', 'xml-feed', 3, 'failed', new Date('2026-09-07T11:00:00Z'), {
                error: 'feed timeout'
            });

            const res = await request(app).get('/api/admin/syndication/status').set(authHeader(admin));

            expect(res.status).toBe(200);
            expect(res.body.entries).toHaveLength(2);
            // la aggregation conserva solo el intento más nuevo por par
            const meta = res.body.entries.find((e: any) => e.channel === 'meta-graph');
            expect(meta.status).toBe('success');
            expect(meta.attempt).toBe(2);
            expect(meta.externalRef).toBe('fb_123');
            const xml = res.body.entries.find((e: any) => e.channel === 'xml-feed');
            expect(xml.status).toBe('failed');
            expect(xml.error).toBe('feed timeout');
            // ordenado por último intento, el más nuevo primero
            expect(res.body.entries[0].channel).toBe('xml-feed');
            // flags de configuración para la UI del tablero
            expect(res.body).toHaveProperty('enabled');
            expect(res.body).toHaveProperty('channels');
            expect(res.body).toHaveProperty('boardEnabled');
        });
    });

    describe('POST /api/admin/syndication/retry', () => {
        it('rejects an unknown channel', async () => {
            configureWithDeps();
            const res = await request(app)
                .post('/api/admin/syndication/retry')
                .set(authHeader(admin))
                .send({ propertyId: String(PROPERTY_ID), channel: 'carrier-pigeon' });
            expect(res.status).toBe(400);
        });

        it('returns 404 for a missing property', async () => {
            configureWithDeps();
            const res = await request(app)
                .post('/api/admin/syndication/retry')
                .set(authHeader(admin))
                .send({ propertyId: new mongoose.Types.ObjectId().toHexString(), channel: 'xml-feed' });
            expect(res.status).toBe(404);
        });

        it('returns 503 when syndication is not configured', async () => {
            const res = await request(app)
                .post('/api/admin/syndication/retry')
                .set(authHeader(admin))
                .send({ propertyId: String(PROPERTY_ID), channel: 'xml-feed' });
            expect(res.status).toBe(503);
        });

        it('re-enqueues a fresh job and logs it as queued', async () => {
            configureWithDeps();
            const res = await request(app)
                .post('/api/admin/syndication/retry')
                .set(authHeader(admin))
                .send({ propertyId: String(PROPERTY_ID), channel: 'xml-feed' });

            expect(res.status).toBe(200);
            expect(enqueued).toHaveLength(1);
            expect(enqueued[0].data).toMatchObject({ propertyId: String(PROPERTY_ID), channel: 'xml-feed', action: 'publish' });
            // el reintento manual no debe colisionar con el id del job original (dedupe de BullMQ)
            expect(enqueued[0].jobId).toMatch(new RegExp(`^publish-${PROPERTY_ID}-\\d+-xml-feed-r\\d+$`));

            const log = await JobLog.findOne({ jobId: enqueued[0].jobId }).lean();
            expect(log?.status).toBe('queued');
            expect(log?.propertyTitle).toBe('Casa sindicada');
        });

        it('retries an unpublish for a soft-deleted property (repo hides it, title comes from JobLog)', async () => {
            await Property.updateOne({ _id: PROPERTY_ID }, { $set: { deletedAt: new Date() } });
            await seedAttempt('publish-p-1-meta-graph', 'meta-graph', 1, 'success', new Date('2026-09-07T10:00:00Z'), {
                externalRef: 'fb_999'
            });
            configureWithDeps();

            const res = await request(app)
                .post('/api/admin/syndication/retry')
                .set(authHeader(admin))
                .send({ propertyId: String(PROPERTY_ID), channel: 'xml-feed', action: 'unpublish' });

            expect(res.status).toBe(200);
            expect(enqueued[0].data).toMatchObject({ action: 'unpublish' });
            expect(enqueued[0].jobId).toMatch(/^unpublish-/);
            const log = await JobLog.findOne({ jobId: enqueued[0].jobId }).lean();
            expect(log?.status).toBe('queued');
        });
    });
});
