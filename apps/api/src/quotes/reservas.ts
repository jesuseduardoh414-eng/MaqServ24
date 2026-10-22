import { Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { PREFIJO_RESERVA, ocupaUnaUnidad } from '../catalog/availability';
import { avisarPanel } from '../notifications/panel';
import { estadoCotizacion } from './quote-validity';
import { diasQueOcupa } from './recomendador.service';

/**
 * LA DISPONIBILIDAD SIGUE AL SERVICIO, SOLA (2026-09-25; automática de punta a
 * punta el 2026-10-15).
 *
 * "Lo que se quiere es que sea lo más automático posible, con la menor
 * interacción con el humano." Antes solo la solicitud de una máquina del
 * catálogo apartaba algo; autorizar una cotización, que el cliente la aceptara
 * o que el servicio arrancara no cambiaba nada y había que bloquear a mano.
 *
 * Ahora hay UNA regla: `sincronizarReserva` mira la cotización tal como está
 * y deja sus bloqueos (`availability_blocks` con nota `reserva:<folio>`) como
 * deben estar. Se llama en cada evento que la mueve —autorizar, aceptar,
 * respuesta del aliado, avance del servicio— y una vez al día para lo que solo
 * depende del calendario (vigencias que vencen, servicios que se alargan).
 * Como siempre recalcula desde cero, llamarla de más no hace daño.
 *
 * QUÉ APARTA Y CUÁNDO:
 *
 *   · Cotización pendiente o rechazada ............. nada
 *   · Autorizada y vigente, aún sin aceptar ......... RESERVADO
 *   · Vencida sin que el cliente aceptara ........... nada (se libera sola)
 *   · Aceptada: por asignar / asignado .............. RESERVADO
 *   · En traslado ................................... EN TRASLADO
 *   · En sitio / en curso ........................... EN SERVICIO (se alarga
 *     día a día si la obra rebasa la fecha de fin: la máquina sigue allá)
 *   · Terminado, cerrado o cancelado ................ nada
 *
 * QUÉ EQUIPO:
 *
 *   · Solicitud de máquina: la que eligió el cliente, tantas piezas como pidió.
 *   · Cotización del catálogo: los equipos de renta de su carrito.
 *   · Cotizador por tipo: no hay máquina elegida hasta que un aliado acepta;
 *     entonces se aparta el suyo (el ligado al renglón del tabulador, o su
 *     único equipo de esa línea).
 *   · Si un aliado rechaza, sus equipos se sueltan. Si acepta OTRO aliado, se
 *     aparta lo de quien aceptó y se suelta lo del que no fue.
 *   · Lo que no tiene aliado no se aparta nunca (2026-10-21): es la ficha del
 *     TIPO, la que lleva el precio, no una máquina. MAQSER24 es solo la
 *     plataforma; las máquinas del grupo del dueño van a nombre de su aliado
 *     como las de cualquier otro.
 *
 * Se aparta desde la autorización y no desde la aceptación, a propósito: entre
 * una y otra pueden pasar días, y dos clientes con el mismo precio en la mano
 * para el mismo viernes acabarían con uno sin máquina.
 *
 * Los bloqueos puestos a mano (mantenimiento, inactivo…) no se tocan nunca: la
 * nota es la frontera.
 */

const log = new Logger('Reservas');

const nota = (folio: string) => `${PREFIJO_RESERVA}${folio}`;

/** Tope de piezas por equipo: un error de captura no debe crear cientos de filas. */
const MAX_PIEZAS = 20;

/** Estados del servicio en los que la máquina sigue comprometida. */
export const SERVICIO_ACTIVO = ['por_asignar', 'asignado', 'en_traslado', 'en_sitio', 'en_curso'] as const;

type EstadoBloqueo = 'reservado' | 'en-traslado' | 'en-servicio';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (v: unknown): v is string => typeof v === 'string' && ISO.test(v);

/** Día calendario en Monterrey/CDMX (UTC-6 fijo): el servidor corre en UTC. */
const diaLocal = (d: Date): string => new Date(d.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
const comoFecha = (s: string) => new Date(`${s}T00:00:00Z`);
const masDias = (s: string, n: number) => {
  const d = comoFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Qué debe enseñar el equipo según el servicio. Null = no aparta nada. */
export function estadoDeBloqueo(serviceState: string | null): EstadoBloqueo | null {
  switch (serviceState) {
    case 'por_asignar':
    case 'asignado':
      return 'reservado';
    case 'en_traslado':
      return 'en-traslado';
    case 'en_sitio':
    case 'en_curso':
      return 'en-servicio';
    default:
      return null;
  }
}

/** "3 días", "2 semanas", "1 mes", "10" → días de calendario. Null si no se entiende. */
export function diasDeDuracion(texto: unknown): number | null {
  if (typeof texto !== 'string') return null;
  const m = texto.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(d[ií]as?|semanas?|mes(?:es)?)?/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unidad = !m[2] || m[2].startsWith('d') ? 'dia' : m[2].startsWith('s') ? 'semana' : 'mes';
  return Math.min(365, diasQueOcupa(unidad, n));
}

interface Renglon { productId: number; qty: number; days: number; unit: string | null }

function renglonesDelCarrito(cartData: string | null): Renglon[] {
  if (!cartData) return [];
  try {
    const cart = JSON.parse(cartData) as Record<string, { qty?: number; days?: number; unit?: string | null; item?: { id?: number } }>;
    return Object.values(cart)
      .filter((c) => c && typeof c.item?.id === 'number')
      .map((c) => ({
        productId: c.item!.id as number,
        qty: Math.max(1, Math.floor(Number(c.qty) || 1)),
        days: Number(c.days) || 1,
        unit: c.unit ?? null,
      }));
  } catch {
    return [];
  }
}

/**
 * LAS FICHAS DE TIPO QUE PIDE UNA SOLICITUD (2026-10-22, Fase 3).
 *
 * Salen de lo que haya: los renglones del cotizador (`requirements.productos`),
 * lo que eligió en /cotizar (el carrito) o la máquina pedida. Una ficha cuenta
 * tal cual; una máquina de aliado, por su tipo. Vacío = no se sabe el tipo, y
 * todo sigue por línea como antes.
 */
export async function tiposDeLaSolicitud(q: { requirements: unknown; cart_data: string | null }): Promise<number[]> {
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  const ids = new Set<number>();
  if (Array.isArray(req.productos)) for (const x of req.productos) if (typeof x === 'number') ids.add(x);
  if (typeof req.productId === 'number') ids.add(req.productId);
  for (const r of renglonesDelCarrito(q.cart_data)) ids.add(r.productId);
  if (ids.size === 0) return [];
  const productos = await prisma.products.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, provider_id: true, tipo_id: true },
  });
  const tipos = new Set<number>();
  for (const p of productos) {
    if (p.provider_id === null) tipos.add(p.id);
    else if (p.tipo_id) tipos.add(p.tipo_id);
  }
  return [...tipos];
}

