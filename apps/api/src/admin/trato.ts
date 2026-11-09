import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { prisma, type Prisma } from '@maqserv/db';
import { ROLES_ADMIN, puedeVerCon, type ModuloAdmin } from '@maqserv/config';
import type { AdminRequest } from './admin-auth';
import { permisosVigentes } from './permisos';

/**
 * EL TRATO CON CLIENTES Y ALIADOS (2026-11-09).
 *
 * "Que quede registro de las llamadas y los WhatsApp, más allá del botón «Ya
 * le hablé»." Cada renglón dice por dónde (llamada, WhatsApp, correo, en
 * persona), quién del panel (sale de la sesión), cuándo (solo) y, si se
 * quiere, una nota corta con cómo quedó y un "recuérdame".
 *
 * DÓNDE SE GUARDA, SIN SQL: en `admin_audit`, la bitácora de quién hizo qué.
 * Se revisaron las demás tablas y ninguna encaja de verdad:
 *  - `service_events` y `order_events` cuelgan de UNA solicitud o pedido: no
 *    sirven para el trato con un cliente o un aliado sin solicitud de por medio.
 *  - `email_log` es el registro de lo que el sistema manda; meter ahí llamadas
 *    ensuciaría la pantalla de Correo y sus conteos.
 *  - `notifications` son los avisos de la campana (del sitio y del panel).
 *  - `platform_settings` es una fila por ajuste: no sirve para algo que crece sin fin.
 * `admin_audit` ya tiene exactamente lo que pide un renglón: quién (id y
 * correo, que sobrevive aunque la cuenta se borre), cuándo, a qué (`objetivo`)
 * y un texto libre (`detalle`, aquí en JSON). Y ya se usa así: las
 * invitaciones a la red viven ahí desde el 2026-10-27.
 *
 * Reglas para no estorbarle a la bitácora de acciones sensibles:
 *  - Todos los renglones llevan `accion = 'contacto'`; la pantalla de Bitácora
 *    (Equipo del panel) los deja fuera: cada trato se ve en su lugar.
 *  - Son los ÚNICOS renglones de esa tabla que se tocan después de escritos, y
 *    solo en su nota, resultado y recordatorio; quién y cuándo no cambian. Y no
 *    se borran: "quitar" uno lo esconde.
 *  - `objetivo` lleva las llaves de a qué pertenece, entre barras:
 *    `|solicitud:12|cliente:4|`. Así un mismo renglón sale en la solicitud y en
 *    el cliente sin escribirlo dos veces, y se busca con `contains` sin
 *    confundir el 4 con el 40.
 */

export const ACCION_CONTACTO = 'contacto';

export const CANALES = ['llamada', 'whatsapp', 'correo', 'visita'] as const;
export type Canal = (typeof CANALES)[number];
/** Los resultados rápidos; lo demás va en la nota. */
export const RESULTADOS = ['no_contesto', 'confirmar', 'confirmado'] as const;
export type Resultado = (typeof RESULTADOS)[number];

export type TipoObjetivo = 'solicitud' | 'cliente' | 'aliado' | 'documento';
const TIPOS: readonly TipoObjetivo[] = ['solicitud', 'cliente', 'aliado', 'documento'];
export type Objetivo = Partial<Record<TipoObjetivo, number>>;

/**
 * Qué módulo deja ver y anotar cada cosa. Una solicitud también se atiende
 * desde Servicios (ahí se le llama al aliado), por eso le basta cualquiera de
 * los dos.
 */
export const MODULOS_DE: Record<TipoObjetivo, ModuloAdmin[]> = {
  solicitud: ['cotizaciones', 'servicios'],
  cliente: ['clientes'],
  aliado: ['proveedores'],
  documento: ['cotizador'],
};

/** Lo que se guarda en `detalle`. Corto a propósito: la tabla es de texto. */
export interface DetalleContacto {
  con: 'cliente' | 'aliado';
  canal: Canal;
  /** A quién: el nombre tal como era ese día. */
  a?: string | null;
  /** Lo anotó el panel solo, al abrir WhatsApp o marcar desde un botón. */
  auto?: boolean;
  nota?: string | null;
  res?: Resultado | null;
  /** AAAA-MM-DD, día de Monterrey en que sale en el Inicio de quien lo anotó. */
  recordar?: string | null;
  /** Cuándo se puso el recordatorio (ISO): lo que pase desde entonces lo apaga. */
  rdesde?: string | null;
  hecho?: boolean;
  /** Escondido por quien lo anotó (p. ej. marcó sin querer). */
  quitado?: boolean;
}

