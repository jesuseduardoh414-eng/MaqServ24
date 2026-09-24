/**
 * Imagen por defecto para compartir (Open Graph / Twitter Card), 1200×630:
 * el lockup oficial centrado sobre el negro tecnológico con la línea azul
 * eléctrico del manual. Sin texto renderizado a propósito: el título y la
 * descripción los pone cada red desde las etiquetas, y así no dependemos de
 * qué fuentes tenga la máquina que lo genere.
 *
 * Las páginas con imagen propia (producto, artículo) la mandan a ella; ésta
 * cubre portada, catálogo, cotizador, contacto, legales…
 *
 * Uso: node scripts/generar-imagen-og.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const NEGRO = '#07090C';
const AZUL = '#008CFF';
const LOGO = path.join(__dirname, '../apps/web/public/brand/maqser24-logo.png');
const DESTINO = path.join(__dirname, '../apps/web/public/og/portada.png');
const W = 1200;
const H = 630;

async function main() {
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  const logo = await sharp(LOGO).resize({ width: 620, fit: 'inside' }).toBuffer();
  const lm = await sharp(logo).metadata();
  const linea = Buffer.from(`<svg width="${W}" height="${H}"><rect x="${(W - 120) / 2}" y="${Math.round(H / 2 + lm.height / 2 + 34)}" width="120" height="4" fill="${AZUL}"/></svg>`);
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: NEGRO } })
    .composite([
      { input: logo, left: Math.round((W - lm.width) / 2), top: Math.round((H - lm.height) / 2) - 10 },
      { input: linea, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(DESTINO, buf);
  const m = await sharp(buf).metadata();
  console.log(`${path.relative(process.cwd(), DESTINO)} ${m.width}x${m.height} ${(buf.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