interface CotizacionReserva {
  id: bigint;
  quote_number: string;
  status: string;
  valid_until: Date | null;
  accepted_at: Date | null;
  service_state: string | null;
  service_started_at: Date | null;
  service_category: string | null;
  requirements: unknown;
  cart_data: string | null;
}

interface Asignacion { provider_id: number; state: string; committed_at: Date | null }

/**
 * Qué debe enseñar el equipo hoy por esta cotización (o null si nada).
 * Antes de aceptarse, solo aparta si alguien la autorizó y sigue vigente.
 */
function estadoDeseado(q: CotizacionReserva, hoy: Date): EstadoBloqueo | null {
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  // Se liberó a mano desde Disponibilidad: no se vuelve a poner sola.
  if (req.sin_reserva === true) return null;
  if (q.service_state) return estadoDeBloqueo(q.service_state);
  // Sin servicio: solo la autorizada que sigue esperando al cliente. Una
  // aceptada sin servicio es de antes del tablero y ya no aparta nada.
  const vigencia = estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }, hoy);
  return vigencia === 'vigente' ? 'reservado' : null;
}

/**
 * Del día que empieza al día que termina.
 *
 * El inicio sale de la solicitud; si no lo trae (cotizador por tipo), de la
 * fecha a la que el aliado se comprometió a llegar. El fin, de la solicitud,
 * de lo que se cotizó (3 días, 2 semanas…) o de la "duración" escrita; si no
 * hay nada, un solo día.
 *
 * Con la máquina ya en camino o en obra el periodo cubre HOY pase lo que pase:
 * si arrancó antes o se alargó, la máquina está allá, diga lo que diga el papel.
 */
