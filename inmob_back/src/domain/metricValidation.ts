import { FieldError } from './appError';
import {
    MetricBatch,
    METRIC_NAMES,
    MAX_BATCH_SIZE,
    MAX_PAGE_PATH_LENGTH,
    MAX_SESSION_ID_LENGTH,
    MAX_DETAIL_KEYS,
    isMetricName,
    isRating
} from './metricTypes';

export function validateMetricBatch(data: unknown): FieldError[] {
    const errors: FieldError[] = [];

    if (typeof data !== 'object' || data === null) {
        return [{ field: 'body', message: 'Request body must be an object' }];
    }

    const body = data as Record<string, unknown>;

    if (typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0) {
        errors.push({ field: 'sessionId', message: 'sessionId is required and must be a non-empty string' });
    } else if (body.sessionId.length > MAX_SESSION_ID_LENGTH) {
        errors.push({ field: 'sessionId', message: `sessionId must not exceed ${MAX_SESSION_ID_LENGTH} characters` });
    }

    if (!Array.isArray(body.metrics) || body.metrics.length === 0) {
        errors.push({ field: 'metrics', message: 'metrics is required and must be a non-empty array' });
        return errors;
    }

    if (body.metrics.length > MAX_BATCH_SIZE) {
        errors.push({ field: 'metrics', message: `metrics must not exceed ${MAX_BATCH_SIZE} items per batch` });
        return errors;
    }

    body.metrics.forEach((item: unknown, index: number) => {
        const prefix = `metrics[${index}]`;

        if (typeof item !== 'object' || item === null) {
            errors.push({ field: prefix, message: 'Metric must be an object' });
            return;
        }

        const metric = item as Record<string, unknown>;

        if (!isMetricName(metric.metric)) {
            errors.push({ field: `${prefix}.metric`, message: `metric must be one of: ${METRIC_NAMES.join(', ')}` });
        }

        if (typeof metric.value !== 'number' || !Number.isFinite(metric.value) || metric.value < 0) {
            errors.push({ field: `${prefix}.value`, message: 'value must be a finite number >= 0' });
        }

        if (!isRating(metric.rating)) {
            errors.push({ field: `${prefix}.rating`, message: 'rating must be one of: good, needs-improvement, poor' });
        }

        if (typeof metric.pagePath !== 'string' || metric.pagePath.trim().length === 0) {
            errors.push({ field: `${prefix}.pagePath`, message: 'pagePath is required and must be a non-empty string' });
        } else if (metric.pagePath.length > MAX_PAGE_PATH_LENGTH) {
            errors.push({ field: `${prefix}.pagePath`, message: `pagePath must not exceed ${MAX_PAGE_PATH_LENGTH} characters` });
        } else if (!metric.pagePath.startsWith('/')) {
            errors.push({ field: `${prefix}.pagePath`, message: 'pagePath must start with "/"' });
        }

        if (metric.detail !== undefined) {
            if (typeof metric.detail !== 'object' || metric.detail === null || Array.isArray(metric.detail)) {
                errors.push({ field: `${prefix}.detail`, message: 'detail must be an object of numeric values' });
            } else {
                const entries = Object.entries(metric.detail as Record<string, unknown>);
                if (entries.length > MAX_DETAIL_KEYS) {
                    errors.push({ field: `${prefix}.detail`, message: `detail must not exceed ${MAX_DETAIL_KEYS} keys` });
                }
                for (const [key, val] of entries) {
                    if (typeof val !== 'number' || !Number.isFinite(val)) {
                        errors.push({ field: `${prefix}.detail.${key}`, message: 'detail values must be finite numbers' });
                    }
                }
            }
        }
    });

    return errors;
}
