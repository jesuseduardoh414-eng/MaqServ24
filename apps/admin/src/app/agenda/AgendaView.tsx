'use client';

import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, EmptyState, GroupLabel, IconBtn, Note, PageHeader, Panel, Segmented, Stat, Stats, StatusText } from '@/components/ui';
import { ESTADOS_DISPONIBILIDAD, type EstadoDisponibilidad } from '@maqserv/config';

/**
 * AGENDA DE OPERACIONES.
 *
 * Contesta una pregunta que el tablero de Servicios no puede: qué VIENE. Está
 * armada por semanas y no por mes porque la ventana de decisión en obra son
 * días, no semanas — un calendario mensual obliga a entrecerrar los ojos para
 * ver lo de pasado mañana.
 *
 * Dos lecturas de lo mismo: el calendario para ver dónde aprieta y dónde hay
 * hueco, y debajo la lista "Lo que viene" para leer cada compromiso completo
 * sin abrir nada. Elegir un día en el calendario filtra la lista a ese día.
 */

export interface Compromiso {
  id: string;
  tipo: 'bloqueo' | 'servicio';
  productId: number | null;
  titulo: string;
  detalle: string | null;
  desde: string;
  hasta: string | null;
  estado: string;
}

export interface Agenda {
  desde: string;
  hasta: string;
  semanas: Array<{ dias: string[]; densidad: number[] }>;
  compromisos: Compromiso[];
  contexto: { equiposActivos: number; bloqueosVigentes: number; serviciosComprometidos: number };
}

/*
 * Colores: los de ESTADOS_DISPONIBILIDAD (@maqserv/config), los mismos de
 * Disponibilidad, Proveedores y el sitio. Antes la agenda tenía los suyos:
 * reservado en ámbar y "en traslado" junto con "en servicio" en un solo azul.
 * El servicio comprometido sigue en verde: es lo que ya está prometido.
 */
const COLOR_SERVICIO = 'var(--adm-ok)';
const estadoDe = (e: string) => ESTADOS_DISPONIBILIDAD[e as EstadoDisponibilidad] ?? ESTADOS_DISPONIBILIDAD.reservado;

/** Lo que significa cada color, en el orden en que importa al prometer. */
const LEYENDA: Array<{ color: string; texto: string }> = [
  { color: COLOR_SERVICIO, texto: 'Servicio comprometido' },
  ...(['reservado', 'en-traslado', 'en-servicio', 'mantenimiento'] as const).map((k) => ({
    color: ESTADOS_DISPONIBILIDAD[k].color.oscuro,
    texto: ESTADOS_DISPONIBILIDAD[k].nombre,
  })),
];

/** Servicio en verde; un bloqueo, con el color de su estado (reservado si no se conoce). */
const colorDe = (c: Compromiso): string => (c.tipo === 'servicio' ? COLOR_SERVICIO : estadoDe(c.estado).color.oscuro);

/** "en-traslado" → "En traslado". */
const rotulo = (c: Compromiso) => {
  if (c.tipo === 'servicio') return 'Servicio';
  const t = c.estado.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Hoy en la zona del navegador. `toISOString` daba el día UTC: en Monterrey,
 * de las seis de la tarde en adelante la agenda ya marcaba "hoy" el día de
 * mañana.
 */
const hoyISO = () => new Date().toLocaleDateString('en-CA');

/** Las fechas llegan como "2026-10-09"; se leen a mediodía UTC para que ningún huso las mueva de día. */
const fecha = (iso: string) => new Date(`${iso}T12:00:00Z`);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => fecha(iso).toLocaleDateString('es-MX', { timeZone: 'UTC', ...o });
const mesCorto = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '');

