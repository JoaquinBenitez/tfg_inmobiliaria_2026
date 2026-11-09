import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    configureSyndication,
    onPropertySaved,
    onPropertyDeleted,
    processSyndicationJob,
    buildJobId,
    backoffDelayMs,
    resolveAttemptStatus,
    SyndicationDeps
} from '../../../src/application/syndicationService';
import { SyndicationQueue, SyndicationJobData } from '../../../src/interfaces/syndicationQueue';
import { JobLogRepository, JobLogAttemptRecord, JobLogSuccess } from '../../../src/interfaces/jobLogRepository';
import { SyndicationChannel, ChannelValidation, ChannelPublishResult } from '../../../src/interfaces/syndicationChannel';
import { JobChannel } from '../../../src/domain/syndicationTypes';
import { RetryableSyndicationError, PermanentSyndicationError } from '../../../src/domain/appError';
import { PropertyEntity } from '../../../src/domain/property';
import { makeProperty } from './canonicalFeed.test';

class FakeQueue implements SyndicationQueue {
    enqueued: Array<{ data: SyndicationJobData; jobId: string }> = [];
    failEnqueue = false;
    async enqueue(data: SyndicationJobData, jobId: string): Promise<void> {
        if (this.failEnqueue) throw new Error('redis down');
        this.enqueued.push({ data, jobId });
    }
    async close(): Promise<void> {}
}

class FakeJobLogs implements JobLogRepository {
    records: JobLogAttemptRecord[] = [];
    latestSuccess: JobLogSuccess | null = null;
    recentSuccesses = 0;
    async recordAttempt(record: JobLogAttemptRecord): Promise<void> {
        this.records.push(record);
    }
    async findLatestSuccess(): Promise<JobLogSuccess | null> {
        return this.latestSuccess;
    }
    async countRecentSuccesses(): Promise<number> {
        return this.recentSuccesses;
    }
}

class FakeChannel implements SyndicationChannel {
    readonly name: string;
    published: PropertyEntity[] = [];
    unpublished: string[] = [];
    publishError: Error | null = null;
    validation: ChannelValidation = { ok: true, missing: [] };
    externalRef = 'ext-1';

    constructor(name: string) {
        this.name = name;
    }
    validate(): ChannelValidation {
        return this.validation;
    }
    async publish(property: PropertyEntity): Promise<ChannelPublishResult> {
        if (this.publishError) throw this.publishError;
        this.published.push(property);
        return { externalRef: this.externalRef };
    }
    async unpublish(externalRef: string): Promise<void> {
        this.unpublished.push(externalRef);
    }
}

function makeDeps(overrides: Partial<SyndicationDeps> = {}): SyndicationDeps & {
    queue: FakeQueue;
    jobLogs: FakeJobLogs;
    channel: FakeChannel;
} {
    const queue = new FakeQueue();
    const jobLogs = new FakeJobLogs();
    const channel = new FakeChannel('meta-graph');
    const deps: SyndicationDeps = {
        queue,
        jobLogs,
        channels: new Map<JobChannel, SyndicationChannel>([['meta-graph', channel], ['xml-feed', new FakeChannel('xml-feed')]]),
        properties: { findById: async (id: string) => (id === 'missing' ? null : makeProperty({ id })) },
        ...overrides
    };
    return Object.assign(deps, { queue, jobLogs, channel });
}

const job = (overrides: Partial<{ jobId: string; propertyId: string; channel: JobChannel; action: 'publish' | 'unpublish'; attempt: number; totalAttempts: number }> = {}) => ({
    jobId: 'publish:1:1000:meta-graph',
    data: { propertyId: 'p1', channel: 'meta-graph' as JobChannel, action: 'publish' as const },
    attempt: 1,
    totalAttempts: 5,
    ...overrides
});

let deps: ReturnType<typeof makeDeps>;

beforeEach(() => {
    deps = makeDeps();
    configureSyndication(deps);
});

afterEach(() => {
    configureSyndication(null);
});

describe('pure helpers', () => {
    it('buildJobId encodes action, property, updatedAt and channel', () => {
        const id = buildJobId('p1', new Date('2026-09-05T12:00:00Z'), 'xml-feed', 'publish');
        expect(id).toBe(`publish-p1-${new Date('2026-09-05T12:00:00Z').getTime()}-xml-feed`);
        expect(buildJobId('p1', '2026-09-05T12:00:00.000Z', 'xml-feed', 'unpublish')).toBe(`unpublish-p1-${new Date('2026-09-05T12:00:00Z').getTime()}-xml-feed`);
    });

    it('backoffDelayMs grows exponentially with jitter and honors retry hints', () => {
        for (let i = 0; i < 50; i++) {
            const delay = backoffDelayMs(1);
            expect(delay).toBeGreaterThanOrEqual(20_000);
            expect(delay).toBeLessThan(25_000);
        }
        expect(backoffDelayMs(3, 12345)).toBe(12345);
        expect(backoffDelayMs(40)).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
    });

    it('resolveAttemptStatus dead-letters on final attempt or permanent errors', () => {
        expect(resolveAttemptStatus(1, 5, false)).toBe('retrying');
        expect(resolveAttemptStatus(5, 5, false)).toBe('failed');
        expect(resolveAttemptStatus(1, 5, true)).toBe('failed');
    });
});

