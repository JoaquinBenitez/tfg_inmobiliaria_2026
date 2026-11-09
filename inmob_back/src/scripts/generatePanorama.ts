/**
 * Genera una panorámica equirectangular sintética (grilla + etiquetas de brújula)
 * para demo/testing — sin necesidad de celular ni cámara 360° (ADR 0003).
 *
 * Uso: npm run gen-panorama [salida.jpg] [ancho] [alto]
 * Luego subir vía el TourBuilder (o POST /api/properties/:id/tour/scenes).
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const out = process.argv[2] ?? 'demo-panorama.jpg';
const width = Number(process.argv[3] ?? 4096);
const height = Number(process.argv[4] ?? 2048);

// Grilla SVG: meridiano cada 30° de yaw, ecuador + trópicos, etiquetas de brújula
const lines: string[] = [];
for (let yaw = -180; yaw <= 180; yaw += 30) {
    const x = ((yaw + 180) / 360) * width;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,255,255,0.35)" stroke-width="${Math.max(1, width / 2048)}"/>`);
}
for (const pitch of [-60, -30, 0, 30, 60]) {
    const y = ((90 - pitch) / 180) * height;
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,255,255,${pitch === 0 ? 0.6 : 0.25})" stroke-width="${Math.max(1, width / 2048)}"/>`);
}
const labels = [
    { yaw: -180, text: 'OESTE' }, { yaw: -90, text: 'SUR' },
    { yaw: 0, text: 'NORTE' }, { yaw: 90, text: 'ESTE' }
];
const fontSize = Math.round(width / 40);
for (const { yaw, text } of labels) {
    const x = ((yaw + 180) / 360) * width + width / 72;
    lines.push(`<text x="${x}" y="${height / 2 - fontSize}" font-family="sans-serif" font-size="${fontSize}" fill="white" opacity="0.9">${text}</text>`);
    lines.push(`<text x="${x}" y="${height / 2 + fontSize * 2}" font-family="sans-serif" font-size="${fontSize * 0.6}" fill="white" opacity="0.7">${yaw}°</text>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e3a5f"/><stop offset="50%" stop-color="#4a7ba6"/><stop offset="100%" stop-color="#c9a86a"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  ${lines.join('\n')}
</svg>`;

async function main(): Promise<void> {
    const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
    await mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await writeFile(out, buffer);
    console.log(`Panorama sintética escrita: ${out} (${width}x${height}, ${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
}

void main();
