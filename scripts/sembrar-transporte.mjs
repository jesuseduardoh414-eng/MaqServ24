#!/usr/bin/env node
/**
 * SEMBRAR TRANSPORTE Y SERVICIOS DE OBRA (2026-10-08).
 *
 * Tercera línea: entrega de agua en pipas y acarreos en camiones de volteo.
 * Por la API del panel, igual que los otros `sembrar-*.mjs`. Idempotente.
 *
 *   1. Crea la categoría "Transporte y servicios de obra" si no existe.
 *   2. Agrega los seis servicios al TABULADOR del cotizador de maquinaria, que
 *      es donde siempre vivieron las pipas y el retiro (con `linea` de
 *      transporte, para que la solicitud se registre en su línea y no como
 *      maquinaria). Ahí, y solo ahí, viven los precios. Si un servicio ya
 *      estaba, respeta su precio. También regresa las condiciones de pipa y de
 *      retiro (las de fábrica) y agrega las de material de banco.
 *   3. Crea una ficha por servicio, SIN precio (precio único) y sin aliado.
 *
 * Precios: pipas y retiros, los de fábrica (lista original del cliente).
 * Material de banco: el que ya tiene el cotizador de triturados, $200 por m³
 * con el flete incluido, puesto en obra → $2,800 el volteo de 14 m³ y $5,600
 * el de 28 m³.
 *
 * Uso:
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/sembrar-transporte.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Las condiciones de pipa y retiro se toman del tabulador de fábrica, no se copian aquí.
const { CATALOGO_MAQUINARIA_DEFAULT } = require('../packages/config/dist/index.js');

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const LINEA = 'transporte-y-servicios-de-obra';

if (!EMAIL || !PASSWORD) {
  console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD (una cuenta de Dirección).');
  process.exit(1);
}

const HORARIO = { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' };
const POR_VIAJE = '<p><b>Se cobra por viaje.</b> El precio depende de la capacidad de la unidad y de la zona de la obra; el cotizador te lo da al momento.</p>';

const BANCO = {
  titulo: 'Condiciones comerciales · Material de banco',
  puntos: [
    'Forma de pago: contado.',
    'El material de banco se cotiza por viaje puesto en obra, en volteo de 14 m³ o de 28 m³.',
    'Se mide por volumen en la caja del camión (no se pesa).',
    'El precio incluye el material y el flete.',
    'El costo del material lo valida el cliente.',
  ],
};

/**
 * Los seis servicios. `servicio` es el renglón del tabulador (ids `pipa`,
 * `agua`, `retiro` y `retiro_28` se conservan: los documentos ya emitidos los
 * citan). `ficha` es lo que se publica en el sitio, sin precio.
 */
