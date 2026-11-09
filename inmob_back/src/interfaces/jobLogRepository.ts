import { JobChannel, JobStatus } from '../domain/syndicationTypes';

export interface JobLogAttemptRecord {
    jobId: string;
    channel: JobChannel;
    propertyId: string;
    propertyTitle: string;
    status: JobStatus;
    attempt: number;
    durationMs?: number;
    error?: string;
    externalRef?: string;
}

export interface JobLogSuccess {
    externalRef: string;
    propertyTitle: string;
}

/** Último intento por (propiedad, canal) — una fila del tablero de publicación */
export interface JobLogDashboardEntry {
    jobId: string;
    propertyId: string;
    propertyTitle: string;
    channel: JobChannel;
    status: JobStatus;
    attempt: number;
    durationMs: number;
    error: string;
    externalRef: string;
    lastAttemptAt: Date;
}

/**
 * Puerto: log de trazabilidad de los intentos de sindicación (Requisito 3 — tiempos
 * de ejecución de publicación + estado de sync). Un documento por (job, intento).
 */
export interface JobLogRepository {
    /** Upsert idempotente sobre (jobId, attempt) — un reintento doble no puede duplicar filas de auditoría */
    recordAttempt(record: JobLogAttemptRecord): Promise<void>;
    /** Último éxito de una propiedad+canal — fuente del externalRef que usa el unpublish */
    findLatestSuccess(propertyId: string, channel: JobChannel): Promise<JobLogSuccess | null>;
    /** Éxitos de un canal dentro de la ventana — alimenta el presupuesto de publicación de Meta de 24 h */
    countRecentSuccesses(channel: JobChannel, sinceMs: number): Promise<number>;
    /** Último intento por (propiedad, canal) para el tablero de publicación */
    findLatestPerPropertyChannel(): Promise<JobLogDashboardEntry[]>;
}
