import sharp from 'sharp';
import { BadRequestError } from '../domain/appError';
import { isFullSphereAspect } from '../domain/tour';

/**
 * Adaptador de preprocesamiento de panoramas (Requisito 1): valida la imagen
 * fuente y genera variantes AVIF/WebP (anchos desktop + mobile) más un poster de
 * baja resolución, para que el visor 360° nunca descargue una textura completa antes
 * de la interacción (protección del LCP).
 */

export interface PanoramaVariants {
    width: number;
    height: number;
    desktop: { avif: Buffer; webp: Buffer };
    mobile: { avif: Buffer; webp: Buffer };
    poster: { webp: Buffer };
}

export const PANORAMA_MIN_WIDTH = 2048;
export const PANORAMA_MIN_HEIGHT = 720;
/** Los panoramas son anchos — rechazar fotos verticales/normales con un mensaje claro. */
export const PANORAMA_MIN_ASPECT = 1.5;
/** Las GPUs móviles tapan las texturas alrededor de 4096-8192px; quedarse dentro con margen. */
export const PANORAMA_DESKTOP_MAX_WIDTH = 8192;
export const PANORAMA_DESKTOP_MAX_HEIGHT = 4096;
export const PANORAMA_MOBILE_MAX_WIDTH = 4096;
export const PANORAMA_MOBILE_MAX_HEIGHT = 2048;
export const PANORAMA_POSTER_WIDTH = 512;
/** Fracción del ancho/alto que se funde a negro en panoramas parciales. */
export const PANORAMA_EDGE_FADE_FRACTION = 0.08;

/**
 * Overlay SVG con degradado a negro en los 4 bordes, para "terminar" los panoramas
 * parciales: el píxel extremo queda negro sólido y el ClampToEdge del visor estira
 * negro (invisible) en vez de fugar el último color hacia los costados.
 */
function edgeFadeSvg(width: number, height: number): Buffer {
    const fx = Math.max(1, Math.round(width * PANORAMA_EDGE_FADE_FRACTION));
    const fy = Math.max(1, Math.round(height * PANORAMA_EDGE_FADE_FRACTION));
    return Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        '<defs>' +
        '<linearGradient id="l"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
        '</defs>' +
        `<rect width="${fx}" height="${height}" fill="url(#l)"/>` +
        `<rect x="${width - fx}" width="${fx}" height="${height}" fill="url(#r)"/>` +
        `<rect width="${width}" height="${fy}" fill="url(#t)"/>` +
        `<rect y="${height - fy}" width="${width}" height="${fy}" fill="url(#b)"/>` +
        '</svg>'
    );
}

export async function processPanorama(buffer: Buffer): Promise<PanoramaVariants> {
    let width: number | undefined;
    let height: number | undefined;
    try {
        const meta = await sharp(buffer, { failOn: 'none' }).metadata();
        width = meta.width;
        height = meta.height;
    } catch {
        throw new BadRequestError('El archivo no es una imagen válida');
    }
    if (!width || !height) {
        throw new BadRequestError('No se pudo determinar el tamaño de la imagen');
    }
    if (width < PANORAMA_MIN_WIDTH || height < PANORAMA_MIN_HEIGHT) {
        throw new BadRequestError(
            `La imagen es demasiado chica (${width}x${height}px). Mínimo ${PANORAMA_MIN_WIDTH}x${PANORAMA_MIN_HEIGHT}px — usá la foto en resolución original.`
        );
    }
    if (width / height < PANORAMA_MIN_ASPECT) {
        throw new BadRequestError(
            'La imagen no es panorámica (relación de aspecto mínima 1.5:1). Sacá la foto con el modo panorama del celular.'
        );
    }

    const scale = Math.min(1, PANORAMA_DESKTOP_MAX_WIDTH / width, PANORAMA_DESKTOP_MAX_HEIGHT / height);
    const outWidth = Math.round(width * scale);
    const outHeight = Math.round(height * scale);

    const rotated = sharp(buffer, { failOn: 'none' }).rotate(); // respetar la orientación EXIF
    // Esfera completa (≈2:1): sin toque — debe envolver con costura perfecta. Parcial:
    // fundir los bordes a negro en TODAS las variantes. El composite de sharp se aplica
    // después del resize, así que el fade se materializa una vez a resolución completa
    // (PNG sin pérdida) y las variantes se derivan de ese buffer.
    const source = isFullSphereAspect(width, height)
        ? rotated
        : sharp(
            await rotated
                .clone()
                .composite([{ input: edgeFadeSvg(width, height), blend: 'over' }])
                .png({ compressionLevel: 1 })
                .toBuffer()
        );
    const desktop = source.clone().resize({
        width: PANORAMA_DESKTOP_MAX_WIDTH,
        height: PANORAMA_DESKTOP_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true
    });
    const mobile = source.clone().resize({
        width: PANORAMA_MOBILE_MAX_WIDTH,
        height: PANORAMA_MOBILE_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true
    });

    try {
        const [desktopAvif, desktopWebp, mobileAvif, mobileWebp, posterWebp] = await Promise.all([
            // effort 1: encodeo ~2× más rápido, visualmente indistinguible a q50 — mantiene
            // el request de subida por debajo de ~15s incluso para panos de celular de 8MP
            desktop.clone().avif({ quality: 50, effort: 1 }).toBuffer(),
            desktop.clone().webp({ quality: 80 }).toBuffer(),
            mobile.clone().avif({ quality: 50, effort: 1 }).toBuffer(),
            mobile.clone().webp({ quality: 80 }).toBuffer(),
            source.clone().resize({ width: PANORAMA_POSTER_WIDTH, withoutEnlargement: true }).webp({ quality: 60 }).toBuffer()
        ]);
        return {
            width: outWidth,
            height: outHeight,
            desktop: { avif: desktopAvif, webp: desktopWebp },
            mobile: { avif: mobileAvif, webp: mobileWebp },
            poster: { webp: posterWebp }
        };
    } catch (err) {
        throw new BadRequestError(`Error procesando la panorámica: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/** Expuesto para llamadores que necesiten decidir el coverage por defecto (ADR 0003). */
export function panoramaIsFullSphere(width: number, height: number): boolean {
    return isFullSphereAspect(width, height);
}