/** Un renglón de la línea de tiempo, como lo pinta el panel. */
export interface RenglonTrato {
  /** 'c123' (contacto) o 'm45' (correo del sistema): no chocan entre sí. */
  id: string;
  tipo: 'contacto' | 'correo';
  cuando: string;
  canal: Canal;
  con: 'cliente' | 'aliado';
  a: string | null;
  /** Quién del panel; null en los correos (los manda el sistema). */
  quien: string | null;
  auto: boolean;
  nota: string | null;
  res: Resultado | null;
  recordar: string | null;
  hecho: boolean;
  /** Lo puede corregir quien pregunta (lo anotó él, o es Dirección). */
  editable: boolean;
  /** La solicitud a la que pertenece, para cuando se ve desde el cliente o el aliado. */
  solicitudId: number | null;
  folio: string | null;
  // Solo los correos:
  asunto?: string;
  estado?: string;
  correoId?: number;
}

const clave = (t: TipoObjetivo, id: number) => `${t}:${id}`;
const contiene = (t: TipoObjetivo, id: number) => `|${clave(t, id)}|`;

/** `|solicitud:12|cliente:4|` → [['solicitud', 12], ['cliente', 4]]. */
export function llavesDe(objetivo: string | null): Array<[TipoObjetivo, number]> {
  return (objetivo ?? '')
    .split('|')
    .map((p) => p.split(':'))
    .filter((p): p is [TipoObjetivo, string] => p.length === 2 && (TIPOS as readonly string[]).includes(p[0]))
    .map(([t, n]) => [t, Number(n)] as [TipoObjetivo, number])
    .filter(([, n]) => Number.isInteger(n) && n > 0);
}

export function leerDetalle(s: string | null): DetalleContacto | null {
  if (!s) return null;
  try {
    const d = JSON.parse(s) as DetalleContacto;
    if (!d || (d.con !== 'cliente' && d.con !== 'aliado') || !(CANALES as readonly string[]).includes(d.canal)) return null;
    return d;
  } catch {
    return null;
  }
}

/** El día de hoy en Monterrey, AAAA-MM-DD: el "hoy" de los recordatorios. */
export const hoyMty = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());

/** ¿Puede ver o anotar en alguna de estas cosas? */
export async function puedeEn(req: AdminRequest, tipos: TipoObjetivo[]): Promise<boolean> {
  const permisos = await permisosVigentes();
  return tipos.some((t) => MODULOS_DE[t].some((m) => puedeVerCon(req.adminRol, m, permisos)));
}

export async function exigirEn(req: AdminRequest, tipos: TipoObjetivo[]): Promise<void> {
  if (!(await puedeEn(req, tipos))) throw new ForbiddenException('Tu rol no tiene acceso a esta sección del panel');
}

/**
 * ¿Cuenta como "ya se le habló"? Lo que escribió una persona, sí; lo que el
 * panel anotó solo al abrir WhatsApp, hasta que le ponen cómo quedó (abrir el
 * chat no es haber hablado). "No contestó" no cuenta: nadie le dio señales.
 */
function cuentaComoContacto(d: DetalleContacto): boolean {
  if (d.con !== 'cliente' || d.quitado) return false;
  if (d.auto && !d.res) return false;
  return d.res !== 'no_contesto';
}

/**
 * «Ya le hablé» sin perder lo que hacía (2026-11-09): el primer renglón que
 * cuenta como contacto sella el PRIMER CONTACTO de la solicitud, el dato del
 * indicador de primera respuesta. Uno anotado en el cliente sella también
 * sus solicitudes por cotizar que ya habían llegado: hablarle es hablarle de
 * todo lo que tiene pendiente. Solo la primera vez: la tercera llamada no
 * reescribe cuándo fue la primera.
 */
