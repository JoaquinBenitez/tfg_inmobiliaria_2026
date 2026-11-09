import { PropertyEntity } from '../domain/property';

export interface ChannelValidation {
    ok: boolean;
    missing: string[];
}

export interface ChannelPublishResult {
    /** Referencia opaca al artefacto externo (p. ej. JSON con id de post FB / id de media IG). Vacío para canales pull. */
    externalRef?: string;
}

/**
 * Puerto: un canal externo de difusión (Requisito 4 — modelado sobre
 * ImageStorageProvider). Los adaptadores viven en `src/services/syndication/` y
 * nunca deben filtrarse a las capas de dominio o aplicación.
 */
export interface SyndicationChannel {
    readonly name: string;
    /** Verifica que la propiedad tenga lo que este canal necesita antes de publicar */
    validate(property: PropertyEntity): ChannelValidation;
    /** Publica (canales push) o produce el artefacto del canal (canales pull/feed) */
    publish(property: PropertyEntity): Promise<ChannelPublishResult>;
    /** Quita un artefacto publicado previamente; opcional — los canales pull se auto-reparan en el próximo rastreo del feed */
    unpublish?(externalRef: string): Promise<void>;
}
