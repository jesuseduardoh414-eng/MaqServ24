'use client';

import { useMemo, useState } from 'react';
import { D, FONT } from '@/components/editor-kit';
import { MapaCobertura, type PuntoMapa } from '@/app/proveedores/MapaCobertura';

/**
 * ¿QUIÉN PUEDE ATENDER ESTA SOLICITUD? (documento, secciones 16 y 17).
 *
 * Hasta ahora esta pregunta se contestaba de memoria: quien cotizaba tenía que
 * acordarse de a quién llamar. Aquí el sistema propone, en orden, a los aliados
 * que atienden esa línea de servicio, y —esto es lo importante— explica en
 * palabras por qué puso a cada uno donde lo puso.
 *
 * La lista NO decide. Quien cotiza sigue eligiendo, y por eso ve tanto lo que
 * juega a favor como lo que hay que tomar en cuenta antes de asignar.
 */

interface Match {
  providerId: number;
  name: string;
  level: string;
  verified: boolean;
  phone: string | null;
  contactName: string | null;
  responseMinutes: number | null;
  coverage: string[];
  score: number;
  reasons: string[];
  warnings: string[];
  availableEquipment: number;
  equipment: Array<{ id: number; name: string; state: string; location: string | null }>;
  lat: number | null;
  lng: number | null;
  coverageRadiusKm: number | null;
  /** Kilómetros por carretera hasta la obra, si los dos están ubicados. */
  distanceKm: number | null;
}

interface Respuesta {
  quoteNumber: string;
  categoria: string | null;
  zona: string | null;
  total: number;
  motivo: string | null;
  /** Dónde está la obra. Null si la dirección todavía no se geocodificó. */
  obra: { lat: number; lng: number; label: string } | null;
  matches: Match[];
}

const NIVEL: Record<string, string> = {
  preferente: 'Preferente',
  activo: 'Activo',
  validado: 'Validado',
  registrado: 'Registrado',
};

