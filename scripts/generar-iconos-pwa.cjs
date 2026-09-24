/**
 * Iconos de la PWA (manifest + apple-touch-icon) a partir del isotipo oficial
 * que ya genera build-brand.cjs. No se redibuja nada: se monta el isotipo
 * sobre el negro tecnológico (08 / FONDOS AUTORIZADOS), igual que el favicon.
 *
 * Salen dos familias porque Android las trata distinto:
 *  - `any`: el sistema lo pinta tal cual → el isotipo ocupa casi todo.
 *  - `maskable`: el sistema lo RECORTA (círculo, gota, cuadrado redondeado) y
 *    solo garantiza el 80 % central. El isotipo va más pequeño para que ninguna
 *    forma le corte una esquina.
 *
 * Uso: node scripts/generar-iconos-pwa.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const NEGRO = '#07090C';
const ISOTIPO = path.join(__dirname, '../apps/web/public/brand/maqser24-isotipo.png');
const DESTINO = path.join(__dirname, '../apps/web/public/pwa');

/** Cuadrado negro con el isotipo centrado ocupando `fraccion` del ancho. */
async function icono(size, fraccion) {
  const inner = await sharp(ISOTIPO).resize({ width: Math.round(size * fraccion), fit: 'inside' }).toBuffer();
  const im = await sharp(inner).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: NEGRO } })
    .composite([{ input: inner, left: Math.round((size - im.width) / 2), top: Math.round((size - im.height) / 2) }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const salidas = {
    'icon-192.png': await icono(192, 0.78),
    'icon-512.png': await icono(512, 0.78),
    'icon-maskable-192.png': await icono(192, 0.58),
    'icon-maskable-512.png': await icono(512, 0.58),
    'apple-touch-icon.png': await icono(180, 0.8),
  };
  for (const [nombre, buf] of Object.entries(salidas)) {
    fs.writeFileSync(path.join(DESTINO, nombre), buf);
    const m = await sharp(buf).metadata();
    console.log(`${nombre.padEnd(26)} ${m.width}x${m.height}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log('\nEscrito en: ' + path.relative(process.cwd(), DESTINO));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
