export interface FieldError {
    field: string;
    message: string;
}

export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly extra?: Record<string, unknown>;

    constructor(statusCode: number, message: string, code: string, extra?: Record<string, unknown>) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.extra = extra;
    }
}

export class BadRequestError extends AppError {
    constructor(message: string, extra?: Record<string, unknown>) {
        super(400, message, 'BAD_REQUEST', extra);
        this.name = 'BadRequestError';
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(404, message, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class ValidationFailedError extends AppError {
    readonly errors: FieldError[];

    constructor(errors: FieldError[]) {
        super(400, 'Validation failed', 'VALIDATION_FAILED');
        this.name = 'ValidationFailedError';
        this.errors = errors;
    }
}

/**
 * Taxonomía de errores de sindicación (Fase 3). Los adaptadores lanzan estas para
 * indicar cómo reaccionar: los errores reintentables se reintentan con backoff
 * exponencial, los permanentes van a dead-letter inmediatamente sin quemar intentos.
 */
export class RetryableSyndicationError extends Error {
    /** Pista opcional de delay que la estrategia de backoff de la cola debe respetar */
    readonly retryAfterMs?: number;

    constructor(message: string, retryAfterMs?: number) {
        super(message);
        this.name = 'RetryableSyndicationError';
        this.retryAfterMs = retryAfterMs;
    }
}

export class PermanentSyndicationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PermanentSyndicationError';
    }
}
