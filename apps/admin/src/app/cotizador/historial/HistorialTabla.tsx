'use client';

import Link from 'next/link';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { COTIZADORES_META, COTIZADOR_TIPOS, type CotizadorTipo } from '@maqserv/config';
import { money, fechaCorta } from '@maqserv/ui';
import { Btn, EmptyState, IconBtn, Note, Panel, SearchBox, Toolbar } from '@/components/ui';

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
 * `solicitada` NO es un pendiente de esta pantalla (2026-10-08): es un pedido
 * del sitio cuyo servicio aún no tiene aliado, y ese trabajo se atiende en
 * Solicitudes y Servicios. Antes decía "Por atender" y contaba en el menú, así
 * que el mismo pendiente aparecía dos veces. Aquí solo se informa.
 */
const ESTADOS: Record<string, { texto: string; color: string }> = {
  solicitada: { texto: 'Esperando aliado', color: 'var(--adm-info)' },
  borrador: { texto: 'Borrador', color: 'var(--adm-muted)' },
  enviada: { texto: 'Enviada', color: 'var(--adm-warn)' },
  aceptada: { texto: 'Aceptada', color: 'var(--adm-ok)' },
  cancelada: { texto: 'Cancelada', color: 'var(--adm-bad)' },
};

export function HistorialTabla({
  items,
  total,
  filtros,
  pie,
}: {
  items: FilaCotizacion[];
  total: number;
  filtros: { kind: string; state: string; search: string };
  /** Paginación (enlaces armados en el servidor): va al pie del panel. */
  pie?: ReactNode;
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
      <Toolbar end={`${items.length} de ${total}`}>
        <AdminSelect
          size="sm"
          className="w-auto min-w-[180px] h-9"
          ariaLabel="Cotizador"
          value={filtros.kind}
          onChange={(v) => navegar({ kind: v })}
          options={[
            { value: '', label: 'Los dos cotizadores' },
            ...COTIZADOR_TIPOS.map((t) => ({ value: t, label: COTIZADORES_META[t as CotizadorTipo].titulo })),
          ]}
        />
        <AdminSelect
          size="sm"
          className="w-auto min-w-[170px] h-9"
          ariaLabel="Estado"
          value={filtros.state}
          onChange={(v) => navegar({ state: v })}
          options={[
            { value: '', label: 'Cualquier estado' },
            ...Object.entries(ESTADOS).map(([k, v]) => ({ value: k, label: v.texto })),
          ]}
        />
        {/* La búsqueda va al servidor: se manda con Enter o con el botón. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navegar({ search: busqueda });
          }}
          style={{ display: 'flex', gap: 8, flex: '1 1 280px', maxWidth: 480 }}
        >
          <SearchBox
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Folio, cliente, obra o correo"
            aria-label="Buscar cotización"
            style={{ maxWidth: 'none' }}
          />
          <Btn type="submit">Buscar</Btn>
        </form>
      </Toolbar>

      {error ? <Note tone="bad" style={{ marginBottom: 14 }}>{error}</Note> : null}

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            icon="ph-file-dashed"
            title={total === 0 ? 'Todavía no se ha emitido ninguna cotización.' : 'Ninguna cotización coincide con el filtro.'}
          />
        </Panel>
      ) : (
        <Panel flush clip footer={pie} style={{ opacity: pendiente ? 0.6 : 1, transition: 'opacity .15s ease' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {['Folio', 'Cliente', 'Cotizador', 'Origen', 'Total', 'Fecha', 'Estado', ''].map((h, i) => (
                    <th key={h || i} style={i === 4 ? { textAlign: 'right' } : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  const est = ESTADOS[q.estado] ?? { texto: q.estado, color: 'var(--adm-muted)' };
                  return (
                    <tr key={q.id}>
                      <td>
                        <Link href={`/cotizador/historial/${q.id}`} className="adm-link adm-mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {q.folio}
                        </Link>
                      </td>
                      <td>
                        <div className="adm-cell-title">{q.cliente}</div>
                        {q.obra ? <div className="adm-cell-sub">{q.obra}</div> : null}
                        {q.correo || q.telefono ? (
                          <div className="adm-cell-sub">{[q.correo, q.telefono].filter(Boolean).join(' · ')}</div>
                        ) : null}
                      </td>
                      <td style={{ color: 'var(--adm-text-2)' }}>{COTIZADORES_META[q.tipo as CotizadorTipo]?.titulo ?? q.tipo}</td>
                      <td style={{ color: 'var(--adm-muted)' }}>{q.origen === 'sitio' ? 'Sitio público' : q.admin || 'Panel'}</td>
                      <td className="adm-num" style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{money(q.total)}</td>
                      <td className="adm-num" style={{ color: 'var(--adm-muted)', whiteSpace: 'nowrap' }}>{fechaCorta(q.fecha)}</td>
                      <td>
                        {/* Se cambia aquí mismo: el color del texto es el del estado. */}
                        <AdminSelect
                          size="sm"
                          className="w-auto min-w-[140px]"
                          ariaLabel={`Estado de ${q.folio}`}
                          value={q.estado}
                          onChange={(v) => cambiarEstado(q.id, v)}
                          style={{ color: est.color, fontWeight: 600 }}
                          options={Object.entries(ESTADOS).map(([k, v]) => ({ value: k, label: v.texto }))}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <IconBtn icon="ph-trash" label="Borrar" danger onClick={() => eliminar(q)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
