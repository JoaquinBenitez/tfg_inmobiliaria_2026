import { SyndicationChannel, ChannelValidation, ChannelPublishResult } from '../../interfaces/syndicationChannel';
import { PropertyEntity } from '../../domain/property';
import { CanonicalFeedItem, toCanonicalItem } from './canonicalFeed';
import { env } from '../../config/env';

export interface JsonFeedDocument {
    generatedAt: string;
    total: number;
    inmuebles: CanonicalFeedItem[];
}

/** Renderiza el feed JSON canónico (documento pull estilo MercadoLibre). */
export function renderJsonFeed(items: CanonicalFeedItem[]): string {
    const doc: JsonFeedDocument = {
        generatedAt: new Date().toISOString(),
        total: items.length,
        inmuebles: items
    };
    return JSON.stringify(doc, null, 2);
}

/** Canal: feed JSON canónico — mismo modelo pull que el feed XML. */
export class JsonFeedChannel implements SyndicationChannel {
    readonly name = 'json-feed';

    validate(property: PropertyEntity): ChannelValidation {
        const missing: string[] = [];
        if (property.images.length === 0) missing.push('images');
        return { ok: missing.length === 0, missing };
    }

    async publish(property: PropertyEntity): Promise<ChannelPublishResult> {
        renderJsonFeed([toCanonicalItem(property, env.PUBLIC_SITE_URL)]);
        return {};
    }
}
