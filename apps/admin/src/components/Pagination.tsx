'use client';

import type { CSSProperties } from 'react';

/**
 * Paginación reutilizable para los módulos de listado del admin (productos,
 * categorías, órdenes…). Solo pagina lo que se muestra; los datos ya viven en
 * el cliente, así que la navegación es instantánea y no dispara consultas.
 *
 * Paleta cromo-oscuro + ámbar, igual que los *Manager del panel.
 */

const C = {
  panel: '#141416', panel2: '#1b1e26',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  amber: 'var(--color-primary)', amberInk: 'var(--color-primary-fg)',
};

export interface PaginationProps {
  /** Página actual (base 1). */
  page: number;
  /** Total de páginas (mínimo 1). */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Tamaño de página; si se pasa junto a onPageSizeChange se muestra el selector. */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Texto informativo a la izquierda, p. ej. «Mostrando 1–12 de 28». */
  info?: string;
}

/** Ventana de páginas con elipsis: 1 … 4 5 6 … 20 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push('gap');
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push('gap');
  out.push(total);
  return out;
}

const btnBase: CSSProperties = {
  minWidth: 36, height: 36, padding: '0 10px', borderRadius: 10,
  border: `1px solid ${C.line}`, background: C.panel2, color: C.muted,
  fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-grid', placeItems: 'center',
};

export function Pagination({
  page, pageCount, onPageChange,
  pageSize, onPageSizeChange, pageSizeOptions = [12, 24, 48],
  info,
}: PaginationProps) {
  const current = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const go = (p: number) => { if (p >= 1 && p <= pageCount && p !== current) onPageChange(p); };
  const arrow = (disabled: boolean): CSSProperties => ({
    ...btnBase, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {info ? <span style={{ fontSize: 13, color: C.muted, fontWeight: 300 }}>{info}</span> : null}
        {pageSize != null && onPageSizeChange ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.dim, fontWeight: 500 }}>
            Por página
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 9, padding: '7px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" aria-label="Anterior" disabled={current <= 1} onClick={() => go(current - 1)} style={arrow(current <= 1)}>
            <i className="ph-bold ph-caret-left" style={{ fontSize: 13 }} />
          </button>
          {pageWindow(current, pageCount).map((it, i) =>
            it === 'gap' ? (
              <span key={`gap-${i}`} style={{ minWidth: 22, textAlign: 'center', color: C.dim, fontWeight: 700 }}>…</span>
            ) : (
              <button
                key={it}
                type="button"
                aria-current={it === current ? 'page' : undefined}
                onClick={() => go(it)}
                style={it === current
                  ? { ...btnBase, background: C.amber, color: C.amberInk, border: `1px solid ${C.amber}`, cursor: 'default' }
                  : btnBase}
              >
                {it}
              </button>
            ),
          )}
          <button type="button" aria-label="Siguiente" disabled={current >= pageCount} onClick={() => go(current + 1)} style={arrow(current >= pageCount)}>
            <i className="ph-bold ph-caret-right" style={{ fontSize: 13 }} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