const SERVICIOS = [
  {
    servicio: { id: 'pipa', nombre: 'Pipa de agua 10 m³', icono: 'pipa', unidad: 'viaje', precio: 3000, presets: [3000], cond: 'pipa' },
    ficha: {
      nombre: 'Pipa de agua 10 m³',
      short: 'Entrega de agua en pipa de 10 m³ (10,000 litros) para obra.',
      usos: ['Riego y compactación de terracerías', 'Curado de concreto', 'Control de polvo', 'Abastecimiento de obra'],
      atributos: { capacidad_pipa: '10000' },
      specs: [{ label: 'Capacidad', value: '10 m³ (10,000 L)' }, { label: 'Manguera', value: '15 a 20 m' }, { label: 'Descarga', value: '45 min por viaje' }],
    },
  },
  {
    servicio: { id: 'agua', nombre: 'Pipa de agua 20 m³', icono: 'agua', unidad: 'viaje', precio: 5000, presets: [5000], cond: 'pipa' },
    ficha: {
      nombre: 'Pipa de agua 20 m³',
      short: 'Entrega de agua en pipa de 20 m³ (20,000 litros) para obra grande.',
      usos: ['Terracerías y riego de grandes superficies', 'Compactación de bases', 'Control de polvo en obra', 'Abastecimiento de tanques'],
      atributos: { capacidad_pipa: '20000' },
      specs: [{ label: 'Capacidad', value: '20 m³ (20,000 L)' }, { label: 'Manguera', value: '15 a 20 m' }, { label: 'Descarga', value: '45 min por viaje' }],
    },
  },
  {
    servicio: { id: 'banco_14', nombre: 'Material de banco 14 m³', icono: 'banco', unidad: 'viaje', precio: 2800, presets: [2800], cond: 'banco' },
    ficha: {
      nombre: 'Material de banco · volteo 14 m³',
      short: 'Entrega de material de banco en volteo de 14 m³, puesto en obra.',
      usos: ['Rellenos y terraplenes', 'Nivelación de terreno', 'Plataformas y desplantes'],
      atributos: { capacidad_unidad: '14', tipo_caja: 'Torton' },
      specs: [{ label: 'Unidad', value: 'Volteo torton de 14 m³' }, { label: 'Se mide', value: 'Por volumen en la caja (no se pesa)' }, { label: 'Incluye', value: 'Material y flete, puesto en obra' }],
    },
  },
  {
    servicio: { id: 'banco_28', nombre: 'Material de banco 28 m³', icono: 'banco', unidad: 'viaje', precio: 5600, presets: [5600], cond: 'banco' },
    ficha: {
      nombre: 'Material de banco · volteo 28 m³',
      short: 'Entrega de material de banco en volteo full de 28 m³, puesto en obra.',
      usos: ['Rellenos y terraplenes de gran volumen', 'Nivelación de terreno', 'Plataformas'],
      atributos: { capacidad_unidad: '28', tipo_caja: 'Full' },
      specs: [{ label: 'Unidad', value: 'Volteo full de 28 m³' }, { label: 'Se mide', value: 'Por volumen en la caja (no se pesa)' }, { label: 'Incluye', value: 'Material y flete, puesto en obra' }],
    },
  },
  {
    servicio: { id: 'retiro', nombre: 'Retiro de material 14 m³', icono: 'retiro', unidad: 'viaje', precio: 3500, presets: [2000, 2500, 3000, 3500, 4000, 4500], cond: 'retiro' },
    ficha: {
      nombre: 'Retiro de material · volteo 14 m³',
      short: 'Retiro de escombro y material de excavación en volteo de 14 m³, a tiro libre.',
      usos: ['Escombro de demolición', 'Material producto de excavación', 'Limpieza de obra'],
      atributos: { capacidad_unidad: '14', tipo_caja: 'Torton' },
      specs: [{ label: 'Unidad', value: 'Volteo torton de 14 m³' }, { label: 'Destino', value: 'Tiro libre' }, { label: 'Material', value: 'Escombro (basura y otros residuos se cotizan aparte)' }],
    },
  },
  {
    servicio: { id: 'retiro_28', nombre: 'Retiro de material 28 m³', icono: 'retiro', unidad: 'viaje', precio: 5000, presets: [3000, 4000, 5000, 6000, 7000, 8000], cond: 'retiro' },
    ficha: {
      nombre: 'Retiro de material · volteo 28 m³',
      short: 'Retiro de escombro y material de excavación en volteo full de 28 m³, a tiro libre.',
      usos: ['Escombro de demolición en volumen', 'Material producto de excavación masiva', 'Limpieza de obra'],
      atributos: { capacidad_unidad: '28', tipo_caja: 'Full' },
      specs: [{ label: 'Unidad', value: 'Volteo full de 28 m³' }, { label: 'Destino', value: 'Tiro libre' }, { label: 'Material', value: 'Escombro (basura y otros residuos se cotizan aparte)' }],
    },
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

// ── 1. Categoría ────────────────────────────────────────────────────────
const cats = await api('/admin/catalog/categories', {}, token);
let cat = (Array.isArray(cats) ? cats : cats?.items ?? []).find((c) => c.slug === LINEA);
if (cat) {
  console.log(`= Categoría Transporte y servicios de obra: ya existe (id ${cat.id})`);
} else {
  const fd = new FormData();
  fd.append('name', 'Transporte y servicios de obra');
  fd.append('status', '1');
  fd.append('description', 'Entrega de agua en pipas y acarreos en camiones de volteo');
  cat = await api('/admin/catalog/categories', { method: 'POST', body: fd }, token);
  if (cat.slug !== LINEA) throw new Error(`La categoría quedó con slug "${cat.slug}" y no "${LINEA}": revisa el nombre.`);
  console.log(`+ Categoría Transporte y servicios de obra: creada (id ${cat.id})`);
}

// ── 2. Tabulador del cotizador de maquinaria ───────────────────────────
const tab = await api('/admin/quoter/catalog/maquinaria', {}, token);
const previos = new Map((tab.servicios ?? []).map((s) => [s.id, s]));
const nuevosIds = new Set(SERVICIOS.map((x) => x.servicio.id));
tab.servicios = [
  // Lo que ya hubiera que no sea de esta línea se queda tal cual.
  ...(tab.servicios ?? []).filter((s) => !nuevosIds.has(s.id)),
  ...SERVICIOS.map(({ servicio }) => {
    const viejo = previos.get(servicio.id);
    return {
      ...servicio,
      productos: viejo?.productos ?? [],
      ...(viejo ? { precio: viejo.precio, presets: viejo.presets } : {}),
      linea: LINEA,
    };
  }),
];
const fabrica = CATALOGO_MAQUINARIA_DEFAULT.condiciones;
tab.condiciones = {
  ...tab.condiciones,
  pipa: tab.condiciones.pipa ?? fabrica.pipa,
  retiro: tab.condiciones.retiro ?? fabrica.retiro,
  banco: tab.condiciones.banco ?? BANCO,
};
await api('/admin/quoter/catalog/maquinaria', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tab),
}, token);
console.log(`~ Tabulador: ${SERVICIOS.map(({ servicio }) => `${servicio.nombre} $${(previos.get(servicio.id)?.precio ?? servicio.precio).toLocaleString('es-MX')}/viaje`).join(' · ')}`);