/** "5 – 18 de octubre de 2026" · "28 de septiembre – 11 de octubre de 2026". */
function rango(desde: string, hasta: string): string {
  const [ad, md] = [desde.slice(0, 4), desde.slice(5, 7)];
  const [ah, mh] = [hasta.slice(0, 4), hasta.slice(5, 7)];
  const dd = Number(desde.slice(8, 10));
  const fin = fmt(hasta, { day: 'numeric', month: 'long', year: 'numeric' });
  if (ad !== ah) return `${fmt(desde, { day: 'numeric', month: 'long', year: 'numeric' })} – ${fin}`;
  if (md !== mh) return `${fmt(desde, { day: 'numeric', month: 'long' })} – ${fin}`;
  return `${dd} – ${fin}`;
}

/** Diferencia en días entre dos fechas ISO. */
const diasEntre = (a: string, b: string) => Math.round((fecha(b).getTime() - fecha(a).getTime()) / 86_400_000);

/** "Hoy", "Mañana" o nada: el nombre del día ya va al lado. */
function cercania(dia: string, hoy: string): string | null {
  const d = diasEntre(hoy, dia);
  return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : null;
}

/** Hasta cuándo dura, dicho para quien está por prometer. */
function duracion(c: Compromiso): string {
  if (c.hasta === null) return 'Sin fecha de fin';
  if (c.hasta === c.desde) return 'Solo ese día';
  const corto = (iso: string) => fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '');
  return `${corto(c.desde)} → ${corto(c.hasta)}`;
}

/** ¿El compromiso toca ese día? Inclusivo, y sin fin = indefinido. */
function toca(c: Compromiso, dia: string): boolean {
  if (c.desde > dia) return false;
  if (c.hasta === null) return true;
  return c.hasta >= dia;
}

const ENCABEZADO = (
  <PageHeader
    eyebrow={['3 · Ejecutar', 'Operaciones']}
    title="Agenda"
    subtitle="Qué viene y qué unidad está comprometida. El tablero de Servicios dice qué está pasando; esto sirve para no prometer dos veces la misma máquina."
    actions={<Btn href="/disponibilidad" icon="ph-calendar-plus">Bloquear un equipo</Btn>}
  />
);

/** Cuántas fichas caben por día según cuántas semanas se ven: con una sola hay espacio de sobra. */
const FICHAS_POR_DIA: Record<string, number> = { '1': 6, '2': 3, '4': 2, '6': 2 };