function periodoDe(
  q: CotizacionReserva,
  asignaciones: Asignacion[],
  estado: EstadoBloqueo,
  hoy: Date,
): { desde: string; hasta: string } | null {
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  const comprometida = asignaciones
    .filter((a) => a.state === 'aceptado' && a.committed_at)
    .map((a) => diaLocal(a.committed_at as Date))
    .sort()[0];
  const enMarcha = estado !== 'reservado';
  const hoyStr = diaLocal(hoy);

  let desde = esFecha(req.fecha_inicio) ? req.fecha_inicio : comprometida ?? null;
  if (!desde && enMarcha) desde = q.service_started_at ? diaLocal(q.service_started_at) : hoyStr;
  if (!desde) return null;

  let hasta: string | null = esFecha(req.fecha_fin) ? req.fecha_fin : null;
  if (!hasta) {
    const renglones = renglonesDelCarrito(q.cart_data);
    const dias = Math.max(
      0,
      ...renglones.map((r) => diasQueOcupa(r.unit ?? 'dia', r.days)),
      diasDeDuracion(req.duracion) ?? 0,
    );
    hasta = masDias(desde, Math.max(1, dias) - 1);
  }
  if (hasta < desde) hasta = desde;

  if (enMarcha) {
    if (hoyStr < desde) desde = hoyStr;
    if (hoyStr > hasta) hasta = hoyStr;
  }
  return { desde, hasta };
}

interface Pieza { productId: number; unidades: number }

