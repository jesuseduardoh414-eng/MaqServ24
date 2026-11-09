import { Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { horarioDe, LINEA_MAQUINARIA, LINEA_TRANSPORTE } from '@maqserv/config';
import { ocupaUnaUnidad } from '../catalog/availability';
import { piezasDe } from '../quotes/reservas';
import { comoFecha, diaLocal, masDias } from '../money/cuentas';

/**
 * USO DE LAS MÁQUINAS (Indicadores, 2026-11-09).
 *
 * El 2026-10-27 se quitó "Utilización" de Indicadores porque no había con qué
 * medirla: dependía de que el aliado confirmara su equipo cada dos semanas, y
 * esa confirmación se quitó. Ahora sí hay con qué: cada máquina de aliado es
 * una fila de `products` con su tipo y sus unidades (`stock`), cada servicio
 * sabe qué máquina llevó (la MISMA regla con la que se aparta, `piezasDe` en
 * quotes/reservas.ts) y su historial dice cuándo salió y cuándo terminó
 * (`service_events`). Nadie captura nada.
 *
 * LA CUENTA, unidad por unidad y día hábil por día hábil:
 *
 *   uso = días que la unidad estuvo en camino o en la obra con un servicio de MAQSER24
 *         ÷ días hábiles que estuvo dada de alta en el periodo
 *
 *   · Día hábil: los del horario de la máquina; sin horario, lunes a sábado
 *     (lo normal en el ramo, HORARIO_DEFAULT).
 *   · Dada de alta: desde que se registró la máquina, o desde que su aliado
 *     entró a la red si fue después. Solo cuentan las activas de aliados
 *     activos, en maquinaria y transporte (triturados, materiales y asfalto
 *     se venden por cantidad: no hay días que ocupar).
 *   · Ocupada: desde que sale a la obra (en traslado, en sitio o en curso)
 *     hasta que se termina, se cierra o se cancela; si sigue allá, hasta hoy.
 *     APARTADA NO CUENTA: una cotización autorizada aparta la máquina aunque
 *     el cliente nunca acepte, y contarla inflaría el uso con promesas. Cuando
 *     sale, sí cuenta, y desde el día que salió.
 *   · No disponible: los días en mantenimiento, o que alguien la marcó a mano
 *     como parada u ocupada, no cuentan ni arriba ni abajo: no se podía rentar.
 *   · Cada unidad cuenta aparte: con 2 retros iguales y una en obra, ese día
 *     el equipo va a la mitad.
 *
 * Lo que NO se ve: lo que el aliado renta por su cuenta. Aquí sale libre. El
 * número dice cuánto trabajo le da MAQSER24 a la red, no cuánto trabaja la
 * máquina; la pantalla lo dice tal cual.
 *
 * Un servicio que no dice qué máquina llevó (el aliado tiene varias de esa
 * línea y la solicitud no trae el tipo) no se puede repartir: no se adivina,
 * se cuenta aparte y se enseña con su folio.
 */

const log = new Logger('UsoMaquinas');

/** Líneas cuyo equipo se renta por tiempo: máquinas y camiones. */
const LINEAS_CON_MAQUINAS: string[] = [LINEA_MAQUINARIA, LINEA_TRANSPORTE];

/** Meta del semáforo: la de Claude hasta que Dirección diga otra (2026-11-09); % y más es mejor. */
export const META_USO = { verde: 30, amarillo: 15, texto: 'Meta: más de 30%' };
/** De aquí para arriba casi nunca hay una libre: conviene sumar aliados con ese tipo. */
const CASI_LLENO = 70;
/** De aquí para abajo casi no se usa: sobran de ese tipo, o a ese aliado casi no le llega trabajo. */
const CASI_NADA = 10;
/** Con menos días posibles que esto (una semana de una sola unidad) no se le pone etiqueta: es muy poco para concluir. */
const DIAS_PARA_CONCLUIR = 6;

/** Etapas en que la máquina ya salió del patio. */
const SALIO = ['en_traslado', 'en_sitio', 'en_curso'];
/** Etapas que la regresan (o la dejan libre). */
const REGRESO = ['terminado', 'cerrado', 'cancelado'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** De qué día a qué día, los dos incluidos ("2026-11-09"). */
export interface Ventana { desde: string; hasta: string }
type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';
/** Lo que conviene hacer con un renglón: sumar aliados (casi lleno) o nada (casi no se usa). */
type Senal = 'lleno' | 'casiNada' | null;

interface Tramo { quoteId: number; folio: string; unidades: number; desde: string; hasta: string }
interface Maquina {
  id: number;
  nombre: string;
  aliadoId: number;
  aliado: string;
  tipoId: number | null;
  tipo: string;
  unidades: number;
  /** Primer día que cuenta. */
  alta: string;
  /** Días de la semana que trabaja (0 = domingo). */
  diasHabiles: Set<number>;
  /** Días en que no se podía rentar (mantenimiento o parada puesta a mano). */
  paradas: Array<{ desde: string; hasta: string | null }>;
  tramos: Tramo[];
}

const pctDe = (parte: number, total: number): number | null => {
  if (total <= 0) return null;
  // Un poco de uso no se enseña como 0%: se vería igual que nada.
  return parte > 0 ? Math.max(1, Math.round((parte / total) * 100)) : 0;
};
const semaforoDe = (pct: number | null): Semaforo =>
  pct === null ? 'gris' : pct >= META_USO.verde ? 'verde' : pct >= META_USO.amarillo ? 'amarillo' : 'rojo';
const senalDe = (pct: number | null, posibles: number): Senal =>
  pct === null || posibles < DIAS_PARA_CONCLUIR ? null : pct >= CASI_LLENO ? 'lleno' : pct < CASI_NADA ? 'casiNada' : null;
const primera = (fechas: Array<Date | null | undefined>): Date | null =>
  fechas.filter((d): d is Date => d instanceof Date).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
const diaDeLaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();

/**
 * Cuándo anduvo fuera la máquina de un servicio (o null si nunca salió).
 *
 * Sale: la primera vez que pasó a en traslado, en sitio o en curso DESPUÉS de
 * que aceptó el aliado que lo tiene (si otro se bajó a medio camino, sus días
 * no son de esta máquina); si no hay historial, la llegada a la obra o el
 * arranque. Regresa: lo primero entre terminado, cerrado o cancelado; si no
 * hay historial, el cierre.
 *
 * Se pueden saltar etapas (una pipa llega y descarga sin marcar "en camino"):
 * si terminó sin decir cuándo salió, cuenta desde el día al que el aliado se
 * comprometió a llegar, o el que pidió el cliente; si no, solo el día que
 * terminó. Cancelado sin haber salido no ocupó nada.
 */
function cuandoAndaFuera(
  q: { service_state: string | null; service_started_at: Date | null; service_closed_at: Date | null; updated_at: Date | null; requirements: unknown },
  eventos: Array<{ to_state: string; created_at: Date }>,
  aceptadas: Array<{ responded_at: Date | null; arrived_at: Date | null; committed_at: Date | null }>,
  hoy: string,
): Ventana | null {
  const acepto = primera(aceptadas.map((a) => a.responded_at));
  const salidas = eventos.filter((e) => SALIO.includes(e.to_state));
  const sale =
    primera(salidas.filter((e) => !acepto || e.created_at >= acepto).map((e) => e.created_at)) ??
    primera(aceptadas.map((a) => a.arrived_at)) ??
    q.service_started_at ??
    primera(salidas.map((e) => e.created_at));

  let desde = sale ? diaLocal(sale) : null;
  let hasta: string;
  if (SALIO.includes(q.service_state ?? '')) {
    // Sigue allá: cuenta hasta hoy, diga lo que diga la fecha de fin.
    hasta = hoy;
    desde = desde ?? hoy;
  } else {
    const regreso =
      primera(eventos.filter((e) => REGRESO.includes(e.to_state) && (!sale || e.created_at >= sale)).map((e) => e.created_at)) ??
      q.service_closed_at ??
      q.updated_at;
    if (!regreso) return null;
    hasta = diaLocal(regreso);
    if (!desde) {
      if (q.service_state === 'cancelado') return null;
      const req = (q.requirements ?? {}) as Record<string, unknown>;
      const comprometida = primera(aceptadas.map((a) => a.committed_at));
      const pedida = typeof req.fecha_inicio === 'string' && ISO.test(req.fecha_inicio) ? req.fecha_inicio : null;
      desde = comprometida ? diaLocal(comprometida) : pedida ?? hasta;
    }
  }
  if (desde > hasta) desde = hasta;
  return { desde, hasta };
}

/** Los días de una ventana con su día de la semana. */
function diasDe(v: Ventana): Array<{ dia: string; semana: number }> {
  const dias: Array<{ dia: string; semana: number }> = [];
  for (let d = v.desde; d <= v.hasta && dias.length < 800; d = masDias(d, 1)) dias.push({ dia: d, semana: diaDeLaSemana(d) });
  return dias;
}

/** Días posibles y días trabajados de cada máquina en una ventana. */
function medir(v: Ventana, maquinas: Maquina[]) {
  const dias = diasDe(v);
  const filas = maquinas.map((m) => {
    let posibles = 0;
    let ocupados = 0;
    const porServicio = new Map<number, { folio: string; dias: number }>();
    for (const { dia, semana } of dias) {
      if (dia < m.alta || !m.diasHabiles.has(semana)) continue;
      if (m.paradas.some((p) => p.desde <= dia && (p.hasta === null || p.hasta >= dia))) continue;
      posibles += m.unidades;
      // Más servicios que unidades el mismo día (doble reserva) no pasa del 100%.
      let libres = m.unidades;
      for (const t of m.tramos) {
        if (libres <= 0) break;
        if (t.desde > dia || t.hasta < dia) continue;
        const u = Math.min(libres, t.unidades);
        libres -= u;
        ocupados += u;
        const s = porServicio.get(t.quoteId) ?? { folio: t.folio, dias: 0 };
        s.dias += u;
        porServicio.set(t.quoteId, s);
      }
    }
    return { m, posibles, ocupados, servicios: [...porServicio].map(([id, s]) => ({ id, folio: s.folio, dias: s.dias })) };
  });
  const posibles = filas.reduce((a, f) => a + f.posibles, 0);
  const ocupados = filas.reduce((a, f) => a + f.ocupados, 0);
  const servicios = new Set(filas.flatMap((f) => f.servicios.map((s) => s.id))).size;
  return {
    filas,
    posibles,
    ocupados,
    servicios,
    // Sin un solo servicio no hay con qué medir: "sin datos", no 0%.
    valor: servicios > 0 ? pctDe(ocupados, posibles) : null,
  };
}

type Medida = ReturnType<typeof medir>;

/** Renglones por tipo o por aliado: lo más ocupado arriba. */
function agrupar(filas: Medida['filas'], claveDe: (m: Maquina) => { clave: string; nombre: string }) {
  const grupos = new Map<string, { clave: string; nombre: string; ids: number[]; unidades: number; aliados: Set<number>; ocupados: number; posibles: number }>();
  for (const f of filas) {
    const { clave, nombre } = claveDe(f.m);
    const g = grupos.get(clave) ?? { clave, nombre, ids: [], unidades: 0, aliados: new Set<number>(), ocupados: 0, posibles: 0 };
    g.ids.push(f.m.id);
    g.unidades += f.m.unidades;
    g.aliados.add(f.m.aliadoId);
    g.ocupados += f.ocupados;
    g.posibles += f.posibles;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const pct = pctDe(g.ocupados, g.posibles);
      return {
        clave: g.clave, nombre: g.nombre, ids: g.ids, maquinas: g.ids.length, unidades: g.unidades, aliados: g.aliados.size,
        ocupados: g.ocupados, posibles: g.posibles, pct, semaforo: semaforoDe(pct), senal: senalDe(pct, g.posibles),
      };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.posibles - a.posibles || a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * El uso de las máquinas de la red en la ventana elegida, comparado con la
 * anterior del mismo largo. Trae también cada máquina con los servicios que
 * la ocuparon: la pantalla abre "lo que forma cada número" sin volver a pedir.
 */
export async function usoDeLasMaquinas(ventana: Ventana, anterior: Ventana, hoy: string = diaLocal()) {
  // ── 1. Las máquinas de la red ──
  const [lineas, aliados] = await Promise.all([
    prisma.categories.findMany({ where: { cat_slug: { in: LINEAS_CON_MAQUINAS } }, select: { id: true } }),
    prisma.providers.findMany({ select: { id: true, name: true, status: true, joined_at: true } }),
  ]);
  const aliadoDe = new Map(aliados.map((a) => [a.id, a]));
  const productos = lineas.length
    ? await prisma.products.findMany({
        where: {
          status: 1,
          provider_id: { in: aliados.filter((a) => a.status === 1).map((a) => a.id) },
          category_id: { in: lineas.map((l) => l.id) },
        },
        select: { id: true, name: true, provider_id: true, tipo_id: true, stock: true, horario: true, created_at: true },
      })
    : [];
  const tiposIds = [...new Set(productos.map((p) => p.tipo_id).filter((t): t is number => t !== null))];
  const [tipos, bloques] = await Promise.all([
    tiposIds.length
      ? prisma.products.findMany({ where: { id: { in: tiposIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: number; name: string }>),
    productos.length
      ? prisma.availability_blocks.findMany({
          where: {
            product_id: { in: productos.map((p) => p.id) },
            starts_on: { lte: comoFecha(ventana.hasta) },
            OR: [{ ends_on: null }, { ends_on: { gte: comoFecha(anterior.desde) } }],
          },
          select: { product_id: true, state: true, starts_on: true, ends_on: true, note: true },
        })
      : Promise.resolve([] as Array<{ product_id: number; state: string; starts_on: Date; ends_on: Date | null; note: string | null }>),
  ]);
  const nombreTipo = new Map(tipos.map((t) => [t.id, t.name]));

  const maquinas = new Map<number, Maquina>();
  for (const p of productos) {
    const a = aliadoDe.get(p.provider_id as number);
    if (!a) continue;
    const entro = diaLocal(a.joined_at);
    const registrada = p.created_at ? diaLocal(p.created_at) : entro;
    maquinas.set(p.id, {
      id: p.id,
      nombre: p.name,
      aliadoId: a.id,
      aliado: a.name,
      tipoId: p.tipo_id,
      tipo: p.tipo_id !== null ? nombreTipo.get(p.tipo_id) ?? 'Tipo sin nombre' : 'Sin tipo (falta clasificar)',
      unidades: Math.max(1, p.stock ?? 1),
      alta: registrada > entro ? registrada : entro,
      diasHabiles: new Set(horarioDe(p.horario).dias),
      paradas: [],
      tramos: [],
    });
  }
  // Lo que puso una persona y para la máquina entera (mantenimiento, parada,
  // ocupada por fuera). Lo que aparta un servicio, o "reservado" a mano, no:
  // apartar no es trabajar.
  for (const b of bloques) {
    if (ocupaUnaUnidad(b)) continue;
    maquinas.get(b.product_id)?.paradas.push({
      desde: b.starts_on.toISOString().slice(0, 10),
      hasta: b.ends_on ? b.ends_on.toISOString().slice(0, 10) : null,
    });
  }

  // ── 2. Los servicios que pudieron sacar una máquina en las dos ventanas ──
  const corte = comoFecha(masDias(anterior.desde, -1));
  const servicios = await prisma.quotes.findMany({
    where: {
      service_state: { in: [...SALIO, ...REGRESO] },
      OR: [{ service_state: { in: SALIO } }, { service_closed_at: { gte: corte } }, { updated_at: { gte: corte } }],
    },
    select: {
      id: true, quote_number: true, status: true, valid_until: true, accepted_at: true, service_state: true,
      service_started_at: true, service_closed_at: true, updated_at: true, service_category: true, requirements: true, cart_data: true,
    },
  });
  const ids = servicios.map((s) => s.id);
  const [eventos, asignaciones] = await Promise.all([
    prisma.service_events.findMany({
      where: { quote_id: { in: ids }, to_state: { in: [...SALIO, ...REGRESO] } },
      select: { quote_id: true, to_state: true, created_at: true },
    }),
    prisma.service_assignments.findMany({
      where: { quote_id: { in: ids } },
      select: { quote_id: true, provider_id: true, state: true, committed_at: true, responded_at: true, arrived_at: true },
    }),
  ]);
  const eventosDe = new Map<string, typeof eventos>();
  for (const e of eventos) eventosDe.set(String(e.quote_id), [...(eventosDe.get(String(e.quote_id)) ?? []), e]);
  const asignacionesDe = new Map<string, typeof asignaciones>();
  for (const a of asignaciones) asignacionesDe.set(String(a.quote_id), [...(asignacionesDe.get(String(a.quote_id)) ?? []), a]);

  const sinMaquina: Array<{ id: number; folio: string }> = [];
  for (const q of servicios) {
    const req = (q.requirements ?? {}) as Record<string, unknown>;
    // Se liberó a mano desde Disponibilidad ("esto ya no aparta nada"): tampoco ocupa aquí.
    if (req.sin_reserva === true) continue;
    const suyas = asignacionesDe.get(String(q.id)) ?? [];
    const aceptadas = suyas.filter((a) => a.state === 'aceptado');
    if (aceptadas.length === 0) continue;
    const fuera = cuandoAndaFuera(q, eventosDe.get(String(q.id)) ?? [], aceptadas, hoy);
    if (!fuera || fuera.hasta < anterior.desde || fuera.desde > ventana.hasta) continue;

    let piezas: Awaited<ReturnType<typeof piezasDe>> = [];
    try {
      piezas = await piezasDe(q, suyas.map((a) => ({ provider_id: a.provider_id, state: a.state, committed_at: a.committed_at })));
    } catch (err) {
      log.warn(`No se pudo saber qué máquina llevó ${q.quote_number}: ${(err as Error).message}`);
    }
    const deLaRed = piezas.filter((p) => maquinas.has(p.productId));
    for (const p of deLaRed) {
      maquinas.get(p.productId)!.tramos.push({ quoteId: Number(q.id), folio: q.quote_number, unidades: Math.max(1, p.unidades), ...fuera });
    }
    // No dice qué máquina llevó: se enseña aparte, si cae en el periodo y su
    // aliado ya estaba en la red (antes de eso no hay contra qué medirlo).
    if (piezas.length === 0 && LINEAS_CON_MAQUINAS.includes(q.service_category ?? '')) {
      const entro = aceptadas.map((a) => aliadoDe.get(a.provider_id)?.joined_at).filter((d): d is Date => !!d).map((d) => diaLocal(d)).sort()[0];
      if (fuera.hasta >= ventana.desde && fuera.desde <= ventana.hasta && (!entro || fuera.hasta >= entro)) {
        sinMaquina.push({ id: Number(q.id), folio: q.quote_number });
      }
    }
  }
  for (const m of maquinas.values()) m.tramos.sort((a, b) => a.desde.localeCompare(b.desde) || a.quoteId - b.quoteId);

  // ── 3. La cuenta, en las dos ventanas ──
  const lista = [...maquinas.values()];
  const ahora = medir(ventana, lista);
  const antes = medir(anterior, lista);

  const detalle = ahora.filas
    .map((f) => {
      const pct = pctDe(f.ocupados, f.posibles);
      return {
        id: f.m.id, nombre: f.m.nombre, aliadoId: f.m.aliadoId, aliado: f.m.aliado, tipo: f.m.tipo, unidades: f.m.unidades,
        ocupados: f.ocupados, posibles: f.posibles, pct, semaforo: semaforoDe(pct),
        servicios: f.servicios.sort((a, b) => b.dias - a.dias),
      };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.posibles - a.posibles || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    valor: ahora.valor,
    antes: antes.valor,
    servicios: ahora.servicios,
    ocupados: ahora.ocupados,
    posibles: ahora.posibles,
    maquinas: lista.length,
    unidades: lista.reduce((a, m) => a + m.unidades, 0),
    aliados: new Set(lista.map((m) => m.aliadoId)).size,
    porTipo: agrupar(ahora.filas, (m) => ({ clave: m.tipoId === null ? 'sin-tipo' : String(m.tipoId), nombre: m.tipo })),
    porAliado: agrupar(ahora.filas, (m) => ({ clave: String(m.aliadoId), nombre: m.aliado })),
    detalle,
    sinMaquina,
  };
}
