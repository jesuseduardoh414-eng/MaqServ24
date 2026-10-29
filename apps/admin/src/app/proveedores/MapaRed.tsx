'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { MapaCobertura, type PuntoMapa } from './MapaCobertura';

/**
 * EL MAPA DE LA RED (2026-10-27, revisión de Proveedores).
 *
 * Antes eran círculos azules encimados: para saber de quién era cada uno había
 * que darle clic, y no se veía qué servicio daba cada quien. Ahora cada punto
 * lleva su nombre y el color de su servicio; arriba se elige un servicio para
 * ver solo a los que lo dan (y dónde no hay nadie), y tocar un punto abre su
 * expediente.
 */

export const LINEAS_MAPA: ReadonlyArray<{ slug: string; nombre: string; color: string }> = [
  { slug: 'maquinaria-pesada', nombre: 'Maquinaria', color: '#3B9EFF' },
  { slug: 'transporte-y-servicios-de-obra', nombre: 'Transporte', color: '#A78BFA' },
  { slug: 'triturados', nombre: 'Triturados', color: '#F5A524' },
  { slug: 'materiales-para-construccion', nombre: 'Materiales', color: '#34C77B' },
  { slug: 'soluciones-asfalticas', nombre: 'Asfalto', color: '#F472B6' },
];
/** Quien solo vende productos (no da ninguna de las cinco líneas). */
const SOLO_PRODUCTOS = '#9CA3AF';

export interface AliadoMapa {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
  coverageRadiusKm: number | null;
  categories: string[];
  status: number;
}

export function MapaRed({ aliados, onElegir }: { aliados: AliadoMapa[]; onElegir: (id: number) => void }) {
  const [linea, setLinea] = useState<string | null>(null);
  // El mapa se vuelve a armar si cambia la función: se guarda la última y se le pasa una fija.
  const elegirRef = useRef(onElegir);
  elegirRef.current = onElegir;
  const elegir = useCallback((id: number) => elegirRef.current(id), []);

  const activos = aliados.filter((a) => a.status === 1);
  const ubicados = activos.filter((a) => a.lat != null && a.lng != null);
  const sinUbicar = activos.length - ubicados.length;
  const cuantos = (slug: string) => activos.filter((a) => a.categories.includes(slug)).length;

  const puntos = useMemo<PuntoMapa[]>(() => {
    const visibles = ubicados.filter((a) => !linea || a.categories.includes(linea));
    return visibles.map((a) => {
      const suya = LINEAS_MAPA.find((l) => (linea ? l.slug === linea : a.categories.includes(l.slug)));
      const servicios = LINEAS_MAPA.filter((l) => a.categories.includes(l.slug)).map((l) => l.nombre);
      return {
        id: a.id,
        nombre: a.name,
        lat: a.lat!,
        lng: a.lng!,
        radioKm: a.coverageRadiusKm,
        tipo: 'aliado',
        color: suya?.color ?? SOLO_PRODUCTOS,
        etiqueta: a.name,
        // Del lado libre: el mapa lo mide en pantalla para que no se encimen.
        etiquetaLado: 'auto',
        detalle: servicios.join(', ') || 'Productos',
      };
    });
    // `ubicados` sale de `aliados`: con eso basta para saber si cambió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliados, linea]);

  if (ubicados.length === 0) return null;

  const filtro = (clave: string | null, nombre: string, n: number, color?: string) => {
    const on = linea === clave;
    return (
      <button
        key={clave ?? 'todas'}
        type="button"
        className="pv-mapa-f"
        aria-pressed={on}
        data-vacio={n === 0}
        onClick={() => setLinea(clave)}
        title={n === 0 ? `Nadie de la red da ${nombre.toLowerCase()}` : undefined}
      >
        {color ? <span className="pv-mapa-p" style={{ background: color }} aria-hidden /> : null}
        {nombre}
        <span className="pv-mapa-n">{n}</span>
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <style>{`
        .pv-mapa-fs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .pv-mapa-f { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text-2); font: inherit; font-size: 13px; cursor: pointer; }
        .pv-mapa-f:hover { border-color: var(--adm-border-strong); color: var(--adm-text); }
        .pv-mapa-f[aria-pressed="true"] { background: var(--adm-raised); border-color: var(--adm-text-2); color: var(--adm-text); }
        .pv-mapa-f[data-vacio="true"] { color: var(--adm-faint); }
        .pv-mapa-p { width: 9px; height: 9px; border-radius: 50%; }
        .pv-mapa-n { font-variant-numeric: tabular-nums; color: var(--adm-faint); }
        .pv-mapa-f[data-vacio="true"] .pv-mapa-n { color: var(--adm-bad); }
      `}</style>
      <div className="pv-mapa-fs" role="group" aria-label="Ver aliados por servicio">
        {filtro(null, 'Todos', activos.length)}
        {LINEAS_MAPA.map((l) => filtro(l.slug, l.nombre, cuantos(l.slug), l.color))}
      </div>
      {puntos.length ? (
        <MapaCobertura alto={400} tema="oscuro" cerca puntos={puntos} onElegir={elegir} />
      ) : (
        // Un servicio sin nadie: el mapa vacío no dice nada; esto sí.
        <div style={{ height: 400, display: 'grid', placeItems: 'center', border: '1px solid var(--adm-border)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--adm-muted)', fontSize: 14, lineHeight: 1.6 }}>
          <div>
            <i className="ph ph-map-trifold" aria-hidden style={{ fontSize: 28, color: 'var(--adm-faint)' }} />
            <p style={{ margin: '8px 0 0' }}>
              Nadie de la red da {LINEAS_MAPA.find((l) => l.slug === linea)?.nombre.toLowerCase()} todavía.
              <br />Invita a alguien con «Invitar aliado».
            </p>
          </div>
        </div>
      )}
      <p className="adm-help" style={{ margin: '8px 0 0' }}>
        {linea
          ? `Solo los que dan ${LINEAS_MAPA.find((l) => l.slug === linea)?.nombre.toLowerCase()}. Donde no llega ningún círculo, no hay quién.`
          : 'El color es su servicio (si da varios, el primero) y el círculo, hasta dónde llega. Elige un servicio para ver dónde falta.'}
        {' '}Toca un aliado para abrir su expediente.
        {sinUbicar ? ` ${sinUbicar} sin ubicar: ponle su dirección en su expediente.` : ''}
      </p>
    </div>
  );
}