/** Qué equipos aparta esta cotización, según lo pedido y quién aceptó. */
async function piezasDe(q: CotizacionReserva, asignaciones: Asignacion[]): Promise<Pieza[]> {
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  const pedidas: Pieza[] = [];

  if (req.origen === 'maquina' && typeof req.productId === 'number') {
    pedidas.push({ productId: req.productId, unidades: Math.max(1, Math.floor(Number(req.equipos) || 1)) });
  }
  const renglones = renglonesDelCarrito(q.cart_data);
  const ligados = Array.isArray(req.productos) ? req.productos.filter((x): x is number => typeof x === 'number') : [];

  const ids = [...new Set([...pedidas.map((p) => p.productId), ...renglones.map((r) => r.productId), ...ligados])];
  const productos = ids.length
    ? await prisma.products.findMany({
        where: { id: { in: ids } },
        select: { id: true, provider_id: true, is_rental: true, status: true },
      })
    : [];
  const prod = new Map(productos.map((p) => [p.id, p]));

  // Del carrito solo la renta: una venta no "regresa" al patio, y las
  // toneladas o los bultos no son piezas que se aparten.
  for (const r of renglones) {
    if (prod.get(r.productId)?.is_rental) pedidas.push({ productId: r.productId, unidades: r.qty });
  }

  const dueno = (id: number) => prod.get(id)?.provider_id ?? null;
  const aceptados = [...new Set(asignaciones.filter((a) => a.state === 'aceptado').map((a) => a.provider_id))];
  // Quien ya dijo que no (y no tiene otra propuesta viva aquí) no va a llevar su máquina.
  const vivos = new Set(asignaciones.filter((a) => a.state === 'propuesto' || a.state === 'aceptado').map((a) => a.provider_id));
  const descartados = new Set(asignaciones.map((a) => a.provider_id).filter((p) => !vivos.has(p)));

  // Sin aliado es la ficha del tipo, no una máquina: no se aparta (ver arriba).
  const deAliado = pedidas.filter((p) => dueno(p.productId) !== null);

  if (aceptados.length === 0) {
    return deAliado.filter((p) => !descartados.has(dueno(p.productId) as number));
  }

  // Ya hay quien atiende: se aparta lo SUYO.
  const piezas = deAliado.filter((p) => aceptados.includes(dueno(p.productId) as number));
  const totalPedido = deAliado.reduce((s, p) => s + p.unidades, 0);
  const sinPieza = aceptados.filter((aliado) => !piezas.some((p) => dueno(p.productId) === aliado));
  const linea = sinPieza.length && q.service_category
    ? await prisma.categories.findUnique({ where: { cat_slug: q.service_category }, select: { id: true } })
    : null;
  const tipos = sinPieza.length ? await tiposDeLaSolicitud(q) : [];
  for (const aliado of sinPieza) {
    // Lo que trae ese aliado: su máquina del TIPO pedido (2026-10-22); si no,
    // la suya ligada al renglón del tabulador; si no, su único equipo
    // publicado en esa línea. Con varios sin tipo no se adivina.
    let elegido: number | null = null;
    if (tipos.length) {
      const delTipo = await prisma.products.findFirst({
        where: { provider_id: aliado, status: 1, tipo_id: { in: tipos } },
        select: { id: true, provider_id: true, is_rental: true, status: true },
        orderBy: { id: 'asc' },
      });
      if (delTipo) {
        elegido = delTipo.id;
        prod.set(delTipo.id, delTipo);
      }
    }
    elegido = elegido ?? ligados.find((id) => dueno(id) === aliado && prod.get(id)?.status === 1) ?? null;
    if (!elegido && linea) {
      const suyos = await prisma.products.findMany({
        where: { provider_id: aliado, status: 1, category_id: linea.id },
        select: { id: true, provider_id: true, is_rental: true, status: true },
        take: 2,
      });
      if (suyos.length === 1) {
        elegido = suyos[0].id;
        prod.set(suyos[0].id, suyos[0]);
      }
    }
    if (elegido) {
      piezas.push({ productId: elegido, unidades: aceptados.length === 1 ? Math.max(1, totalPedido) : 1 });
    }
  }
  return piezas;
}

export interface ResultadoReserva {
  quoteNumber: string | null;
  cambio: boolean;
  /** Equipos que aparta ahora. */
  productos: number[];
  /** Equipos que apartaba antes de este cambio. */
  antes: number[];
}

const sinCambio = (folio: string | null = null): ResultadoReserva => ({ quoteNumber: folio, cambio: false, productos: [], antes: [] });

/**
 * Deja los bloqueos de una cotización como deben estar HOY. Nunca lanza: la
 * disponibilidad es un reflejo del servicio, y un fallo aquí no puede tumbar
 * la autorización, la aceptación o el avance que la disparó.
 */
