'use client';

import { useEffect, useState } from 'react';
import { Panel, Stat, Stats, StatusText, type Tone } from '@/components/ui';

/**
 * HISTORIAL DE CUMPLIMIENTO (documento institucional, sección 23).
 *
 * "En construcción, la confianza no puede depender únicamente de una
 * calificación de estrellas. Es necesario verificar elementos objetivos: [...]
 * evidencia de servicio e historial de cumplimiento."
 *
 * El resto del expediente dice si el aliado tiene los papeles. Esto dice si
 * CUMPLE, que es otra cosa: se puede estar en regla y no contestar nunca, o
 * aceptar una obra y después cancelarla.
 *
 * Con pocos casos NO se pintan porcentajes, se cuentan los hechos. Un "100% de
 * cumplimiento" sacado de dos servicios se lee con la misma autoridad que uno
 * sacado de doscientos — y eso es exactamente la calificación de estrellas que
 * el documento pide no imitar.
 */

interface Historial {
  ofrecidos: number;
  aceptados: number;
  rechazados: number;
  sinContestar: number;
  completados: number;
  cancelados: number;
  enCurso: number;
  tasaAceptacion: number | null;
  tasaCumplimiento: number | null;
  minutosRespuestaReal: number | null;
  minutosRespuestaDeclarado: number | null;
  desviacionRespuesta: number | null;
  confiable: boolean;
  resumen: string;
  motivosRechazo: Array<{ motivo: string; veces: number }>;
  recientes: Array<{
    quoteNumber: string;
    category: string | null;
    state: string;
    serviceState: string | null;
    reason: string | null;
    offeredAt: string;
    respondedAt: string | null;
  }>;
}

const ESTADO: Record<string, { texto: string; tono: Tone }> = {
  aceptado: { texto: 'Aceptó', tono: 'ok' },
  rechazado: { texto: 'Rechazó', tono: 'bad' },
  retirado: { texto: 'Se retiró', tono: 'bad' },
  propuesto: { texto: 'Sin contestar', tono: 'warn' },
};

const fuerte = { color: 'var(--adm-text)', fontWeight: 600 } as const;
const rotulo = { display: 'block', marginBottom: 6 } as const;

export function ProviderHistory({ providerId }: { providerId: number }) {
  const [h, setH] = useState<Historial | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fetch(`/api/admin/providers/${providerId}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setH(d); })
      .catch(() => { if (vivo) setH(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [providerId]);

  if (cargando) return <div style={{ fontSize: 13, color: 'var(--adm-faint)', padding: '10px 0' }}>Cargando historial…</div>;
  if (!h) return null;

  return (
    <section style={{ borderTop: '1px solid var(--adm-border)', marginTop: 24, paddingTop: 20 }}>
      {/* Las cinco cifras van en texto, como las del encabezado de cada
          módulo. Dentro del expediente la columna es angosta: se recorta el
          aire entre cifras para que las etiquetas no se corten. */}
      <style>{`
        .pv-hist .adm-stat { padding-left: 16px; padding-right: 16px; }
        .pv-hist .adm-stat:first-child { padding-left: 0; }
        @media (max-width: 760px) { .pv-hist .adm-stat:nth-child(odd) { padding-left: 0; } }
      `}</style>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--adm-text)' }}>Cumplimiento</h3>
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.6 }}>{h.resumen}</p>

      {h.ofrecidos > 0 ? (
        <>
          <div className="pv-hist">
            <Stats style={{ marginBottom: 18 }}>
              <Stat label="Se le ofreció" icon="ph-paper-plane-tilt" value={h.ofrecidos} />
              <Stat label="Aceptó" icon="ph-check-circle" tone="ok" value={h.aceptados} />
              <Stat label="Rechazó" icon="ph-x-circle" tone="muted" value={h.rechazados} />
              <Stat label="Completó" icon="ph-flag-checkered" tone="ok" value={h.completados} />
              {/* Cancelar después de aceptar es lo que más pesa: la obra ya
                  contaba con esa unidad. Se pinta en rojo solo si pasó. */}
              <Stat
                label="Canceló"
                icon="ph-prohibit"
                tone={h.cancelados > 0 ? 'bad' : 'muted'}
                valueTone={h.cancelados > 0 ? 'bad' : undefined}
                value={h.cancelados}
              />
            </Stats>
          </div>

          {/*
            Lo prometido contra lo cumplido. El declarado es un número que
            alguien escribió al dar de alta al aliado; el medido sale de sus
            propuestas contestadas. Enseñar solo el primero es repetir el
            folleto.
          */}
          {h.minutosRespuestaDeclarado !== null || h.minutosRespuestaReal !== null ? (
            <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.65 }}>
              <div>
                Dice contestar en{' '}
                <span className="adm-num" style={fuerte}>
                  {h.minutosRespuestaDeclarado !== null ? `${h.minutosRespuestaDeclarado} min` : 'no lo declaró'}
                </span>
                {' · '}
                de verdad tarda{' '}
                <span className="adm-num" style={fuerte}>
                  {h.minutosRespuestaReal !== null ? `${h.minutosRespuestaReal} min` : 'aún no hay con qué medirlo'}
                </span>
              </div>
              {h.desviacionRespuesta !== null && Math.abs(h.desviacionRespuesta) >= 5 ? (
                <div className={`adm-tone ${h.desviacionRespuesta > 0 ? 't-warn' : 't-ok'}`} style={{ marginTop: 4 }}>
                  {h.desviacionRespuesta > 0
                    ? `Tarda ${h.desviacionRespuesta} min más de lo que promete.`
                    : `Contesta ${Math.abs(h.desviacionRespuesta)} min antes de lo que promete.`}
                </div>
              ) : null}
              <div className="adm-help" style={{ marginTop: 4 }}>
                Para ordenar candidatos manda el medido, no el declarado.
              </div>
            </div>
          ) : null}

          {h.motivosRechazo.length > 0 ? (
            <div style={{ marginBottom: 18 }}>
              <span className="adm-label" style={rotulo}>Por qué ha dicho que no</span>
              {h.motivosRechazo.map((m) => (
                <div key={m.motivo} style={{ fontSize: 13, color: 'var(--adm-text)', lineHeight: 1.6 }}>
                  · {m.motivo}{m.veces > 1 ? <span style={{ color: 'var(--adm-faint)' }}> ({m.veces} veces)</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Caso por caso: cuando un número extraña, hay que poder mirarlo. */}
          {h.recientes.length > 0 ? (
            <>
              <span className="adm-label" style={rotulo}>Últimas solicitudes</span>
              <Panel flush clip>
                {h.recientes.map((r) => {
                  const e = ESTADO[r.state] ?? { texto: r.state, tono: 'warn' as const };
                  return (
                    <div
                      key={r.quoteNumber + r.offeredAt}
                      className="adm-trow"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px 12px', flexWrap: 'wrap', padding: '10px 16px', fontSize: 12.5 }}
                    >
                      <span className="adm-mono" style={{ color: 'var(--adm-faint)', minWidth: 108 }}>{r.quoteNumber}</span>
                      <span style={{ minWidth: 104 }}><StatusText tone={e.tono}>{e.texto}</StatusText></span>
                      <span style={{ color: 'var(--adm-muted)' }}>{r.category ?? 'sin línea'}</span>
                      {r.reason ? <span style={{ color: 'var(--adm-faint)' }}>· {r.reason}</span> : null}
                    </div>
                  );
                })}
              </Panel>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
