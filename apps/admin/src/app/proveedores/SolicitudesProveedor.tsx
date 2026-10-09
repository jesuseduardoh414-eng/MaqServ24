'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { Btn, Chip, Panel } from '@/components/ui';
import { MapaCobertura, type PuntoMapa } from './MapaCobertura';
import { confirmar } from '@/components/Dialogos';

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
  lat?: number | null;
  lng?: number | null;
  responseMinutes?: number | null;
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
 *
 * "Ver solicitud" (2026-10-09): la fila es un resumen; el detalle enseña todo
 * lo que mandó, dónde queda en el mapa y hasta dónde llega, para decidir sin
 * tener que llamarle primero.
 */
export function SolicitudesProveedor({ solicitudes, onCambio }: { solicitudes: SolicitudRow[]; onCambio: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [viendo, setViendo] = useState<SolicitudRow | null>(null);
  if (solicitudes.length === 0) return null;

  async function aceptar(s: SolicitudRow) {
    const ok = await confirmar({
      titulo: `¿Aceptar a «${s.name}» en la red?`,
      mensaje: s.email
        ? `Queda ubicado con su dirección y le llega a ${s.email} el enlace a su portal.`
        : 'Queda ubicado con su dirección. No dejó correo: su enlace se lo mandas por WhatsApp desde su expediente.',
      confirmar: 'Aceptar en la red',
    });
    if (!ok) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}/aceptar`, { method: 'POST' });
    const d = await r.json().catch(() => null);
    setOcupado(null);
    if (!r.ok) { onCambio(typeof d?.message === 'string' ? d.message : 'No se pudo aceptar. Inténtalo de nuevo.'); return; }
    setViendo(null);
    const enlace = d?.acceso?.mensaje ?? 'No dejó correo: mándale su enlace por WhatsApp desde su expediente.';
    onCambio([`«${s.name}» ya está en la red.`, enlace, d?.ubicacion?.mensaje].filter(Boolean).join(' '));
  }

  async function descartar(s: SolicitudRow) {
    if (!(await confirmar({ titulo: `¿Descartar la solicitud de «${s.name}»?`, mensaje: 'Se borra y no se le avisa.', confirmar: 'Descartar', peligro: true }))) return;
    setOcupado(s.id);
    const r = await fetch(`/api/admin/providers/${s.id}`, { method: 'DELETE' });
    setOcupado(null);
    if (r.ok) setViendo(null);
    onCambio(r.ok ? `Se descartó la solicitud de «${s.name}».` : 'No se pudo descartar. Inténtalo de nuevo.');
  }

  const botones = (s: SolicitudRow, conVer: boolean) => (
    <>
      {conVer ? <Btn size="sm" variant="ghost" icon="ph-eye" onClick={() => setViendo(s)}>Ver solicitud</Btn> : null}
      <Btn size="sm" variant="danger" disabled={ocupado === s.id} onClick={() => descartar(s)}>Descartar</Btn>
      <Btn size="sm" icon="ph-check" variant={conVer ? 'secondary' : 'primary'} disabled={ocupado === s.id} onClick={() => aceptar(s)}>
        {ocupado === s.id ? 'Guardando…' : 'Aceptar en la red'}
      </Btn>
    </>
  );

  return (
    <>
      {/* Datos a la izquierda, decisión a la derecha; en móvil los botones
          bajan debajo de los datos. */}
      <style>{`
        .pv-sol-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 20px; align-items: start; }
        .pv-sol-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .pv-sol-meta > span, .pv-sol-meta > a { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
        .pv-sol-meta i { font-size: 13px; color: var(--adm-faint); }
        .pv-sol-msg { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .pv-det { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 9px 16px; margin: 0; font-size: 13.5px; }
        .pv-det dt { color: var(--adm-muted); }
        .pv-det dd { margin: 0; color: var(--adm-text); overflow-wrap: anywhere; }
        @media (max-width: 640px) {
          .pv-sol-row { grid-template-columns: minmax(0, 1fr); }
          .pv-det { grid-template-columns: minmax(0, 1fr); gap: 2px; }
          .pv-det dd { margin-bottom: 8px; }
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
          const { mensaje } = leerNota(s.notes);
          return (
            <div key={s.id} className="adm-trow pv-sol-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="adm-cell-title adm-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setViendo(s)}>
                    {s.name}
                  </button>
                  {(s.categoryLabels ?? []).map((c) => <Chip key={c}>{c}</Chip>)}
                </div>
                <div className="adm-meta pv-sol-meta" style={{ marginTop: 6 }}>
                  {s.contactName ? <span title="Contacto"><i className="ph ph-user" aria-hidden />{s.contactName}</span> : null}
                  {s.phone ? <span title="Teléfono"><i className="ph ph-phone" aria-hidden /><span className="adm-mono">{s.phone}</span></span> : null}
                  {ubicacion ? <span title="Ubicación"><i className="ph ph-map-pin" aria-hidden />{ubicacion}</span> : null}
                  {s.coverageRadiusKm ? <span title="Hasta dónde llega"><i className="ph ph-path" aria-hidden />~{s.coverageRadiusKm} km</span> : null}
                </div>
                {mensaje ? (
                  <p className="pv-sol-msg" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--adm-text-2)' }}>{mensaje}</p>
                ) : null}
              </div>
              <div className="pv-sol-actions">{botones(s, true)}</div>
            </div>
          );
        })}
      </Panel>

      {viendo ? (
        <Modal
          abierto
          titulo={`Solicitud · ${viendo.name}`}
          subtitulo="Lo que mandó desde «Regístrate como proveedor». Al aceptarlo le llega su enlace al portal."
          onCerrar={() => setViendo(null)}
          ancho={760}
          pie={botones(viendo, false)}
        >
          <DetalleSolicitud s={viendo} />
        </Modal>
      ) : null}
    </>
  );
}

