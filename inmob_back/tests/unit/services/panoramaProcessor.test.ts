import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
    processPanorama,
    PANORAMA_MIN_WIDTH,
    PANORAMA_MIN_HEIGHT
} from '../../../src/services/panoramaProcessor';
import { BadRequestError } from '../../../src/domain/appError';

async function syntheticImage(width: number, height: number): Promise<Buffer> {
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 90, g: 120, b: 160 }
        }
    }).jpeg({ quality: 80 }).toBuffer();
}

describe('processPanorama', () => {
    it('generates 5 variants with capped dimensions for a full-sphere source', async () => {
        const variants = await processPanorama(await syntheticImage(4096, 2048));
        expect(variants.width).toBe(4096);
        expect(variants.height).toBe(2048);
        expect(variants.desktop.avif.length).toBeGreaterThan(0);
        expect(variants.desktop.webp.length).toBeGreaterThan(0);
        expect(variants.mobile.avif.length).toBeGreaterThan(0);
        expect(variants.mobile.webp.length).toBeGreaterThan(0);
        expect(variants.poster.webp.length).toBeGreaterThan(0);

        // sharp reporta la familia ISO-BMFF ('heif') para AVIF; asertar el brand
        // ftyp real — es lo que husmean los navegadores y nuestro storage local.
        const avifBrand = (buf: Buffer) => buf.toString('ascii', 8, 12);
        expect(avifBrand(variants.desktop.avif)).toBe('avif');
        expect(avifBrand(variants.mobile.avif)).toBe('avif');
        const [desktopWebp, posterWebp] = await Promise.all([
            sharp(variants.desktop.webp).metadata(),
            sharp(variants.poster.webp).metadata()
        ]);
        expect(desktopWebp.format).toBe('webp');
        expect(posterWebp.format).toBe('webp');
        expect(posterWebp.width).toBe(512); // poster downscaled
    });

    it('generates AVIF/WebP variants that decode with the correct format', async () => {
        const variants = await processPanorama(await syntheticImage(3072, 1024)); // partial aspect 3:1
        expect(variants.desktop.avif.toString('ascii', 8, 12)).toBe('avif');
        const webp = await sharp(variants.desktop.webp).metadata();
        expect(webp.format).toBe('webp');
        expect(webp.width).toBe(3072);
        expect(webp.height).toBe(1024);
    });

    it('fades partial pano edges to black so the viewer clamp stretches black, not color', async () => {
        const variants = await processPanorama(await syntheticImage(3072, 1024)); // 3:1 parcial
        const { data, info } = await sharp(variants.desktop.webp).raw().toBuffer({ resolveWithObject: true });
        const px = (x: number, y: number): [number, number, number] => {
            const i = (y * info.width + x) * info.channels;
            return [data[i], data[i + 1], data[i + 2]];
        };
        const midY = Math.floor(info.height / 2);
        // píxel extremo ~negro (±8 por la codificación lossy — el bug era una fuga de
        // color con valores ~90+, no un residuo de compresión)
        for (const v of [...px(0, midY), ...px(info.width - 1, midY), ...px(Math.floor(info.width / 2), 0)]) {
            expect(v).toBeLessThanOrEqual(8);
        }
        // el centro conserva el color original
        const [r, g, b] = px(Math.floor(info.width / 2), midY);
        expect(Math.abs(r - 90)).toBeLessThanOrEqual(10);
        expect(Math.abs(g - 120)).toBeLessThanOrEqual(10);
        expect(Math.abs(b - 160)).toBeLessThanOrEqual(10);
    });

    it('leaves full-sphere sources untouched (seamless wrap)', async () => {
        const variants = await processPanorama(await syntheticImage(4096, 2048));
        const { data, info } = await sharp(variants.desktop.webp).raw().toBuffer({ resolveWithObject: true });
        const i = (Math.floor(info.height / 2) * info.width) * info.channels; // primer píxel del ecuador
        expect(data[i]).toBeGreaterThan(80); // sigue azul, no fundido a negro
    });

    it('rejects images below minimum resolution', async () => {
        await expect(processPanorama(await syntheticImage(1200, 800))).rejects.toThrow(BadRequestError);
    });

    it('rejects non-panoramic aspect ratios', async () => {
        await expect(processPanorama(await syntheticImage(2400, 2000))).rejects.toThrow(/panorámica/);
    });

    it('rejects corrupt buffers', async () => {
        await expect(processPanorama(Buffer.from('not an image'))).rejects.toThrow(BadRequestError);
    });

    it('documents the minimum size contract', () => {
        expect(PANORAMA_MIN_WIDTH).toBe(2048);
        expect(PANORAMA_MIN_HEIGHT).toBe(720);
    });
});
