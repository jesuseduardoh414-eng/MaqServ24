'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { esLineaServicio, LINEAS_SERVICIO } from '@maqserv/config';

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

const C = {
  panel2: '#1b1e26', line2: 'rgba(255,255,255,0.12)', ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)', bad: 'var(--color-error)',
};
const label: CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 6, display: 'block' };
const chip = (on: boolean): CSSProperties => ({
  background: on ? C.accent : C.panel2, color: on ? C.accentInk : C.muted,
  border: `1px solid ${on ? C.accent : C.line2}`, borderRadius: 999,
  padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: on ? 700 : 500,
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

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <span style={label}>¿Qué ofrece?</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            ['servicios', 'Servicios', 'Renta de maquinaria, fletes, surtido de material…'],
            ['productos', 'Productos', 'Cosas que vende a precio fijo'],
            ['ambos', 'Ambos', 'Servicios y productos'],
          ] as const).map(([v, t, ayuda]) => (
            <button key={v} type="button" onClick={() => onTipo(v)} style={{ ...chip(tipo === v), borderRadius: 12, textAlign: 'left', padding: '10px 14px' }}>
              <div style={{ fontSize: 14 }}>{t}</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>{ayuda}</div>
            </button>
          ))}
        </div>
      </div>

      {tipo !== 'productos' ? (
        <div>
          <span style={label}>Qué servicios atiende</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {todas === null ? <span style={{ fontSize: 13, color: C.dim }}>Cargando…</span> : null}
            {servicios.map((c) => (
              <button key={c.slug} type="button" onClick={() => alternar(c.slug)} style={chip(categorias.includes(c.slug))}>{c.name}</button>
            ))}
          </div>
        </div>
      ) : null}

      {tipo !== 'servicios' ? (
        <div>
          <span style={label}>Qué productos vende</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {productos.map((c) => (
              <button key={c.slug} type="button" onClick={() => alternar(c.slug)} style={chip(categorias.includes(c.slug))}>{c.name}</button>
            ))}
            {todas !== null && productos.length === 0 ? (
              <span style={{ fontSize: 13, color: C.muted }}>Aún no hay categorías de productos. Crea la primera:</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 480 }}>
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void crearCategoria(); } }}
              placeholder="Nueva categoría de productos (ej. Herramienta)"
              style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 10, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="button" onClick={() => void crearCategoria()} disabled={nueva.trim().length < 2 || creando} style={{ ...chip(false), borderRadius: 10, opacity: nueva.trim().length < 2 ? 0.5 : 1 }}>
              {creando ? 'Creando…' : '+ Crear'}
            </button>
          </div>
          {error ? <div style={{ fontSize: 12.5, color: C.bad, marginTop: 6 }}>{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
