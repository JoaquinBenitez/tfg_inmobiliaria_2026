import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import JobLog, { JOB_STATUSES, JOB_CHANNELS } from '../../../src/models/JobLog';

describe('JobLog model', () => {
    const baseJobLog = {
        jobId: 'job-123',
        channel: 'xml-feed',
        propertyId: new mongoose.Types.ObjectId(),
        status: 'queued',
        attempt: 0,
    };

    it('saves a valid job log with defaults', async () => {
        const doc = await JobLog.create(baseJobLog);

        expect(doc._id).toBeDefined();
        expect(doc.durationMs).toBe(0);
        expect(doc.error).toBe('');
    });

    it('rejects unknown statuses', async () => {
        await expect(JobLog.create({ ...baseJobLog, status: 'paused' })).rejects.toThrow();
    });

    it('rejects unknown channels', async () => {
        await expect(JobLog.create({ ...baseJobLog, channel: 'twitter' })).rejects.toThrow();
    });

    it('rejects negative attempts and durations', async () => {
        await expect(JobLog.create({ ...baseJobLog, attempt: -1 })).rejects.toThrow();
        await expect(JobLog.create({ ...baseJobLog, durationMs: -10 })).rejects.toThrow();
    });

    it('requires jobId, channel and propertyId', async () => {
        for (const field of ['jobId', 'channel', 'propertyId']) {
            const doc: Record<string, unknown> = { ...baseJobLog };
            delete doc[field];
            await expect(JobLog.create(doc)).rejects.toThrow();
        }
    });

    it('rejects duplicate (jobId, attempt) pairs (idempotent attempt logging)', async () => {
        await JobLog.create(baseJobLog);

        await expect(
            JobLog.create({ ...baseJobLog, error: 'retry double-fired' })
        ).rejects.toThrow(/duplicate/);
    });

    it('allows the same jobId across different attempts', async () => {
        await JobLog.create(baseJobLog);
        const retry = await JobLog.create({ ...baseJobLog, attempt: 1, status: 'retrying' });

        expect(retry.attempt).toBe(1);
    });

    it('stores a propertyTitle snapshot with a default', async () => {
        const doc = await JobLog.create(baseJobLog);
        expect(doc.propertyTitle).toBe('');

        const titled = await JobLog.create({ ...baseJobLog, attempt: 2, propertyTitle: 'Casa en Rosario' });
        expect(titled.propertyTitle).toBe('Casa en Rosario');
    });

    it('rejects error strings longer than 2000 characters', async () => {
        await expect(
            JobLog.create({ ...baseJobLog, attempt: 3, error: 'x'.repeat(2001) })
        ).rejects.toThrow(/2000/);
    });

    it('accepts every documented status and channel', async () => {
        for (const [i, status] of JOB_STATUSES.entries()) {
            const doc = await JobLog.create({
                ...baseJobLog,
                jobId: `job-${i}`,
                status,
                channel: JOB_CHANNELS[i % JOB_CHANNELS.length],
            });
            expect(doc.status).toBe(status);
        }
    });

    it('has indexes on {jobId, attempt} and {propertyId, channel, updatedAt}', () => {
        const indexKeys = JobLog.schema.indexes().map(([keys]) => JSON.stringify(keys));
        expect(indexKeys).toContain(JSON.stringify({ jobId: 1, attempt: 1 }));
        expect(indexKeys).toContain(JSON.stringify({ propertyId: 1, channel: 1, updatedAt: -1 }));
    });
});