export async function sincronizarReserva(quoteId: number, hoy: Date = new Date()): Promise<ResultadoReserva> {
  try {
    const q = await prisma.quotes.findUnique({
      where: { id: quoteId },
      select: {
        id: true, quote_number: true, status: true, valid_until: true, accepted_at: true,
        service_state: true, service_started_at: true, service_category: true, requirements: true, cart_data: true,
      },
    });
    if (!q) return sinCambio();

    const asignaciones = await prisma.service_assignments.findMany({
      where: { quote_id: q.id },
      select: { provider_id: true, state: true, committed_at: true },
    });

    const deseadas: Array<{ product_id: number; state: EstadoBloqueo; starts_on: Date; ends_on: Date }> = [];
    const estado = estadoDeseado(q, hoy);
    if (estado) {
      const periodo = periodoDe(q, asignaciones, estado, hoy);
      if (periodo) {
        for (const p of await piezasDe(q, asignaciones)) {
          for (let i = 0; i < Math.min(MAX_PIEZAS, p.unidades); i++) {
            deseadas.push({ product_id: p.productId, state: estado, starts_on: comoFecha(periodo.desde), ends_on: comoFecha(periodo.hasta) });
          }
        }
      }
    }

    const actuales = await prisma.availability_blocks.findMany({
      where: { note: nota(q.quote_number) },
      select: { product_id: true, state: true, starts_on: true, ends_on: true },
    });

    const clave = (b: { product_id: number; state: string; starts_on: Date; ends_on: Date | null }) =>
      `${b.product_id}|${b.state}|${b.starts_on.toISOString().slice(0, 10)}|${b.ends_on ? b.ends_on.toISOString().slice(0, 10) : ''}`;
    const a = actuales.map(clave).sort().join(',');
    const d = deseadas.map(clave).sort().join(',');
    const antes = [...new Set(actuales.map((b) => b.product_id))];
    const ahora = [...new Set(deseadas.map((b) => b.product_id))];
    if (a === d) return { quoteNumber: q.quote_number, cambio: false, productos: ahora, antes };

    await prisma.$transaction([
      prisma.availability_blocks.deleteMany({ where: { note: nota(q.quote_number) } }),
      ...(deseadas.length
        ? [prisma.availability_blocks.createMany({ data: deseadas.map((b) => ({ ...b, note: nota(q.quote_number) })) })]
        : []),
    ]);

    // Solo se revisa el choque cuando entra un equipo o una pieza nueva: si
    // solo se movió la fecha, ya se avisó cuando se apartó.
    const piezasAntes = (id: number) => actuales.filter((b) => b.product_id === id).length;
    const nuevas = ahora.filter((id) => deseadas.filter((b) => b.product_id === id).length > piezasAntes(id));
    if (nuevas.length) void avisarSiChoca(q.quote_number, nuevas, deseadas);

    return { quoteNumber: q.quote_number, cambio: true, productos: ahora, antes };
  } catch (err) {
    // Lo que no se pudo apartar se ve en Disponibilidad; la corrida diaria lo reintenta.
    log.warn(`No se pudo sincronizar la reserva de la cotización ${quoteId}: ${(err as Error).message}`);
    return sinCambio();
  }
}

/**
 * Doble reserva: el equipo ya no alcanza esas fechas. No se impide —la
 * cotización ya existe y quizá el aliado tiene otra máquina—, pero MAQSER24
 * se entera en la campana en vez de descubrirlo el día de la obra.
 */
async function avisarSiChoca(
  folio: string,
  productos: number[],
  deseadas: Array<{ product_id: number; starts_on: Date; ends_on: Date }>,
): Promise<void> {
  try {
    for (const id of productos) {
      const mias = deseadas.filter((b) => b.product_id === id);
      const desde = mias[0].starts_on;
      const hasta = mias[0].ends_on;
      const [equipo, otros] = await Promise.all([
        prisma.products.findUnique({ where: { id }, select: { name: true, stock: true } }),
        prisma.availability_blocks.findMany({
          where: {
            product_id: id,
            starts_on: { lte: hasta },
            AND: [
              { OR: [{ ends_on: null }, { ends_on: { gte: desde } }] },
              // Los puestos a mano casi siempre van sin nota, y en SQL
              // `note <> x` deja fuera los NULL: hay que pedirlos aparte.
              { OR: [{ note: null }, { note: { not: nota(folio) } }] },
            ],
          },
          select: { state: true, note: true },
        }),
      ]);
      const paradoEntero = otros.some((b) => !ocupaUnaUnidad(b));
      const ocupadas = otros.filter(ocupaUnaUnidad).length + mias.length;
      if (!paradoEntero && ocupadas <= Math.max(1, equipo?.stock ?? 1)) continue;
      await avisarPanel({
        modulo: 'disponibilidad',
        evento: 'choque_reserva',
        titulo: `${equipo?.name ?? `Equipo #${id}`} ya estaba ocupado esas fechas (${folio})`,
        cuerpo: `Del ${desde.toISOString().slice(0, 10)} al ${hasta.toISOString().slice(0, 10)}. Revisa si el aliado tiene otra unidad o ajusta la fecha.`,
        link: '/disponibilidad',
      });
    }
  } catch (err) {
    log.warn(`No se pudo revisar el choque de ${folio}: ${(err as Error).message}`);
  }
}

