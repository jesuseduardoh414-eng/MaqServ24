/**
 * Genera los activos de marca MAQSER24 a partir de los PNG entregados por el
 * cliente (documentacion/*-removebg-preview.png).
 *
 * El manual (05 / SISTEMA DE LOGOTIPO) prohíbe REDIBUJAR el logo. Esto no lo
 * redibuja: recorta el isotipo y el wordmark del activo oficial y los recompone
 * en un lockup horizontal, porque el lockup vertical original mide 1.35:1 y en
 * una cabecera de 46 px de alto el wordmark quedaría a ~6 px (ilegible).
 *
 * Uso: node _build-brand.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const DOC = 'c:/Users/jesus/Downloads/SevMarq24/documentacion/';
const PM = DOC + 'WhatsApp_Image_2026-08-22_at_8.42.42_PM-removebg-preview.png';
const PAM = DOC + 'WhatsApp_Image_2026-08-22_at_8.42.42_PaM-removebg-preview.png';

const NEGRO = '#07090C'; // negro tecnológico del manual (11 / PALETA PRINCIPAL)
const DESTINOS = ['../apps/web/public/brand', '../apps/admin/public/brand'];

async function main() {
  for (const d of DESTINOS) fs.mkdirSync(d, { recursive: true });

  // --- Fuentes recortadas del activo oficial -------------------------------
  const base = await sharp(PM).trim({ threshold: 1 }).toBuffer(); // 449x333
  const iso = await sharp(base)
    .extract({ left: 0, top: 0, width: 449, height: 268 })
    .trim({ threshold: 1 })
    .toBuffer();
  const word = await sharp(base)
    .extract({ left: 0, top: 276, width: 449, height: 57 })
    .trim({ threshold: 1 })
    .toBuffer();

  // --- 1. Lockup horizontal (cabecera) -------------------------------------
  const isoH = 400;
  const isoMeta = await sharp(iso).metadata();
  const isoW = Math.round((isoMeta.width * isoH) / isoMeta.height);
  const wordH = 118;
  const wordMeta = await sharp(word).metadata();
  const wordW = Math.round((wordMeta.width * wordH) / wordMeta.height);
  const gap = 78;
  const totalW = isoW + gap + wordW;

  const isoRs = await sharp(iso).resize({ height: isoH }).toBuffer();
  const wordRs = await sharp(word).resize({ height: wordH }).toBuffer();

  const lockup = await sharp({
    create: { width: totalW, height: isoH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: isoRs, left: 0, top: 0 },
      { input: wordRs, left: isoW + gap, top: Math.round((isoH - wordH) / 2) },
    ])
    .png()
    .toBuffer();

  // --- 2. Isotipo suelto ----------------------------------------------------
  const isotipo = await sharp(iso).resize({ height: 512 }).png().toBuffer();

  // --- 3. Lockup vertical (pie de página / institucional) -------------------
  const stacked = await sharp(base).resize({ height: 512 }).png().toBuffer();

  // --- 4. Lockup con descriptor (usos institucionales) ---------------------
  const descriptor = await sharp(PAM).trim({ threshold: 1 }).resize({ height: 560 }).png().toBuffer();

  // --- 5. Favicon e ícono de app -------------------------------------------
  // El isotipo es metálico claro: sobre la pestaña blanca de un navegador
  // desaparece. Va montado sobre el negro tecnológico, como manda el manual
  // (08 / FONDOS AUTORIZADOS: negro prioritario).
  const cuadrado = async (size, pad) => {
    const inner = await sharp(iso).resize({ width: size - pad * 2, fit: 'inside' }).toBuffer();
    const im = await sharp(inner).metadata();
    return sharp({
      create: { width: size, height: size, channels: 4, background: NEGRO },
    })
      .composite([{ input: inner, left: pad, top: Math.round((size - im.height) / 2) }])
      .png()
      .toBuffer();
  };
  const favicon = await cuadrado(64, 6);
  const appIcon = await cuadrado(180, 18);

  const salidas = {
    'maqser24-logo.png': lockup,
    'maqser24-isotipo.png': isotipo,
    'maqser24-logo-vertical.png': stacked,
    'maqser24-logo-descriptor.png': descriptor,
    'favicon.png': favicon,
    'app-icon.png': appIcon,
  };

  for (const dir of DESTINOS) {
    for (const [nombre, buf] of Object.entries(salidas)) {
      fs.writeFileSync(path.join(dir, nombre), buf);
    }
  }

  for (const [nombre, buf] of Object.entries(salidas)) {
    const m = await sharp(buf).metadata();
    console.log(`${nombre.padEnd(30)} ${m.width}x${m.height}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log('\nEscrito en: ' + DESTINOS.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
