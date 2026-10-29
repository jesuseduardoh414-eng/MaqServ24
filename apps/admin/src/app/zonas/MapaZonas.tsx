'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { MapaCobertura, type PuntoMapa } from '../proveedores/MapaCobertura';
import type { SaludZona, Zona } from './Zonas';

/**
 * EL MAPA DE LAS ZONAS (2026-10-28, revisión de Zonas y cobertura).
 *
 * "Aquí no veo el mapa": el 26 el mapa se fue a Servicios en curso y esta
 * pantalla quedó solo en texto. Pero «¿dónde no llega nadie?» se contesta
 * mejor en un mapa que en una lista. Cada municipio es un punto: el anillo es
 * el color de su zona y el relleno dice cuántos aliados llegan (verde dos o
 * más, ámbar uno solo, rojo ninguno). Encima, hasta dónde llega cada aliado.
 * Tocar un municipio baja a su renglón de cobertura.
 */

/** Un color por zona, en el orden en que están configuradas. */
export const COLORES_ZONA = ['#3B9EFF', '#A78BFA', '#F5A524', '#34C77B', '#F472B6', '#22D3EE', '#FB923C'];
const RELLENO = { bien: '#34C77B', uno: '#F5A524', sin: '#EF4444', fuera: '#52525b' } as const;

export interface AliadoMapaZonas {
  id: number;
  nombre: string;
  lat: number | null;
  lng: number | null;
  radioKm: number | null;
}

export function MapaZonas({ zonas, salud, aliados, onMunicipio }: {
  zonas: Zona[];
  salud: SaludZona[];
  aliados: AliadoMapaZonas[];
  /** Al tocar un municipio: su nombre, para bajar a su renglón de cobertura. */
  onMunicipio: (nombre: string) => void;
}) {
  const [verAliados, setVerAliados] = useState(true);
  const [zonaVista, setZonaVista] = useState<string | null>(null);
  const irRef = useRef(onMunicipio);
  irRef.current = onMunicipio;

  const colorDe = (id: string) => COLORES_ZONA[Math.max(0, zonas.findIndex((z) => z.id === id)) % COLORES_ZONA.length];

  /** id numérico para el mapa (pide número) y el nombre al que corresponde. */
  const indice = useMemo(() => {
    const lista: Array<{ nombre: string; zona: Zona; aliados: number; lat: number; lng: number }> = [];
    for (const z of zonas) {
      if (z.estado === 'pausada') continue;
      const s = salud.find((x) => x.id === z.id);
      for (const m of z.municipios) {
        const dato = s?.municipios.find((x) => x.nombre === m);
        if (!dato || dato.lat == null || dato.lng == null) continue;
        lista.push({ nombre: m, zona: z, aliados: dato.aliados, lat: dato.lat, lng: dato.lng });
      }
    }
    return lista;
  }, [zonas, salud]);

  const puntos = useMemo<PuntoMapa[]>(() => {
    const p: PuntoMapa[] = indice
      .filter((m) => !zonaVista || m.zona.id === zonaVista)
      .map((m, i) => ({
        id: 100000 + i,
        nombre: m.nombre,
        lat: m.lat,
        lng: m.lng,
        tipo: 'municipio',
        color: colorDe(m.zona.id),
        relleno: m.aliados >= 2 ? RELLENO.bien : m.aliados === 1 ? RELLENO.uno : RELLENO.sin,
        detalle: `${m.zona.nombre} · ${m.aliados === 0 ? 'ningún aliado llega' : m.aliados === 1 ? 'un solo aliado' : `${m.aliados} aliados`}`,
      }));
    if (verAliados) {
      for (const a of aliados) {
        if (a.lat == null || a.lng == null) continue;
        p.push({ id: a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, tipo: 'aliado', radioKm: a.radioKm, color: '#9CA3AF', detalle: a.radioKm ? `Llega hasta ${a.radioKm} km` : null });
      }
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, aliados, verAliados, zonaVista, zonas]);

  const elegir = useCallback((id: number) => {
    const m = indice.filter((x) => !zonaVista || x.zona.id === zonaVista)[id - 100000];
    if (m) irRef.current(m.nombre);
  }, [indice, zonaVista]);

  const sinUbicar = zonas.filter((z) => z.estado !== 'pausada').flatMap((z) => z.municipios).length - indice.length;
  if (indice.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        .zm-fs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
        .zm-f { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text-2); font: inherit; font-size: 13px; cursor: pointer; }
        .zm-f:hover { border-color: var(--adm-border-strong); color: var(--adm-text); }
        .zm-f[aria-pressed="true"] { background: var(--adm-raised); border-color: var(--adm-text-2); color: var(--adm-text); }
        .zm-p { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--c); }
        .zm-leyenda { display: flex; gap: 14px; flex-wrap: wrap; margin-left: auto; font-size: 12.5px; color: var(--adm-muted); }
        .zm-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
        .zm-leyenda i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
      `}</style>
      <div className="zm-fs" role="group" aria-label="Ver una zona en el mapa">
        <button type="button" className="zm-f" aria-pressed={zonaVista === null} onClick={() => setZonaVista(null)}>Todas</button>
        {zonas.filter((z) => z.estado !== 'pausada').map((z) => (
          <button key={z.id} type="button" className="zm-f" aria-pressed={zonaVista === z.id} onClick={() => setZonaVista(zonaVista === z.id ? null : z.id)}>
            <span className="zm-p" style={{ ['--c' as string]: colorDe(z.id) }} aria-hidden />{z.nombre}
          </button>
        ))}
        <button type="button" className="zm-f" aria-pressed={verAliados} onClick={() => setVerAliados((v) => !v)} title="Hasta dónde llega cada aliado">
          <i className="ph ph-handshake" aria-hidden />Aliados
        </button>
        <div className="zm-leyenda" aria-label="Qué significa el relleno">
          <span><i style={{ background: RELLENO.bien }} />2 o más aliados</span>
          <span><i style={{ background: RELLENO.uno }} />uno solo</span>
          <span><i style={{ background: RELLENO.sin }} />nadie llega</span>
        </div>
      </div>
      {/* cerca: encuadra los puntos y no los círculos completos; con el alcance de 37 km de un aliado la ciudad se volvía una bolita. */}
      <MapaCobertura alto={420} tema="oscuro" cerca puntos={puntos} onElegir={elegir} />
      <p className="adm-help" style={{ margin: '8px 0 0' }}>
        El anillo es la zona; el relleno, cuántos aliados llegan. Toca un municipio para ver sus solicitudes y quién llega.
        {sinUbicar > 0 ? ` ${sinUbicar} municipio${sinUbicar === 1 ? '' : 's'} sin ubicar en el mapa (el nombre no está en la tabla de cabeceras).` : ''}
      </p>
    </div>
  );
}
