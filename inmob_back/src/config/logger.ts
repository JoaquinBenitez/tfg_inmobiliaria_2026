import pino from 'pino';
import { isProduction, isTest } from './env';

/**
 * Logger estructurado (pino).
 * - consola: pretty-print en desarrollo, líneas JSON en producción
 * - archivo: logs/backend.log vía pino-roll — rota diario o a los 10MB (lo que
 *   llegue primero), conserva los 30 archivos más recientes
 * - test: silencioso (mantiene limpia la salida de test)
 * Sobreescribir con la variable de entorno LOG_LEVEL en cualquier entorno.
 */
const resolveLevel = (): string => {
    if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
    if (isTest()) return 'silent';
    return isProduction() ? 'info' : 'debug';
};

const consoleTarget = !isProduction()
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname', singleLine: true }
    }
    : { target: 'pino/file', options: { destination: 1 } }; // JSON a stdout

// Rotación diaria O a los 10MB, lo que llegue primero; count recorta a los 30 archivos más nuevos
const fileTarget = {
    target: 'pino-roll',
    options: {
        file: 'logs/backend.log',
        frequency: 'daily',
        limit: { size: '10m', count: 30 },
        mkdir: true
    }
};

export const logger = pino({
    level: resolveLevel(),
    // Adjuntar transports solo fuera de tests para evitar spawnear
    // worker threads durante las corridas de test (el nivel ahí es silent igualmente).
    ...(isTest() ? {} : { transport: { targets: [consoleTarget, fileTarget] } }),
    redact: {
        paths: [
            'password',
            '*.password',
            'token',
            '*.token',
            'access_token',
            '*.access_token',
            'req.headers.authorization',
            'req.headers.cookie'
        ],
        censor: '[REDACTED]'
    }
});

export default logger;
