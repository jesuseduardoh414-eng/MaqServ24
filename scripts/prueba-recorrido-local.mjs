#!/usr/bin/env node
/**
 * RECORRIDO COMPLETO DE PUNTA A PUNTA — SOLO EN LOCAL.
 *
 * Hace por la API lo mismo que el guion de pruebas (E-01..E-15): un cliente se
 * registra y confirma su correo, pide un servicio en el cotizador, MAQSER24 da
 * de alta a un aliado y se lo ofrece, el aliado acepta y reporta su avance, y
 * el panel cierra. Además prueba los roles del panel.
 *
 * ESCRIBE en la base (todo con "PRUEBA-AUTO" en el nombre), por eso se niega a
 * correr contra algo que no sea localhost. Necesita:
 *   - API en :4000 con MAIL_ENABLED=true apuntando a Mailpit (apps/api/.env)
 *   - Mailpit en :8025  (herramientas/mailpit/mailpit.exe --smtp-auth-accept-any --smtp-auth-allow-insecure)
 *   - Las cuentas u-<rol>@maqserv24.test con la contraseña de ADMIN_PASS
 *
 *   node scripts/prueba-recorrido-local.mjs
 */

const API = process.env.API ?? 'http://localhost:4000';
const MAILPIT = process.env.MAILPIT ?? 'http://localhost:8025';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'Pruebas2026!';

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) {
  console.error(`Este script escribe en la base: solo corre contra localhost (API=${API}).`);
  process.exit(2);
}

const TS = Date.now().toString(36);
const CLIENTE = `cliente.${TS}@maqserv24.test`;
const ALIADO = `aliado.${TS}@maqserv24.test`;
let ip = 0;
const otraIp = () => `10.99.${Math.floor(++ip / 250)}.${ip % 250}`; // el límite de login es por IP

const pasos = [];
async function paso(nombre, fn) {
  try {
    const nota = await fn();
    pasos.push({ nombre, ok: true, nota: nota ?? '' });
    console.log(`  ✓ ${nombre}${nota ? `  — ${nota}` : ''}`);
  } catch (e) {
    pasos.push({ nombre, ok: false, nota: e.message });
    console.log(`  ✗ ${nombre}  — ${e.message}`);
  }
}
const exige = (c, m) => { if (!c) throw new Error(m); };

async function api(metodo, ruta, { token, body, esperado } = {}) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-client-ip': otraIp(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (esperado !== undefined) {
    exige(r.status === esperado, `${metodo} ${ruta} → HTTP ${r.status} (esperaba ${esperado}) ${JSON.stringify(data)?.slice(0, 160)}`);
  } else {
    exige(r.ok, `${metodo} ${ruta} → HTTP ${r.status} ${JSON.stringify(data)?.slice(0, 200)}`);
  }
  return data;
}

