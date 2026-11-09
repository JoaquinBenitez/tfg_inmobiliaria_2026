import { Request, Response, NextFunction } from 'express';
import { JOB_CHANNELS, JobChannel } from '../domain/syndicationTypes';
import { PermanentSyndicationError } from '../domain/appError';
import { env } from '../config/env';
import { JobLogRepositoryFactory } from '../infrastructure/jobLogRepositoryFactory';
import { syndicationConfigured, retryPublication } from '../application/syndicationService';

const getRepo = () => JobLogRepositoryFactory.getRepository();

/**
 * Snapshot del tablero de publicación: último intento de JobLog por (propiedad, canal)
 * más los flags de configuración de sindicación que necesita la UI. Solo admin.
 */
export async function getSyndicationStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const entries = await getRepo().findLatestPerPropertyChannel();
        res.json({
            enabled: syndicationConfigured(),
            channels: env.SYNDICATION_CHANNELS,
            boardEnabled: env.QUEUE_BOARD_TOKEN.length > 0,
            entries
        });
    } catch (error) {
        next(error);
    }
}

/** Reintento / republicación manual desde el tablero (re-encola un job fresco). */
export async function retrySyndicationPublication(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { propertyId, channel, action } = req.body ?? {};
    if (typeof propertyId !== 'string' || propertyId.length === 0) {
        res.status(400).json({ message: 'propertyId is required' });
        return;
    }
    if (typeof channel !== 'string' || !JOB_CHANNELS.includes(channel as JobChannel)) {
        res.status(400).json({ message: `channel must be one of: ${JOB_CHANNELS.join(', ')}` });
        return;
    }
    if (action !== undefined && action !== 'publish' && action !== 'unpublish') {
        res.status(400).json({ message: 'action must be publish or unpublish' });
        return;
    }
    if (!syndicationConfigured()) {
        res.status(503).json({ message: 'Syndication is disabled (SYNDICATION_CHANNELS empty or worker not running)' });
        return;
    }
    try {
        await retryPublication(propertyId, channel as JobChannel, action ?? 'publish');
        res.json({ message: 'Job re-enqueued' });
    } catch (error) {
        if (error instanceof PermanentSyndicationError) {
            const notFound = error.message.startsWith('Property not found');
            res.status(notFound ? 404 : 400).json({ message: error.message });
            return;
        }
        next(error);
    }
}