async function sellarPrimerContacto(llaves: Array<[TipoObjetivo, number]>, d: DetalleContacto, cuando: Date, quien: string | null) {
  if (!cuentaComoContacto(d)) return;
  const solicitudes = llaves.filter(([t]) => t === 'solicitud').map(([, n]) => n);
  const clientes = llaves.filter(([t]) => t === 'cliente').map(([, n]) => n);
  if (!solicitudes.length && !clientes.length) return;
  const or: Prisma.quotesWhereInput[] = [];
  if (solicitudes.length) or.push({ id: { in: solicitudes } });
  if (clientes.length) or.push({ client_id: { in: clientes }, status: 'pending', created_at: { lte: cuando } });
  await prisma.quotes.updateMany({
    where: { first_contact_at: null, OR: or },
    data: { first_contact_at: cuando, first_contact_by: quien?.slice(0, 190) ?? null, first_contact_via: d.canal },
  }).catch(() => undefined);
}

/**
 * Completa las llaves con lo que ya se sabe, para que el renglón salga en
 * todos los lugares donde importa sin que nadie lo repita: la solicitud lleva
 * a su cliente; el documento del cotizador, a sus solicitudes y a su cliente.
 * De paso confirma que lo que se pidió existe y saca a quién se le habló.
 */
async function completar(obj: Objetivo, con: 'cliente' | 'aliado'): Promise<{ llaves: Array<[TipoObjetivo, number]>; a: string | null }> {
  const llaves: Array<[TipoObjetivo, number]> = [];
  const poner = (t: TipoObjetivo, n: number | null | undefined) => {
    if (n && !llaves.some(([x, y]) => x === t && y === n)) llaves.push([t, n]);
  };
  let a: string | null = null;

  if (obj.solicitud) {
    const q = await prisma.quotes.findUnique({ where: { id: obj.solicitud }, select: { id: true, client_id: true, name: true, company_name: true } });
    if (!q) throw new NotFoundException('No encontramos esa solicitud.');
    poner('solicitud', Number(q.id));
    if (con === 'cliente') {
      poner('cliente', q.client_id);
      a = q.company_name && q.company_name !== q.name ? `${q.name} · ${q.company_name}` : q.name;
    }
  }
  if (obj.documento) {
    const doc = await prisma.quoter_quotes.findUnique({ where: { id: obj.documento }, select: { id: true, folio: true, client_name: true, attention: true, snapshot: true } });
    if (!doc) throw new NotFoundException('No encontramos esa cotización.');
    poner('documento', doc.id);
    if (con === 'cliente') {
      const partes = await prisma.quotes.findMany({
        where: { requirements: { path: '$.folio', equals: doc.folio } },
        select: { id: true, client_id: true },
        orderBy: { id: 'asc' },
        take: 6,
      });
      partes.forEach((p) => poner('solicitud', Number(p.id)));
      const destino = (doc.snapshot as { destino?: { clientId?: unknown } } | null)?.destino?.clientId;
      poner('cliente', typeof destino === 'number' ? destino : partes[0]?.client_id ?? null);
      a ??= doc.attention || doc.client_name || null;
    }
  }
  if (obj.cliente && con === 'cliente') {
    const c = await prisma.clients.findUnique({ where: { id: obj.cliente }, select: { id: true, name: true } });
    if (!c) throw new NotFoundException('No encontramos ese cliente.');
    poner('cliente', c.id);
    a ??= c.name;
  }
  if (con === 'aliado') {
    if (!obj.aliado) throw new BadRequestException('Falta a qué aliado se le habló.');
    const p = await prisma.providers.findUnique({ where: { id: obj.aliado }, select: { id: true, name: true } });
    if (!p) throw new NotFoundException('No encontramos ese aliado.');
    poner('aliado', p.id);
    a = p.name;
  }
  if (!llaves.length) throw new BadRequestException('Falta con quién fue.');
  return { llaves, a };
}

/** El módulo con el que se guarda (columna `modulo`): el del lugar donde se anotó. */
function moduloDe(obj: Objetivo): ModuloAdmin {
  if (obj.solicitud) return 'cotizaciones';
  if (obj.documento) return 'cotizador';
  if (obj.cliente) return 'clientes';
  return 'proveedores';
}

