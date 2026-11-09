import { Queue } from 'bullmq';
import { SyndicationQueue, SyndicationJobData } from '../../interfaces/syndicationQueue';
import { SYNDICATION_MAX_ATTEMPTS } from '../../domain/syndicationTypes';
import { env, isTest } from '../../config/env';

export const SYNDICATION_QUEUE_NAME = 'syndication';
/** Nombre de la estrategia de backoff custom — implementada en los settings del worker */
export const SYNDICATION_BACKOFF_STRATEGY = 'exponentialJitter';

export function isSyndicationEnabled(): boolean {
    return !isTest() && env.SYNDICATION_CHANNELS.length > 0;
}

/**
 * Instancia compartida de la Queue de BullMQ (singleton lazy). La usan tanto el
 * wrapper de encolado como el adaptador de Bull Board — una conexión Redis para
 * lecturas y escrituras.
 */
let rawQueue: Queue | null = null;
export function getRawQueue(): Queue {
    if (!rawQueue) {
        rawQueue = new Queue(SYNDICATION_QUEUE_NAME, {
            connection: { url: env.REDIS_URL }
        });
    }
    return rawQueue;
}

/** Objeto null: mantiene el camino del request sin efectos secundarios cuando la sindicación está deshabilitada */
class NullSyndicationQueue implements SyndicationQueue {
    enqueue(): Promise<void> {
        return Promise.resolve();
    }
    close(): Promise<void> {
        return Promise.resolve();
    }
}

class BullMqSyndicationQueue implements SyndicationQueue {
    private readonly queue = getRawQueue();

    async enqueue(data: SyndicationJobData, jobId: string): Promise<void> {
        await this.queue.add(data.action, data, {
            jobId,
            attempts: SYNDICATION_MAX_ATTEMPTS,
            backoff: { type: SYNDICATION_BACKOFF_STRATEGY, delay: 10_000 },
            removeOnComplete: { age: 24 * 60 * 60 },
            removeOnFail: { age: 7 * 24 * 60 * 60 }
        });
    }

    close(): Promise<void> {
        return this.queue.close();
    }
}

export class SyndicationQueueFactory {
    private static instance: SyndicationQueue | null = null;

    static getQueue(): SyndicationQueue {
        if (!this.instance) {
            this.instance = isSyndicationEnabled() ? new BullMqSyndicationQueue() : new NullSyndicationQueue();
        }
        return this.instance;
    }

    static resetInstance(): void {
        this.instance = null;
        rawQueue = null;
    }
}
