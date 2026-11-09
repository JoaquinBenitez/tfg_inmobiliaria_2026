import { PropertyEntity } from '../domain/property';
import { JobChannel, SYNDICATION_MAX_ATTEMPTS, META_DAILY_BUDGET, META_BUDGET_WINDOW_MS, META_BUDGET_RETRY_AFTER_MS } from '../domain/syndicationTypes';
import { PermanentSyndicationError, RetryableSyndicationError } from '../domain/appError';
import { SyndicationChannel } from '../interfaces/syndicationChannel';
import { SyndicationQueue, SyndicationJobData, SyndicationAction } from '../interfaces/syndicationQueue';
import { JobLogRepository } from '../interfaces/jobLogRepository';
import { PropertyRepository } from '../interfaces/propertyRepository';
import { timeAsync } from '../utils/timeAsync';
import { logger } from '../config/logger';

/**
 * Dependencias resueltas por la raíz de composición (server.ts vía el bootstrap
 * del worker). La capa de aplicación nunca toca BullMQ ni Mongoose directamente.
 */
export interface SyndicationDeps {
    queue: SyndicationQueue;
    jobLogs: JobLogRepository;
    channels: Map<JobChannel, SyndicationChannel>;
    properties: Pick<PropertyRepository, 'findById'>;
}

let deps: SyndicationDeps | null = null;

/** Conecta (o desconecta con null) las dependencias de sindicación. */
export function configureSyndication(next: SyndicationDeps | null): void {
    deps = next;
}

export function syndicationConfigured(): boolean {
    return deps !== null;
}

/**
 * Clave de idempotencia: un cambio en la propiedad (bump de createdAt/updatedAt)
 * produce un nuevo id de job por canal+acción; BullMQ deduplica ids idénticos
 * que sigan en la cola.
 */
export function buildJobId(propertyId: string, updatedAt: Date | string, channel: JobChannel, action: SyndicationAction): string {
    // Separador '-': BullMQ prohíbe ':' en ids de job custom (separador de claves de Redis)
    return `${action}-${propertyId}-${new Date(updatedAt).getTime()}-${channel}`;
}

/**
 * Backoff exponencial con jitter: delay = 2^intento × base + jitter, con tope.
 * Una pista retryAfterMs (p. ej. el presupuesto diario de Meta) pisa la curva.
 */
export function backoffDelayMs(attemptsMade: number, retryAfterMs?: number): number {
    if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
    const jitter = Math.floor(Math.random() * 5000);
    return Math.min(2 ** attemptsMade * 10_000 + jitter, 6 * 60 * 60 * 1000);
}

/** Estado de un intento fallido: dead-letter si es final O permanente; si no, reintentando. */
export function resolveAttemptStatus(attempt: number, totalAttempts: number, permanent: boolean): 'retrying' | 'failed' {
    return attempt >= totalAttempts || permanent ? 'failed' : 'retrying';
}

export interface ProcessedJob {
    jobId: string;
    data: SyndicationJobData;
    /** Número de intento (base 1) */
    attempt: number;
    totalAttempts?: number;
}

/**
 * Encola un job por cada canal habilitado para una propiedad guardada. Fire-and-forget:
 * los llamadores nunca esperan esto en el camino del request; los fallos se loguean, nunca se lanzan.
 */
export async function onPropertySaved(property: PropertyEntity): Promise<void> {
    await enqueueAll(property, 'publish');
}

/** Propiedad con soft delete: los canales push necesitan un unpublish explícito; los feeds se auto-reparan. */
export async function onPropertyDeleted(property: PropertyEntity): Promise<void> {
    await enqueueAll(property, 'unpublish');
}

/**
 * Re-encolado manual desde el botón Reintentar del tablero de publicación. Usa un
 * id de job fresco (sufijo `-r<ts>`): BullMQ deduplica ids de job, así que re-agregar
 * el id original mientras está en el set de fallados se ignoraría en silencio.
 */
