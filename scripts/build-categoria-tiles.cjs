/**
 * Genera las imágenes de las dos categorías que no tienen fotografía:
 * "Agua en pipas" y "Triturados".
 *
 * NO son fotos. El manual pide fotografía de operación real (16 / FOTOGRAFÍA) y
 * no hay ninguna de pipas ni de triturados; inventar una con banco de imágenes
 * genérico sería justo lo que prohíbe. En su lugar van placas de marca con un
 * pictograma de una sola línea, como manda 15 / ICONOGRAFÍA, sobre grafito y
 * con la retícula técnica de 14 / RETÍCULA.
 *
 * SIN TEXTO a propósito: la tarjeta de categoría ya superpone el nombre y el
 * conteo abajo a la izquierda con un velo oscuro. Si la imagen trajera el
 * nombre, saldría dos veces.
 *
 * Cuando el cliente entregue fotos reales, se suben desde el admin y estas se
 * reemplazan solas.
 *
 * Uso: node scripts/build-categoria-tiles.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const W = 900;
const H = 640;
const GRAFITO = '#11161C';
const NEGRO = '#07090C';
const AZUL = '#008CFF';
const ACERO = '#A9B0B7';

/** Retícula tenue de fondo. */
function reticula() {
  const paso = 40;
  let l = '';
  for (let x = paso; x < W; x += paso) l += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = paso; y < H; y += paso) l += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return `<g stroke="${ACERO}" stroke-width="1" opacity="0.05">${l}</g>`;
}

/** Pipa: tractor + cisterna, de perfil, a un solo trazo. */
const PIPA = `
  <g fill="none" stroke="${ACERO}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <rect x="24" y="70" width="104" height="76" rx="10"/>
    <path d="M128 106 h26"/>
    <rect x="154" y="52" width="250" height="94" rx="47"/>
    <path d="M212 52 v94 M280 52 v94 M348 52 v94"/>
    <path d="M24 146 h380"/>
  </g>
  <g fill="none" stroke="${AZUL}" stroke-width="7" stroke-linecap="round">
    <circle cx="72" cy="176" r="26"/>
    <circle cx="222" cy="176" r="26"/>
    <circle cx="336" cy="176" r="26"/>
  </g>`;

/** Triturados: montículo de agregado sobre línea de banco. */
const TRITURADO = `
  <g fill="none" stroke="${ACERO}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 190 L150 40 L280 190 Z"/>
    <path d="M150 40 L150 190"/>
    <path d="M85 115 L215 115"/>
  </g>
  <g fill="none" stroke="${AZUL}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M300 190 L372 108 L444 190 Z"/>
    <path d="M0 190 H460"/>
  </g>`;

const TILES = [
  { archivo: 'cat-agua-en-pipas.png', arte: PIPA, ancho: 430 },
  { archivo: 'cat-triturados.png', arte: TRITURADO, ancho: 470 },
];

function svg({ arte, ancho }) {
  // El arte se coloca arriba-derecha: la esquina inferior izquierda la ocupa el
  // velo con el nombre de la categoría que pinta la tarjeta.
  const escala = 0.92;
  const x = W - ancho * escala - 70;
  const y = 92;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GRAFITO}"/>
      <stop offset="100%" stop-color="${NEGRO}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fondo)"/>
  ${reticula()}
  <g transform="translate(${x} ${y}) scale(${escala})">${arte}</g>
</svg>`;
}

async function main() {
  const destinos = ['../apps/web/public/brand', '../apps/admin/public/brand'].map((d) =>
    path.join(__dirname, d),
  );
  for (const d of destinos) fs.mkdirSync(d, { recursive: true });
  for (const tile of TILES) {
    const buf = await sharp(Buffer.from(svg(tile))).png().toBuffer();
    for (const d of destinos) fs.writeFileSync(path.join(d, tile.archivo), buf);
    console.log(`${tile.archivo.padEnd(28)} ${W}x${H}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