export function QuoteMatches({ quoteId }: { quoteId: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * La obra y los candidatos ubicados, en un solo mapa.
   *
   * "A 12 km de la obra" contesta cuánto, pero no HACIA DÓNDE: dos aliados a la
   * misma distancia pueden estar en lados opuestos de la ciudad, y con el
   * tráfico de Monterrey eso son dos horas de diferencia. El mapa muestra lo
   * que la lista no puede.
   *
   * La obra va primero para que quede debajo de los círculos de cobertura y
   * encima no la tape nadie.
   */
  const puntos = useMemo<PuntoMapa[]>(() => {
    if (!data?.obra) return [];
    const obra: PuntoMapa = {
      id: -1,
      nombre: 'La obra',
      lat: data.obra.lat,
      lng: data.obra.lng,
      tipo: 'obra',
      detalle: data.obra.label,
    };
    const aliados = data.matches
      .filter((m): m is Match & { lat: number; lng: number } => m.lat != null && m.lng != null)
      .map((m) => ({
        id: m.providerId,
        nombre: m.name,
        lat: m.lat,
        lng: m.lng,
        radioKm: m.coverageRadiusKm,
        tipo: 'aliado' as const,
        detalle: m.distanceKm != null ? `A ${m.distanceKm} km de la obra` : null,
      }));
    return [obra, ...aliados];
  }, [data]);

  /** Cuántos candidatos NO se pueden pintar: se dice, no se esconde. */
  const sinUbicar = (data?.matches ?? []).filter((m) => m.lat == null || m.lng == null).length;

  async function abrir() {
    setOpen(true);
    if (data) return;
    setError(null);
    try {
      const r = await fetch(`/api/admin/quotes/${quoteId}/matches`);
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setError('No se pudo consultar la red de aliados. Intenta de nuevo.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Ver qué aliados pueden atender esta solicitud"
        style={{
          border: `1px solid ${D.inputBorder}`, background: 'transparent', color: '#B4B4B9',
          borderRadius: 9, padding: '8px 12px', fontWeight: 600, fontSize: 12.5,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        ¿Quién puede?
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aliados que pueden atender"
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200, fontFamily: FONT }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18,
          padding: 24, width: 'min(620px, 100%)', textAlign: 'left',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
          // La lista crece con el número de aliados: sin tope, el modal se sale
          // de la pantalla y no hay forma de llegar al final.
          maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
          Quién puede atender esto
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: D.muted, lineHeight: 1.55 }}>
          {data
            ? `${data.categoria ?? 'Sin línea de servicio'}${data.zona ? ` · ${data.zona}` : ''}`
            : 'Consultando la red…'}
        </p>

        {error ? (
          <div style={{ fontSize: 13, color: D.warn, padding: '14px 0' }}>{error}</div>
        ) : null}

        {/* El mapa antes de la lista: la primera pregunta al asignar es "¿quién
            está cerca?", y eso se ve, no se lee. */}
        {puntos.length > 1 ? (
          <div style={{ marginBottom: 16 }}>
            <MapaCobertura puntos={puntos} alto={240} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: D.muted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E0A32E' }} /> La obra
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#008CFF' }} /> Aliado y hasta dónde llega
              </span>
              {sinUbicar > 0 ? (
                <span style={{ color: D.warn }}>
                  {sinUbicar} candidato{sinUbicar === 1 ? '' : 's'} sin ubicar: no aparece{sinUbicar === 1 ? '' : 'n'} en el mapa
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Sin mapa hay que decir POR QUÉ, o parece que se rompió. */}
        {data && data.matches.length > 0 && puntos.length <= 1 ? (
          <div style={{ marginBottom: 16, padding: '11px 14px', border: `1px solid ${D.cardBorder}`, borderRadius: 11, fontSize: 12.5, color: D.muted, lineHeight: 1.55 }}>
            {!data.obra
              ? 'No hay mapa porque la obra todavía no tiene ubicación. Ponle coordenadas en Clientes y obras y aquí verás quién está cerca.'
              : 'No hay mapa porque ninguno de los candidatos está ubicado. Usa “Ponerlo en el mapa” en el expediente de cada aliado.'}
          </div>
        ) : null}

        {data && data.matches.length === 0 ? (
          <div style={{ padding: '26px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#B4B4B9' }}>Nadie en la red cubre esto todavía</div>
            <div style={{ fontSize: 13, color: D.muted, marginTop: 7, lineHeight: 1.6 }}>{data.motivo}</div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {(data?.matches ?? []).map((m, i) => (
            <div
              key={m.providerId}
              style={{
                border: `1px solid ${i === 0 ? 'color-mix(in srgb, var(--color-primary) 34%, transparent)' : D.cardBorder}`,
                borderRadius: 13, padding: '14px 16px',
                background: i === 0 ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: D.text }}>{m.name}</span>
                  {m.verified ? (
                    <span title="Expediente completo y vigente" style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: D.amber }}>✓ VERIFICADO</span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11.5, color: D.muted2, whiteSpace: 'nowrap' }}>
                  {/* La distancia, al frente: es lo que decide entre dos
                      aliados equivalentes y lo que se paga en el traslado. */}
                  {m.distanceKm != null ? (
                    <span style={{ color: D.text, fontWeight: 700 }}>{m.distanceKm} km · </span>
                  ) : null}
                  {NIVEL[m.level] ?? m.level}
                  {/* El puntaje se muestra en chico y al final: es para ordenar,
                      no para que nadie decida con él. Lo que se lee son las razones. */}
                  <span style={{ opacity: 0.5 }}> · {m.score} pts</span>
                </span>
              </div>

              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {m.reasons.map((r) => (
                  <li key={r} style={{ fontSize: 12.5, color: '#9A9A9F', lineHeight: 1.5 }}>
                    <span style={{ color: D.amber, marginRight: 7 }}>+</span>{r}
                  </li>
                ))}
                {m.warnings.map((w) => (
                  <li key={w} style={{ fontSize: 12.5, color: '#8A8A90', lineHeight: 1.5 }}>
                    <span style={{ color: D.warn, marginRight: 7 }}>!</span>{w}
                  </li>
                ))}
              </ul>

              {m.phone || m.contactName ? (
                <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${D.cardBorder}`, fontSize: 12.5, color: D.muted2 }}>
                  {m.contactName ? <span>{m.contactName}</span> : null}
                  {m.contactName && m.phone ? ' · ' : ''}
                  {m.phone ? (
                    <a href={`tel:${m.phone}`} style={{ color: D.amber, textDecoration: 'none', fontWeight: 600 }}>{m.phone}</a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ marginTop: 20, width: '100%', border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 11, padding: '11px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
