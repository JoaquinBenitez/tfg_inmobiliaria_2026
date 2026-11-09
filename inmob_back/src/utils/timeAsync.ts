import { performance } from 'perf_hooks';
import { logger } from '../config/logger';

export interface TimeAsyncLabels {
    [key: string]: unknown;
}

export interface TimeAsyncResult<T> {
    status: 'success' | 'error';
    durationMs: number;
    value?: T;
    error?: Error;
}

/**
 * Envuelve una operación async, mide su duración y emite un log estructurado
 * con durationMs y status. Devuelve el error en el resultado para que los
 * llamadores conserven el control del manejo de errores. Lo usan los jobs de
 * sindicación (Fase 3) para el Requisito 3 (tiempos de ejecución de publicación
 * + log del estado de sync).
 */
export async function timeAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    labels?: TimeAsyncLabels
): Promise<TimeAsyncResult<T>> {
    const start = performance.now();
    try {
        const value = await fn();
        const durationMs = Math.round(performance.now() - start);
        logger.info({ operation, durationMs, status: 'success', ...labels }, `${operation} completed`);
        return { status: 'success', durationMs, value };
    } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error({ operation, durationMs, status: 'error', errorMessage: error.message, ...labels }, `${operation} failed`);
        return { status: 'error', durationMs, error };
    }
}

/**
 * Como timeAsync pero relanza el error después de loguearlo (para llamadores que
 * quieren el registro de tiempos Y que la excepción se propague).
 */
export async function timeAsyncThrow<T>(
    operation: string,
    fn: () => Promise<T>,
    labels?: TimeAsyncLabels
): Promise<T> {
    const result = await timeAsync(operation, fn, labels);
    if (result.status === 'error' && result.error) {
        throw result.error;
    }
    return result.value as T;
}
