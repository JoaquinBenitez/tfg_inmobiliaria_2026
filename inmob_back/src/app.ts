import express from 'express';
import path from 'path';
import routes from './routes';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { env, isDevelopment, isProduction, isTest } from './config/env';
import { logger } from './config/logger';
import { generalLimiter } from './middleware/rateLimiter';

const app = express();

// Log de requests con correlation IDs (se salta en test para mantener limpia la salida)
if (!isTest()) {
    app.use(pinoHttp({
        logger,
        genReqId: (req, res) => {
            const existing = req.headers['x-request-id'];
            if (typeof existing === 'string' && existing.length > 0) return existing;
            const id = randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
        },
        autoLogging: {
            // Endpoints de alta frecuencia y baja señal: mantener usable la consola
            ignore: (req) => req.url === '/api/health' || req.url === '/api/metrics'
        },
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        }
    }));
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de CORS dependiente del entorno
export const corsOptions: cors.CorsOptions = {
    origin: isDevelopment()
        ? ['http://localhost:3001', 'http://localhost:3000']
        : process.env.FRONTEND_URLS?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Aplicar rate limiting general a todos los requests
app.use(generalLimiter);

// Headers de seguridad
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    if (isProduction()) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
});

// Servido de archivos estáticos para imágenes locales (solo con storage local)
if (env.IMAGE_STORAGE_TYPE === 'local') {
    const uploadsPath = process.env.UPLOADS_BASE_DIR || path.join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsPath, {
        maxAge: '7d', // Cachear imágenes 7 días
        etag: true,
        lastModified: true
    }));
    if (isDevelopment()) {
        logger.info({ uploadsPath }, 'Static file serving enabled for local images');
    }
}

// Health check (antes de las rutas, lo salta el rate limiter)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Rutas
app.use('/api', routes);

// Manejador de errores global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const log = (req as any).log ?? logger;
    log.error({ err: error }, 'Global error handler');

    if (isDevelopment()) {
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            stack: error.stack
        });
    } else {
        res.status(500).json({
            message: 'Internal server error'
        });
    }
});

export default app;
