import { SyndicationChannel, ChannelValidation, ChannelPublishResult } from '../../interfaces/syndicationChannel';
import { PropertyEntity } from '../../domain/property';
import { CanonicalFeedItem, toCanonicalItem } from './canonicalFeed';
import { escapeXml, XML_DECLARATION } from './xmlEscape';
import { env } from '../../config/env';

function renderItem(item: CanonicalFeedItem): string[] {
    return [
        '  <inmueble>',
        `    <codigoInmueble>${escapeXml(item.codigoInmueble)}</codigoInmueble>`,
        `    <operacion>${escapeXml(item.operacion)}</operacion>`,
        `    <tipoPropiedad>${escapeXml(item.tipoPropiedad)}</tipoPropiedad>`,
        `    <precio>${escapeXml(item.precio)}</precio>`,
        `    <moneda>${escapeXml(item.moneda)}</moneda>`,
        `    <ciudad>${escapeXml(item.ciudad)}</ciudad>`,
        `    <direccion>${escapeXml(item.direccion)}</direccion>`,
        `    <latitud>${escapeXml(item.latitud)}</latitud>`,
        `    <longitud>${escapeXml(item.longitud)}</longitud>`,
        `    <superficieTotal>${escapeXml(item.superficieTotal)}</superficieTotal>`,
        `    <dormitorios>${escapeXml(item.dormitorios)}</dormitorios>`,
        `    <banos>${escapeXml(item.banos)}</banos>`,
        '    <imagenes>',
        ...item.imagenes.map(url => `      <imagen>${escapeXml(url)}</imagen>`),
        '    </imagenes>',
        `    <urlDetalle>${escapeXml(item.urlDetalle)}</urlDetalle>`,
        `    <fechaActualizacion>${escapeXml(item.fechaActualizacion)}</fechaActualizacion>`,
        '  </inmueble>'
    ];
}

/** Renderiza el feed XML canónico (schema pull estilo ZonaProp/Idealista). */
export function renderXmlFeed(items: CanonicalFeedItem[]): string {
    const lines = [XML_DECLARATION, '<inmuebles>', ...items.flatMap(renderItem), '</inmuebles>'];
    return lines.join('\n');
}

/**
 * Canal: feed XML canónico (modelo pull — el portal rastrea nuestra URL de feed
 * con su propio cronograma). "Publicar" acá significa renderizar el ítem del feed
 * de la propiedad, lo que mantiene honestas las duraciones de JobLog sin fingir
 * que empujamos nada.
 */
export class XmlFeedChannel implements SyndicationChannel {
    readonly name = 'xml-feed';

    validate(property: PropertyEntity): ChannelValidation {
        const missing: string[] = [];
        if (property.images.length === 0) missing.push('images');
        return { ok: missing.length === 0, missing };
    }

    async publish(property: PropertyEntity): Promise<ChannelPublishResult> {
        // ponytail: renderiza un ítem por job; la regeneración del feed completo ocurre on
        // request con caché de 15 min — O(n) por request, suficiente a escala de inmobiliaria.
        renderXmlFeed([toCanonicalItem(property, env.PUBLIC_SITE_URL)]);
        return {};
    }
}