async function correos(para) {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${para}"`)}`);
  exige(r.ok, `Mailpit no responde en ${MAILPIT}`);
  return (await r.json()).messages ?? [];
}
async function esperaCorreo(para, filtro = () => true, intentos = 20) {
  for (let i = 0; i < intentos; i++) {
    const m = (await correos(para)).filter(filtro);
    if (m.length) {
      const r = await fetch(`${MAILPIT}/api/v1/message/${m[0].ID}`);
      return r.json();
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`no llegó correo a ${para}`);
}
const enlaceCon = (msg, param) => {
  const texto = `${msg.Text ?? ''} ${msg.HTML ?? ''}`.replace(/&amp;/g, '&');
  const m = texto.match(new RegExp(`[?&]${param}=([A-Za-z0-9._\\-%]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

const ctx = {};
console.log(`\nRecorrido local · ${new Date().toLocaleString('es-MX')} · etiqueta ${TS}\n`);

// ------------------------------------------------------------- Cliente
console.log('Cliente');
await paso('se registra (pide confirmar correo)', async () => {
  const r = await api('POST', '/auth/register', { body: { name: `PRUEBA-AUTO Cliente ${TS}`, email: CLIENTE, password: 'Tizne#Volcan-83Qr' } });
  exige(r.verificar === true, `respuesta ${JSON.stringify(r)}`);
});
await paso('no puede entrar sin confirmar', async () => {
  await api('POST', '/auth/login', { body: { email: CLIENTE, password: 'Tizne#Volcan-83Qr' }, esperado: 403 });
});
await paso('le llega el correo de confirmación y el enlace sirve', async () => {
  const msg = await esperaCorreo(CLIENTE);
  const t = enlaceCon(msg, 't') ?? enlaceCon(msg, 'token');
  exige(t, `el correo "${msg.Subject}" no trae enlace`);
  const r = await api('POST', '/auth/verify', { body: { token: t } });
  exige(r.token, 'no devolvió sesión');
  ctx.cliente = r.token;
  return msg.Subject;
});
await paso('inicia sesión', async () => {
  const r = await api('POST', '/auth/login', { body: { email: CLIENTE, password: 'Tizne#Volcan-83Qr' } });
  ctx.cliente = r.token;
});

// ------------------------------------------------------------- Cotizador
console.log('\nCotizador');
const solicitud = {
  cliente: `PRUEBA-AUTO Constructora ${TS}`, obra: 'Obra de prueba', municipio: 'Monterrey',
  correo: CLIENTE, telefono: '8112345678',
  partidas: [{ tipo: 'equipo', id: 'retro_cuch', dias: 3, cantidad: 1 }],
};
await paso('sin sesión no se puede solicitar', async () => {
  await api('POST', '/quoter/request/maquinaria', { body: solicitud, esperado: 401 });
});
await paso('solicita servicio de maquinaria', async () => {
  const r = await api('POST', '/quoter/request/maquinaria', { token: ctx.cliente, body: solicitud });
  exige(r.folio && r.quoteNumber, `respuesta ${JSON.stringify(r)}`);
  Object.assign(ctx, { folio: r.folio, cot: r.quoteNumber });
  return `${r.folio} · ${r.quoteNumber} · $${r.total}`;
});
await paso('el doble envío devuelve el mismo folio', async () => {
  const r = await api('POST', '/quoter/request/maquinaria', { token: ctx.cliente, body: solicitud });
  exige(r.folio === ctx.folio, `${r.folio} ≠ ${ctx.folio}`);
});
await paso('el cliente la ve en su cuenta', async () => {
  const r = await api('GET', `/quotes/${ctx.cot}`, { token: ctx.cliente });
  return `estado ${r.serviceState ?? r.service_state ?? r.status}`;
});
await paso('el cliente recibe aviso en la campana', async () => {
  const r = await api('GET', '/notifications', { token: ctx.cliente });
  const n = Array.isArray(r) ? r.length : (r.items?.length ?? 0);
  exige(n > 0, 'sin avisos');
  return `${n} aviso(s)`;
});

// ------------------------------------------------------------- Panel
console.log('\nPanel');
await paso('Dirección inicia sesión', async () => {
  const r = await api('POST', '/admin/auth/login', { body: { email: 'u-direccion@maqserv24.test', password: ADMIN_PASS } });
  exige(r.token, 'sin token');
  ctx.admin = r.token;
});
await paso('la solicitud aparece Por asignar', async () => {
  const r = await api('GET', '/admin/services', { token: ctx.admin });
  const lista = Array.isArray(r) ? r : (r.items ?? r.servicios ?? []);
  const s = lista.find((x) => (x.quoteNumber ?? x.quote_number) === ctx.cot);
  exige(s, `${ctx.cot} no está en el tablero`);
  ctx.servicio = Number(s.id);
  return `servicio #${s.id} · ${s.state ?? s.serviceState}`;
});
await paso('da de alta al aliado', async () => {
  const r = await api('POST', '/admin/providers', {
    token: ctx.admin,
    body: { name: `PRUEBA-AUTO Aliado ${TS}`, email: ALIADO, phone: `81${TS.slice(-8).replace(/\D/g, '1').padStart(8, '1')}`, state: 'Nuevo León', city: 'Monterrey', coverage: ['Monterrey'], categories: ['maquinaria-pesada'] },
  });
  ctx.aliadoId = Number(r.id ?? r.provider?.id);
  exige(ctx.aliadoId, `respuesta ${JSON.stringify(r).slice(0, 160)}`);
  return `#${ctx.aliadoId}`;
});
await paso('el mismo alta otra vez se rechaza (409)', async () => {
  await api('POST', '/admin/providers', { token: ctx.admin, body: { name: `PRUEBA-AUTO Aliado ${TS}`, email: ALIADO }, esperado: 409 });
});
await paso('le ofrece el servicio al aliado', async () => {
  await api('POST', `/admin/services/${ctx.servicio}/ofrecer`, { token: ctx.admin, body: { providerId: ctx.aliadoId } });
});
await paso('le llega al aliado el correo con su enlace', async () => {
  const msg = await esperaCorreo(ALIADO);
  ctx.aliado = enlaceCon(msg, 't');
  exige(ctx.aliado, `el correo "${msg.Subject}" no trae enlace`);
  return msg.Subject;
});

// ------------------------------------------------------------- Aliado
console.log('\nAliado');
await paso('abre su portal con el enlace', async () => {
  const r = await api('GET', '/aliado', { token: ctx.aliado });
  const s = (r.porContestar ?? []).find((x) => x.quoteNumber === ctx.cot);
  exige(s, 'la solicitud no aparece en Por contestar');
  ctx.asignacion = s.assignmentId;
  return `${r.porContestar.length} por contestar`;
});
await paso('un enlace falso no abre', async () => {
  await api('GET', '/aliado', { token: 'no.es.un.token', esperado: 401 });
});
await paso('acepta con hora de llegada', async () => {
  const llegada = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  await api('PATCH', `/aliado/solicitudes/${ctx.asignacion}`, { token: ctx.aliado, body: { estado: 'aceptado', llegada } });
});
await paso('contestar otra vez se rechaza', async () => {
  await api('PATCH', `/aliado/solicitudes/${ctx.asignacion}`, { token: ctx.aliado, body: { estado: 'rechazado', motivo: 'x' }, esperado: 400 });
});
for (const estado of ['en_traslado', 'en_sitio', 'en_curso', 'terminado']) {
  await paso(`reporta ${estado}`, async () => {
    await api('PATCH', `/aliado/servicios/${ctx.cot}/avance`, { token: ctx.aliado, body: { estado } });
  });
}

// ------------------------------------------------------------- Cierre
console.log('\nCierre');
await paso('cerrar sin cantidad se rechaza', async () => {
  const r = await fetch(`${API}/admin/services/${ctx.servicio}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.admin}` },
    body: JSON.stringify({ state: 'cerrado' }),
  });
  exige(r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
});
await paso('cierra con 3 días', async () => {
  await api('PATCH', `/admin/services/${ctx.servicio}`, { token: ctx.admin, body: { state: 'cerrado', quantity: 3, unit: 'dia', note: 'PRUEBA-AUTO' } });
});
await paso('el cliente lo ve cerrado', async () => {
  const r = await api('GET', `/quotes/${ctx.cot}`, { token: ctx.cliente });
  const s = JSON.stringify(r);
  exige(/cerrado/i.test(s), 'no dice cerrado');
});
await paso('correos del recorrido', async () => {
  const c = await correos(CLIENTE);
  const a = await correos(ALIADO);
  exige(c.length >= 3 && a.length >= 2, `cliente ${c.length}, aliado ${a.length}`);
  return `cliente ${c.length} · aliado ${a.length}`;
});

// ------------------------------------------------------------- Roles
console.log('\nRoles del panel');
const matriz = {
  operaciones: { '/admin/services': 200, '/admin/admins': 403 },
  red: { '/admin/providers': 200, '/admin/services': 403 },
  comercial: { '/admin/quotes': 200, '/admin/providers': 403 },
  marca: { '/admin/services': 403, '/admin/quotes': 403 },
};
for (const [rol, rutas] of Object.entries(matriz)) {
  await paso(`rol ${rol}`, async () => {
    const r = await api('POST', '/admin/auth/login', { body: { email: `u-${rol}@maqserv24.test`, password: ADMIN_PASS } });
    const malas = [];
    for (const [ruta, code] of Object.entries(rutas)) {
      const x = await fetch(`${API}${ruta}`, { headers: { authorization: `Bearer ${r.token}` } });
      if (x.status !== code) malas.push(`${ruta} dio ${x.status}, esperaba ${code}`);
    }
    exige(!malas.length, malas.join('; '));
  });
}

// ------------------------------------------------------------- Seguridad
console.log('\nSeguridad');
await paso('otro cliente no ve la cotización ajena', async () => {
  const otro = `otro.${TS}@maqserv24.test`;
  await api('POST', '/auth/register', { body: { name: 'PRUEBA-AUTO Otro', email: otro, password: 'Tizne#Volcan-83Qr' } });
  const t = enlaceCon(await esperaCorreo(otro), 't');
  const s = await api('POST', '/auth/verify', { body: { token: t } });
  const r = await fetch(`${API}/quotes/${ctx.cot}`, { headers: { authorization: `Bearer ${s.token}` } });
  exige(r.status >= 400, `HTTP ${r.status}: la ve`);
});

const malos = pasos.filter((p) => !p.ok).length;
console.log(`\n${pasos.length - malos}/${pasos.length} bien${malos ? ` · ${malos} FALLA(S)` : ''}`);
console.log(`Correos del recorrido: ${MAILPIT}  ·  datos con "PRUEBA-AUTO" y "${TS}"`);
process.exit(malos ? 1 : 0);
