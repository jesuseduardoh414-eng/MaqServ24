'use client';

import { useEffect, useState } from 'react';

/**
 * AVISOS DE EXPEDIENTE (documento institucional, sección 23).
 *
 * "La plataforma requiere alertas y reglas que impidan tratar como verificado
 * un expediente desactualizado."
 *
 * Las reglas ya estaban: quien tiene un papel caído pierde el sello solo. Lo
 * que faltaba era avisar. Antes eso se descubría al ir a asignarle una obra —
 * el peor momento posible.
 *
 * Los contadores de arriba dicen CUÁNTOS. Esto dice QUÉ papel, DE QUIÉN y PARA
 * CUÁNDO, que es lo único con lo que se puede levantar el teléfono.
 */

interface Documento {
  documentId: number;
  kind: string;
  name: string | null;
  expiresAt: string;
  diasRestantes: number;
  urgencia: 'vencido' | 'por-vencer';
  texto: string;
}

interface Aviso {
  providerId: number;
  name: string;
  level: string;
  activo: boolean;
  pierdeSello: boolean;
  serviciosActivos: number;
  documentos: Documento[];
  peor: 'vencido' | 'por-vencer';
}

const TIPO: Record<string, string> = {
  fiscal: 'Fiscal',
  legal: 'Legal',
  seguro: 'Seguro',
  tecnico: 'Técnico',
  seguridad: 'Seguridad',
  otro: 'Otro',
};

export function DocumentAlerts({
  colores, onIr,
}: {
  colores: { panel: string; line: string; line2: string; ink: string; muted: string; dim: string; warn: string; bad: string; accent: string };
  /** Abrir el expediente de ese aliado en la lista de abajo. */
  onIr?: (providerId: number) => void;
}) {
  const C = colores;
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [abierto, setAbierto] = useState(true);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/providers/alerts')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (vivo) setAvisos(Array.isArray(d) ? d : []); })
      .catch(() => { if (vivo) setAvisos([]); })
      .finally(() => {});
    return () => { vivo = false; };
  }, []);

  // Sin avisos no se pinta nada: un recuadro que dice "todo en orden" ocupa el
  // lugar de arriba todos los días para no decir nada el 95% de ellos.
  if (!avisos || avisos.length === 0) return null;

  const hayVencidos = avisos.some((a) => a.peor === 'vencido');
  const color = hayVencidos ? C.bad : C.warn;

  return (
    <section
      aria-label="Expedientes que piden atención"
      style={{
        background: `color-mix(in srgb, ${color} 6%, ${C.panel})`,
        border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
        borderRadius: 14, padding: '16px 18px', marginBottom: 22,
      }}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: C.ink }}
      >
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>
            {hayVencidos ? 'Hay expedientes vencidos' : 'Papeles por vencer'}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
            {avisos.length} aliado{avisos.length === 1 ? '' : 's'} · renovarlos antes de que pierdan el sello
          </div>
        </div>
        <span style={{ fontSize: 12.5, color: C.muted }}>{abierto ? 'Ocultar' : 'Ver'}</span>
      </button>

      {abierto ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 15 }}>
          {avisos.map((a) => (
            <div
              key={a.providerId}
              style={{
                border: `1px solid ${C.line2}`, borderRadius: 11, padding: '12px 14px',
                // Un aliado dado de baja sigue apareciendo, pero apagado:
                // esconderlo garantizaría reactivarlo con los papeles caídos.
                opacity: a.activo ? 1 : 0.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span
                    onClick={() => onIr?.(a.providerId)}
                    style={{ fontSize: 14, fontWeight: 700, cursor: onIr ? 'pointer' : 'default' }}
                  >
                    {a.name}
                  </span>
                  {!a.activo ? <span style={{ marginLeft: 8, fontSize: 11, color: C.dim }}>· inactivo</span> : null}
                  {a.pierdeSello ? (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.bad }}>PERDIÓ EL SELLO</span>
                  ) : null}
                </div>
                {a.serviciosActivos > 0 ? (
                  // El dato que convierte un trámite pendiente en una obra
                  // expuesta. Por eso se muestra y por eso ordena la lista.
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.bad }}>
                    {a.serviciosActivos} servicio{a.serviciosActivos === 1 ? '' : 's'} en curso
                  </span>
                ) : null}
              </div>

              <ul style={{ margin: '9px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {a.documentos.map((d) => {
                  const c = d.urgencia === 'vencido' ? C.bad : C.warn;
                  return (
                    <li key={d.documentId} style={{ fontSize: 12.5, color: C.muted, display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ color: c, fontWeight: 700, minWidth: 130 }}>{d.texto}</span>
                      <span style={{ color: C.ink }}>{d.name || TIPO[d.kind] || d.kind}</span>
                      <span style={{ color: C.dim }}>· {TIPO[d.kind] ?? d.kind} · vence {d.expiresAt}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
