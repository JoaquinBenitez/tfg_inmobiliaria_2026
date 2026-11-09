import { SyndicationChannel, ChannelValidation, ChannelPublishResult } from '../../interfaces/syndicationChannel';
import { PropertyEntity } from '../../domain/property';
import { RetryableSyndicationError, PermanentSyndicationError } from '../../domain/appError';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const MAX_IG_IMAGES = 10;
const MAX_IG_CAPTION_LENGTH = 2200;

export interface MetaGraphConfig {
    pageId: string;
    igUserId: string;
    accessToken: string;
    graphVersion: string;
    /** Dry-run: loguea el payload en vez de llamar a la Graph API */
    sandbox: boolean;
}

export function metaGraphConfigFromEnv(): MetaGraphConfig {
    return {
        pageId: env.META_PAGE_ID,
        igUserId: env.META_IG_USER_ID,
        accessToken: env.META_ACCESS_TOKEN,
        graphVersion: env.META_GRAPH_VERSION,
        sandbox: env.META_SANDBOX || !env.META_ACCESS_TOKEN
    };
}

/** Caption de la publicación compartida por los posts de Facebook e Instagram. */
export function buildListingCaption(property: PropertyEntity, siteUrl: string): string {
    const operacion = property.listingType === 'sale' ? 'Venta' : 'Alquiler';
    const precio = `${property.price.currency} ${property.price.amount.toLocaleString('es-AR')}`;
    const detalles = [
        `${property.area} m²`,
        `${property.bedrooms} dorm.`,
        `${property.bathrooms} baños`
    ].join(' · ');
    const link = `${siteUrl}/propiedades/${property.id}`;
    const hashtags = `#inmobiliaria #${property.propertyType} #${property.listingType === 'sale' ? 'venta' : 'alquiler'}`;
    const caption = [
        `${property.title} — ${operacion}`,
        precio,
        `${property.propertyType} en ${property.location.city}`,
        detalles,
        link,
        hashtags
    ].join('\n');
    return caption.length > MAX_IG_CAPTION_LENGTH
        ? caption.slice(0, MAX_IG_CAPTION_LENGTH - 3) + '...'
        : caption;
}

/**
 * Las imágenes del feed de Instagram aceptan relaciones de aspecto entre 1.91:1 y 4:5.
 * Las URLs de Cloudinary se pueden recortar del lado del servidor sin costo para
 * nosotros; las URLs comunes (storage local) pasan sin cambios.
 */
export function igImageUrl(url: string): string {
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
        return url.replace('/upload/', '/upload/c_fill,ar_4:5/');
    }
    return url;
}

/**
 * Taxonomía de errores según plan §2.3:
 * - reintentable: red, HTTP 5xx/429, códigos de rate limit de Meta (4 app, 17 user, 32 page, 613 llamadas-por-segundo)
 * - permanente: HTTP 400, códigos de token/permisos (190 token, 10 permission) — nunca quemar reintentos en estos
 */
export function classifyMetaError(status: number, metaCode: number | undefined): Error {
    const message = `Meta Graph API error (HTTP ${status}${metaCode !== undefined ? `, code ${metaCode}` : ''})`;
    if ([4, 17, 32, 613].includes(metaCode ?? -1) || status >= 500 || status === 429) {
        return new RetryableSyndicationError(message);
    }
    if ([190, 10].includes(metaCode ?? -1) || status === 400) {
        return new PermanentSyndicationError(message);
    }
    // Códigos desconocidos: reintentar — el backoff abarata los reintentos; un dead-letter erróneo no.
    return new RetryableSyndicationError(message);
}

interface GraphResponse {
    id?: string;
    post_id?: string;
    error?: { code?: number; message?: string; type?: string };
    [key: string]: unknown;
}

/**
 * Adaptador: posts orgánicos con fotos a la Página de Facebook y la cuenta
 * profesional de Instagram de la inmobiliaria (TFG: "avisos fotográficos en
 * Facebook e Instagram"). Usa el access token compartido de la Página; sin SDK
 * de Meta — solo fetch plano detrás de este adaptador.
 */
export class MetaGraphChannel implements SyndicationChannel {
    readonly name = 'meta-graph';

    constructor(
        private readonly config: MetaGraphConfig = metaGraphConfigFromEnv(),
        private readonly fetchImpl: typeof fetch = fetch
    ) {}

