import { Router } from 'express';
import { PropertyRepositoryFactory } from '../infrastructure/propertyRepositoryFactory';
import { toCanonicalItem } from '../services/syndication/canonicalFeed';
import { renderXmlFeed } from '../services/syndication/xmlFeedAdapter';
import { renderJsonFeed } from '../services/syndication/jsonFeedAdapter';
import { env } from '../config/env';

const router = Router();

const CACHE_TTL_MS = 15 * 60 * 1000;

type FeedFormat = 'xml' | 'json';

// ponytail: caché TTL en memoria, una entrada por formato. Asume proceso único;
// cambiar por un store compartido si la API alguna vez escala horizontal.
const cache: Record<FeedFormat, { body: string; expires: number } | undefined> = {
    xml: undefined,
    json: undefined
};

async function getFeedBody(format: FeedFormat): Promise<string> {
    const hit = cache[format];
    if (hit && hit.expires > Date.now()) return hit.body;

    const repo = PropertyRepositoryFactory.getRepository();
    // Política del feed: publicitar solo propiedades disponibles — las reservadas están
    // por cerrar y las vendidas deben desaparecer de los portales.
    const properties = await repo.findByCriteria({ status: 'available' });
    const items = properties
        .map(property => toCanonicalItem(property, env.PUBLIC_SITE_URL))
        .sort((a, b) => b.fechaActualizacion.localeCompare(a.fechaActualizacion));

    const body = format === 'xml' ? renderXmlFeed(items) : renderJsonFeed(items);
    cache[format] = { body, expires: Date.now() + CACHE_TTL_MS };
    return body;
}

router.get('/properties.xml', (req, res, next) => {
    getFeedBody('xml')
        .then(body => {
            res.set('Cache-Control', 'public, max-age=900');
            res.type('application/xml');
            res.send(body);
        })
        .catch(next);
});

router.get('/properties.json', (req, res, next) => {
    getFeedBody('json')
        .then(body => {
            res.set('Cache-Control', 'public, max-age=900');
            res.type('application/json');
            res.send(body);
        })
        .catch(next);
});

export default router;
