import { describe, it, expect, vi } from 'vitest';
import {
    MetaGraphChannel,
    MetaGraphConfig,
    buildListingCaption,
    igImageUrl,
    classifyMetaError
} from '../../../src/services/syndication/metaGraphAdapter';
import { RetryableSyndicationError, PermanentSyndicationError } from '../../../src/domain/appError';
import { makeProperty } from './canonicalFeed.test';

const realConfig = (overrides: Partial<MetaGraphConfig> = {}): MetaGraphConfig => ({
    pageId: 'page-1',
    igUserId: 'ig-1',
    accessToken: 'token-1',
    graphVersion: 'v23.0',
    sandbox: false,
    ...overrides
});

/** Fetch stub: scripted responses in order; records every call. */
function fetchStub(responses: Array<{ status: number; body: unknown }>) {
    const calls: Array<{ url: string; method: string; body: any }> = [];
    const impl: typeof fetch = async (url, init) => {
        calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const next = responses.shift();
        if (!next) throw new Error('fetch stub exhausted');
        return new Response(JSON.stringify(next.body), {
            status: next.status,
            headers: { 'Content-Type': 'application/json' }
        });
    };
    return { impl, calls };
}

const mustNotFetch = async () => {
    throw new Error('fetch must not be called in sandbox mode');
};

describe('buildListingCaption', () => {
    it('contains title, price, location details and the detail link', () => {
        const caption = buildListingCaption(makeProperty(), 'https://inmob.test');
        expect(caption).toContain('Casa con jardín — Venta');
        expect(caption).toContain('USD 120.000');
        expect(caption).toContain('casa en Reconquista');
        expect(caption).toContain('140 m² · 3 dorm. · 2 baños');
        expect(caption).toContain('https://inmob.test/propiedades/507f1f77bcf86cd799439011');
    });

    it('uses Alquiler for rent listings', () => {
        expect(buildListingCaption(makeProperty({ listingType: 'rent' }), 'https://inmob.test')).toContain('Alquiler');
    });

    it('caps the caption at the Instagram limit', () => {
        const caption = buildListingCaption(
            makeProperty({ title: 'x'.repeat(3000), description: 'y'.repeat(3000) }),
            'https://inmob.test'
        );
        expect(caption.length).toBeLessThanOrEqual(2200);
    });
});

describe('igImageUrl', () => {
    it('adds a 4:5 crop transform to Cloudinary URLs', () => {
        expect(igImageUrl('https://res.cloudinary.com/demo/image/upload/v1/props/a.jpg'))
            .toBe('https://res.cloudinary.com/demo/image/upload/c_fill,ar_4:5/v1/props/a.jpg');
    });

    it('leaves non-Cloudinary URLs untouched', () => {
        expect(igImageUrl('http://localhost:3000/uploads/a.webp')).toBe('http://localhost:3000/uploads/a.webp');
    });
});

describe('classifyMetaError', () => {
    it('classifies rate limits and server errors as retryable', () => {
        for (const [status, code] of [[500], [429], [200, 4], [200, 17], [200, 32], [200, 613]] as const) {
            expect(classifyMetaError(status, code)).toBeInstanceOf(RetryableSyndicationError);
        }
    });

    it('classifies token/permission/validation errors as permanent', () => {
        for (const [status, code] of [[400], [200, 190], [200, 10]] as const) {
            expect(classifyMetaError(status, code)).toBeInstanceOf(PermanentSyndicationError);
        }
    });
});