    validate(property: PropertyEntity): ChannelValidation {
        const missing: string[] = [];
        if (property.images.length === 0) missing.push('images');
        if (property.title.trim().length === 0) missing.push('title');
        // Los destinos solo hacen falta para publicar de verdad — los dry-runs del sandbox
        // deben funcionar sin credenciales de Meta (ese es el punto del modo demo)
        if (!this.config.sandbox && !this.config.pageId && !this.config.igUserId) {
            missing.push('meta target (META_PAGE_ID / META_IG_USER_ID)');
        }
        return { ok: missing.length === 0, missing };
    }

    async publish(property: PropertyEntity): Promise<ChannelPublishResult> {
        const caption = buildListingCaption(property, env.PUBLIC_SITE_URL);
        if (this.config.sandbox) {
            logger.info(
                { propertyId: property.id, caption, images: property.images.length },
                'Meta publish dry-run (sandbox mode)'
            );
            return { externalRef: 'dry-run' };
        }

        const refs: Record<string, string> = {};
        if (this.config.pageId) {
            refs.fbPostId = await this.publishToFacebook(property, caption);
        }
        if (this.config.igUserId) {
            refs.igMediaId = await this.publishToInstagram(property, caption);
        }
        return { externalRef: JSON.stringify(refs) };
    }

    async unpublish(externalRef: string): Promise<void> {
        if (this.config.sandbox) {
            logger.info({ externalRef }, 'Meta unpublish dry-run (sandbox mode)');
            return;
        }
        let refs: Record<string, string> = {};
        try {
            refs = JSON.parse(externalRef);
        } catch {
            throw new PermanentSyndicationError(`Unparseable externalRef: ${externalRef.slice(0, 100)}`);
        }
        for (const externalId of Object.values(refs)) {
            await this.graph(`/${externalId}`, 'DELETE');
        }
    }

    private async publishToFacebook(property: PropertyEntity, caption: string): Promise<string> {
        const pageId = this.config.pageId;
        const urls = property.images.slice(0, MAX_IG_IMAGES).map(image => image.url);

        if (urls.length === 1) {
            const res = await this.graph(`/${pageId}/photos`, 'POST', { url: urls[0], caption });
            return String(res.post_id ?? res.id);
        }

        // Multi-foto: crear fotos no publicadas y luego adjuntarlas a un post del feed
        const mediaFbids: string[] = [];
        for (const url of urls) {
            const res = await this.graph(`/${pageId}/photos`, 'POST', { url, published: false });
            if (res.id) mediaFbids.push(String(res.id));
        }
        const post = await this.graph(`/${pageId}/feed`, 'POST', {
            message: caption,
            attached_media: mediaFbids.map(id => ({ media_fbid: id }))
        });
        return String(post.id);
    }

    private async publishToInstagram(property: PropertyEntity, caption: string): Promise<string> {
        const igUserId = this.config.igUserId;
        const urls = property.images.slice(0, MAX_IG_IMAGES).map(image => igImageUrl(image.url));

        if (urls.length === 1) {
            const container = await this.graph(`/${igUserId}/media`, 'POST', { image_url: urls[0], caption });
            const published = await this.graph(`/${igUserId}/media_publish`, 'POST', {
                creation_id: container.id
            });
            return String(published.id);
        }

        // Carrusel: un container por imagen, luego un container CAROUSEL, y publicar
        const children: string[] = [];
        for (const image_url of urls) {
            const child = await this.graph(`/${igUserId}/media`, 'POST', { image_url });
            if (child.id) children.push(String(child.id));
        }
        const carousel = await this.graph(`/${igUserId}/media`, 'POST', {
            media_type: 'CAROUSEL',
            children: children.join(','),
            caption
        });
        const published = await this.graph(`/${igUserId}/media_publish`, 'POST', {
            creation_id: carousel.id
        });
        return String(published.id);
    }

    private async graph(path: string, method: 'GET' | 'POST' | 'DELETE', body?: Record<string, unknown>): Promise<GraphResponse> {
        const url = `https://graph.facebook.com/${this.config.graphVersion}${path}`;
        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, access_token: this.config.accessToken })
            });
        } catch (err) {
            throw new RetryableSyndicationError(`Meta Graph API network error: ${(err as Error).message}`);
        }

        const json = (await response.json().catch(() => ({}))) as GraphResponse;
        if (!response.ok) {
            throw classifyMetaError(response.status, json.error?.code);
        }
        return json;
    }
}
