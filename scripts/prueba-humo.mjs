#!/usr/bin/env node
/**
 * Prueba de humo de MAQSER24 — SOLO LECTURA.
 *
 * No crea cuentas, no manda solicitudes, no escribe en la base ni manda
 * correos. Se puede correr contra producción después de cada despliegue:
 *
 *   node scripts/prueba-humo.mjs
 *   node scripts/prueba-humo.mjs --web http://localhost:3000 --api http://localhost:4000 --admin http://localhost:3001
 *
 * Sale con código 1 si falla algo, para poder usarlo en un workflow.
 */

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const WEB = arg('web', 'https://maqserv24.com');
const API = arg('api', 'https://api.maqserv24.com');
const ADMIN = arg('admin', 'https://admin.maqserv24.com');
const TIMEOUT = 30_000;

const resultados = [];
async function prueba(grupo, nombre, fn) {
  const t0 = Date.now();
  try {
    const nota = await fn();
    resultados.push({ grupo, nombre, ok: true, ms: Date.now() - t0, nota: nota ?? '' });
  } catch (e) {
    resultados.push({ grupo, nombre, ok: false, ms: Date.now() - t0, nota: e.message });
  }
}
function exige(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function pedir(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    return await fetch(url, { redirect: 'manual', ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
async function json(url, opts) {
  const r = await pedir(url, opts);
  exige(r.ok, `HTTP ${r.status}`);
  return r.json();
}
const post = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// ---------------------------------------------------------------- API base
await prueba('API', 'health con base de datos', async () => {
  const h = await json(`${API}/health`);
  exige(h.status === 'ok' && h.db === 'ok', `health=${JSON.stringify(h)}`);
});
await prueba('API', 'tema publicado', async () => {
  const t = await json(`${API}/theme`);
  exige(t && typeof t === 'object' && Object.keys(t).length > 0, 'tema vacío');
  const s = JSON.stringify(t);
  // Cierre de migración: el tema no debe depender de Supabase.
  const supa = (s.match(/supabase\.co/g) || []).length;
  return supa ? `AVISO: ${supa} URL(s) de Supabase en el tema` : 'sin URLs de Supabase';
});
await prueba('API', 'categorías con productos', async () => {
  const c = await json(`${API}/catalog/categories`);
  exige(Array.isArray(c) && c.length > 0, 'sin categorías');
  return `${c.length} categorías`;
});
await prueba('API', 'catálogo de productos', async () => {
  const p = await json(`${API}/catalog/products?limit=5`);
  exige(Array.isArray(p.items), 'no trae items');
  return `${p.items.length} en la primera página`;
});
await prueba('API', 'métodos de pago', async () => {
  const m = await json(`${API}/payments/methods`);
  return JSON.stringify(m).slice(0, 120);
});
await prueba('API', 'proveedores de login', async () => {
  const p = await json(`${API}/auth/providers`);
  return JSON.stringify(p);
});
await prueba('API', 'preguntas frecuentes', async () => {
  const f = await json(`${API}/content/faqs`);
  exige(Array.isArray(f) || typeof f === 'object', 'respuesta rara');
});

// ---------------------------------------------------------------- Cotizador
let catMaq = null;
await prueba('Cotizador', 'tabulador de maquinaria público', async () => {
  catMaq = await json(`${API}/quoter/catalog/maquinaria`);
  exige(catMaq.equipos?.length > 0, 'sin equipos');
  const muni = catMaq.municipios || [];
  const norte = muni.filter((m) => /Coah\.|Chih\./.test(m)).length;
  return `${catMaq.equipos.length} equipos · ${muni.length} municipios` +
    (norte ? ` (${norte} de Coahuila/Chihuahua)` : ' · AVISO: faltan los de Coahuila y Chihuahua');
});
await prueba('Cotizador', 'el tabulador no publica dueños', async () => {
  exige(catMaq, 'sin tabulador');
  const s = JSON.stringify(catMaq);
  exige(!/"(provider|providers|dueno|dueño|proveedor)_?id"/i.test(s), 'aparecen ids de proveedor');
});
await prueba('Cotizador', 'tabulador de triturados público', async () => {
  const t = await json(`${API}/quoter/catalog/triturados`);
  return `${(t.productos || t.materiales || []).length || 'ok'} materiales`;
});
await prueba('Cotizador', 'calcula una renta de 3 días', async () => {
  exige(catMaq, 'sin tabulador');
  const eq = catMaq.equipos[0];
  const r = await json(`${API}/quoter/calculate/maquinaria`, post({ partidas: [{ tipo: 'equipo', id: eq.id, dias: 3, cantidad: 1 }] }));
  exige(Number(r.total) > 0, `total=${r.total}`);
  return `${eq.nombre}: $${Number(r.total).toLocaleString('es-MX')}`;
});
await prueba('Cotizador', 'ignora el precio que manda el cliente', async () => {
  exige(catMaq, 'sin tabulador');
  const eq = catMaq.equipos[0];
  const base = await json(`${API}/quoter/calculate/maquinaria`, post({ partidas: [{ tipo: 'equipo', id: eq.id, dias: 3 }] }));
  const trampa = await json(`${API}/quoter/calculate/maquinaria`, post({ partidas: [{ tipo: 'equipo', id: eq.id, dias: 3, precio_hora: 1 }] }));
  exige(Number(base.total) === Number(trampa.total), `con precio_hora=1 da ${trampa.total} y sin él ${base.total}`);
});
await prueba('Cotizador', 'rechaza partidas inválidas (400)', async () => {
  const r = await pedir(`${API}/quoter/calculate/maquinaria`, post({ partidas: 'x' }));
  exige(r.status === 400, `HTTP ${r.status}`);
});

// ---------------------------------------------------------------- Seguridad
const cerradas = [
  ['GET', '/auth/me'],
  ['GET', '/quotes/mine'],
  ['GET', '/orders'],
  ['GET', '/notifications'],
  ['GET', '/admin/roles'],
  ['GET', '/aliado'],
  ['POST', '/quoter/request/maquinaria'],
];
for (const [m, p] of cerradas) {
  await prueba('Seguridad', `${m} ${p} exige sesión`, async () => {
    const r = await pedir(`${API}${p}`, m === 'POST' ? post({}) : {});
    exige([401, 403].includes(r.status), `HTTP ${r.status}`);
  });
}
await prueba('Seguridad', 'tareas programadas exigen secreto', async () => {
  const r = await pedir(`${API}/tareas/recordatorios`, post({}));
  exige([401, 403, 404].includes(r.status), `HTTP ${r.status} — cualquiera podría dispararlas`);
});
await prueba('Seguridad', 'rutas /maquinas desmontadas', async () => {
  const r = await pedir(`${API}/maquinas/lineas`);
  exige(r.status === 404, `HTTP ${r.status}`);
});
await prueba('Seguridad', 'HTTP redirige a HTTPS', async () => {
  if (!WEB.startsWith('https://')) return 'omitida (local)';
  const r = await pedir(WEB.replace('https://', 'http://') + '/');
  exige([301, 302, 307, 308].includes(r.status), `HTTP ${r.status}`);
});
await prueba('Seguridad', 'www redirige al dominio', async () => {
  if (!WEB.startsWith('https://')) return 'omitida (local)';
  const r = await pedir(WEB.replace('https://', 'https://www.') + '/');
  exige([301, 308].includes(r.status), `HTTP ${r.status}`);
});

// ---------------------------------------------------------------- Sitio
const paginas = [
  '/', '/cotizador', '/cotizador/maquinaria', '/cotizador/triturados', '/cotizar',
  '/servicios', '/contacto', '/blog', '/login', '/registro', '/terminos', '/privacidad',
];
for (const p of paginas) {
  await prueba('Sitio', `página ${p}`, async () => {
    const r = await pedir(`${WEB}${p}`);
    exige(r.status === 200, `HTTP ${r.status}`);
    const html = await r.text();
    exige(/MAQSER24/i.test(html), 'no aparece la marca');
    exige(!/Application error|Internal Server Error/i.test(html), 'la página trae un error');
  });
}
await prueba('Sitio', 'una ficha de producto abre', async () => {
  const p = await json(`${API}/catalog/products?limit=1`);
  const it = p.items?.[0];
  if (!it) return 'sin productos';
  const r = await pedir(`${WEB}/servicios/${it.slug}`);
  exige(r.status === 200, `HTTP ${r.status} en /servicios/${it.slug}`);
  return it.name;
});
await prueba('Sitio', 'la URL vieja /productos redirige', async () => {
  const r = await pedir(`${WEB}/productos`);
  exige([301, 307, 308].includes(r.status) && /\/servicios/.test(r.headers.get('location') || ''), `HTTP ${r.status}`);
});
await prueba('Sitio', 'una página que no existe da 404', async () => {
  const r = await pedir(`${WEB}/esta-pagina-no-existe-${Date.now()}`);
  exige(r.status === 404, `HTTP ${r.status}`);
});
await prueba('Sitio', 'sitemap.xml y robots.txt', async () => {
  const s = await pedir(`${WEB}/sitemap.xml`);
  exige(s.status === 200, `sitemap HTTP ${s.status}`);
  const n = ((await s.text()).match(/<loc>/g) || []).length;
  const r = await pedir(`${WEB}/robots.txt`);
  exige(r.status === 200 && /sitemap/i.test(await r.text()), 'robots sin Sitemap');
  return `${n} URLs en el sitemap`;
});
await prueba('Sitio', 'imágenes optimizadas (webp)', async () => {
  const p = await json(`${API}/catalog/products?limit=1`);
  const img = p.items?.[0]?.image;
  if (!img) return 'sin imagen para probar';
  const r = await pedir(`${WEB}/_next/image?url=${encodeURIComponent(img)}&w=384&q=75`, {
    headers: { Accept: 'image/avif,image/webp,*/*' },
  });
  exige(r.status === 200, `HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  exige(/webp|avif/.test(ct), `devuelve ${ct} (¿sharp roto?)`);
  return ct;
});

// ---------------------------------------------------------------- Panel
await prueba('Panel', 'login del panel', async () => {
  const r = await pedir(`${ADMIN}/login`);
  exige(r.status === 200, `HTTP ${r.status}`);
});
await prueba('Panel', 'sin sesión no entra al panel', async () => {
  const r = await pedir(`${ADMIN}/`);
  exige([302, 303, 307, 308].includes(r.status) || (r.status === 200 && /login|contraseña/i.test(await r.text())), `HTTP ${r.status}`);
});

// ---------------------------------------------------------------- Reporte
const grupos = [...new Set(resultados.map((r) => r.grupo))];
let fallas = 0;
for (const g of grupos) {
  console.log(`\n${g}`);
  for (const r of resultados.filter((x) => x.grupo === g)) {
    if (!r.ok) fallas++;
    const marca = r.ok ? (/AVISO/.test(r.nota) ? '!' : '✓') : '✗';
    console.log(`  ${marca} ${r.nombre.padEnd(44)} ${String(r.ms).padStart(5)} ms  ${r.nota}`);
  }
}
console.log(`\n${resultados.length - fallas}/${resultados.length} bien${fallas ? ` · ${fallas} FALLA(S)` : ''}`);
process.exit(fallas ? 1 : 0);