/** Lo que alguien anota, ya validado. */
export interface Anotacion {
  objetivo: Objetivo;
  con: 'cliente' | 'aliado';
  canal: Canal;
  /** A quién, si la pantalla sabe algo más preciso (el contacto de la obra). */
  a?: string | null;
  nota?: string | null;
  res?: Resultado | null;
  recordar?: string | null;
  auto?: boolean;
}

export function validarRecordar(v: string | null | undefined): string | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException('La fecha del recordatorio no es válida.');
  if (v < hoyMty()) throw new BadRequestException('El recordatorio tiene que ser hoy o después.');
  return v;
}

export async function anotarContacto(req: AdminRequest, e: Anotacion): Promise<RenglonTrato> {
  const { llaves, a } = await completar(e.objetivo, e.con);
  const d: DetalleContacto = {
    con: e.con,
    canal: e.canal,
    a: (e.a?.trim() || a || null)?.slice(0, 160) ?? null,
    ...(e.auto ? { auto: true } : {}),
    ...(e.nota?.trim() ? { nota: e.nota.trim().slice(0, 300) } : {}),
    ...(e.res ? { res: e.res } : {}),
    ...(e.recordar ? { recordar: validarRecordar(e.recordar), rdesde: new Date().toISOString() } : {}),
  };
  const fila = await prisma.admin_audit.create({
    data: {
      admin_id: req.adminId,
      admin_email: (req.adminEmail ?? '').slice(0, 190),
      admin_rol: ROLES_ADMIN[req.adminRol]?.nombre?.slice(0, 40) ?? req.adminRol,
      modulo: moduloDe(e.objetivo),
      accion: ACCION_CONTACTO,
      objetivo: `|${llaves.map(([t, n]) => clave(t, n)).join('|')}|`.slice(0, 190),
      detalle: JSON.stringify(d),
    },
  });
  await sellarPrimerContacto(llaves, d, fila.created_at, req.adminNombre ?? null);
  return (await aRenglones(req, [fila]))[0];
}

/** Nota, resultado o recordatorio después de anotado. Solo quien lo anotó (o Dirección). */
export async function corregirContacto(
  req: AdminRequest,
  id: number,
  cambios: { nota?: string | null; res?: Resultado | null; recordar?: string | null; hecho?: boolean; quitado?: boolean },
): Promise<RenglonTrato | null> {
  const fila = await prisma.admin_audit.findUnique({ where: { id } });
  const d = fila?.accion === ACCION_CONTACTO ? leerDetalle(fila.detalle) : null;
  if (!fila || !d) throw new NotFoundException('No encontramos ese renglón.');
  if (fila.admin_id !== req.adminId && req.adminRol !== 'direccion') {
    throw new ForbiddenException('Solo quien lo anotó puede cambiarlo. Agrega tu propio renglón.');
  }
  if (cambios.nota !== undefined) d.nota = cambios.nota?.trim() ? cambios.nota.trim().slice(0, 300) : null;
  if (cambios.res !== undefined) d.res = cambios.res;
  if (cambios.recordar !== undefined) {
    d.recordar = validarRecordar(cambios.recordar);
    // Un recordatorio nuevo vuelve a estar pendiente, y cuenta desde ahora.
    d.rdesde = d.recordar ? new Date().toISOString() : null;
    if (d.recordar) d.hecho = false;
  }
  if (cambios.hecho !== undefined) d.hecho = cambios.hecho;
  if (cambios.quitado !== undefined) d.quitado = cambios.quitado;
  const limpio = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== false));
  await prisma.admin_audit.update({ where: { id }, data: { detalle: JSON.stringify(limpio) } });
  // Con el resultado puesto, un renglón que el panel anotó solo pasa a ser contacto de verdad.
  const quien = await prisma.admins.findUnique({ where: { id: fila.admin_id }, select: { name: true } }).catch(() => null);
  await sellarPrimerContacto(llavesDe(fila.objetivo), d, fila.created_at, quien?.name ?? null);
  if (d.quitado) return null;
  return (await aRenglones(req, [{ ...fila, detalle: JSON.stringify(d) }]))[0];
}

type FilaAudit = { id: number; admin_id: number; admin_email: string; objetivo: string | null; detalle: string | null; created_at: Date };

