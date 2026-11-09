import { Worker, UnrecoverableError, type Job } from 'bullmq';
import {
    configureSyndication,
    processSyndicationJob,
    backoffDelayMs
} from '../../application/syndicationService';
import { PermanentSyndicationError } from '../../domain/appError';
import { SyndicationChannelFactory } from '../../services/syndication/syndicationChannelFactory';
import { JobLogRepositoryFactory } from '../jobLogRepositoryFactory';
import { PropertyRepositoryFactory } from '../propertyRepositoryFactory';
import {
    SyndicationQueueFactory,
    SYNDICATION_QUEUE_NAME,
    isSyndicationEnabled
} from './syndicationQueueFactory';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export interface SyndicationWorkerHandle {
    close(): Promise<void>;
}

/**
 * Arranca el worker de sindicación y conecta las dependencias de la capa de aplicación.
 * Se llama SOLO desde server.ts — app.ts queda import-safe para los tests.
 */
export function startSyndicationWorker(): SyndicationWorkerHandle | null {
    if (!isSyndicationEnabled()) {
        logger.info('Syndication worker disabled (SYNDICATION_CHANNELS empty or test env)');
        return null;
    }

    configureSyndication({
        queue: SyndicationQueueFactory.getQueue(),
        jobLogs: JobLogRepositoryFactory.getRepository(),
        channels: SyndicationChannelFactory.getChannels(),
        properties: PropertyRepositoryFactory.getRepository()
    });

    const worker = new Worker(
        SYNDICATION_QUEUE_NAME,
        async (job: Job) => {
            // BullMQ 6: attemptsMade es N-1 durante el intento N (verificado contra el código fuente)
            const attempt = job.attemptsMade + 1;
            try {
                await processSyndicationJob({
                    jobId: String(job.id),
                    data: job.data,
                    attempt,
                    totalAttempts: job.opts.attempts
                });
            } catch (err) {
                // Los errores permanentes van a dead-letter inmediatamente en vez de quemar reintentos
                if (err instanceof PermanentSyndicationError) {
                    throw new UnrecoverableError(err.message);
                }
                throw err;
            }
        },
        {
            connection: { url: env.REDIS_URL },
            settings: {
                // El tipo de backoff custom 'exponentialJitter' se resuelve acá (BullMQ 6:
                // los tipos no builtin caen a la única función de estrategia)
                backoffStrategy: (attemptsMade: number, _type?: string, err?: Error) =>
                    backoffDelayMs(attemptsMade, (err as { retryAfterMs?: number } | undefined)?.retryAfterMs)
            }
        }
    );

    worker.on('failed', (job, err) => {
        logger.warn({ jobId: job?.id, err: err.message }, 'Syndication job attempt failed');
    });
    worker.on('error', (err) => {
        logger.error({ err }, 'Syndication worker error');
    });
    logger.info({ queue: SYNDICATION_QUEUE_NAME }, 'Syndication worker started');

    return { close: () => worker.close() };
}