describe('MetaGraphChannel', () => {
    it('validate flags missing images and missing targets (targets only outside sandbox)', () => {
        const noImages = new MetaGraphChannel(realConfig(), mustNotFetch);
        expect(noImages.validate(makeProperty({ images: [] })).missing).toContain('images');

        const noTargets = new MetaGraphChannel(realConfig({ pageId: '', igUserId: '' }), mustNotFetch);
        expect(noTargets.validate(makeProperty()).ok).toBe(false);
        expect(noTargets.validate(makeProperty()).missing.join()).toContain('META_PAGE_ID');

        // el dry-run del sandbox necesita cero credenciales de Meta — el camino de demo sin acceso de developer
        const sandboxNoTargets = new MetaGraphChannel(realConfig({ pageId: '', igUserId: '', sandbox: true }), mustNotFetch);
        expect(sandboxNoTargets.validate(makeProperty()).ok).toBe(true);
    });

    it('dry-runs in sandbox mode without calling the Graph API', async () => {
        const channel = new MetaGraphChannel(realConfig({ sandbox: true }), mustNotFetch);
        const result = await channel.publish(makeProperty());
        expect(result.externalRef).toBe('dry-run');
        await expect(channel.unpublish('dry-run')).resolves.toBeUndefined();
    });

    it('publishes a single-photo Facebook post', async () => {
        const { impl, calls } = fetchStub([{ status: 200, body: { post_id: 'fb-post-1', id: 'photo-1' } }]);
        const channel = new MetaGraphChannel(realConfig({ igUserId: '' }), impl);

        const result = await channel.publish(makeProperty({ images: makeProperty().images.slice(0, 1) }));

        expect(result.externalRef).toBe(JSON.stringify({ fbPostId: 'fb-post-1' }));
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://graph.facebook.com/v23.0/page-1/photos');
        expect(calls[0].body.caption).toContain('Casa con jardín — Venta');
        expect(calls[0].body.access_token).toBe('token-1');
    });

    it('publishes a Facebook multi-photo post via unpublished photos + feed', async () => {
        const { impl, calls } = fetchStub([
            { status: 200, body: { id: 'photo-1' } },
            { status: 200, body: { id: 'photo-2' } },
            { status: 200, body: { id: 'fb-post-2' } }
        ]);
        const channel = new MetaGraphChannel(realConfig({ igUserId: '' }), impl);

        const result = await channel.publish(makeProperty());

        expect(result.externalRef).toBe(JSON.stringify({ fbPostId: 'fb-post-2' }));
        expect(calls.map(call => call.url)).toEqual([
            'https://graph.facebook.com/v23.0/page-1/photos',
            'https://graph.facebook.com/v23.0/page-1/photos',
            'https://graph.facebook.com/v23.0/page-1/feed'
        ]);
        expect(calls[0].body.published).toBe(false);
        expect(calls[2].body.attached_media).toEqual([
            { media_fbid: 'photo-1' },
            { media_fbid: 'photo-2' }
        ]);
    });

    it('publishes an Instagram carousel (children → carousel container → publish)', async () => {
        const { impl, calls } = fetchStub([
            { status: 200, body: { id: 'child-1' } },
            { status: 200, body: { id: 'child-2' } },
            { status: 200, body: { id: 'carousel-1' } },
            { status: 200, body: { id: 'ig-media-1' } }
        ]);
        const channel = new MetaGraphChannel(realConfig({ pageId: '' }), impl);

        const result = await channel.publish(makeProperty());

        expect(result.externalRef).toBe(JSON.stringify({ igMediaId: 'ig-media-1' }));
        expect(calls[0].url).toContain('/ig-1/media');
        expect(calls[0].body.image_url).toContain('c_fill,ar_4:5');
        expect(calls[2].body.media_type).toBe('CAROUSEL');
        expect(calls[2].body.children).toBe('child-1,child-2');
        expect(calls[3].url).toContain('/ig-1/media_publish');
        expect(calls[3].body.creation_id).toBe('carousel-1');
    });

    it('maps Graph API failures through the error taxonomy', async () => {
        // los rate limits de Meta llegan como HTTP 400 con el código de rate limit en el body
        const rateLimited = fetchStub([{ status: 400, body: { error: { code: 32 } } }]);
        const channelRate = new MetaGraphChannel(realConfig({ igUserId: '' }), rateLimited.impl);
        await expect(
            channelRate.publish(makeProperty({ images: makeProperty().images.slice(0, 1) }))
        ).rejects.toBeInstanceOf(RetryableSyndicationError);

        const badToken = fetchStub([{ status: 400, body: { error: { code: 190 } } }]);
        const channelToken = new MetaGraphChannel(realConfig({ igUserId: '' }), badToken.impl);
        await expect(
            channelToken.publish(makeProperty({ images: makeProperty().images.slice(0, 1) }))
        ).rejects.toBeInstanceOf(PermanentSyndicationError);
    });

    it('wraps network failures as retryable', async () => {
        const failing: typeof fetch = async () => {
            throw new Error('ECONNRESET');
        };
        const channel = new MetaGraphChannel(realConfig({ igUserId: '' }), failing);
        await expect(
            channel.publish(makeProperty({ images: makeProperty().images.slice(0, 1) }))
        ).rejects.toBeInstanceOf(RetryableSyndicationError);
    });

    it('unpublish deletes every stored external artifact', async () => {
        const { impl, calls } = fetchStub([{ status: 200, body: { success: true } }, { status: 200, body: { success: true } }]);
        const channel = new MetaGraphChannel(realConfig(), impl);

        await channel.unpublish(JSON.stringify({ fbPostId: 'fb-1', igMediaId: 'ig-1' }));

        expect(calls.map(call => call.url)).toEqual([
            'https://graph.facebook.com/v23.0/fb-1',
            'https://graph.facebook.com/v23.0/ig-1'
        ]);
        expect(calls.every(call => call.method === 'DELETE')).toBe(true);
    });

    it('rejects unparseable externalRefs as permanent', async () => {
        const channel = new MetaGraphChannel(realConfig(), mustNotFetch);
        await expect(channel.unpublish('not-json{')).rejects.toBeInstanceOf(PermanentSyndicationError);
    });
});
