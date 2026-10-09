'use client';

import { useState } from 'react';
import { Btn, Chip, Panel } from '@/components/ui';

export interface SolicitudRow {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  /** Desde 2026-10-09 el formulario del sitio pide lo mismo que el alta del panel. */
  address?: string | null;
  coverage?: string[];
  coverageRadiusKm?: number | null;
  notes: string | null;
  categoryLabels?: string[];
}

/**
 * SOLICITUDES DE PROVEEDORES (2026-10-06).
 *
 * Lo que llega por "Regístrate como proveedor" en el sitio: aliados con
 * `status = 2`. No reciben ofertas ni entran al cotizador hasta aceptarlos.
 * Aceptar los pasa a la red (status 1) con los datos que mandaron, los ubica
 * con su dirección y les manda su enlace al portal en el mismo paso (antes el
 * enlace había que mandarlo aparte y se olvidaba). Descartar borra
 * la ficha (no tiene historial).
 */
export function SolicitudesProveedor({ solicitudes, onCambio }: { solicitudes: SolicitudRow[]; onCambio: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  if (solicitudes.length === 0) return null;

  async function aceptar(s: SolicitudRow) {
    const aviso = s.email
      ? `¿Aceptar a «${s.name}» en la red de aliados? Le llega a ${s.email} el enlace a su portal.`
      : `¿Aceptar a «${s.name}» en la red de aliados? No dejó correo: su enlace lo mandas desde su expediente (WhatsApp).`;
    if (!window.confirm(aviso)) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}/aceptar`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(null);
    if (!r.ok) { onCambio(typeof d?.message === 'string' ? d.message : 'No se pudo aceptar. Inténtalo de nuevo.'); return; }
    const enlace = d?.acceso?.mensaje ?? 'No dejó correo: mándale su enlace por WhatsApp desde su expediente.';
    onCambio([`«${s.name}» ya está en la red.`, enlace, d?.ubicacion?.mensaje].filter(Boolean).join(' '));
  }

  async function descartar(s: SolicitudRow) {
    if (!window.confirm(`¿Descartar la solicitud de «${s.name}»? Se borra y no se le avisa.`)) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}`, { method: 'DELETE' });
    setOcupado(null);
    onCambio(r.ok ? `Se descartó la solicitud de «${s.name}».` : 'No se pudo descartar. Inténtalo de nuevo.');
  }

  return (
    <>
      {/* Datos y nota a la izquierda, decisión a la derecha; en móvil los
          botones bajan debajo de la nota. */}
      <style>{`
        .pv-sol-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 20px; align-items: start; }
        .pv-sol-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .pv-sol-meta > span, .pv-sol-meta > a { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
        .pv-sol-meta i { font-size: 13px; color: var(--adm-faint); }
        @media (max-width: 640px) {
          .pv-sol-row { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
      <Panel
        flush
        clip
        style={{ marginBottom: 24 }}
        icon="ph-user-plus"
        title="Solicitudes de proveedores"
        desc="Llegan desde «Regístrate como proveedor» en el sitio. No reciben ofertas hasta que los aceptes."
        action={<Chip tone="warn">{solicitudes.length} por revisar</Chip>}
      >
        {solicitudes.map((s) => {
          const ubicacion = [s.city, s.state].filter(Boolean).join(', ');
          return (
            <div key={s.id} className="adm-trow pv-sol-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="adm-cell-title">{s.name}</span>
                  {(s.categoryLabels ?? []).map((c) => <Chip key={c}>{c}</Chip>)}
                </div>
                <div className="adm-meta pv-sol-meta" style={{ marginTop: 6 }}>
                  {s.contactName ? <span title="Contacto"><i className="ph ph-user" aria-hidden />{s.contactName}</span> : null}
                  {s.phone ? (
                    <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="adm-link" title="Teléfono">
                      <i className="ph ph-phone" aria-hidden /><span className="adm-mono">{s.phone}</span>
                    </a>
                  ) : null}
                  {s.email ? (
                    <a href={`mailto:${s.email}`} className="adm-link" title="Correo">
                      <i className="ph ph-envelope-simple" aria-hidden />{s.email}
                    </a>
                  ) : null}
                  {ubicacion ? <span title="Ubicación"><i className="ph ph-map-pin" aria-hidden />{s.address ? `${s.address}, ${ubicacion}` : ubicacion}</span> : null}
                </div>
                {s.coverage?.length ? (
                  <div className="adm-meta pv-sol-meta" style={{ marginTop: 4 }}>
                    <span title="Municipios a los que llega">
                      <i className="ph ph-path" aria-hidden />Llega a {s.coverage.join(', ')}
                      {s.coverageRadiusKm ? <> · <b className="adm-num" style={{ color: 'var(--adm-text-2)' }}>~{s.coverageRadiusKm} km</b></> : null}
                    </span>
                  </div>
                ) : null}
                {s.notes ? (
                  <p style={{ margin: '10px 0 0', paddingLeft: 12, borderLeft: '2px solid var(--adm-border-strong)', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--adm-text-2)' }}>
                    {s.notes}
                  </p>
                ) : null}
              </div>
              <div className="pv-sol-actions">
                <Btn size="sm" variant="danger" disabled={ocupado === s.id} onClick={() => descartar(s)}>Descartar</Btn>
                <Btn size="sm" icon="ph-check" disabled={ocupado === s.id} onClick={() => aceptar(s)}>
                  {ocupado === s.id ? 'Guardando…' : 'Aceptar en la red'}
                </Btn>
              </div>
            </div>
          );
        })}
      </Panel>
    </>
  );
}
