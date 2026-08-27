'use client';

import { useMemo, useState } from 'react';
import { D, FONT } from '@/components/editor-kit';
import { QuoteRespond } from './QuoteRespond';
import { QuoteMatches } from './QuoteMatches';
import { QuoteContact } from './QuoteContact';

export interface QuoteItem {
  id: number;
  quoteNumber: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  subtotal: number;
  freightCost: number;
  total: number;
  status: string;
  comments: string | null;
  createdAt: string | null;
  /** Primer contacto con el cliente: alimenta el indicador de primera respuesta. */
  firstContactAt: string | null;
  firstContactVia: string | null;
  /** Calculados en el servidor para no romper la hidratación. */
  days: number;
  dateLabel: string;
}

const GREEN = '#3fbf8f';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const URGENT_DAYS = 7; // a partir de aquí la espera del cliente se marca en ámbar

const GRID = '1.35fr 2fr 1fr 0.95fr auto';
const PAGE_SIZE = 8;

type Tab = 'nuevas' | 'respondidas' | 'todas';
type Sort = 'recent' | 'oldest' | 'amount';

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isPending = (q: QuoteItem) => q.status.trim().toLowerCase() !== 'completed';
const ageLabel = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `hace ${d} días`);

const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };
const toolbarBox: React.CSSProperties = { display: 'flex', alignItems: 'center', background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 11, height: 42, padding: '0 13px' };

