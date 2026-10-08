'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { esLineaServicio, LINEAS_SERVICIO } from '@maqserv/config';
import { Btn } from '@/components/ui';

/**
 * QUÉ OFRECE EL ALIADO (2026-09-25).
 *
 * "¿Qué pasa si en lugar de ofrecer servicios ofrece productos, o ambos? …
 * eso empieza desde que MAQSER24 manda la invitación al proveedor."
 *
 * Lo que un aliado puede ofrecer se decide al darlo de alta y vive en
 * `providers.categories` (slugs). La regla es la misma del catálogo: si el
 * slug es una línea de servicio, es servicio; cualquier otra categoría activa
 * es de productos. Así el portal del aliado sabe qué le deja ofrecer sin
 * columna nueva ni SQL.
 */

export type TipoOferta = 'servicios' | 'productos' | 'ambos';

export interface CategoriaPanel { id: number; name: string; slug: string; status: number }

const rotulo: CSSProperties = { display: 'block', marginBottom: 8 };

/**
 * Lo elegido se marca con un velo del acento y un borde, no con un bloque de
 * color sólido: con varias líneas marcadas, los bloques del acento pesaban más
 * que el botón principal del alta (el acento es para la acción principal).
 */
const elegido = (on: boolean): CSSProperties => ({
  border: `1px solid ${on ? 'color-mix(in srgb, var(--adm-accent) 60%, transparent)' : 'var(--adm-border-strong)'}`,
  background: on ? 'color-mix(in srgb, var(--adm-accent) 11%, transparent)' : 'transparent',
  color: on ? 'var(--adm-text)' : 'var(--adm-text-2)',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s ease, border-color .15s ease',
});
/** Una opción de "¿Qué ofrece?": título y una línea de ayuda. */
const opcion = (on: boolean): CSSProperties => ({
  ...elegido(on), display: 'grid', gap: 2, flex: '1 1 160px', textAlign: 'left', padding: '9px 14px', borderRadius: 8,
});
/** Una línea o categoría que se marca y desmarca. */
const casilla = (on: boolean): CSSProperties => ({
  ...elegido(on), display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 8,
  fontSize: 13, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
});

/** Tipo que se deduce de lo que ya tiene marcado (al editar). */
export function tipoDeCategorias(slugs: string[]): TipoOferta {
  const s = slugs.some((x) => esLineaServicio(x));
  const p = slugs.some((x) => !esLineaServicio(x));
  return s && p ? 'ambos' : p ? 'productos' : 'servicios';
}

/** Quita lo que no corresponde al tipo elegido (al guardar). */
export function categoriasDelTipo(slugs: string[], tipo: TipoOferta): string[] {
  if (tipo === 'ambos') return slugs;
  return slugs.filter((x) => (tipo === 'servicios' ? esLineaServicio(x) : !esLineaServicio(x)));
}

/** Qué falta para poder guardar, o null si está completo. */
export function faltaEnOferta(slugs: string[], tipo: TipoOferta): string | null {
  const s = slugs.some((x) => esLineaServicio(x));
  const p = slugs.some((x) => !esLineaServicio(x));
  if ((tipo === 'servicios' || tipo === 'ambos') && !s) return 'Marca al menos un servicio que atiende.';
  if ((tipo === 'productos' || tipo === 'ambos') && !p) return 'Marca al menos una categoría de productos.';
  return null;
}

export function QueOfrece({
  tipo, onTipo, categorias, onCategorias,
}: {
  tipo: TipoOferta;
  onTipo: (t: TipoOferta) => void;
  categorias: string[];
  onCategorias: (c: string[]) => void;
}) {
  const [todas, setTodas] = useState<CategoriaPanel[] | null>(null);
  const [nueva, setNueva] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const r = await fetch('/api/admin/catalog/categories');
    setTodas(r.ok ? ((await r.json()) as CategoriaPanel[]) : []);
  }
  useEffect(() => { void cargar(); }, []);

  const lineas = (todas ?? []).filter((c) => esLineaServicio(c.slug));
  // Las cinco líneas, en el orden en que el cliente las presenta.
  const servicios = LINEAS_SERVICIO.map((s) => lineas.find((c) => c.slug === s)).filter((c): c is CategoriaPanel => !!c);
  const productos = (todas ?? []).filter((c) => !esLineaServicio(c.slug) && c.status === 1);

  const alternar = (slug: string) =>
    onCategorias(categorias.includes(slug) ? categorias.filter((c) => c !== slug) : [...categorias, slug]);

  // Hoy no hay categorías de productos: se crea aquí mismo, sin salir del alta.
  async function crearCategoria() {
    const nombre = nueva.trim();
    if (nombre.length < 2 || creando) return;
    setCreando(true); setError(null);
    const fd = new FormData();
    fd.set('name', nombre);
    const r = await fetch('/api/admin/catalog/categories', { method: 'POST', body: fd });
    const d = await r.json().catch(() => null);
    setCreando(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo crear la categoría.'); return; }
    setNueva('');
    await cargar();
    if (d?.slug) onCategorias([...categorias, d.slug as string]);
  }

  const marcable = (c: CategoriaPanel) => {
    const on = categorias.includes(c.slug);
    return (
      <button key={c.slug} type="button" aria-pressed={on} onClick={() => alternar(c.slug)} style={casilla(on)}>
        {on ? <i className="ph-bold ph-check" style={{ fontSize: 12, color: 'var(--adm-accent)' }} aria-hidden /> : null}
        {c.name}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <span className="adm-label" style={rotulo}>¿Qué ofrece?</span>
        <div role="radiogroup" aria-label="¿Qué ofrece?" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            ['servicios', 'Servicios', 'Renta de maquinaria, fletes, surtido de material…'],
            ['productos', 'Productos', 'Cosas que vende a precio fijo'],
            ['ambos', 'Ambos', 'Servicios y productos'],
          ] as const).map(([v, t, ayuda]) => (
            <button key={v} type="button" role="radio" aria-checked={tipo === v} onClick={() => onTipo(v)} style={opcion(tipo === v)}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</span>
              <span style={{ fontSize: 12, color: 'var(--adm-muted)', lineHeight: 1.4 }}>{ayuda}</span>
            </button>
          ))}
        </div>
      </div>

      {tipo !== 'productos' ? (
        <div>
          <span className="adm-label" style={rotulo}>Qué servicios atiende</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {todas === null ? <span style={{ fontSize: 13, color: 'var(--adm-faint)' }}>Cargando…</span> : null}
            {servicios.map(marcable)}
          </div>
        </div>
      ) : null}

      {tipo !== 'servicios' ? (
        <div>
          <span className="adm-label" style={rotulo}>Qué productos vende</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {productos.map(marcable)}
            {todas !== null && productos.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Aún no hay categorías de productos. Crea la primera:</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 480 }}>
            <input
              className="adm-input"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void crearCategoria(); } }}
              placeholder="Nueva categoría de productos (ej. Herramienta)"
              aria-label="Nueva categoría de productos"
              style={{ flex: 1, minWidth: 0 }}
            />
            <Btn icon="ph-plus" onClick={() => void crearCategoria()} disabled={nueva.trim().length < 2 || creando}>
              {creando ? 'Creando…' : 'Crear'}
            </Btn>
          </div>
          {error ? <div role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', marginTop: 6 }}>{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
