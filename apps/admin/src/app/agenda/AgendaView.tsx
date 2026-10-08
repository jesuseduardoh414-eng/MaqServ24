'use client';

import { useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { Bar, Btn, EmptyState, Note, PageHeader, Panel, Stat, Stats, StatusText, Toolbar, type Tone } from '@/components/ui';

/**
 * AGENDA DE OPERACIONES.
 *
 * Contesta una pregunta que el tablero de Servicios no puede: qué VIENE. Está
 * armada por semanas y no por mes porque la ventana de decisión en obra son
 * días, no semanas — un calendario mensual obliga a entrecerrar los ojos para
 * ver lo de pasado mañana.
 *
 * Cada día muestra lo que lo ocupa; los días vacíos se ven vacíos, y eso
 * también es información: es donde se puede prometer.
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

const TONO_ESTADO: Record<string, Tone> = {
  reservado: 'warn',
  'en-traslado': 'accent',
  'en-servicio': 'accent',
  mantenimiento: 'bad',
  inactivo: 'muted',
};

const COLOR_TONO: Record<Tone, string> = {
  accent: 'var(--adm-accent)', ok: 'var(--adm-ok)', warn: 'var(--adm-warn)',
  bad: 'var(--adm-bad)', info: 'var(--adm-info)', muted: 'var(--adm-faint)',
};

/** Servicio en verde; un bloqueo, según su estado (reservado si no se conoce). */
const tonoDe = (c: Compromiso): Tone => (c.tipo === 'servicio' ? 'ok' : TONO_ESTADO[c.estado] ?? 'warn');

/** "en-traslado" → "En traslado". */
const rotulo = (c: Compromiso) => {
  if (c.tipo === 'servicio') return 'Servicio';
  const t = c.estado.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** Compara sólo la fecha: el día de hoy en la zona del navegador. */
const hoyISO = () => new Date().toISOString().slice(0, 10);

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
  />
);

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
      for (const d of s.dias) m.set(d, agenda.compromisos.filter((c) => toca(c, d)));
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

  function mover(semanas: number) {
    const base = filtros.desde ? new Date(`${filtros.desde}T00:00:00Z`) : new Date();
    base.setUTCDate(base.getUTCDate() + semanas * 7);
    const qs = new URLSearchParams({ desde: base.toISOString().slice(0, 10) });
    if (filtros.semanas !== '2') qs.set('semanas', filtros.semanas);
    router.push(`/agenda?${qs}`);
  }

  const maxDensidad = Math.max(1, ...agenda.semanas.flatMap((s) => s.densidad));
  const hoy = hoyISO();
  const delDia = dia ? porDia.get(dia) ?? [] : [];
  const fechaDia = dia
    ? new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const n = agenda.compromisos.length;

  return (
    <div>
      <style>{`
        .agd-cols { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
        .agd-head.adm-thead { padding: 0; }
        .agd-head > div { padding: 10px 10px; }
        .agd-semana + .agd-semana { border-top: 1px solid var(--adm-border); }
        .agd-dia {
          min-width: 0; min-height: 112px; padding: 10px 10px 12px;
          display: flex; flex-direction: column; gap: 7px;
          background: transparent; color: var(--adm-text); text-align: left; cursor: pointer; font-family: inherit;
          border: 0; border-left: 1px solid var(--adm-border);
          /* El día de hoy se marca con una línea arriba, no con un fondo: el
             fondo compite con la carga del día. */
          border-top: 2px solid transparent;
          transition: background .12s ease;
        }
        .agd-dia:first-child { border-left: 0; }
        .agd-dia:hover { background: rgba(255, 255, 255, 0.018); }
        .agd-dia.is-sel { background: var(--adm-raised); }
        .agd-dia.is-hoy { border-top-color: var(--adm-accent); }
        .agd-fila { display: grid; grid-template-columns: 130px minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; }
        @media (max-width: 600px) {
          .agd-head > div { padding: 9px 6px; }
          .agd-dia { min-height: 96px; padding: 8px 6px 10px; }
          .agd-fila { grid-template-columns: minmax(0, 1fr) auto; }
          .agd-fila > :first-child { grid-column: 1 / -1; }
        }
      `}</style>

      {ENCABEZADO}

      <Stats>
        <Stat label="Bloqueos" icon="ph-lock-simple" tone="warn" value={agenda.contexto.bloqueosVigentes} hint="vigentes" />
        <Stat label="Servicios" icon="ph-truck" tone="ok" value={agenda.contexto.serviciosComprometidos} hint="con hora comprometida" />
        <Stat label="Equipos" icon="ph-package" tone="info" value={agenda.contexto.equiposActivos} hint="en total" />
      </Stats>

      <Toolbar end={`${n} compromiso${n === 1 ? '' : 's'} en la vista`}>
        <Btn size="sm" icon="ph-caret-left" onClick={() => mover(-1)}>Semana anterior</Btn>
        <Btn size="sm" onClick={() => router.push('/agenda')}>Hoy</Btn>
        <Btn size="sm" onClick={() => mover(1)}>
          Semana siguiente <i className="ph ph-caret-right" aria-hidden />
        </Btn>
        <AdminSelect
          size="sm"
          className="w-auto min-w-[130px]"
          ariaLabel="Semanas a la vista"
          value={filtros.semanas}
          onChange={(v) => {
            const qs = new URLSearchParams();
            if (filtros.desde) qs.set('desde', filtros.desde);
            if (v !== '2') qs.set('semanas', v);
            router.push(`/agenda${qs.size ? `?${qs}` : ''}`);
          }}
          options={[
            { value: '1', label: '1 semana' },
            { value: '2', label: '2 semanas' },
            { value: '4', label: '4 semanas' },
            { value: '6', label: '6 semanas' },
          ]}
        />
      </Toolbar>

      {/* Todas las semanas en un solo panel; el nombre del día va una vez arriba. */}
      <Panel flush clip>
        <div className="adm-thead agd-cols agd-head">
          {DIAS.map((d) => <div key={d}>{d}</div>)}
        </div>
        {agenda.semanas.map((s) => (
          <div key={s.dias[0]} className="agd-cols agd-semana">
            {s.dias.map((d, i) => {
              const items = porDia.get(d) ?? [];
              const esHoy = d === hoy;
              const carga = s.densidad[i] / maxDensidad;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(dia === d ? null : d)}
                  aria-pressed={dia === d}
                  aria-label={`${DIAS[i]} ${Number(d.slice(8, 10))}${items.length ? `, ${items.length} compromiso(s)` : ''}`}
                  className={`agd-dia${dia === d ? ' is-sel' : ''}${esHoy ? ' is-hoy' : ''}`}
                >
                  <span className="adm-num" style={{ fontSize: 14.5, fontWeight: 600, color: esHoy ? 'var(--adm-accent)' : 'var(--adm-text)' }}>
                    {Number(d.slice(8, 10))}
                  </span>

                  {/* La carga del día, para ver de un vistazo dónde aprieta. */}
                  <Bar pct={items.length > 0 ? Math.round(carga * 100) : 0} />

                  <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                    {items.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        className="adm-ellipsis"
                        style={{
                          fontSize: 11.5, lineHeight: 1.35, color: 'var(--adm-muted)',
                          borderLeft: `2px solid ${COLOR_TONO[tonoDe(c)]}`, paddingLeft: 6,
                        }}
                      >
                        {c.titulo}
                      </div>
                    ))}
                    {items.length > 3 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--adm-faint)', paddingLeft: 8 }}>+{items.length - 3} más</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </Panel>

      {/* El detalle del día elegido. Va debajo y no en un modal: la agenda se
          consulta comparando días, y un modal tapa justo lo que se compara. */}
      {dia ? (
        <Panel
          flush
          clip
          style={{ marginTop: 20 }}
          title={fechaDia.charAt(0).toUpperCase() + fechaDia.slice(1)}
          action={<Btn variant="ghost" size="sm" onClick={() => setDia(null)}>Cerrar</Btn>}
        >
          {delDia.length === 0 ? (
            // Un día vacío ES información: es donde se puede prometer.
            <EmptyState icon="ph-calendar-check" title="Nada comprometido este día." sub="Es un hueco donde se puede prometer." />
          ) : (
            delDia.map((c) => (
              <div key={c.id} className="adm-trow agd-fila">
                <div><StatusText tone={tonoDe(c)}>{rotulo(c)}</StatusText></div>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title">{c.titulo}</div>
                  {c.detalle ? <div className="adm-cell-sub">{c.detalle}</div> : null}
                </div>
                <span className="adm-num" style={{ fontSize: 12.5, color: 'var(--adm-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {c.hasta === null
                    ? 'sin fecha de fin'
                    : c.hasta === c.desde
                      ? '—'
                      : `hasta ${c.hasta.slice(8, 10)}/${c.hasta.slice(5, 7)}`}
                </span>
              </div>
            ))
          )}
        </Panel>
      ) : null}

      {agenda.compromisos.length === 0 ? (
        <Note style={{ marginTop: 20 }}>
          No hay nada comprometido en esta ventana. Los servicios aparecen aquí cuando un aliado
          acepta y se compromete a una hora de llegada; los bloqueos, desde Disponibilidad.
        </Note>
      ) : null}
    </div>
  );
}