export async function retryPublication(
    propertyId: string,
    channel: JobChannel,
    action: SyndicationAction = 'publish'
): Promise<void> {
    if (!deps) throw new PermanentSyndicationError('Syndication not configured');
    if (!deps.channels.has(channel)) {
        throw new PermanentSyndicationError(`Channel not enabled: ${channel}`);
    }
    let propertyTitle = '';
    let updatedAt: Date | string;
    if (action === 'unpublish') {
        // El unpublish funciona sobre propiedades con soft delete — el repo las oculta,
        // así que el título se lee del snapshot del último éxito en vez del documento.
        const latest = await deps.jobLogs.findLatestSuccess(propertyId, channel);
        propertyTitle = latest?.propertyTitle ?? '';
        updatedAt = new Date();
    } else {
        const property = await deps.properties.findById(propertyId);
        if (!property) {
            throw new PermanentSyndicationError(`Property not found or deleted: ${propertyId}`);
        }
        propertyTitle = property.title;
        updatedAt = property.updatedAt;
    }
    const jobId = `${buildJobId(propertyId, updatedAt, channel, action)}-r${Date.now()}`;
    await deps.queue.enqueue({ propertyId, channel, action }, jobId);
    await deps.jobLogs.recordAttempt({
        jobId,
        channel,
        propertyId,
        propertyTitle,
        status: 'queued',
        attempt: 0
    });
}

async function enqueueAll(property: PropertyEntity, action: SyndicationAction): Promise<void> {
    if (!deps) return;
    for (const [channel] of deps.channels) {
        const jobId = buildJobId(property.id, property.updatedAt, channel, action);
        try {
            await deps.queue.enqueue({ propertyId: property.id, channel, action }, jobId);
            await deps.jobLogs.recordAttempt({
                jobId,
                channel,
                propertyId: property.id,
                propertyTitle: property.title,
                status: 'queued',
                attempt: 0
            });
        } catch (err) {
            logger.error({ err, jobId, channel, action }, 'Failed to enqueue syndication job');
        }
    }
}

/**
 * Procesa un intento de un job de sindicación. Persiste una fila de JobLog por intento
 * (Requisito 3) y relanza para que la capa de cola decida reintento vs dead-letter:
 * PermanentSyndicationError → sin más reintentos, cualquier otra → reintento con backoff.
 */
export async function processSyndicationJob(job: ProcessedJob): Promise<void> {
    if (!deps) throw new Error('Syndication not configured');
    const { jobId, data } = job;
    const totalAttempts = job.totalAttempts ?? SYNDICATION_MAX_ATTEMPTS;
    const adapter = deps.channels.get(data.channel);
    if (!adapter) {
        throw new PermanentSyndicationError(`Channel not enabled: ${data.channel}`);
    }

    let propertyTitle = '';
    let durationMs = 0;
    try {
        const operation = async (): Promise<{ externalRef?: string }> => {
            if (data.action === 'unpublish') {
                const latest = await deps!.jobLogs.findLatestSuccess(data.propertyId, data.channel);
                if (!latest || !adapter.unpublish) return {}; // nunca se publicó nada externamente
                propertyTitle = latest.propertyTitle;
                await adapter.unpublish(latest.externalRef);
                return {};
            }
            const property = await deps!.properties.findById(data.propertyId);
            if (!property) {
                throw new PermanentSyndicationError(`Property not found or deleted: ${data.propertyId}`);
            }
            propertyTitle = property.title;
            const validation = adapter.validate(property);
            if (!validation.ok) {
                throw new PermanentSyndicationError(`Channel ${data.channel} missing: ${validation.missing.join(', ')}`);
            }
            if (data.channel === 'meta-graph') {
                await assertMetaBudget();
            }
            return adapter.publish(property);
        };

        const timed = await timeAsync(`syndication:${data.channel}:${data.action}`, operation, {
            jobId,
            channel: data.channel,
            propertyId: data.propertyId
        });
        durationMs = timed.durationMs;
        if (timed.status === 'error' && timed.error) throw timed.error;

        await deps.jobLogs.recordAttempt({
            jobId,
            channel: data.channel,
            propertyId: data.propertyId,
            propertyTitle,
            status: 'success',
            attempt: job.attempt,
            durationMs,
            externalRef: timed.value?.externalRef ?? ''
        });
    } catch (err) {
        const permanent = err instanceof PermanentSyndicationError;
        const status = resolveAttemptStatus(job.attempt, totalAttempts, permanent);
        await deps.jobLogs.recordAttempt({
            jobId,
            channel: data.channel,
            propertyId: data.propertyId,
            propertyTitle,
            status,
            attempt: job.attempt,
            durationMs,
            error: err instanceof Error ? err.message : String(err)
        });
        throw err;
    }
}

/** Difiere cuando el presupuesto de publicación de 24 h de Meta está cerca de agotarse (plan §2.3). */
async function assertMetaBudget(): Promise<void> {
    const successes = await deps!.jobLogs.countRecentSuccesses('meta-graph', META_BUDGET_WINDOW_MS);
    if (successes >= META_DAILY_BUDGET) {
        throw new RetryableSyndicationError(
            `Meta daily publish budget reached (${successes} in the last 24 h)`,
            META_BUDGET_RETRY_AFTER_MS
        );
    }
}
