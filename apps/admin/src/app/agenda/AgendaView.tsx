'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

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

const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const COLOR_ESTADO: Record<string, string> = {
  reservado: C.warn,
  'en-traslado': C.accent,
  'en-servicio': C.accent,
  mantenimiento: C.bad,
  inactivo: C.dim,
};

const input: CSSProperties = {
  background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 9, padding: '8px 11px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
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
    return <div style={{ color: C.muted, fontSize: 14 }}>No se pudo cargar la agenda.</div>;
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

  return (
    <div style={{ color: C.ink }}>
      <header style={{ marginBottom: 18 }}>
        <h1 className="adm-page-title">Agenda</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0', maxWidth: 640, lineHeight: 1.6 }}>
          Qué viene y qué unidad está comprometida. El tablero de Servicios dice qué está pasando;
          esto sirve para no prometer dos veces la misma máquina.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button type="button" onClick={() => mover(-1)} style={{ ...input, cursor: 'pointer' }}>‹ Semana anterior</button>
        <button type="button" onClick={() => router.push('/agenda')} style={{ ...input, cursor: 'pointer' }}>Hoy</button>
        <button type="button" onClick={() => mover(1)} style={{ ...input, cursor: 'pointer' }}>Semana siguiente ›</button>
        <select
          value={filtros.semanas}
          onChange={(e) => {
            const qs = new URLSearchParams();
            if (filtros.desde) qs.set('desde', filtros.desde);
            if (e.target.value !== '2') qs.set('semanas', e.target.value);
            router.push(`/agenda${qs.size ? `?${qs}` : ''}`);
          }}
          style={{ ...input, cursor: 'pointer' }}
        >
          <option value="1">1 semana</option>
          <option value="2">2 semanas</option>
          <option value="4">4 semanas</option>
          <option value="6">6 semanas</option>
        </select>
      </div>

      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 16 }}>
        {agenda.contexto.bloqueosVigentes} bloqueo(s) · {agenda.contexto.serviciosComprometidos} servicio(s)
        con hora comprometida · {agenda.contexto.equiposActivos} equipos en total
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {agenda.semanas.map((s) => (
          <div key={s.dias[0]} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: C.line }}>
              {s.dias.map((d, i) => {
                const items = porDia.get(d) ?? [];
                const esHoy = d === hoy;
                const carga = s.densidad[i] / maxDensidad;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDia(dia === d ? null : d)}
                    style={{
                      background: dia === d ? C.panel3 : C.panel,
                      border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      color: C.ink, padding: '11px 10px 13px', minHeight: 118,
                      display: 'flex', flexDirection: 'column', gap: 7,
                      // El día de hoy se marca con una línea arriba, no con un
                      // fondo: el fondo compite con la carga del día.
                      borderTop: `2px solid ${esHoy ? C.accent : 'transparent'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, color: esHoy ? C.accent : C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {DIAS[i]}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: esHoy ? 800 : 600, color: esHoy ? C.accent : C.ink }}>
                        {Number(d.slice(8, 10))}
                      </span>
                    </div>

                    {/* La carga del día, para ver de un vistazo dónde aprieta. */}
                    <div style={{ height: 3, background: C.line2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(carga * 100)}%`, background: items.length > 0 ? C.accent : 'transparent' }} />
                    </div>

                    <div style={{ display: 'grid', gap: 3 }}>
                      {items.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          style={{
                            fontSize: 11, lineHeight: 1.35, color: C.muted,
                            borderLeft: `2px solid ${c.tipo === 'servicio' ? C.ok : COLOR_ESTADO[c.estado] ?? C.warn}`,
                            paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {c.titulo}
                        </div>
                      ))}
                      {items.length > 3 ? (
                        <div style={{ fontSize: 11, color: C.dim, paddingLeft: 8 }}>+{items.length - 3} más</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* El detalle del día elegido. Va debajo y no en un modal: la agenda se
          consulta comparando días, y un modal tapa justo lo que se compara. */}
      {dia ? (
        <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '17px 19px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <button type="button" onClick={() => setDia(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cerrar
            </button>
          </div>

          {delDia.length === 0 ? (
            // Un día vacío ES información: es donde se puede prometer.
            <div style={{ fontSize: 13.5, color: C.muted }}>
              Nada comprometido este día. Es un hueco donde se puede prometer.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {delDia.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                      color: c.tipo === 'servicio' ? C.ok : COLOR_ESTADO[c.estado] ?? C.warn,
                      minWidth: 96, textTransform: 'uppercase',
                    }}
                  >
                    {c.tipo === 'servicio' ? 'Servicio' : c.estado}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.titulo}</div>
                    {c.detalle ? <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{c.detalle}</div> : null}
                  </div>
                  <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>
                    {c.hasta === null
                      ? 'sin fecha de fin'
                      : c.hasta === c.desde
                        ? '—'
                        : `hasta ${c.hasta.slice(8, 10)}/${c.hasta.slice(5, 7)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {agenda.compromisos.length === 0 ? (
        <div style={{ marginTop: 18, fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
          No hay nada comprometido en esta ventana. Los servicios aparecen aquí cuando un aliado
          acepta y se compromete a una hora de llegada; los bloqueos, desde Disponibilidad.
        </div>
      ) : null}
    </div>
  );
}