export function AgendaView({
  agenda, filtros,
}: {
  agenda: Agenda | null;
  filtros: { desde: string; semanas: string };
}) {
  const router = useRouter();
  const [dia, setDia] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const m = new Map<string, Compromiso[]>();
    if (!agenda) return m;
    for (const s of agenda.semanas) {
      for (const d of s.dias) {
        // Primero lo que ya venía de antes (bloqueos largos), después lo que empieza ese día.
        m.set(d, agenda.compromisos.filter((c) => toca(c, d)).sort((a, b) => a.desde.localeCompare(b.desde) || a.titulo.localeCompare(b.titulo)));
      }
    }
    return m;
  }, [agenda]);

  if (!agenda) {
    return (
      <div>
        {ENCABEZADO}
        <Note tone="bad">No se pudo cargar la agenda.</Note>
      </div>
    );
  }

  function ir(desde: string | null, semanas = filtros.semanas) {
    const qs = new URLSearchParams();
    if (desde) qs.set('desde', desde);
    if (semanas !== '2') qs.set('semanas', semanas);
    router.push(`/agenda${qs.size ? `?${qs}` : ''}`);
  }

  function mover(semanas: number) {
    const base = filtros.desde ? fecha(filtros.desde) : fecha(hoyISO());
    base.setUTCDate(base.getUTCDate() + semanas * 7);
    ir(base.toISOString().slice(0, 10));
  }

  const hoy = hoyISO();
  const todos = agenda.semanas.flatMap((s) => s.dias);
  const hoyEnVista = todos.includes(hoy);
  const fichas = FICHAS_POR_DIA[filtros.semanas] ?? 3;
  const n = agenda.compromisos.length;
  const deHoy = porDia.get(hoy)?.length ?? 0;

  /**
   * La lista de abajo. Sin día elegido son los días con algo, desde hoy (o
   * desde el inicio de la vista, si se está mirando el futuro): lo que ya pasó
   * se ve en el calendario y no hace falta leerlo otra vez.
   */
  const diasLista = dia
    ? [dia]
    : todos.filter((d) => (porDia.get(d)?.length ?? 0) > 0 && (!hoyEnVista || d >= hoy));

  return (
    <div>
      <style>{`
        .agd-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap;
          padding: 14px 16px; border-bottom: 1px solid var(--adm-border);
        }
        .agd-nav { display: flex; align-items: center; gap: 6px; }
        .agd-rango { font-size: 16px; font-weight: 600; color: var(--adm-text); letter-spacing: -0.01em; margin-left: 8px; }
        .agd-cols { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
        .agd-head > div {
          padding: 9px 12px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          color: var(--adm-muted); border-bottom: 1px solid var(--adm-border);
        }
        .agd-head > div.is-finde { color: var(--adm-faint); }
        .agd-semana + .agd-semana { border-top: 1px solid var(--adm-border); }
        .agd-dia {
          position: relative; min-width: 0; min-height: var(--agd-alto, 124px); padding: 8px 8px 10px;
          display: flex; flex-direction: column; gap: 6px;
          background: transparent; color: var(--adm-text); text-align: left; cursor: pointer; font-family: inherit;
          border: 0; border-left: 1px solid var(--adm-border);
          transition: background .12s ease;
        }
        .agd-dia:first-child { border-left: 0; }
        .agd-dia.is-finde { background: rgba(255, 255, 255, 0.014); }
        .agd-dia:hover { background: rgba(255, 255, 255, 0.03); }
        .agd-dia.is-sel { background: var(--adm-raised); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--adm-accent) 55%, transparent); }
        .agd-dia:focus-visible { outline: 2px solid var(--adm-accent); outline-offset: -2px; }
        .agd-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 24px; }
        .agd-num {
          display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 4px;
          border-radius: 999px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--adm-text);
        }
        .agd-mes { font-size: 11.5px; font-weight: 500; color: var(--adm-muted); margin-left: 2px; }
        .agd-dia.is-pasado .agd-num { color: var(--adm-faint); font-weight: 500; }
        /* Lo pasado se apaga un poco, no a la mitad: a .5 la ficha ya no se leía (2026-10-15). */
        .agd-dia.is-pasado .agd-evs { opacity: .72; }
        /* Hoy: el número en un círculo de acento. Un fondo en toda la celda
           competiría con las fichas, que es lo que hay que leer. */
        .agd-dia.is-hoy .agd-num { background: var(--adm-accent); color: #fff; }
        .agd-cuenta { font-size: 11px; font-weight: 600; color: var(--adm-muted); font-variant-numeric: tabular-nums; padding: 1px 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
        .agd-evs { display: grid; gap: 3px; min-width: 0; }
        .agd-ev {
          display: block; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          font-size: 12px; font-weight: 600; line-height: 1.3; color: var(--adm-text);
          padding: 4px 7px; border-radius: 5px;
          /* Más color (2026-10-15): al 13% y con texto gris la ficha casi no se veía. */
          background: color-mix(in srgb, var(--agd-tono) 30%, transparent);
          border-left: 3px solid var(--agd-tono);
        }
        /* Un bloqueo que viene de días antes: sin borde izquierdo, se lee como continuación. */
        .agd-ev.is-sigue { border-left-color: transparent; border-top-left-radius: 0; border-bottom-left-radius: 0; color: var(--adm-muted); }
        .agd-mas { font-size: 11.5px; color: var(--adm-faint); padding-left: 6px; }
        .agd-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px 18px; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--adm-border); font-size: 12.5px; color: var(--adm-muted); }
        .agd-leyenda { display: flex; flex-wrap: wrap; gap: 6px 18px; }
        /* El color va en el punto y el texto queda neutro: así se lee igual que las fichas. */
        .agd-ley { display: inline-flex; align-items: center; gap: 7px; color: var(--adm-text-2); }
        .agd-ley i { width: 8px; height: 8px; border-radius: 2px; background: var(--agd-tono); }
        .agd-sem-c { display: none; }
        .agd-fila { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; }
        .agd-dura { font-size: 12.5px; color: var(--adm-muted); white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 760px) {
          .agd-rango { flex-basis: 100%; order: -1; margin: 0 0 2px; }
          .agd-nav { flex-wrap: wrap; }
          .agd-head > div { padding: 8px 4px; text-align: center; letter-spacing: .04em; }
          .agd-dia { min-height: 64px; padding: 6px 4px 8px; align-items: center; }
          .agd-top { justify-content: center; }
          .agd-mes, .agd-cuenta, .agd-mas { display: none; }
          /* En el teléfono no caben nombres: cada compromiso es un punto de su color. */
          .agd-evs { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; }
          .agd-ev, .agd-ev.is-sigue { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px; font-size: 0; background: var(--agd-tono); }
          .agd-sem-l { display: none; }
          .agd-sem-c { display: inline; }
          .agd-fila { grid-template-columns: minmax(0, 1fr) auto; }
          .agd-fila > :first-child { grid-column: 1 / -1; }
        }
      `}</style>

      {ENCABEZADO}

      <Stats>
        <Stat
          label="Hoy"
          icon="ph-calendar-dot"
          tone="accent"
          value={deHoy}
          hint={deHoy === 0 ? 'nada comprometido' : deHoy === 1 ? 'compromiso' : 'compromisos'}
        />
        <Stat label="Bloqueos" icon="ph-lock-simple" tone="warn" value={agenda.contexto.bloqueosVigentes} hint="en estas semanas" />
        <Stat label="Servicios" icon="ph-truck" tone="ok" value={agenda.contexto.serviciosComprometidos} hint="con llegada comprometida" />
        <Stat label="Equipos" icon="ph-package" tone="info" value={agenda.contexto.equiposActivos} hint="en el inventario" />
      </Stats>

      <Panel flush clip>
        {/* Navegación arriba del calendario, como en cualquier agenda: el rango a la vista manda. */}
        <div className="agd-bar">
          <div className="agd-nav">
            <IconBtn icon="ph-caret-left" label="Semana anterior" onClick={() => mover(-1)} />
            <Btn size="sm" onClick={() => ir(null)} disabled={hoyEnVista && !filtros.desde}>Hoy</Btn>
            <IconBtn icon="ph-caret-right" label="Semana siguiente" onClick={() => mover(1)} />
            <span className="agd-rango">{rango(agenda.desde, agenda.hasta)}</span>
          </div>
          <Segmented
            ariaLabel="Semanas a la vista"
            value={filtros.semanas}
            onChange={(v) => ir(filtros.desde || null, v)}
            items={(['1', '2', '4', '6'] as const).map((k) => ({
              key: k,
              // En el teléfono "semanas" no cabe cuatro veces en una línea.
              label: <><span className="agd-sem-l">{k} {k === '1' ? 'semana' : 'semanas'}</span><span className="agd-sem-c">{k} sem</span></>,
            }))}
          />
        </div>

        <div className="agd-cols agd-head">
          {DIAS.map((d, i) => <div key={d} className={i >= 5 ? 'is-finde' : undefined}>{d}</div>)}
        </div>

        {agenda.semanas.map((s, si) => (
          <div
            key={s.dias[0]}
            className="agd-cols agd-semana"
            style={{ '--agd-alto': filtros.semanas === '1' ? '240px' : filtros.semanas === '2' ? '132px' : '104px' } as CSSProperties}
          >
            {s.dias.map((d, i) => {
              const items = porDia.get(d) ?? [];
              const esHoy = d === hoy;
              const num = Number(d.slice(8, 10));
              // El mes se escribe donde cambia y en la primera celda: sin eso, "3" no dice de qué mes.
              const conMes = num === 1 || (si === 0 && i === 0);
              const clases = ['agd-dia', i >= 5 && 'is-finde', esHoy && 'is-hoy', d < hoy && 'is-pasado', dia === d && 'is-sel'].filter(Boolean).join(' ');
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(dia === d ? null : d)}
                  aria-pressed={dia === d}
                  aria-label={`${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${items.length ? `, ${items.length} compromiso(s)` : ', libre'}`}
                  className={clases}
                >
                  <span className="agd-top">
                    <span>
                      <span className="agd-num">{num}</span>
                      {conMes ? <span className="agd-mes">{mesCorto(d)}</span> : null}
                    </span>
                    {items.length > 0 ? <span className="agd-cuenta" aria-hidden>{items.length}</span> : null}
                  </span>

                  {items.length > 0 ? (
                    <span className="agd-evs">
                      {items.slice(0, fichas).map((c) => (
                        <span
                          key={c.id}
                          className={`agd-ev${c.desde < d && i > 0 ? ' is-sigue' : ''}`}
                          style={{ '--agd-tono': colorDe(c) } as CSSProperties}
                          title={`${rotulo(c)} · ${c.titulo}`}
                        >
                          {c.titulo}
                        </span>
                      ))}
                      {items.length > fichas ? <span className="agd-mas">+{items.length - fichas} más</span> : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}

        <div className="agd-pie">
          <div className="agd-leyenda">
            {LEYENDA.map((l) => (
              <span key={l.texto} className="agd-ley" style={{ '--agd-tono': l.color } as CSSProperties}>
                <i aria-hidden />{l.texto}
              </span>
            ))}
          </div>
          <span>{n === 0 ? 'Nada comprometido en estas semanas' : `${n} compromiso${n === 1 ? '' : 's'} en la vista`}</span>
        </div>
      </Panel>

      {/* La lista va debajo y no en un modal: la agenda se consulta comparando
          días, y un modal tapa justo lo que se compara. */}
      <Panel
        flush
        clip
        style={{ marginTop: 20 }}
        title={dia ? fmt(dia, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (x) => x.toUpperCase()) : 'Lo que viene'}
        desc={dia ? (cercania(dia, hoy) ?? undefined) : 'Los días con algo comprometido, de hoy en adelante. Elige un día en el calendario para ver solo ese.'}
        action={dia ? <Btn variant="ghost" size="sm" icon="ph-x" onClick={() => setDia(null)}>Ver todo</Btn> : undefined}
      >
        {diasLista.length === 0 || (dia && (porDia.get(dia)?.length ?? 0) === 0) ? (
          dia ? (
            // Un día vacío ES información: es donde se puede prometer.
            <EmptyState icon="ph-calendar-check" title="Día libre." sub="Nada comprometido: es un hueco donde se puede prometer." />
          ) : (
            <EmptyState
              icon="ph-calendar-blank"
              title="Nada comprometido en estas semanas."
              sub="Los servicios aparecen aquí cuando un aliado acepta y se compromete a una fecha de llegada; los bloqueos, desde Disponibilidad."
            />
          )
        ) : (
          diasLista.map((d) => {
            const items = porDia.get(d) ?? [];
            const cerca = cercania(d, hoy);
            const nombre = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
            return (
              <Fragment key={d}>
                {dia ? null : (
                  <GroupLabel count={items.length} tone={cerca === 'Hoy' ? 'accent' : undefined}>
                    {cerca ? `${cerca} · ${nombre}` : nombre.replace(/^./, (x) => x.toUpperCase())}
                  </GroupLabel>
                )}
                {items.map((c) => (
                  <div key={`${d}-${c.id}`} className="adm-trow agd-fila">
                    <div><StatusText color={colorDe(c)}>{rotulo(c)}</StatusText></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="adm-cell-title">{c.titulo}</div>
                      {c.detalle ? <div className="adm-cell-sub">{c.detalle}</div> : null}
                    </div>
                    <span className="agd-dura">{duracion(c)}</span>
                  </div>
                ))}
              </Fragment>
            );
          })
        )}
      </Panel>
    </div>
  );
}