/** Filas de la bitácora → renglones, con el nombre de quién y el folio de su solicitud. */
async function aRenglones(req: AdminRequest, filas: FilaAudit[]): Promise<RenglonTrato[]> {
  const conDetalle = filas.map((f) => ({ f, d: leerDetalle(f.detalle), llaves: llavesDe(f.objetivo) })).filter((x) => x.d && !x.d.quitado);
  const adminIds = [...new Set(conDetalle.map((x) => x.f.admin_id))];
  const solicitudIds = [...new Set(conDetalle.flatMap((x) => x.llaves.filter(([t]) => t === 'solicitud').map(([, n]) => n)))];
  const [admins, folios] = await Promise.all([
    adminIds.length ? prisma.admins.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }) : [],
    solicitudIds.length ? prisma.quotes.findMany({ where: { id: { in: solicitudIds } }, select: { id: true, quote_number: true } }) : [],
  ]);
  const nombre = new Map(admins.map((a) => [a.id, a.name]));
  const folio = new Map(folios.map((q) => [Number(q.id), q.quote_number]));
  return conDetalle.map(({ f, d, llaves }) => {
    const sol = llaves.find(([t]) => t === 'solicitud')?.[1] ?? null;
    return {
      id: `c${f.id}`,
      tipo: 'contacto',
      cuando: f.created_at.toISOString(),
      canal: d!.canal,
      con: d!.con,
      a: d!.a ?? null,
      // Si la cuenta ya no existe, su correo: la bitácora sigue diciendo quién fue.
      quien: nombre.get(f.admin_id) ?? f.admin_email,
      auto: Boolean(d!.auto),
      nota: d!.nota ?? null,
      res: d!.res ?? null,
      recordar: d!.recordar ?? null,
      hecho: Boolean(d!.hecho),
      editable: f.admin_id === req.adminId || req.adminRol === 'direccion',
      solicitudId: sol,
      folio: sol ? folio.get(sol) ?? null : null,
    };
  });
}

/**
 * Correos que van a la oficina, no a la persona, o que no dicen nada del
 * trato (restablecer la contraseña): no salen en su línea de tiempo.
 */
const NO_SON_DEL_TRATO = [
  'quote_request_internal', 'quoter_request_internal', 'provider_offer_review', 'provider_signup_internal',
  'contact_internal', 'cierre_mes', 'prueba', 'admin_password_reset', 'admin_invitacion',
  'password_reset', 'email_verification', 'welcome',
];

const CORREO_SELECT = { id: true, kind: true, to_name: true, subject: true, state: true, quote_id: true, provider_id: true, created_at: true } as const;

/**
 * La línea de tiempo de una solicitud, un cliente o un aliado: lo anotado por
 * el panel y, en gris, lo que el sistema ya le mandó por correo (2026-11-09).
 * Lo más reciente arriba.
 */
