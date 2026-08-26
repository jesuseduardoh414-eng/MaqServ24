'use client';

import { useEffect, useState } from 'react';

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

const ESTADO: Record<string, { texto: string; tono: 'ok' | 'mal' | 'espera' }> = {
  aceptado: { texto: 'Aceptó', tono: 'ok' },
  rechazado: { texto: 'Rechazó', tono: 'mal' },
  retirado: { texto: 'Se retiró', tono: 'mal' },
  propuesto: { texto: 'Sin contestar', tono: 'espera' },
};

export function ProviderHistory({
  providerId, colores,
}: {
  providerId: number;
  colores: { panel2: string; line: string; line2: string; ink: string; muted: string; dim: string; warn: string; ok: string; bad: string };
}) {
  const C = colores;
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

  if (cargando) return <div style={{ fontSize: 13, color: C.dim, padding: '10px 0' }}>Cargando historial…</div>;
  if (!h) return null;

  const tono = (t: 'ok' | 'mal' | 'espera') => (t === 'ok' ? C.ok : t === 'mal' ? C.bad : C.warn);

  return (
    <section style={{ borderTop: `1px solid ${C.line}`, marginTop: 22, paddingTop: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.ink }}>Cumplimiento</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{h.resumen}</p>

      {h.ofrecidos > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
            {[
              ['Se le ofreció', h.ofrecidos, C.ink],
              ['Aceptó', h.aceptados, C.ok],
              ['Rechazó', h.rechazados, C.muted],
              ['Completó', h.completados, C.ok],
              // Cancelar después de aceptar es lo que más pesa: la obra ya
              // contaba con esa unidad. Se pinta en rojo solo si pasó.
              ['Canceló', h.cancelados, h.cancelados > 0 ? C.bad : C.dim],
            ].map(([t, n, col]) => (
              <div key={String(t)} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ fontSize: 11.5, color: C.muted }}>{t}</div>
                <div style={{ fontSize: 21, fontWeight: 800, marginTop: 3, color: col as string }}>{n as number}</div>
              </div>
            ))}
          </div>

          {/*
            Lo prometido contra lo cumplido. El declarado es un número que
            alguien escribió al dar de alta al aliado; el medido sale de sus
            propuestas contestadas. Enseñar solo el primero es repetir el
            folleto.
          */}
          {h.minutosRespuestaDeclarado !== null || h.minutosRespuestaReal !== null ? (
            <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 11, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
              <div>
                Dice contestar en{' '}
                <strong style={{ color: C.ink }}>
                  {h.minutosRespuestaDeclarado !== null ? `${h.minutosRespuestaDeclarado} min` : 'no lo declaró'}
                </strong>
                {' · '}
                de verdad tarda{' '}
                <strong style={{ color: C.ink }}>
                  {h.minutosRespuestaReal !== null ? `${h.minutosRespuestaReal} min` : 'aún no hay con qué medirlo'}
                </strong>
              </div>
              {h.desviacionRespuesta !== null && Math.abs(h.desviacionRespuesta) >= 5 ? (
                <div style={{ marginTop: 5, color: h.desviacionRespuesta > 0 ? C.warn : C.ok }}>
                  {h.desviacionRespuesta > 0
                    ? `Tarda ${h.desviacionRespuesta} min más de lo que promete.`
                    : `Contesta ${Math.abs(h.desviacionRespuesta)} min antes de lo que promete.`}
                </div>
              ) : null}
              <div style={{ marginTop: 5, fontSize: 12, color: C.dim }}>
                Para ordenar candidatos manda el medido, no el declarado.
              </div>
            </div>
          ) : null}

          {h.motivosRechazo.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Por qué ha dicho que no</div>
              {h.motivosRechazo.map((m) => (
                <div key={m.motivo} style={{ fontSize: 13, color: C.ink }}>
                  · {m.motivo}{m.veces > 1 ? <span style={{ color: C.dim }}> ({m.veces} veces)</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* Caso por caso: cuando un número extraña, hay que poder mirarlo. */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Últimas solicitudes</div>
          <div style={{ display: 'grid', gap: 5 }}>
            {h.recientes.map((r) => {
              const e = ESTADO[r.state] ?? { texto: r.state, tono: 'espera' as const };
              return (
                <div key={r.quoteNumber + r.offeredAt} style={{ display: 'flex', gap: 10, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: C.dim, minWidth: 108 }}>{r.quoteNumber}</span>
                  <span style={{ color: tono(e.tono), fontWeight: 600, minWidth: 92 }}>{e.texto}</span>
                  <span style={{ color: C.muted }}>{r.category ?? 'sin línea'}</span>
                  {r.reason ? <span style={{ color: C.dim }}>· {r.reason}</span> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