/**
 * Lo que solo depende del calendario: vigencias que vencen sin aceptarse,
 * servicios que se alargan más allá de su fecha, y de paso cualquier reserva
 * que haya fallado al momento. Va en la tarea diaria (/tareas/recordatorios).
 */
export async function sincronizarReservasActivas(hoy: Date = new Date()): Promise<{ revisadas: number; cambiadas: number }> {
  const ayer = new Date(hoy.getTime() - 86_400_000);
  const [conBloqueo, activas] = await Promise.all([
    prisma.availability_blocks.findMany({
      where: { note: { startsWith: PREFIJO_RESERVA }, OR: [{ ends_on: null }, { ends_on: { gte: ayer } }] },
      select: { note: true },
    }),
    prisma.quotes.findMany({
      where: {
        OR: [
          { service_state: { in: [...SERVICIO_ACTIVO] } },
          // Autorizadas que siguen esperando al cliente.
          { status: 'completed', accepted_at: null, valid_until: { gte: ayer } },
        ],
      },
      select: { id: true },
    }),
  ]);
  const folios = [...new Set(conBloqueo.map((b) => (b.note ?? '').slice(PREFIJO_RESERVA.length)).filter(Boolean))];
  const deFolio = folios.length
    ? await prisma.quotes.findMany({ where: { quote_number: { in: folios } }, select: { id: true } })
    : [];

  const ids = [...new Set([...activas, ...deFolio].map((q) => Number(q.id)))];
  let cambiadas = 0;
  for (const id of ids) {
    if ((await sincronizarReserva(id, hoy)).cambio) cambiadas++;
  }
  if (cambiadas) log.log(`Reservas: ${cambiadas} de ${ids.length} cotizaciones ajustadas`);
  return { revisadas: ids.length, cambiadas };
}

/**
 * "Esto ya no aparta nada": se libera a mano desde Disponibilidad. Queda
 * marcado en la cotización para que la sincronización no lo vuelva a poner.
 */
export async function liberarReservaAMano(folio: string): Promise<boolean> {
  const q = await prisma.quotes.findFirst({ where: { quote_number: folio }, select: { id: true, requirements: true } });
  await prisma.availability_blocks.deleteMany({ where: { note: nota(folio) } });
  if (!q) return false;
  const req = (q.requirements && typeof q.requirements === 'object' ? q.requirements : {}) as Record<string, unknown>;
  await prisma.quotes.update({
    where: { id: q.id },
    data: { requirements: { ...req, sin_reserva: true } as Prisma.InputJsonValue },
  });
  return true;
}

/**
 * Lo que pasó con la máquina confirma que la disponibilidad es cierta: el
 * aliado acaba de decir que la lleva, o la máquina acaba de volver. Ahorra la
 * confirmación manual que de otro modo caería a los catorce días.
 */
export async function confirmarEquipos(productIds: number[], providerId?: number | null): Promise<void> {
  if (productIds.length === 0) return;
  try {
    await prisma.products.updateMany({
      where: { id: { in: productIds }, ...(providerId ? { provider_id: providerId } : {}) },
      data: { availability_confirmed_at: new Date() },
    });
  } catch (err) {
    log.warn(`No se pudo confirmar la disponibilidad de ${productIds.join(', ')}: ${(err as Error).message}`);
  }
}