export function QuotesManager({ items }: { items: QuoteItem[] }) {
  const [tab, setTab] = useState<Tab>('nuevas');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<QuoteItem | null>(null);

  const countPending = items.filter(isPending).length;
  const countQuoted = items.length - countPending;

  const filtered = useMemo(() => {
    let list = items.slice();
    if (tab === 'nuevas') list = list.filter(isPending);
    else if (tab === 'respondidas') list = list.filter((q) => !isPending(q));

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((q) =>
        [q.quoteNumber, q.name, q.company ?? '', q.email, q.phone].join(' ').toLowerCase().includes(term),
      );
    }

    if (sort === 'recent') list.sort((a, b) => a.days - b.days);
    else if (sort === 'oldest') list.sort((a, b) => b.days - a.days);
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [items, tab, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const rangeLabel = filtered.length === 0 ? '0' : `${start + 1}–${start + pageItems.length}`;

  const TABS: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'nuevas', label: 'Por responder', count: countPending },
    { key: 'respondidas', label: 'Cotizadas', count: countQuoted },
    { key: 'todas', label: 'Todas', count: items.length },
  ];

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
      <style>{`
        .qz-row:hover{ background: rgba(255,255,255,0.022); }
        .qz-tab:hover{ background: rgba(255,255,255,0.05); color:#f5f5f4; }
        .qz-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
        @media (max-width: 1100px){ .qz-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .qz-head{ display:none !important; } }
      `}</style>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
            <span>Ventas</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Cotizaciones</span>
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Cotizaciones</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>Gestiona y responde las solicitudes de cotización de tus clientes.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: D.amber, boxShadow: `0 0 10px ${D.amber}b3` }} />
              <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Por responder</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: D.accent, fontFamily: MONO }}>{countPending}</div>
          </div>
          <div style={statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}99` }} />
              <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Cotizadas</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{countQuoted}</div>
          </div>
        </div>
      </div>

      {/* Barra de herramientas */}
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#111113', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 4, flexWrap: 'wrap', maxWidth: '100%' }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                className={on ? undefined : 'qz-tab'}
                onClick={() => { setTab(t.key); setPage(1); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 600, padding: '8px 16px', borderRadius: 9, background: on ? D.amber : 'transparent', color: on ? 'var(--color-primary-fg)' : '#9A9A9F' }}
              >
                {t.label}
                <span style={{ background: on ? 'rgba(26,18,6,0.22)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ ...toolbarBox, flex: 1, minWidth: 220, maxWidth: 340, gap: 9 }}>
          <i className="ph ph-magnifying-glass" style={{ color: '#6B6B71', fontSize: 14 }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar cliente o folio…"
            aria-label="Buscar cotización"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        <label style={{ ...toolbarBox, gap: 8 }}>
          <span style={{ color: '#6B6B71', fontSize: 12.5, fontWeight: 600 }}>Ordenar</span>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}
            style={{ background: 'transparent', border: 'none', color: D.text, fontSize: 13.5, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="recent" style={{ background: D.card }}>Más recientes</option>
            <option value="oldest" style={{ background: D.card }}>Más antiguas</option>
            <option value="amount" style={{ background: D.card }}>Mayor monto</option>
          </select>
        </label>
      </div>

      {/* Tabla */}
      <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div className="qz-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
          <div style={th}>COTIZACIÓN</div>
          <div style={th}>CLIENTE</div>
          <div style={{ ...th, textAlign: 'right' }}>TOTAL</div>
          <div style={th}>ESTADO</div>
          <div style={{ ...th, textAlign: 'right' }}>ACCIÓN</div>
        </div>

        {pageItems.map((q) => {
          const pend = isPending(q);
          const urgent = pend && q.days >= URGENT_DAYS;
          // Pendiente normal en el acento; solo la espera larga se marca en ámbar,
          // que es el color que el manual reserva para advertir.
          const color = pend ? (urgent ? D.warn : D.accent) : GREEN;
          return (
            <div key={q.id} className="qz-row qz-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 3, alignSelf: 'stretch', minHeight: 34, borderRadius: 3, background: color, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#EDEDEC', letterSpacing: '-0.2px' }}>{q.quoteNumber}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#7A7A7F' }}>{q.dateLabel}</span>
                    {urgent ? (
                      <span title={`Lleva ${q.days} días esperando respuesta`} style={{ fontSize: 10.5, fontWeight: 700, color: D.amber, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', padding: '1px 7px', borderRadius: 20 }}>{ageLabel(q.days)}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#5C5C61' }}>· {ageLabel(q.days)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#EDEDEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.name}{q.company ? ` · ${q.company}` : ''}
                </div>
                <div style={{ fontSize: 12, color: '#7A7A7F', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.email} · {q.phone}</div>
                {q.comments ? (
                  <div title={q.comments} style={{ fontSize: 12, color: '#9A9A9F', fontStyle: 'italic', marginTop: 7, paddingLeft: 10, borderLeft: '2px solid rgba(255,255,255,0.1)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    “{q.comments}”
                  </div>
                ) : null}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: '#FBFBFA', letterSpacing: '-0.3px' }}>{money(q.total)}</div>
                {q.freightCost > 0 ? (
                  <div style={{ fontSize: 11, color: '#6B6B71', marginTop: 3 }}>incl. traslado {money(q.freightCost)}</div>
                ) : null}
              </div>

              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  {pend ? 'Pendiente' : 'Cotizada'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                {pend ? (
                  <>
                    {/* Se registra ANTES de cotizar: es lo que separa "ya le
                        contestamos" de "ya le pusimos precio". */}
                    <QuoteContact quoteId={q.id} firstContactAt={q.firstContactAt} firstContactVia={q.firstContactVia} />
                    {/* Antes de poner precio hay que saber quién la puede atender. */}
                    <QuoteMatches quoteId={q.id} />
                    <QuoteRespond quoteId={q.id} subtotal={q.subtotal} />
                  </>
                ) : (
                  <button type="button" onClick={() => setDetail(q)} className="qz-pg" style={{ background: 'transparent', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap' }}>Ver detalle</button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <i className="ph ph-magnifying-glass" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>{items.length === 0 ? 'Aún no hay cotizaciones' : 'Sin resultados'}</div>
            <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5 }}>
              {items.length === 0 ? 'Cuando un cliente solicite una, aparecerá aquí.' : 'Prueba con otro término o cambia el filtro.'}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 24px', background: '#131315', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
            Mostrando <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{rangeLabel}</span> de <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{filtered.length}</span> cotizaciones
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="qz-pg" aria-label="Página anterior" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, cursor: safePage <= 1 ? 'default' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1, fontSize: 15 }}>‹</button>
            <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {safePage} / {totalPages}</span>
            <button type="button" className="qz-pg" aria-label="Página siguiente" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, cursor: safePage >= totalPages ? 'default' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1, fontSize: 15 }}>›</button>
          </div>
        </div>
      </div>

      {/* Detalle de una cotización ya respondida (solo con lo que la API devuelve). */}
      {detail ? (
        <div role="dialog" aria-modal="true" aria-label="Detalle de cotización" onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, padding: 24, width: 'min(460px, 100%)', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
            <div style={{ fontFamily: MONO, fontSize: 13, color: D.muted2 }}>{detail.quoteNumber}</div>
            <h2 style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{detail.name}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: D.muted }}>
              {detail.company ? `${detail.company} · ` : ''}{detail.email} · {detail.phone}
            </p>
            {detail.comments ? (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9A9A9F', fontStyle: 'italic', paddingLeft: 10, borderLeft: '2px solid rgba(255,255,255,0.1)', lineHeight: 1.5 }}>“{detail.comments}”</p>
            ) : null}
            <div style={{ borderTop: `1px solid ${D.cardBorder}`, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: D.muted2 }}><span>Subtotal</span><span style={{ color: D.text, fontFamily: MONO }}>{money(detail.subtotal)}</span></div>
              {detail.freightCost > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, color: D.muted2 }}><span>Traslado</span><span style={{ color: D.text, fontFamily: MONO }}>{money(detail.freightCost)}</span></div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: `1px solid ${D.cardBorder}` }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
                <strong style={{ fontSize: 22, fontWeight: 800, color: GREEN, fontFamily: MONO }}>{money(detail.total)}</strong>
              </div>
            </div>
            <button type="button" onClick={() => setDetail(null)} style={{ width: '100%', marginTop: 18, border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 11, padding: '11px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