export async function lineaDeTiempo(req: AdminRequest, tipo: 'solicitud' | 'cliente' | 'aliado', id: number): Promise<RenglonTrato[]> {
  const base = { accion: ACCION_CONTACTO } as const;
  let contactos: Prisma.admin_auditWhereInput;
  let correos: Prisma.email_logWhereInput[] = [];
  let desde: Date | null = null;

  if (tipo === 'solicitud') {
    const q = await prisma.quotes.findUnique({ where: { id }, select: { id: true, email: true, client_id: true, created_at: true, requirements: true } });
    if (!q) throw new NotFoundException('No encontramos esa solicitud.');
    desde = q.created_at;
    // Lo de la solicitud y, del cliente, lo que se anotó desde Clientes (sin
    // solicitud) después de que llegó: hablarle es hablarle de esto también.
    contactos = {
      ...base,
      OR: [
        { objetivo: { contains: contiene('solicitud', id) } },
        ...(q.client_id ? [{ objetivo: { contains: contiene('cliente', q.client_id) }, ...(q.created_at ? { created_at: { gte: q.created_at } } : {}) }] : []),
      ],
    };
    const folioDoc = (q.requirements as { folio?: unknown } | null)?.folio;
    correos = [
      // Sin los del sistema a aliados (ofertas a varios a la vez, recordatorios):
      // aquí serían ruido y se ven en el trato de cada aliado.
      { quote_id: id, provider_id: null },
      // El documento del cotizador sale sin solicitud en el registro: se reconoce por su folio.
      ...(q.email && typeof folioDoc === 'string' && folioDoc ? [{ to_email: q.email, subject: { contains: folioDoc } }] : []),
    ];
  } else if (tipo === 'cliente') {
    const c = await prisma.clients.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!c) throw new NotFoundException('No encontramos ese cliente.');
    contactos = { ...base, objetivo: { contains: contiene('cliente', id) } };
    const suyas = await prisma.quotes.findMany({ where: { client_id: id }, select: { id: true } });
    correos = [
      ...(suyas.length ? [{ quote_id: { in: suyas.map((s) => s.id) }, provider_id: null }] : []),
      ...(c.email ? [{ to_email: c.email }] : []),
    ];
  } else {
    const p = await prisma.providers.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!p) throw new NotFoundException('No encontramos ese aliado.');
    contactos = { ...base, objetivo: { contains: contiene('aliado', id) } };
    correos = [{ provider_id: id }, ...(p.email ? [{ to_email: p.email }] : [])];
  }

  const [filas, mails] = await Promise.all([
    prisma.admin_audit.findMany({ where: contactos, orderBy: { id: 'desc' }, take: 200 }),
    correos.length
      ? prisma.email_log.findMany({
          where: { OR: correos, kind: { notIn: NO_SON_DEL_TRATO } },
          orderBy: { id: 'desc' },
          take: 60,
          select: CORREO_SELECT,
        }).catch(() => [])
      : [],
  ]);

  // En la solicitud, lo del cliente que es de OTRA solicitud no se mezcla.
  const propias = tipo === 'solicitud'
    ? filas.filter((f) => f.objetivo?.includes(contiene('solicitud', id)) || !llavesDe(f.objetivo).some(([t]) => t === 'solicitud'))
    : filas;

  const renglones = await aRenglones(req, propias);

  // Los correos a aliados dentro de una solicitud dicen a cuál.
  const provIds = [...new Set(mails.map((m) => m.provider_id).filter((n): n is number => n !== null))];
  const quoteIds = [...new Set(mails.map((m) => (m.quote_id === null ? null : Number(m.quote_id))).filter((n): n is number => n !== null))];
  const [provs, folios] = await Promise.all([
    provIds.length ? prisma.providers.findMany({ where: { id: { in: provIds } }, select: { id: true, name: true } }) : [],
    quoteIds.length ? prisma.quotes.findMany({ where: { id: { in: quoteIds } }, select: { id: true, quote_number: true } }) : [],
  ]);
  const prov = new Map(provs.map((p) => [p.id, p.name]));
  const folio = new Map(folios.map((q) => [Number(q.id), q.quote_number]));

  for (const m of mails) {
    if (m.kind.endsWith('_internal')) continue;
    // Antes de que llegara la solicitud, lo del cliente no es de esta.
    if (tipo === 'solicitud' && desde && m.created_at < desde && Number(m.quote_id) !== id) continue;
    const sol = m.quote_id === null ? null : Number(m.quote_id);
    renglones.push({
      id: `m${m.id}`,
      tipo: 'correo',
      cuando: m.created_at.toISOString(),
      canal: 'correo',
      con: m.provider_id ? 'aliado' : 'cliente',
      a: (m.provider_id ? prov.get(m.provider_id) : null) ?? m.to_name ?? null,
      quien: null,
      auto: true,
      nota: null,
      res: null,
      recordar: null,
      hecho: false,
      editable: false,
      solicitudId: sol,
      folio: sol ? folio.get(sol) ?? null : null,
      asunto: m.subject,
      estado: m.state,
      correoId: m.id,
    });
  }
  return renglones.sort((x, y) => (x.cuando < y.cuando ? 1 : x.cuando > y.cuando ? -1 : 0)).slice(0, 200);
}

/** Un recordatorio que ya toca, como lo enseña el Inicio. */
export interface Recordatorio {
  id: number;
  recordar: string;
  atrasado: boolean;
  canal: Canal;
  con: 'cliente' | 'aliado';
  a: string | null;
  nota: string | null;
  res: Resultado | null;
  folio: string | null;
  href: string;
  anotado: string;
}

