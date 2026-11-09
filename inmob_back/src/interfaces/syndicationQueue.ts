import { JobChannel } from '../domain/syndicationTypes';

export type SyndicationAction = 'publish' | 'unpublish';

export interface SyndicationJobData {
    propertyId: string;
    channel: JobChannel;
    action: SyndicationAction;
}

/**
 * Puerto: la cola de jobs en background. La capa de aplicación orquesta a través
 * de esta interface; el cableado de BullMQ vive exclusivamente en `src/infrastructure/queue/`.
 */
export interface SyndicationQueue {
    /** Encola un job; el `jobId` cumple también de clave de idempotencia (los ids duplicados se ignoran) */
    enqueue(data: SyndicationJobData, jobId: string): Promise<void>;
    close(): Promise<void>;
}
