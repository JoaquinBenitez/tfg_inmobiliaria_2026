import { describe, it, expect } from 'vitest';
import { renderXmlFeed } from '../../../src/services/syndication/xmlFeedAdapter';
import { renderJsonFeed } from '../../../src/services/syndication/jsonFeedAdapter';
import { XmlFeedChannel } from '../../../src/services/syndication/xmlFeedAdapter';
import { JsonFeedChannel } from '../../../src/services/syndication/jsonFeedAdapter';
import { toCanonicalItem, CanonicalFeedItem } from '../../../src/services/syndication/canonicalFeed';
import { makeProperty } from './canonicalFeed.test';

const item = (overrides: Partial<CanonicalFeedItem> = {}): CanonicalFeedItem => ({
    codigoInmueble: 'id-1',
    operacion: 'venta',
    tipoPropiedad: 'casa',
    precio: 120000,
    moneda: 'USD',
    ciudad: 'Reconquista',
    direccion: 'Av. San Martín & Cía <123> "Centro"',
    latitud: -29.15,
    longitud: -59.65,
    superficieTotal: 140,
    dormitorios: 3,
    banos: 2,
    imagenes: ['https://img.test/a.jpg?w=1&h=2'],
    urlDetalle: 'https://inmob.test/propiedades/id-1',
    fechaActualizacion: '2026-09-05T12:00:00.000Z',
    ...overrides
});

describe('XML feed rendering', () => {
    it('renders a well-formed feed with declaration and one inmueble per item', () => {
        const xml = renderXmlFeed([item(), item({ codigoInmueble: 'id-2' })]);
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml.endsWith('</inmuebles>')).toBe(true);
        expect(xml.match(/<inmueble>/g)).toHaveLength(2);
        expect(xml).toContain('<operacion>venta</operacion>');
        expect(xml).toContain('<precio>120000</precio>');
    });

    it('escapes XML-special characters in text fields and URLs', () => {
        const xml = renderXmlFeed([item()]);
        expect(xml).toContain(
            '<direccion>Av. San Martín &amp; Cía &lt;123&gt; &quot;Centro&quot;</direccion>'
        );
        expect(xml).toContain('<imagen>https://img.test/a.jpg?w=1&amp;h=2</imagen>');
    });

    it('renders empty imagenes list without image elements', () => {
        const xml = renderXmlFeed([item({ imagenes: [] })]);
        expect(xml).toContain('<imagenes>\n    </imagenes>');
        expect(xml).not.toContain('<imagen>');
    });
});

describe('JSON feed rendering', () => {
    it('renders a parseable document with canonical items', () => {
        const body = renderJsonFeed([item()]);
        const doc = JSON.parse(body);
        expect(doc.total).toBe(1);
        expect(doc.inmuebles[0]).toMatchObject({
            codigoInmueble: 'id-1',
            operacion: 'venta',
            moneda: 'USD',
            dormitorios: 3
        });
        expect(doc.generatedAt).toBeTruthy();
    });
});

describe('feed channels', () => {
    it('validate flags properties without images', () => {
        const xml = new XmlFeedChannel();
        const json = new JsonFeedChannel();
        expect(xml.validate(makeProperty({ images: [] })).missing).toContain('images');
        expect(json.validate(makeProperty({ images: [] })).missing).toContain('images');
        expect(xml.validate(makeProperty()).ok).toBe(true);
        expect(json.validate(makeProperty()).ok).toBe(true);
    });

    it('publish renders the item and returns no externalRef (pull channel)', async () => {
        const xml = new XmlFeedChannel();
        const json = new JsonFeedChannel();
        await expect(xml.publish(makeProperty())).resolves.toEqual({});
        await expect(json.publish(makeProperty())).resolves.toEqual({});
    });
});
