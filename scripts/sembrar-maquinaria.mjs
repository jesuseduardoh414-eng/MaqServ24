#!/usr/bin/env node
/**
 * SEMBRAR RENTA DE MAQUINARIA (2026-10-08).
 *
 * Da de alta, por la API del panel, las cuatro fichas que MAQSER24 va a
 * ofrecer: excavadora, retroexcavadora, motoconformadora y vibrocompactador.
 * El cliente no dio más datos, así que llevan la configuración MÁS COMÚN del
 * mercado de Monterrey (equipos de referencia, tonelaje, potencia).
 *
 * SIN PRECIO PROPIO, a propósito: el precio de un servicio es UNO y vive en el
 * tabulador del cotizador (Ajustes › Tarifas y condiciones). Es la misma regla
 * que aplica el editor de fichas del panel (manda price 0 y tarifas vacías).
 *
 * Van sin aliado (equipo de MAQSER24) porque todavía no hay proveedores. Al
 * dar de alta a cada aliado se le asigna su ficha y se liga a su renglón en
 * Ajustes › Tarifas y condiciones.
 *
 * Por la API y no por SQL: valida igual que el panel y así sirve tal cual
 * para producción. Idempotente: si ya existe una ficha con el mismo nombre,
 * no la vuelve a crear.
 *
 * Uso:
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/sembrar-maquinaria.mjs
 */

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const CATEGORIA = 'maquinaria-pesada';

if (!EMAIL || !PASSWORD) {
  console.error('Faltan ADMIN_EMAIL y ADMIN_PASSWORD (una cuenta de Dirección o Red de Aliados).');
  process.exit(1);
}

