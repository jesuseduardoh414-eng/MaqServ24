'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { catalogoDeCategorias, type Tabuladores } from '@maqserv/config';
import { Tarjeta } from './piezas';
import { ServicioAMano } from './pasos-maquinaria';
import type { LineaServicio } from './estado';

/** Un producto del catálogo de una categoría que todavía no tiene precio de lista. */
export interface ProductoALaMedida {
  id: number;
  nombre: string;
  /** La unidad de su ficha ("m2", "tonelada"…); sin ella, por pieza. */
  unidad: string | null;
}

/** "m2" → "m²", "tonelada" → "ton"…; lo que no se conoce, tal cual (o "pieza" si no hay). */
export function unidadDeProducto(u: string | null): string {
  const mapa: Record<string, string> = { m2: 'm²', m3: 'm³', tonelada: 'ton', toneladas: 'ton', pieza: 'pieza', piezas: 'pieza', viaje: 'viaje', hora: 'hora', dia: 'día', día: 'día' };
  const k = (u ?? '').trim().toLowerCase();
  return mapa[k] ?? (k || 'pieza');
}

/**
 * LAS CATEGORÍAS DE UNA COTIZACIÓN (2026-11-03): la de entrada y las que se
 * agregan desde «¿Necesitas otro servicio?». Con ellas se arma el tabulador
 * de esta cotización. Lo comparten el sitio, el panel y el enlace.
 */
export function useCategorias(tabuladores: Tabuladores, iniciales: readonly string[]) {
  const [activas, setActivas] = useState<string[]>(() => [...new Set(iniciales)]);
  const catalogo = useMemo(() => catalogoDeCategorias(tabuladores, activas), [tabuladores, activas]);
  const activar = (clave: string) => setActivas((a) => (a.includes(clave) ? a : [...a, clave]));
  const quitar = (clave: string) => setActivas((a) => a.filter((k) => k !== clave));
  return { activas, catalogo, activar, quitar };
}

/**
 * UNA CATEGORÍA SIN PRECIO DE LISTA EN EL PANEL Y EL ENLACE (2026-11-03):
 * sus productos del catálogo en tarjetas; tocar uno agrega su renglón con
 * nombre y unidad, y el precio se captura aquí (el documento sale con
 * precio). Sin productos, un renglón para escribirlo todo a mano.
 */
export function CategoriaAMano({ titulo, icono, productos, lineas, alternar, agregarOtro, actualizar, quitarLinea, quitar, mostrarPrecios }: {
  titulo: string;
  icono: string;
  productos: ProductoALaMedida[];
  /** Los renglones de esta categoría. */
  lineas: LineaServicio[];
  alternar: (p: ProductoALaMedida) => void;
  agregarOtro: () => void;
  actualizar: (uid: number, patch: Partial<LineaServicio>) => void;
  quitarLinea: (uid: number) => void;
  /** Quita la categoría de la cotización, con sus renglones. */
  quitar: () => void;
  mostrarPrecios: boolean;
}) {
  const cuenta = (p: ProductoALaMedida) => lineas.filter((l) => l.nombre === p.nombre).length;
  return (
    <div className="cz-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <h2 className="cz-card-h">{titulo}</h2>
        <button type="button" className="cz-rm" aria-label={`Quitar ${titulo}`} title="Quitar" onClick={quitar}>✕</button>
      </div>
      <p className="cz-card-s">
        {productos.length
          ? 'Todavía no tiene precio de lista: toca lo que se cotiza y captura su precio.'
          : 'Todavía no tiene precio de lista: escribe qué es y su precio.'}
      </p>
      {productos.length ? (
        <div className="cz-cards">
          {productos.map((p) => (
            <Tarjeta key={p.id} icono={icono} titulo={p.nombre} nota={`por ${unidadDeProducto(p.unidad)} · precio a mano`} n={cuenta(p)} onClick={() => alternar(p)} />
          ))}
        </div>
      ) : null}
      {lineas.length ? (
        <div style={{ marginTop: 16 }}>
          {lineas.map((l) => (
            <ServicioAMano key={l.uid} l={l} actualizar={actualizar} quitar={quitarLinea} mostrarPrecios={mostrarPrecios} />
          ))}
        </div>
      ) : null}
      <button type="button" className="cz-agregar" onClick={agregarOtro} style={{ marginTop: 14 }}>
        <Plus className="size-4" aria-hidden />
        {productos.length ? 'Otro (nombre y precio a mano)' : 'Agregar (nombre y precio a mano)'}
      </button>
    </div>
  );
}