// ── 3. Fichas, sin precio ───────────────────────────────────────────────
const existentes = await api('/admin/catalog/products?pageSize=500', {}, token);
const nombres = new Set((existentes?.items ?? []).map((p) => p.name.trim().toLowerCase()));

for (const { ficha } of SERVICIOS) {
  if (nombres.has(ficha.nombre.toLowerCase())) {
    console.log(`= ${ficha.nombre}: ya existe, no se toca`);
    continue;
  }
  const fd = new FormData();
  fd.append('name', ficha.nombre);
  fd.append('categoryId', String(cat.id));
  // Precio único: el servicio se cobra con el tabulador del cotizador.
  fd.append('price', '0');
  fd.append('priceUnit', 'viaje');
  fd.append('tarifas', '{}');
  fd.append('costoAliado', '{}');
  fd.append('minimo', '1');
  fd.append('isRental', 'false');
  fd.append('status', '1');
  fd.append('featured', 'false');
  fd.append('short', ficha.short);
  fd.append('description', `<p>${ficha.short}</p><ul>${ficha.usos.map((u) => `<li>${u}</li>`).join('')}</ul>${POR_VIAJE}`);
  fd.append('specs', JSON.stringify(ficha.specs));
  fd.append('attributes', JSON.stringify(ficha.atributos));
  fd.append('location', 'Monterrey, N.L.');
  fd.append('horario', JSON.stringify(HORARIO));
  fd.append('providerId', '');
  const r = await api('/admin/catalog/products', { method: 'POST', body: fd }, token);
  console.log(`+ ${ficha.nombre}: ficha creada (id ${r?.id ?? '?'})`);
}