describe('enqueue hooks', () => {
    it('enqueues one job per enabled channel with idempotency key and queued log', async () => {
        await onPropertySaved(makeProperty());

        expect(deps.queue.enqueued).toHaveLength(2);
        expect(deps.queue.enqueued.map(entry => entry.data.channel).sort()).toEqual(['meta-graph', 'xml-feed']);
        expect(deps.queue.enqueued[0].jobId).toMatch(/^publish-507f1f77bcf86cd799439011-\d+-(meta-graph|xml-feed)$/);
        expect(deps.jobLogs.records.filter(record => record.status === 'queued')).toHaveLength(2);
        expect(deps.jobLogs.records.every(record => record.attempt === 0)).toBe(true);
    });

    it('enqueue failures are swallowed (never break the request path)', async () => {
        deps.queue.failEnqueue = true;
        await expect(onPropertySaved(makeProperty())).resolves.toBeUndefined();
        expect(deps.jobLogs.records).toHaveLength(0);
    });

    it('is a no-op when syndication is not configured', async () => {
        configureSyndication(null);
        await expect(onPropertySaved(makeProperty())).resolves.toBeUndefined();
        await expect(onPropertyDeleted(makeProperty())).resolves.toBeUndefined();
    });

    it('soft delete enqueues unpublish jobs', async () => {
        await onPropertyDeleted(makeProperty());
        expect(deps.queue.enqueued.every(entry => entry.data.action === 'unpublish')).toBe(true);
    });
});

describe('processSyndicationJob', () => {
    it('records a success attempt with duration and externalRef', async () => {
        await processSyndicationJob(job());

        expect(deps.channel.published).toHaveLength(1);
        const success = deps.jobLogs.records.find(record => record.status === 'success');
        expect(success).toMatchObject({
            jobId: 'publish:1:1000:meta-graph',
            channel: 'meta-graph',
            attempt: 1,
            externalRef: 'ext-1',
            propertyTitle: 'Casa con jardín'
        });
        expect(success?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('throws permanent when the channel is not enabled', async () => {
        const result = processSyndicationJob(job({ data: { propertyId: 'p1', channel: 'json-feed', action: 'publish' } }));
        await expect(result).rejects.toBeInstanceOf(PermanentSyndicationError);
    });

    it('throws permanent when the property is missing or deleted', async () => {
        const missing = job({ data: { propertyId: 'missing', channel: 'meta-graph', action: 'publish' } });
        await expect(processSyndicationJob(missing)).rejects.toBeInstanceOf(PermanentSyndicationError);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'failed', attempt: 1 });
    });

    it('throws permanent when channel validation fails', async () => {
        deps.channel.validation = { ok: false, missing: ['images'] };
        await expect(processSyndicationJob(job())).rejects.toBeInstanceOf(PermanentSyndicationError);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'failed', error: expect.stringContaining('images') });
    });

    it('records retrying for a retryable failure with attempts left, and rethrows', async () => {
        deps.channel.publishError = new RetryableSyndicationError('rate limited');
        await expect(processSyndicationJob(job({ attempt: 1 }))).rejects.toBeInstanceOf(RetryableSyndicationError);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'retrying', attempt: 1, error: 'rate limited' });
    });

    it('records failed on the final attempt', async () => {
        deps.channel.publishError = new RetryableSyndicationError('still failing');
        await expect(processSyndicationJob(job({ attempt: 5, totalAttempts: 5 }))).rejects.toThrow();
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'failed', attempt: 5 });
    });

    it('records failed (not retrying) for permanent errors even with attempts left', async () => {
        deps.channel.publishError = new PermanentSyndicationError('bad token');
        await expect(processSyndicationJob(job({ attempt: 1 }))).rejects.toBeInstanceOf(PermanentSyndicationError);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'failed' });
    });

    it('defers meta-graph publishing when the daily budget is exhausted', async () => {
        deps.jobLogs.recentSuccesses = 20;
        const promise = processSyndicationJob(job());
        await expect(promise).rejects.toBeInstanceOf(RetryableSyndicationError);
        expect(deps.channel.published).toHaveLength(0);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'retrying', error: expect.stringContaining('budget') });
    });

    it('unpublish uses the latest success externalRef', async () => {
        deps.jobLogs.latestSuccess = { externalRef: 'ext-9', propertyTitle: 'Casa con jardín' };
        await processSyndicationJob(job({ data: { propertyId: 'p1', channel: 'meta-graph', action: 'unpublish' } }));
        expect(deps.channel.unpublished).toEqual(['ext-9']);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'success', propertyTitle: 'Casa con jardín' });
    });

    it('unpublish succeeds as a no-op when nothing was ever published', async () => {
        deps.jobLogs.latestSuccess = null;
        await processSyndicationJob(job({ data: { propertyId: 'p1', channel: 'meta-graph', action: 'unpublish' } }));
        expect(deps.channel.unpublished).toHaveLength(0);
        expect(deps.jobLogs.records.at(-1)).toMatchObject({ status: 'success' });
    });
});
