#!/usr/bin/env node
/**
 * SEMBRAR TRITURADOS (2026-10-08).
 *
 * Segunda línea del catálogo, después de Renta de maquinaria: arena, grava,
 * base hidráulica y CNC. Por la API del panel, igual que
 * `sembrar-maquinaria.mjs`, para que valide como el panel y sirva tal cual en
 * producción. Idempotente.
 *
 * Hace tres cosas:
 *   1. Crea la categoría "Triturados" (slug `triturados`) si no existe.
 *   2. Deja en el TABULADOR del cotizador de triturados los seis materiales que
 *      se van a ofrecer, con su precio por tonelada. Ahí, y solo ahí, viven los
 *      precios. Si el tabulador quedó vacío (lo vació `solo-maquinaria.sql`),
 *      primero lo regresa al de fábrica para recuperar zonas, fletes y
 *      condiciones; si ya tiene zonas, no las toca.
 *   3. Crea una ficha por material, SIN precio (precio único: lo da el
 *      cotizador), sin aliado todavía.
 *
 * Precios: los del tabulador de fábrica (lista original del cliente). "Grava 2"
 * y "Arena 4" salen del renglón "Grava 2 / mixto / arena 4". "Grava 1" no venía
 * en esa lista: arranca con el precio de la grava 2 y HAY QUE CONFIRMARLO.
 * Si el tabulador ya tenía precio para un material, se respeta.
 *
 * Uso:
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/sembrar-triturados.mjs
 */

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD (una cuenta de Dirección).');
  process.exit(1);
}

const HORARIO = { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' };
const ENTREGA =
  '<p><b>Se vende por tonelada.</b> El flete a obra se cotiza aparte según la zona de entrega, o puedes recogerlo en planta. Entregas en volteo de 20 a 22 t o tolva de 48 a 50 t.</p>';

/**
 * Los seis materiales. `id` es la clave en el tabulador; `desde` son las claves
 * del tabulador de fábrica de donde se toma el precio si ya existía.
 */
const MATERIALES = [
  {
    id: 'arena4', nombre: 'Arena #4', desde: ['arena4', 'grava2_mix_a4'], precio: 280,
    short: 'Arena triturada #4 para concreto, block y mortero.',
    usos: ['Concreto hecho en obra', 'Fabricación y pegado de block', 'Mortero para firmes', 'Plantillas'],
    tamano: 'Arena #4',
  },
  {
    id: 'arena5', nombre: 'Arena #5', desde: ['arena5'], precio: 345,
    short: 'Arena triturada #5, más fina, para enjarres y acabados.',
    usos: ['Enjarres y repellados', 'Acabados finos', 'Mortero para pegar tabique', 'Junteo'],
    tamano: 'Arena #5',
  },
  {
    id: 'grava1', nombre: 'Grava 1', desde: ['grava1'], precio: 280,
    short: 'Grava triturada #1 (3/4" aprox.) para concreto y firmes.',
    usos: ['Concreto para losas, firmes y columnas', 'Filtros y drenes', 'Pisos de concreto'],
    tamano: '3/4" aprox., según el banco',
  },
  {
    id: 'grava2', nombre: 'Grava 2', desde: ['grava2', 'grava2_mix_a4'], precio: 280,
    short: 'Grava triturada #2 (1 1/2" aprox.) para concreto masivo y drenes.',
    usos: ['Concreto ciclópeo y masivo', 'Drenes y filtros', 'Cimentaciones', 'Bases drenantes'],
    tamano: '1 1/2" aprox., según el banco',
  },
  {
    id: 'base', nombre: 'Base hidráulica', desde: ['base'], precio: 260,
    short: 'Material graduado para bases de pavimentos, compactable.',
    usos: ['Bases de calles y caminos', 'Estacionamientos y patios de maniobra', 'Plataformas y desplantes', 'Bajo pisos de concreto'],
    tamano: 'Graduada para base',
  },
  {
    id: 'cnc', nombre: 'CNC', desde: ['cnc'], precio: 125,
    short: 'Material económico para rellenos y nivelación de terreno.',
    usos: ['Rellenos en general', 'Nivelación de terreno', 'Caminos provisionales', 'Desplantes'],
    tamano: 'Sin cribar',
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
let cat = (Array.isArray(cats) ? cats : cats?.items ?? []).find((c) => c.slug === 'triturados');
if (cat) {
  console.log(`= Categoría Triturados: ya existe (id ${cat.id})`);
} else {
  const fd = new FormData();
  fd.append('name', 'Triturados');
  fd.append('status', '1');
  fd.append('description', 'Arena, grava, base hidráulica y CNC');
  cat = await api('/admin/catalog/categories', { method: 'POST', body: fd }, token);
  console.log(`+ Categoría Triturados: creada (id ${cat.id})`);
}

// ── 2. Tabulador del cotizador ─────────────────────────────────────────
let tab = await api('/admin/quoter/catalog/triturados', {}, token);
if (!tab.zonas?.length) {
  tab = await api('/admin/quoter/catalog/triturados/reset', { method: 'POST' }, token);
  console.log('~ Tabulador de triturados vacío: se regresó al de fábrica (zonas, fletes y condiciones)');
}
const previos = new Map((tab.productos ?? []).map((p) => [p.id, p]));
tab.productos = MATERIALES.map((m) => {
  const viejo = m.desde.map((k) => previos.get(k)).find(Boolean);
  return { ...(viejo ?? {}), id: m.id, nombre: m.nombre, precio_ton: viejo?.precio_ton ?? m.precio };
});
tab.publico = { ...tab.publico, habilitado: true };
await api('/admin/quoter/catalog/triturados', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tab),
}, token);
console.log(`~ Tabulador: ${tab.productos.map((p) => `${p.nombre} $${p.precio_ton}/t`).join(' · ')}`);

// ── 3. Fichas, sin precio ───────────────────────────────────────────────
const existentes = await api('/admin/catalog/products?pageSize=500', {}, token);
const nombres = new Set((existentes?.items ?? []).map((p) => p.name.trim().toLowerCase()));

for (const m of MATERIALES) {
  if (nombres.has(m.nombre.toLowerCase())) {
    console.log(`= ${m.nombre}: ya existe, no se toca`);
    continue;
  }
  const fd = new FormData();
  fd.append('name', m.nombre);
  fd.append('categoryId', String(cat.id));
  // Precio único: el material se cobra con el tabulador del cotizador.
  fd.append('price', '0');
  fd.append('priceUnit', 'tonelada');
  fd.append('tarifas', '{}');
  fd.append('costoAliado', '{}');
  fd.append('minimo', '0');
  fd.append('isRental', 'false');
  fd.append('status', '1');
  fd.append('featured', 'false');
  fd.append('short', m.short);
  fd.append('description', `<p>${m.short}</p><ul>${m.usos.map((u) => `<li>${u}</li>`).join('')}</ul>${ENTREGA}`);
  fd.append('specs', JSON.stringify([{ label: 'Tamaño', value: m.tamano }, { label: 'Se vende por', value: 'Tonelada' }, { label: 'Entrega', value: 'Puesto en obra (flete aparte) o en planta' }]));
  fd.append('attributes', JSON.stringify({ material: m.nombre, tamano: m.tamano }));
  fd.append('horario', JSON.stringify(HORARIO));
  fd.append('providerId', '');
  const r = await api('/admin/catalog/products', { method: 'POST', body: fd }, token);
  console.log(`+ ${m.nombre}: ficha creada (id ${r?.id ?? '?'})`);
}
