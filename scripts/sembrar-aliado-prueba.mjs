#!/usr/bin/env node
/**
 * ALIADO DE PRUEBA (2026-10-08).
 *
 * Todavía no hay un proveedor real. Para probar el flujo completo —solicitud,
 * aliado sugerido, aceptación en su portal, avance del servicio— se da de alta
 * UN aliado ficticio que atiende las cinco líneas, con un correo REAL (el
 * enlace a su portal le llega ahí).
 *
 * Hace, por la API del panel e idempotente:
 *   1. Da de alta al aliado (o lo reutiliza si ya existe con ese correo) y le
 *      manda su enlace al portal.
 *   2. Lo ubica en el mapa: su patio en General Escobedo, con radio de 60 km.
 *   3. Le asigna las fichas del inventario que todavía no tienen aliado.
 *   4. Liga cada renglón de los tabuladores (maquinaria y triturados) a su
 *      ficha. Es lo que hace que una solicitud del cotizador le llegue a él
 *      sugerida, en vez de quedarse "por asignar" sin a quién ofrecerla.
 *
 * Cuando entre el primer aliado real: se le asignan sus fichas y a este se le
 * da de baja desde Proveedores.
 *
 * Uso:
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   ALIADO_EMAIL=correo@real.com node scripts/sembrar-aliado-prueba.mjs
 */

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const ALIADO_EMAIL = process.env.ALIADO_EMAIL?.trim().toLowerCase();

if (!EMAIL || !PASSWORD || !ALIADO_EMAIL) {
  console.error('Faltan ADMIN_EMAIL, ADMIN_PASSWORD y ALIADO_EMAIL (el correo real del aliado de prueba).');
  process.exit(1);
}

const ALIADO = {
  name: 'Aliado de Prueba Norte',
  level: 'activo',
  contactName: 'Contacto de prueba',
  phone: '81 1234 5678',
  email: ALIADO_EMAIL,
  city: 'General Escobedo',
  state: 'Nuevo León',
  address: 'Patio de maquinaria, General Escobedo, N.L.',
  coverageRadiusKm: 60,
  coverage: [
    'Monterrey', 'San Nicolás de los Garza', 'Guadalupe', 'Apodaca', 'General Escobedo',
    'Santa Catarina', 'San Pedro Garza García', 'García', 'Juárez', 'Santiago',
  ],
  categories: [
    'maquinaria-pesada', 'triturados', 'transporte-y-servicios-de-obra',
    'materiales-para-construccion', 'soluciones-asfalticas',
  ],
  responseMinutes: 30,
  notes: 'ALIADO FICTICIO para probar el flujo completo (2026-10-08). Atiende las cinco líneas. Darlo de baja cuando entre el primer aliado real.',
};

/** Centro de General Escobedo: zona de patios y pedreras, al norte de Monterrey. */
const PATIO = { lat: 25.7972, lng: -100.3256 };

/**
 * Qué ficha atiende cada renglón del tabulador (por nombre de ficha). La retro
 * y la excavadora cubren sus dos variantes: con cucharón y con martillo.
 */
const LIGAS = {
  maquinaria: {
    retro_cuch: 'Retroexcavadora 4x4',
    retro_mart: 'Retroexcavadora 4x4',
    exc_cuch: 'Excavadora hidráulica 20 t',
    exc_mart: 'Excavadora hidráulica 20 t',
    moto: 'Motoconformadora',
    vibro: 'Vibrocompactador 10 t',
    pipa: 'Pipa de agua 10 m³',
    agua: 'Pipa de agua 20 m³',
    banco_14: 'Material de banco · volteo 14 m³',
    banco_28: 'Material de banco · volteo 28 m³',
    retiro: 'Retiro de material · volteo 14 m³',
    retiro_28: 'Retiro de material · volteo 28 m³',
  },
  triturados: {
    arena4: 'Arena #4',
    arena5: 'Arena #5',
    grava1: 'Grava 1',
    grava2: 'Grava 2',
    base: 'Base hidráulica',
    cnc: 'CNC',
    // Material de banco del cotizador de triturados: se entrega en volteo de 14 m³.
    banco: 'Material de banco · volteo 14 m³',
  },
};

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
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const { token } = await api('/admin/auth/login', json('POST', { email: EMAIL, password: PASSWORD }));

// ── 1. El aliado ────────────────────────────────────────────────────────
const lista = await api('/admin/providers', {}, token);
const aliados = Array.isArray(lista) ? lista : lista?.items ?? [];
let aliado = aliados.find((p) => p.email?.trim().toLowerCase() === ALIADO_EMAIL);
if (aliado) {
  console.log(`= Aliado: ya existe «${aliado.name}» (id ${aliado.id})`);
} else {
  const r = await api('/admin/providers', json('POST', ALIADO), token);
  aliado = { id: r.id, name: ALIADO.name };
  console.log(`+ Aliado: «${ALIADO.name}» dado de alta (id ${r.id})`);
  if (r.acceso) console.log(`  Enlace a su portal (${r.acceso.estado}): ${r.acceso.url || r.acceso.mensaje}`);
}

// ── 2. Su patio en el mapa ──────────────────────────────────────────────
const geo = await api(`/admin/providers/${aliado.id}/geocodificar`, json('POST', PATIO), token);
console.log(`~ Ubicación: ${geo.mensaje}`);

// ── 3. Sus fichas ───────────────────────────────────────────────────────
const productos = (await api('/admin/catalog/products?pageSize=500', {}, token))?.items ?? [];
const porNombre = new Map(productos.map((p) => [p.name.trim().toLowerCase(), p]));
let asignadas = 0;
for (const p of productos) {
  const detalle = await api(`/admin/catalog/products/${p.id}`, {}, token);
  if (detalle.providerId) continue;
  const fd = new FormData();
  fd.append('providerId', String(aliado.id));
  await api(`/admin/catalog/products/${p.id}`, { method: 'PATCH', body: fd }, token);
  asignadas++;
}
console.log(`~ Fichas asignadas al aliado: ${asignadas} (las que ya tenían aliado no se tocan)`);

// ── 4. Ligar los renglones de los tabuladores ──────────────────────────
for (const [tipo, ligas] of Object.entries(LIGAS)) {
  const cat = await api(`/admin/quoter/catalog/${tipo}`, {}, token);
  const idDe = (nombre) => {
    const p = porNombre.get(nombre.toLowerCase());
    if (!p) throw new Error(`No existe la ficha «${nombre}»: corre antes los sembrar-*.mjs de su línea.`);
    return p.id;
  };
  const ligar = (renglon) => {
    const nombre = ligas[renglon.id];
    if (!nombre) return renglon;
    const id = idDe(nombre);
    return { ...renglon, productos: [...new Set([...(renglon.productos ?? []), id])] };
  };
  if (tipo === 'maquinaria') {
    cat.equipos = cat.equipos.map(ligar);
    cat.servicios = cat.servicios.map(ligar);
  } else {
    cat.productos = cat.productos.map(ligar);
    if (ligas.banco) cat.material_banco = { ...cat.material_banco, productos: [...new Set([...(cat.material_banco.productos ?? []), idDe(ligas.banco)])] };
  }
  await api(`/admin/quoter/catalog/${tipo}`, json('PATCH', cat), token);
  console.log(`~ Tabulador de ${tipo}: ${Object.keys(ligas).length} renglones ligados a sus fichas`);
}
