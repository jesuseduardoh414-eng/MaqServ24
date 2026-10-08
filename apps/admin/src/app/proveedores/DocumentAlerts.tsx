'use client';

import { useEffect, useState } from 'react';
import { Chip, Panel, StatusText } from '@/components/ui';

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
  onIr,
}: {
  /** Abrir el expediente de ese aliado en la lista de abajo. */
  onIr?: (providerId: number) => void;
}) {
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

  return (
    <>
      {/* Plegado solo queda la cabecera: sin su línea inferior no se dobla
          con el borde del panel. */}
      <style>{`.pv-alertas.is-plegado .adm-panel-head { border-bottom: 0; }`}</style>
      <Panel
        flush
        clip
        className={`pv-alertas${abierto ? '' : ' is-plegado'}`}
        style={{ marginBottom: 24 }}
        title={
          <>
            <i className="ph ph-warning-circle" style={{ color: hayVencidos ? 'var(--adm-bad)' : 'var(--adm-warn)' }} aria-hidden />
            {hayVencidos ? 'Hay expedientes vencidos' : 'Papeles por vencer'}
          </>
        }
        desc={`${avisos.length} aliado${avisos.length === 1 ? '' : 's'} · renovarlos antes de que pierdan el sello`}
        action={
          <button type="button" className="adm-panel-link" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
            {abierto ? 'Ocultar' : 'Ver'}
            <i className={`ph ph-caret-${abierto ? 'up' : 'down'}`} aria-hidden />
          </button>
        }
      >
        {abierto
          ? avisos.map((a) => (
              <div
                key={a.providerId}
                className="adm-trow"
                // Un aliado dado de baja sigue apareciendo, pero apagado:
                // esconderlo garantizaría reactivarlo con los papeles caídos.
                style={a.activo ? undefined : { opacity: 0.55 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    {onIr ? (
                      <button
                        type="button"
                        className="adm-cell-title adm-link"
                        onClick={() => onIr(a.providerId)}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      >
                        {a.name}
                      </button>
                    ) : (
                      <span className="adm-cell-title">{a.name}</span>
                    )}
                    {!a.activo ? <Chip tone="muted">Inactivo</Chip> : null}
                    {a.pierdeSello ? <Chip tone="bad">Perdió el sello</Chip> : null}
                  </div>
                  {a.serviciosActivos > 0 ? (
                    // El dato que convierte un trámite pendiente en una obra
                    // expuesta. Por eso se muestra y por eso ordena la lista.
                    <StatusText tone="bad">
                      {a.serviciosActivos} servicio{a.serviciosActivos === 1 ? '' : 's'} en curso
                    </StatusText>
                  ) : null}
                </div>

                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                  {a.documentos.map((d) => (
                    <li key={d.documentId} style={{ fontSize: 12.5, color: 'var(--adm-muted)', display: 'flex', gap: '2px 10px', flexWrap: 'wrap' }}>
                      <span className={`adm-tone t-${d.urgencia === 'vencido' ? 'bad' : 'warn'}`} style={{ fontWeight: 600, minWidth: 130 }}>
                        {d.texto}
                      </span>
                      <span style={{ color: 'var(--adm-text-2)' }}>{d.name || TIPO[d.kind] || d.kind}</span>
                      <span style={{ color: 'var(--adm-faint)' }}>
                        · {TIPO[d.kind] ?? d.kind} · vence <span className="adm-num">{d.expiresAt}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : null}
      </Panel>
    </>
  );
}
