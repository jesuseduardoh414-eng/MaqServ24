'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Btn, Chip, EmptyState, Note } from '@/components/ui';
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

  return (
    <>
      <Btn size="sm" variant="ghost" icon="ph-users-three" onClick={abrir} title="Ver qué aliados pueden atender esta solicitud">
        ¿Quién puede?
      </Btn>

      {/* El Modal del kit ya trae el tope de alto y el scroll interno: la lista
          crece con el número de aliados y sin tope se salía de la pantalla. */}
      <Modal
        abierto={open}
        titulo="Quién puede atender esto"
        subtitulo={data ? `${data.categoria ?? 'Sin línea de servicio'}${data.zona ? ` · ${data.zona}` : ''}` : 'Consultando la red…'}
        onCerrar={() => setOpen(false)}
        ancho={620}
        pie={<Btn onClick={() => setOpen(false)}>Cerrar</Btn>}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {error ? <Note tone="warn">{error}</Note> : null}

          {/* El mapa antes de la lista: la primera pregunta al asignar es "¿quién
              está cerca?", y eso se ve, no se lee. */}
          {puntos.length > 1 ? (
            <div>
              <MapaCobertura puntos={puntos} alto={240} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                {/* Mismos colores que los marcadores de MapaCobertura. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E0A32E' }} /> La obra
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#008CFF' }} /> Aliado y hasta dónde llega
                </span>
                {sinUbicar > 0 ? (
                  <span style={{ color: 'var(--adm-warn)' }}>
                    {sinUbicar} candidato{sinUbicar === 1 ? '' : 's'} sin ubicar: no aparece{sinUbicar === 1 ? '' : 'n'} en el mapa
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Sin mapa hay que decir POR QUÉ, o parece que se rompió. */}
          {data && data.matches.length > 0 && puntos.length <= 1 ? (
            <Note icon="ph-map-trifold">
              {!data.obra
                ? 'No hay mapa porque la obra todavía no tiene ubicación. Ponle coordenadas en Clientes y obras y aquí verás quién está cerca.'
                : 'No hay mapa porque ninguno de los candidatos está ubicado. Usa “Ponerlo en el mapa” en el expediente de cada aliado.'}
            </Note>
          ) : null}

          {data && data.matches.length === 0 ? (
            <EmptyState icon="ph-users-three" title="Nadie en la red cubre esto todavía" sub={data.motivo} />
          ) : null}

          {/* Una sola lista con filas: el primero va apenas resaltado porque es
              la propuesta del sistema, no porque esté decidido. */}
          {data && data.matches.length > 0 ? (
            <div className="adm-panel is-clip">
              {data.matches.map((m, i) => (
                <div
                  key={m.providerId}
                  className="adm-trow"
                  style={i === 0 ? { background: 'color-mix(in srgb, var(--adm-accent) 5%, transparent)' } : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="adm-cell-title">{m.name}</span>
                      {m.verified ? <Chip tone="ok" title="Expediente completo y vigente">Verificado</Chip> : null}
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--adm-muted)', whiteSpace: 'nowrap' }}>
                      {/* La distancia, al frente: es lo que decide entre dos
                          aliados equivalentes y lo que se paga en el traslado. */}
                      {m.distanceKm != null ? (
                        <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{m.distanceKm} km · </span>
                      ) : null}
                      {NIVEL[m.level] ?? m.level}
                      {/* El puntaje se muestra en chico y al final: es para ordenar,
                          no para que nadie decida con él. Lo que se lee son las razones. */}
                      <span className="adm-num" style={{ color: 'var(--adm-faint)' }}> · {m.score} pts</span>
                    </span>
                  </div>

                  <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                    {m.reasons.map((r) => (
                      <li key={r} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--adm-text-2)', lineHeight: 1.5 }}>
                        <i className="ph ph-plus" aria-hidden style={{ color: 'var(--adm-ok)', marginTop: 3, fontSize: 12 }} />{r}
                      </li>
                    ))}
                    {m.warnings.map((w) => (
                      <li key={w} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
                        <i className="ph ph-warning" aria-hidden style={{ color: 'var(--adm-warn)', marginTop: 3, fontSize: 12 }} />{w}
                      </li>
                    ))}
                  </ul>

                  {m.phone || m.contactName ? (
                    <div className="adm-meta" style={{ marginTop: 8 }}>
                      {m.contactName ? <span>{m.contactName}</span> : null}
                      {m.phone ? (
                        <a href={`tel:${m.phone}`} className="adm-link adm-mono" style={{ fontWeight: 500 }}>{m.phone}</a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