/** L–S de 8 a 18: lo normal en el ramo (mismo valor que HORARIO_DEFAULT). */
const HORARIO = { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' };

const INCLUYE = '<p><b>Renta con operador y diésel incluidos</b>, por jornada de 8 horas. El operador cuenta con DC3. El traslado a obra se cotiza aparte.</p>';

const FICHAS = [
  {
    name: 'Excavadora hidráulica 20 t',
    short: 'Excavadora de oruga de 20 toneladas para excavación masiva, zanjas y carga de camiones.',
    description:
      '<p>Excavadora hidráulica sobre orugas de la clase de 20 toneladas, la más usada en obra civil y urbanización. Trabaja con cucharón o con martillo hidráulico.</p>' +
      '<ul><li>Excavación masiva y cortes de terreno</li><li>Zanjas para drenaje, agua y gas</li><li>Cimentaciones y sótanos</li><li>Carga de camiones de volteo</li><li>Demolición y rompimiento de roca con martillo</li></ul>' +
      INCLUYE,
    attributes: { capacidad: '20', potencia: '150', energia: 'Diésel', implementos: 'Cucharón de 1.0 a 1.2 m³; martillo hidráulico opcional', operador: 'Incluido', combustible: 'Incluido' },
    specs: [
      { label: 'Peso operativo', value: '20 a 22 t' },
      { label: 'Potencia', value: '150 a 160 HP' },
      { label: 'Cucharón', value: '1.0 a 1.2 m³' },
      { label: 'Profundidad máxima de excavación', value: '6.5 m aprox.' },
      { label: 'Alcance máximo', value: '9.8 m aprox.' },
      { label: 'Equipos de referencia', value: 'Caterpillar 320, Komatsu PC200, John Deere 210G o similar' },
    ],
  },
  {
    name: 'Retroexcavadora 4x4',
    short: 'Retroexcavadora con cargador frontal para zanjas, excavación ligera, carga y relleno.',
    description:
      '<p>Retroexcavadora 4x4 con cargador frontal y brazo excavador trasero: el equipo más versátil de la obra. Se mueve por su propio pie entre frentes cercanos y trabaja con cucharón o martillo.</p>' +
      '<ul><li>Zanjas y excavación ligera</li><li>Carga de material y camiones</li><li>Relleno y limpieza de terreno</li><li>Rompimiento de concreto con martillo</li><li>Apoyo general en urbanización</li></ul>' +
      INCLUYE,
    attributes: { capacidad: '8', potencia: '95', energia: 'Diésel', implementos: 'Cucharón frontal de 1.0 m³ y trasero de 24"; martillo opcional', operador: 'Incluido', combustible: 'Incluido' },
    specs: [
      { label: 'Peso operativo', value: '7.5 a 8.5 t' },
      { label: 'Potencia', value: '90 a 100 HP' },
      { label: 'Tracción', value: '4x4' },
      { label: 'Cucharón frontal', value: '1.0 m³' },
      { label: 'Cucharón trasero', value: '24" (60 cm)' },
      { label: 'Profundidad de excavación', value: '4.3 m aprox.' },
      { label: 'Equipos de referencia', value: 'Caterpillar 416, JCB 3CX, Case 580 o similar' },
    ],
  },
  {
    name: 'Motoconformadora',
    short: 'Motoconformadora para nivelar y perfilar terracerías, caminos y plataformas.',
    description:
      '<p>Motoconformadora (motoniveladora) para dar nivel y bombeo a terracerías, caminos y estacionamientos, y para conformar bases y sub-bases antes de compactar.</p>' +
      '<ul><li>Nivelación y perfilado de terracerías</li><li>Caminos, calles y estacionamientos</li><li>Conformación de bases y sub-bases</li><li>Cunetas y taludes</li><li>Mantenimiento de caminos de terracería</li></ul>' +
      INCLUYE,
    attributes: { capacidad: '15', potencia: '150', energia: 'Diésel', implementos: 'Hoja niveladora de 12 a 14 ft; escarificador según equipo', operador: 'Incluido', combustible: 'Incluido' },
    specs: [
      { label: 'Peso operativo', value: '14 a 16 t' },
      { label: 'Potencia', value: '140 a 160 HP' },
      { label: 'Hoja', value: '12 a 14 ft (3.7 a 4.3 m)' },
      { label: 'Escarificador', value: 'Trasero, según equipo' },
      { label: 'Equipos de referencia', value: 'Caterpillar 120K / 140K, John Deere 670G o similar' },
    ],
  },
  {
    name: 'Vibrocompactador 10 t',
    short: 'Rodillo vibratorio de 10 toneladas para compactar terracerías, bases y rellenos.',
    description:
      '<p>Vibrocompactador (rodillo vibratorio) de tambor liso de la clase de 10 toneladas, el más común para compactar terracerías y bases. Con tambor pata de cabra para suelos arcillosos, según disponibilidad.</p>' +
      '<ul><li>Compactación de terracerías</li><li>Bases y sub-bases de caminos y estacionamientos</li><li>Rellenos en capas</li><li>Plataformas y desplantes</li></ul>' +
      INCLUYE,
    attributes: { capacidad: '10', potencia: '120', energia: 'Diésel', implementos: 'Tambor liso; pata de cabra según equipo', operador: 'Incluido', combustible: 'Incluido' },
    specs: [
      { label: 'Peso operativo', value: '10 a 12 t' },
      { label: 'Tambor', value: 'Liso, 2.1 m de ancho' },
      { label: 'Potencia', value: '100 a 130 HP' },
      { label: 'Fuerza centrífuga', value: '245 a 300 kN' },
      { label: 'Equipos de referencia', value: 'Dynapac CA250, Bomag BW211, Caterpillar CS533 o similar' },
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

const categorias = await api('/admin/catalog/categories', {}, token);
const lista = Array.isArray(categorias) ? categorias : categorias?.items ?? [];
const cat = lista.find((c) => c.slug === CATEGORIA || c.cat_slug === CATEGORIA);
if (!cat) {
  console.error(`No existe la categoría "${CATEGORIA}". Corre antes packages/db/sql/solo-maquinaria.sql o créala en el panel.`);
  process.exit(1);
}

const existentes = await api('/admin/catalog/products?pageSize=500', {}, token);
const nombres = new Set((existentes?.items ?? []).map((p) => p.name.trim().toLowerCase()));

for (const f of FICHAS) {
  if (nombres.has(f.name.toLowerCase())) {
    console.log(`= ${f.name}: ya existe, no se toca`);
    continue;
  }
  const fd = new FormData();
  fd.append('name', f.name);
  fd.append('categoryId', String(cat.id));
  // Precio único: el servicio se cobra con el tabulador del cotizador.
  fd.append('price', '0');
  fd.append('priceUnit', 'dia');
  fd.append('tarifas', '{}');
  fd.append('costoAliado', '{}');
  fd.append('minimo', '1');
  fd.append('isRental', 'true');
  fd.append('stock', '1');
  fd.append('status', '1');
  fd.append('featured', 'true');
  fd.append('short', f.short);
  fd.append('description', f.description);
  fd.append('specs', JSON.stringify(f.specs));
  fd.append('attributes', JSON.stringify(f.attributes));
  fd.append('location', 'Monterrey, N.L.');
  fd.append('horario', JSON.stringify(HORARIO));
  fd.append('providerId', '');
  const r = await api('/admin/catalog/products', { method: 'POST', body: fd }, token);
  console.log(`+ ${f.name}: creada (id ${r?.id ?? '?'})`);
}