/**
 * Los recordatorios de quien pregunta que ya tocan (hoy o atrasados).
 *
 * Se apagan SOLOS cuando alguien vuelve a tener contacto con esa persona
 * (cualquier renglón nuevo con el mismo cliente o aliado, aunque sea un
 * WhatsApp que abrió el panel): el recordatorio era para volver a buscarlo, y
 * ya se buscó. Cuenta lo que pasa desde UNA HORA después de ponerlo: el
 * WhatsApp que se manda en la misma sentada que la llamada no es "volver a
 * buscarlo". Si hace falta otro, el renglón nuevo trae el suyo.
 */
const MARGEN_RECORDATORIO_MS = 60 * 60 * 1000;

export async function recordatoriosDe(req: AdminRequest): Promise<Recordatorio[]> {
  const hoy = hoyMty();
  const filas = await prisma.admin_audit.findMany({
    where: { admin_id: req.adminId, accion: ACCION_CONTACTO, detalle: { contains: '"recordar":"' } },
    orderBy: { id: 'desc' },
    take: 300,
  });
  const pendientes = filas
    .map((f) => ({ f, d: leerDetalle(f.detalle), llaves: llavesDe(f.objetivo) }))
    .filter((x) => x.d && x.d.recordar && x.d.recordar <= hoy && !x.d.hecho && !x.d.quitado)
    .slice(0, 30);
  if (!pendientes.length) return [];

  const vigentes: typeof pendientes = [];
  for (const x of pendientes) {
    // La llave de la PERSONA: el cliente o el aliado; si no hay, la primera.
    const persona = x.llaves.find(([t]) => t === (x.d!.con === 'aliado' ? 'aliado' : 'cliente')) ?? x.llaves[0];
    if (!persona) continue;
    const puesto = x.d!.rdesde ? new Date(x.d!.rdesde) : x.f.created_at;
    const despues = await prisma.admin_audit.findFirst({
      where: {
        accion: ACCION_CONTACTO,
        id: { not: x.f.id },
        created_at: { gt: new Date((Number.isNaN(puesto.getTime()) ? x.f.created_at : puesto).getTime() + MARGEN_RECORDATORIO_MS) },
        objetivo: { contains: contiene(persona[0], persona[1]) },
        NOT: { detalle: { contains: '"quitado":true' } },
      },
      select: { id: true },
    });
    if (!despues) vigentes.push(x);
  }

  const solicitudIds = [...new Set(vigentes.flatMap((x) => x.llaves.filter(([t]) => t === 'solicitud').map(([, n]) => n)))];
  const folios = solicitudIds.length ? await prisma.quotes.findMany({ where: { id: { in: solicitudIds } }, select: { id: true, quote_number: true } }) : [];
  const folio = new Map(folios.map((q) => [Number(q.id), q.quote_number]));

  return vigentes
    .map(({ f, d, llaves }) => {
      const de = (t: TipoObjetivo) => llaves.find(([x]) => x === t)?.[1] ?? null;
      const sol = de('solicitud');
      // A donde lleva: al aliado, su expediente en la pestaña del trato; al
      // cliente, la solicitud si la hay (ahí está todo) o su ficha.
      const href = d!.con === 'aliado' && de('aliado')
        ? `/proveedores?ver=${de('aliado')}&dato=trato`
        : sol ? `/cotizaciones?ver=${sol}`
          : de('cliente') ? `/clientes?ver=${de('cliente')}`
            : de('documento') ? `/cotizador/historial/${de('documento')}` : '/';
      return {
        id: f.id,
        recordar: d!.recordar!,
        atrasado: d!.recordar! < hoy,
        canal: d!.canal,
        con: d!.con,
        a: d!.a ?? null,
        nota: d!.nota ?? null,
        res: d!.res ?? null,
        folio: sol ? folio.get(sol) ?? null : null,
        href,
        anotado: f.created_at.toISOString(),
      };
    })
    .sort((x, y) => (x.recordar < y.recordar ? -1 : x.recordar > y.recordar ? 1 : 0));
}
