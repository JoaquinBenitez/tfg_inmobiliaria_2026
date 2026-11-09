import app, { corsOptions } from './app';
import { connectDB } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { startSyndicationWorker } from './infrastructure/queue/syndicationWorker';
import { SyndicationQueueFactory } from './infrastructure/queue/syndicationQueueFactory';
import { mountQueueBoard } from './infrastructure/queue/bullBoard';

// Conectar a la base de datos
connectDB();

// Worker de sindicación (no-op salvo que SYNDICATION_CHANNELS esté seteado y no sea test)
const worker = startSyndicationWorker();

// Tablero de colas Bull Board (no-op salvo que QUEUE_BOARD_TOKEN esté seteado)
mountQueueBoard(app);

app.listen(env.PORT, () => {
    logger.info(
        { port: env.PORT, mode: env.NODE_ENV, corsOrigins: corsOptions.origin },
        'Server started'
    );
});

// Apagado ordenado: dejar de aceptar jobs de sindicación, drenar el worker, cerrar la cola
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');
    try {
        await worker?.close();
        await SyndicationQueueFactory.getQueue().close();
    } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
    }
    process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught Exception');
    process.exit(1);
});
