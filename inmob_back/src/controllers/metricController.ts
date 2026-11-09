import { Request, Response } from 'express';
import { AppError, ValidationFailedError } from '../domain/appError';
import { METRIC_NAMES } from '../domain/metricTypes';
import { MetricRepositoryFactory } from '../infrastructure/metricRepositoryFactory';
import { metricService } from '../application/metricService';
import { logger } from '../config/logger';

const getRepo = () => MetricRepositoryFactory.getRepository();

function sendAppError(res: Response, error: AppError): void {
    const body: Record<string, unknown> = { message: error.message, ...(error.extra ?? {}) };
    if (error instanceof ValidationFailedError) {
        body.errors = error.errors;
    }
    res.status(error.statusCode).json(body);
}

/**
 * Ingere un lote de métricas Core Web Vitals / FPS (público, rate-limited)
 * @route POST /metrics
 */
export const ingestMetrics = async (req: Request, res: Response) => {
    try {
        const userAgent = req.headers['user-agent'] ?? '';
        const connectionHeader = req.headers['connection'] ?? '';
        const effectiveType = (req.headers['ect'] as string | undefined) ?? '';
        const connection = effectiveType || connectionHeader;

        const inserted = await metricService.ingest(getRepo(), req.body, {
            userAgent: String(userAgent).slice(0, 500),
            connection: String(connection).slice(0, 100)
        });

        res.status(201).json({ inserted });
    } catch (error) {
        if (error instanceof AppError) return sendAppError(res, error);
        logger.error({ err: error }, 'Error ingesting metrics');
        res.status(500).json({
            message: 'Error ingesting metrics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Resumen de métricas agregadas para la demo de la defensa (solo admin)
 * @route GET /metrics/summary?metric=LCP&pagePath=/venta&days=7
 */
export const getMetricsSummary = async (req: Request, res: Response) => {
    try {
        const { metric, pagePath } = req.query;
        const days = Math.max(1, Math.min(365, parseInt(String(req.query.days ?? '7'), 10) || 7));

        if (metric !== undefined && !(METRIC_NAMES as readonly string[]).includes(String(metric))) {
            res.status(400).json({ message: `metric must be one of: ${METRIC_NAMES.join(', ')}` });
            return;
        }
        if (pagePath !== undefined && (typeof pagePath !== 'string' || !pagePath.startsWith('/'))) {
            res.status(400).json({ message: 'pagePath must start with "/"' });
            return;
        }

        const summary = await metricService.getSummary(getRepo(), {
            metric: metric ? String(metric) : undefined,
            pagePath: pagePath ? String(pagePath) : undefined,
            since: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        });

        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error building metrics summary');
        res.status(500).json({
            message: 'Error building metrics summary',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
