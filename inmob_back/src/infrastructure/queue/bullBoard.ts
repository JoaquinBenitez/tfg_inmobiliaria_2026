import { Request, Response, NextFunction, Express } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getRawQueue } from './syndicationQueueFactory';

export const QUEUE_BOARD_PATH = '/api/admin/queue-board';
const COOKIE_NAME = 'qb_token';

function readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1));
    }
    return undefined;
}

/**
 * Compuerta de token para la UI de Bull Board. El primer hit debe llevar
 * ?token=<QUEUE_BOARD_TOKEN> (amigable para bookmarks); luego setea una cookie
 * HttpOnly para que los sub-requests XHR del board pasen sin el token en la URL.
 */
function queueBoardGuard(req: Request, res: Response, next: NextFunction): void {
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = queryToken ?? readCookie(req, COOKIE_NAME);
    if (token !== env.QUEUE_BOARD_TOKEN) {
        res.status(401).json({ message: 'Queue board token required (?token=QUEUE_BOARD_TOKEN)' });
        return;
    }
    if (queryToken) {
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'lax',
            path: QUEUE_BOARD_PATH
        });
    }
    next();
}

/**
 * Monta el tablero de colas Bull Board. Deshabilitado (404 en cualquier path) salvo
 * que QUEUE_BOARD_TOKEN esté seteado — una UI de navegador no puede mandar headers
 * Bearer, así que la compuerta es un secreto compartido. Se llama solo desde server.ts:
 * crea la Queue de BullMQ (conexión Redis), lo cual app.ts nunca debe hacer (tests).
 */
export function mountQueueBoard(app: Express): void {
    if (!env.QUEUE_BOARD_TOKEN) {
        logger.info('Bull Board disabled (QUEUE_BOARD_TOKEN not set)');
        return;
    }
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(QUEUE_BOARD_PATH);
    createBullBoard({
        queues: [new BullMQAdapter(getRawQueue())],
        serverAdapter
    });
    app.use(QUEUE_BOARD_PATH, queueBoardGuard, serverAdapter.getRouter());
    logger.info({ path: QUEUE_BOARD_PATH }, 'Bull Board mounted');
}
