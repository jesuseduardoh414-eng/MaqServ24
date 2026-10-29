'use client';

import Link from 'next/link';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { COTIZADORES_META, COTIZADOR_TIPOS, type CotizadorTipo } from '@maqserv/config';
import { money, fechaCorta } from '@maqserv/ui';
import { Btn, EmptyState, IconBtn, Note, Panel, SearchBox, Toolbar } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';
import { ESTADOS_COTIZACION, EstadoCotizacion } from './EstadoCotizacion';

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
  /** Enviada y su vigencia pasó sin respuesta (2026-10-26). */
  vencida?: boolean;
}


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

  async function eliminar(fila: FilaCotizacion) {
    if (!(await confirmar({ titulo: `¿Borrar la cotización ${fila.folio}?`, mensaje: 'No se puede deshacer.', confirmar: 'Borrar', peligro: true }))) return;
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
            ...Object.entries(ESTADOS_COTIZACION).map(([k, v]) => ({ value: k, label: v.texto })),
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
          {/* En tableta y teléfono, cada documento es una tarjeta (auditoría 2026-10-28):
              la tabla de 760 px escondía total, fecha, estado y borrar fuera de la vista. */}
          <style>{`
            @media (max-width: 900px) {
              .hi-wrap { overflow-x: visible !important; }
              .hi-tbl { min-width: 0 !important; display: block; }
              .hi-tbl thead { display: none; }
              .hi-tbl tbody { display: block; }
              .hi-tbl tr {
                display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: start;
                grid-template-areas: "folio estado" "cli total" "cot fecha" "origen borrar";
                padding: 14px 16px; border-bottom: 1px solid var(--adm-border);
              }
              .hi-tbl td { display: block; padding: 0 !important; border: 0 !important; }
              .hi-folio { grid-area: folio; } .hi-estado { grid-area: estado; justify-self: end; }
              .hi-cli { grid-area: cli; min-width: 0; } .hi-total { grid-area: total; }
              .hi-cot { grid-area: cot; font-size: 12.5px; } .hi-fecha { grid-area: fecha; justify-self: end; font-size: 12.5px; }
              .hi-origen { grid-area: origen; font-size: 12.5px; } .hi-borrar { grid-area: borrar; justify-self: end; }
            }
          `}</style>
          <div className="hi-wrap" style={{ overflowX: 'auto' }}>
            <table className="adm-tbl hi-tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  {['Folio', 'Cliente', 'Cotizador', 'Origen', 'Total', 'Fecha', 'Estado', ''].map((h, i) => (
                    <th key={h || i} style={i === 4 ? { textAlign: 'right' } : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  return (
                    <tr key={q.id}>
                      <td className="hi-folio">
                        <Link href={`/cotizador/historial/${q.id}`} className="adm-link adm-mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {q.folio}
                        </Link>
                      </td>
                      <td className="hi-cli">
                        <div className="adm-cell-title">{q.cliente}</div>
                        {q.obra ? <div className="adm-cell-sub">{q.obra}</div> : null}
                        {q.correo || q.telefono ? (
                          <div className="adm-cell-sub">{[q.correo, q.telefono].filter(Boolean).join(' · ')}</div>
                        ) : null}
                      </td>
                      <td className="hi-cot" style={{ color: 'var(--adm-text-2)' }}>{COTIZADORES_META[q.tipo as CotizadorTipo]?.titulo ?? q.tipo}</td>
                      <td className="hi-origen" style={{ color: 'var(--adm-muted)' }}>{q.origen === 'sitio' ? 'Sitio público' : q.admin || 'Panel'}</td>
                      <td className="adm-num hi-total" style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{money(q.total)}</td>
                      <td className="adm-num hi-fecha" style={{ color: 'var(--adm-muted)', whiteSpace: 'nowrap' }}>{fechaCorta(q.fecha)}</td>
                      <td className="hi-estado">
                        {/* Solo de lectura (2026-10-26): el estado lo pone el flujo. Aceptar por teléfono
                            o cancelar se hace en la página del documento. */}
                        <EstadoCotizacion estado={q.estado} vencida={q.vencida} />
                      </td>
                      <td className="hi-borrar" style={{ textAlign: 'right' }}>
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
