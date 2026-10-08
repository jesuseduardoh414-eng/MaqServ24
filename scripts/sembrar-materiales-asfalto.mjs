#!/usr/bin/env node
/**
 * SEMBRAR MATERIALES PARA CONSTRUCCIÓN Y SOLUCIONES ASFÁLTICAS (2026-10-08).
 *
 * Las dos últimas líneas. Por la API del panel, igual que los otros
 * `sembrar-*.mjs`. Idempotente.
 *
 * A diferencia de maquinaria, triturados y transporte, estas dos NO tienen
 * cotizador ni tabulador: se cotizan a mano (decisión del 2026-10-06). El
 * cliente manda su solicitud desde /cotizar con lo que pide el formulario de su
 * línea (piezas de block; m² y espesor de carpeta), le llega a Solicitudes ›
 * Por cotizar, y quien la atiende le responde con el precio. La carpeta se
 * cotiza por tonelada aplicada.
 *
 * Por eso aquí solo se crean las categorías y sus fichas, SIN precio.
 *
 * Uso:
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/sembrar-materiales-asfalto.mjs
 */

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD (una cuenta de Dirección).');
  process.exit(1);
}

const HORARIO = { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' };

const LINEAS = [
  {
    nombre: 'Materiales para construcción',
    slug: 'materiales-para-construccion',
    descripcion: 'Concreto premezclado, acero de refuerzo, block y cemento',
    fichas: [
      {
        nombre: 'Block de concreto 6"',
        unidad: 'pieza',
        short: 'Block de concreto de 6" (15 × 20 × 40 cm) para muros y bardas, puesto en obra.',
        usos: ['Muros y bardas', 'Vivienda', 'Bodegas y locales', 'Obra industrial y comercial'],
        cierre: '<p><b>Se cotiza por pieza.</b> La entrega depende de la cantidad y de la zona: indícanos cuántas piezas necesitas, dónde y cuándo, y te respondemos con la propuesta.</p>',
        atributos: { material: 'Block 6"', especificacion: '15 × 20 × 40 cm', presentacion: 'Por pieza' },
        specs: [
          { label: 'Medidas', value: '15 × 20 × 40 cm (6")' },
          { label: 'Material', value: 'Concreto' },
          { label: 'Se vende por', value: 'Pieza' },
          { label: 'Entrega', value: 'Puesto en obra, de una vez o por parcialidades' },
        ],
      },
    ],
  },
  {
    nombre: 'Soluciones asfálticas',
    slug: 'soluciones-asfalticas',
    descripcion: 'Suministro y aplicación de carpeta asfáltica',
    fichas: [
      {
        nombre: 'Riego de impregnación',
        unidad: 'm2',
        short: 'Riego de impregnación con emulsión asfáltica sobre la base, antes de tender la carpeta.',
        usos: ['Preparar bases hidráulicas para pavimentar', 'Estacionamientos', 'Calles y caminos internos', 'Patios de maniobra'],
        cierre: '<p><b>Se cotiza por m².</b> Indícanos la superficie y el estado de la base, y te respondemos con la propuesta.</p>',
        atributos: { tipo_mezcla: 'Emulsión asfáltica de impregnación', aplicacion: 'Suministro y aplicación' },
        specs: [
          { label: 'Material', value: 'Emulsión asfáltica de impregnación' },
          { label: 'Dosificación', value: '1.0 a 1.5 L/m² aprox., según la base' },
          { label: 'Se cobra por', value: 'm²' },
          { label: 'Incluye', value: 'Suministro y aplicación' },
        ],
      },
      {
        nombre: 'Carpeta asfáltica normal',
        unidad: 'tonelada',
        short: 'Suministro y aplicación de carpeta asfáltica de mezcla en caliente, tendida y compactada.',
        usos: ['Estacionamientos', 'Calles y caminos internos', 'Parques industriales', 'Fraccionamientos'],
        cierre: '<p><b>Se cotiza por tonelada aplicada.</b> Con los m² de la superficie y el espesor en cm te ayudamos a sacar el volumen; el estado de la base también cambia el precio.</p>',
        atributos: { tipo_mezcla: 'Mezcla asfáltica en caliente', aplicacion: 'Suministro y aplicación' },
        specs: [
          { label: 'Mezcla', value: 'Asfáltica en caliente' },
          { label: 'Espesor', value: '4 a 7 cm según el uso' },
          { label: 'Se cotiza por', value: 'Tonelada aplicada' },
          { label: 'Incluye', value: 'Suministro, tendido y compactación' },
        ],
      },
    ],
  },
];

async function api(path, init = {}, token) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${typeof body === 'object' ? body?.message : body}`);
  return body;
}

const { token } = await api('/admin/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

const cats = await api('/admin/catalog/categories', {}, token);
const lista = Array.isArray(cats) ? cats : cats?.items ?? [];
const existentes = await api('/admin/catalog/products?pageSize=500', {}, token);
const nombres = new Set((existentes?.items ?? []).map((p) => p.name.trim().toLowerCase()));

for (const linea of LINEAS) {
  let cat = lista.find((c) => c.slug === linea.slug);
  if (cat) {
    console.log(`= Categoría ${linea.nombre}: ya existe (id ${cat.id})`);
  } else {
    const fd = new FormData();
    fd.append('name', linea.nombre);
    fd.append('status', '1');
    fd.append('description', linea.descripcion);
    cat = await api('/admin/catalog/categories', { method: 'POST', body: fd }, token);
    if (cat.slug !== linea.slug) throw new Error(`La categoría quedó con slug "${cat.slug}" y no "${linea.slug}".`);
    console.log(`+ Categoría ${linea.nombre}: creada (id ${cat.id})`);
  }

  for (const f of linea.fichas) {
    if (nombres.has(f.nombre.toLowerCase())) {
      console.log(`  = ${f.nombre}: ya existe, no se toca`);
      continue;
    }
    const fd = new FormData();
    fd.append('name', f.nombre);
    fd.append('categoryId', String(cat.id));
    // Sin precio: estas líneas se cotizan a mano desde Solicitudes.
    fd.append('price', '0');
    fd.append('priceUnit', f.unidad);
    fd.append('tarifas', '{}');
    fd.append('costoAliado', '{}');
    fd.append('minimo', '0');
    fd.append('isRental', 'false');
    fd.append('status', '1');
    fd.append('featured', 'false');
    fd.append('short', f.short);
    fd.append('description', `<p>${f.short}</p><ul>${f.usos.map((u) => `<li>${u}</li>`).join('')}</ul>${f.cierre}`);
    fd.append('specs', JSON.stringify(f.specs));
    fd.append('attributes', JSON.stringify(f.atributos));
    fd.append('location', 'Monterrey, N.L.');
    fd.append('horario', JSON.stringify(HORARIO));
    fd.append('providerId', '');
    const r = await api('/admin/catalog/products', { method: 'POST', body: fd }, token);
    console.log(`  + ${f.nombre}: ficha creada (id ${r?.id ?? '?'})`);
  }
}
