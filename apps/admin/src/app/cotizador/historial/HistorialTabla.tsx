'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { COTIZADORES_META, COTIZADOR_TIPOS, type CotizadorTipo } from '@maqserv/config';
import { money, fechaCorta } from '@maqserv/ui';
import { D } from '@/components/design-tokens';

export interface FilaCotizacion {
  id: number;
  tipo: string;
  folio: string;
  origen: string;
  estado: string;
  cliente: string;
  obra: string | null;
  municipio: string | null;
  correo: string | null;
  telefono: string | null;
  total: number;
  admin: string | null;
  fecha: string | null;
}

/**
 * Estados de una cotización emitida.
 *
 * `solicitada` es el único que significa "alguien está esperando", y por eso va
 * primero y con el acento: es el que hay que vaciar. Los demás son historia.
 */
const ESTADOS: Record<string, { texto: string; color: string }> = {
  solicitada: { texto: 'Por atender', color: 'var(--color-primary)' },
  borrador: { texto: 'Borrador', color: '#8a8a93' },
  enviada: { texto: 'Enviada', color: 'var(--color-warning)' },
  aceptada: { texto: 'Aceptada', color: 'var(--color-success)' },
  cancelada: { texto: 'Cancelada', color: 'var(--color-error)' },
};

export function HistorialTabla({
  items,
  total,
  filtros,
}: {
  items: FilaCotizacion[];
  total: number;
  filtros: { kind: string; state: string; search: string };
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [busqueda, setBusqueda] = useState(filtros.search);
  const [error, setError] = useState<string | null>(null);

  function navegar(patch: Record<string, string>) {
    const p = new URLSearchParams({ ...filtros, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    empezar(() => router.push(`/cotizador/historial${p.size ? `?${p}` : ''}`));
  }

  async function cambiarEstado(id: number, estado: string) {
    setError(null);
    const res = await fetch(`/api/admin/quoter/quotes/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.message ?? 'No se pudo cambiar el estado.');
      return;
    }
    empezar(() => router.refresh());
  }

  async function eliminar(fila: FilaCotizacion) {
    if (!confirm(`¿Borrar la cotización ${fila.folio}? No se puede deshacer.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/quoter/quotes/${fila.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.message ?? 'No se pudo borrar.');
      return;
    }
    empezar(() => router.refresh());
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={filtros.kind} onChange={(e) => navegar({ kind: e.target.value })} style={control}>
          <option value="">Los dos cotizadores</option>
          {COTIZADOR_TIPOS.map((t) => (
            <option key={t} value={t}>
              {COTIZADORES_META[t as CotizadorTipo].titulo}
            </option>
          ))}
        </select>
        <select value={filtros.state} onChange={(e) => navegar({ state: e.target.value })} style={control}>
          <option value="">Cualquier estado</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.texto}
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navegar({ search: busqueda });
          }}
          style={{ display: 'flex', gap: 8, flex: 1, minWidth: 220 }}
        >
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Folio, cliente, obra o correo"
            style={{ ...control, flex: 1 }}
          />
          <button type="submit" style={{ ...control, cursor: 'pointer', color: D.accent, fontWeight: 700 }}>
            Buscar
          </button>
        </form>
      </div>

      {error ? (
        <p style={{ color: D.bad, fontSize: 13, marginBottom: 12 }}>{error}</p>
      ) : null}

      {items.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: 'center', padding: '44px 20px', color: D.muted2 }}>
          <i className="ph ph-file-dashed" style={{ fontSize: 30, display: 'block', marginBottom: 10 }} />
          {total === 0 ? 'Todavía no se ha emitido ninguna cotización.' : 'Ninguna cotización coincide con el filtro.'}
        </div>
      ) : (
        <div style={{ ...tarjeta, overflowX: 'auto', opacity: pendiente ? 0.6 : 1 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead>
              <tr>
                {['Folio', 'Cliente', 'Cotizador', 'Origen', 'Total', 'Fecha', 'Estado', ''].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const est = ESTADOS[q.estado] ?? { texto: q.estado, color: D.muted2 };
                return (
                  <tr key={q.id}>
                    <td style={td}>
                      <Link href={`/cotizador/historial/${q.id}`} style={{ color: D.accent, fontWeight: 700, textDecoration: 'none' }}>
                        {q.folio}
                      </Link>
                    </td>
                    <td style={td}>
                      <b>{q.cliente}</b>
                      {q.obra ? <div style={{ fontSize: 12, color: D.muted2 }}>{q.obra}</div> : null}
                      {q.correo || q.telefono ? (
                        <div style={{ fontSize: 12, color: D.muted2 }}>{[q.correo, q.telefono].filter(Boolean).join(' · ')}</div>
                      ) : null}
                    </td>
                    <td style={td}>{COTIZADORES_META[q.tipo as CotizadorTipo]?.titulo ?? q.tipo}</td>
                    <td style={{ ...td, color: D.muted2 }}>{q.origen === 'sitio' ? 'Sitio público' : q.admin || 'Panel'}</td>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(q.total)}</td>
                    <td style={{ ...td, color: D.muted2, whiteSpace: 'nowrap' }}>{fechaCorta(q.fecha)}</td>
                    <td style={td}>
                      <select
                        value={q.estado}
                        onChange={(e) => cambiarEstado(q.id, e.target.value)}
                        style={{ ...control, height: 32, fontSize: 12.5, color: est.color, fontWeight: 700 }}
                      >
                        {Object.entries(ESTADOS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.texto}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => eliminar(q)}
                        title="Borrar"
                        style={{ border: 'none', background: 'transparent', color: D.muted2, cursor: 'pointer', fontSize: 16 }}
                      >
                        <i className="ph ph-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tarjeta = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 16 } as const;
const control = {
  height: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${D.inputBorder}`,
  background: D.inputBg, color: D.text, fontFamily: 'inherit', fontSize: 13.5, outline: 'none',
} as const;
const th = {
  textAlign: 'left', padding: '11px 14px', borderBottom: `1px solid ${D.cardBorder}`,
  fontSize: 11.5, letterSpacing: '.05em', textTransform: 'uppercase', color: D.muted2, whiteSpace: 'nowrap',
} as const;
const td = {
  padding: '12px 14px', borderBottom: `1px solid ${D.cardBorder}`, fontSize: 13.5, color: D.text, verticalAlign: 'top',
} as const;