/**
 * La nota que arma la API: "Solicitud desde el sitio (fecha)\nTipo: …\nOfrece:
 * …\n\nmensaje". Si se registró varias veces, los bloques van separados por
 * "---" y aquí se juntan los mensajes.
 */
function leerNota(nota: string | null): { fecha: string | null; tipo: string | null; ofrece: string | null; mensaje: string } {
  const bloques = (nota ?? '').split(/\n\s*---\s*\n/).map((b) => b.trim()).filter(Boolean);
  let fecha: string | null = null;
  let tipo: string | null = null;
  let ofrece: string | null = null;
  const mensajes: string[] = [];
  for (const b of bloques) {
    const [cabeza, ...resto] = b.split(/\n\s*\n/);
    const lineas = cabeza.split('\n');
    const f = lineas.find((l) => l.startsWith('Solicitud desde el sitio'))?.match(/\((.+)\)/)?.[1];
    if (f) fecha = f;
    tipo = lineas.find((l) => l.startsWith('Tipo:'))?.slice(5).trim() ?? tipo;
    ofrece = lineas.find((l) => l.startsWith('Ofrece:'))?.slice(7).trim() ?? ofrece;
    const texto = (lineas.some((l) => l.startsWith('Tipo:')) ? resto.join('\n\n') : b).trim();
    if (texto) mensajes.push(texto);
  }
  return { fecha, tipo, ofrece, mensaje: mensajes.join('\n\n') };
}

const minutosATexto = (m: number) => (m < 60 ? `~${m} min` : m < 480 ? `~${Math.round(m / 60)} h` : 'el mismo día');

function DetalleSolicitud({ s }: { s: SolicitudRow }) {
  const nota = leerNota(s.notes);
  const wa = waDe(s.phone);
  const punto = useMemo<PuntoMapa[]>(
    () => (s.lat != null && s.lng != null ? [{ id: s.id, nombre: s.name, lat: s.lat, lng: s.lng, radioKm: s.coverageRadiusKm ?? null, tipo: 'aliado' }] : []),
    [s.id, s.name, s.lat, s.lng, s.coverageRadiusKm],
  );
  const fila = (titulo: string, valor: ReactNode) => (valor ? <><dt>{titulo}</dt><dd>{valor}</dd></> : null);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <section>
        <h3 style={H3}>Quién es</h3>
        <dl className="pv-det">
          {fila('Se registra como', nota.tipo)}
          {fila('Persona de contacto', s.contactName)}
          {fila('Teléfono', s.phone ? (
            <span style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="adm-link adm-mono">{s.phone}</a>
              {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="adm-link">WhatsApp</a> : null}
            </span>
          ) : null)}
          {fila('Correo', s.email ? <a href={`mailto:${s.email}`} className="adm-link">{s.email}</a> : <span style={{ color: 'var(--adm-faint)' }}>No dejó: su enlace al portal se lo mandas por WhatsApp</span>)}
          {fila('Contesta', s.responseMinutes ? minutosATexto(s.responseMinutes) : null)}
          {fila('Se registró', nota.fecha)}
        </dl>
      </section>

      <section>
        <h3 style={H3}>Qué ofrece</h3>
        <dl className="pv-det">
          {fila('Líneas', (s.categoryLabels ?? []).length ? (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{(s.categoryLabels ?? []).map((c) => <Chip key={c}>{c}</Chip>)}</span>
          ) : nota.ofrece)}
        </dl>
        {nota.mensaje ? (
          <p style={{ margin: '12px 0 0', paddingLeft: 12, borderLeft: '2px solid var(--adm-border-strong)', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--adm-text-2)' }}>
            {nota.mensaje}
          </p>
        ) : null}
      </section>

      <section>
        <h3 style={H3}>Dónde está y hasta dónde llega</h3>
        <dl className="pv-det">
          {fila('Dirección de su base', s.address || <span style={{ color: 'var(--adm-faint)' }}>No la dio</span>)}
          {fila('Municipio', [s.city, s.state].filter(Boolean).join(', '))}
          {fila('Municipios a los que llega', s.coverage?.length ? s.coverage.join(', ') : <span style={{ color: 'var(--adm-faint)' }}>No los dio</span>)}
          {fila('Hasta dónde llega', s.coverageRadiusKm ? <b className="adm-num">~{s.coverageRadiusKm} km de su base</b> : null)}
        </dl>
        {punto.length ? (
          <div style={{ marginTop: 14 }}>
            <MapaCobertura alto={220} puntos={punto} />
            <p className="adm-help" style={{ margin: '6px 0 0' }}>
              Por ahora es el centro de su municipio. Al aceptarlo se ubica con su dirección exacta.
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <h3 style={H3}>Papeles</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-text-2)' }}>
          No se piden en el registro. Al aceptarlo, los sube en su portal: póliza de seguro, constancia de situación fiscal y
          DC-3 de sus operadores. Mientras no estén vigentes, no tiene el sello de verificado.
        </p>
      </section>
    </div>
  );
}

const H3 = { margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' } as const;

/** 10 dígitos de México → 52XXXXXXXXXX para wa.me. */
function waDe(tel: string | null): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`;
  return null;
}
