'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Bar, Btn, EmptyState, IconBtn, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toast, Toolbar, type Tone,
} from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

/**
 * Dos fuentes en un mismo tablero (2026-10-12): las reseñas de SERVICIO, que el
 * cliente deja al cerrar su servicio (0 por revisar · 1 publicada · 2 oculta), y
 * las de PRODUCTO que quedan de cuando había carrito (1 aprobada · 0 pendiente).
 * `key` las distingue: el id solo no basta, son tablas distintas.
 */
export interface Review {
  key: string; id: number; fuente: 'servicio' | 'producto';
  author: string; product: string; rating: number; review: string; status: number; verified?: boolean; createdAt: string | null;
  folio?: string | null; aliado?: string | null;
}

const base = (r: Review) => (r.fuente === 'servicio' ? '/api/admin/service-reviews' : '/api/admin/comments');
/** "Ocultar" no es lo mismo en las dos: en la de producto vuelve a pendiente. */
const oculta = (r: Review) => (r.fuente === 'servicio' ? 2 : 0);

const PAGE_SIZE = 8;

const initials = (n: string) => n.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusMeta = (r: Review): { label: string; tone: Tone } => r.status === 1
  ? { label: r.fuente === 'servicio' ? 'Publicada' : 'Aprobada', tone: 'ok' }
  : r.status === 2 ? { label: 'Oculta', tone: 'muted' }
    : { label: r.fuente === 'servicio' ? 'Por revisar' : 'Pendiente', tone: 'warn' };

const Star = ({ filled, size }: { filled: boolean; size: number }) => filled
  ? <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--adm-accent)" stroke="none" aria-hidden><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg>
  : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--adm-border-strong)" strokeWidth="1.8" aria-hidden><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg>;
const Stars = ({ n, size = 13 }: { n: number; size?: number }) => (
  <span style={{ display: 'inline-flex', gap: 2 }} title={`${n} de 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} filled={i < n} size={size} />)}</span>
);

const GRID = '28px minmax(0,1.5fr) 92px minmax(0,2.4fr) 110px 110px 112px';

export function ReviewsBoard({ initial }: { initial: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initial);
  const [tab, setTab] = useState<'todas' | 'pend' | 'aprob'>('todas');
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3500); return () => clearTimeout(id); }, [toast]);

  const total = reviews.length;
  const pending = reviews.filter((r) => r.status === 0).length;
  const approved = reviews.filter((r) => r.status === 1).length;
  const avgNum = total ? reviews.reduce((a, r) => a + r.rating, 0) / total : 0;
  const avg = avgNum.toFixed(1);
  const dist = [5, 4, 3, 2, 1].map((st) => ({ star: st, count: reviews.filter((r) => r.rating === st).length }));
  const maxDist = Math.max(1, ...dist.map((d) => d.count));
  const thisWeek = reviews.filter((r) => r.createdAt && Date.now() - new Date(r.createdAt).getTime() < 7 * 864e5).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      const tabOk = tab === 'todas' || (tab === 'pend' && r.status === 0) || (tab === 'aprob' && r.status === 1);
      const qOk = !q || [r.author, r.review, r.product, r.folio ?? '', r.aliado ?? ''].some((x) => x.toLowerCase().includes(q));
      return tabOk && qOk;
    });
  }, [reviews, tab, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const paged = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const visIds = filtered.map((r) => r.key);
  const selectedCount = Object.keys(sel).filter((k) => sel[k]).length;
  const allSelected = visIds.length > 0 && visIds.every((id) => sel[id]);

  // ---- acciones (optimista + API) ----
  async function apiStatus(r: Review, status: number) {
    return fetch(`${base(r)}/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  }
  async function setStatus(rev: Review, status: number) {
    const prev = reviews;
    setReviews((rs) => rs.map((r) => (r.key === rev.key ? { ...r, status } : r)));
    const r = await apiStatus(rev, status);
    if (!r.ok) { setReviews(prev); setToast({ ok: false, text: 'No se pudo actualizar la reseña' }); }
  }
  async function remove(rev: Review) {
    if (!(await confirmar({ titulo: '¿Eliminar esta reseña?', mensaje: 'No se puede deshacer.', confirmar: 'Eliminar', peligro: true }))) return;
    const prev = reviews;
    setReviews((rs) => rs.filter((r) => r.key !== rev.key));
    setSel((s) => { const n = { ...s }; delete n[rev.key]; return n; });
    const r = await fetch(`${base(rev)}/${rev.id}`, { method: 'DELETE' });
    if (!r.ok) { setReviews(prev); setToast({ ok: false, text: 'No se pudo eliminar' }); }
  }
  async function bulk(action: 'approve' | 'hide' | 'delete') {
    const elegidas = reviews.filter((r) => sel[r.key]);
    if (!elegidas.length) return;
    if (action === 'delete' && !(await confirmar({ titulo: `¿Eliminar ${elegidas.length} ${elegidas.length === 1 ? 'reseña' : 'reseñas'}?`, mensaje: 'No se puede deshacer.', confirmar: 'Eliminar', peligro: true }))) return;
    const prev = reviews;
    const keys = new Set(elegidas.map((r) => r.key));
    const nuevo = (r: Review) => (action === 'approve' ? 1 : oculta(r));
    if (action === 'delete') setReviews((rs) => rs.filter((r) => !keys.has(r.key)));
    else setReviews((rs) => rs.map((r) => (keys.has(r.key) ? { ...r, status: nuevo(r) } : r)));
    setSel({});
    const results = await Promise.all(elegidas.map((r) => (action === 'delete'
      ? fetch(`${base(r)}/${r.id}`, { method: 'DELETE' })
      : apiStatus(r, nuevo(r)))));
    if (results.some((r) => !r.ok)) { setReviews(prev); setToast({ ok: false, text: 'Algunas no se pudieron actualizar' }); }
  }
  function toggleAll() {
    setSel((s) => {
      const n = { ...s };
      if (allSelected) visIds.forEach((id) => delete n[id]);
      else visIds.forEach((id) => { n[id] = true; });
      return n;
    });
  }
  function exportCsv() {
    const head = ['Tipo', 'Folio', 'Autor', 'Servicio o producto', 'Aliado', 'Calificación', 'Reseña', 'Estado', 'Fecha'];
    const rows = reviews.map((r) => [r.fuente === 'servicio' ? 'Servicio' : 'Producto', r.folio ?? '', r.author, r.product, r.aliado ?? '', String(r.rating), r.review, statusMeta(r).label, fmtDate(r.createdAt)]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'resenas.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const changeTab = (t: typeof tab) => { setTab(t); setPage(1); };
  const changeQuery = (v: string) => { setQuery(v); setPage(1); };

  // Casilla de selección: la del kit no existe; se arma con sus variables.
  const box = (on: boolean): CSSProperties => ({
    width: 18, height: 18, borderRadius: 5, padding: 0, flexShrink: 0, cursor: 'pointer',
    border: `1.5px solid ${on ? 'var(--adm-accent)' : 'var(--adm-border-strong)'}`,
    background: on ? 'var(--adm-accent)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const check = <i className="ph-bold ph-check" style={{ fontSize: 11, color: 'var(--color-primary-fg, #fff)' }} aria-hidden />;
  const pageBtn = (on: boolean): CSSProperties => ({
    width: 'auto', minWidth: 32, padding: '0 9px', fontFamily: 'inherit', fontSize: 13, fontVariantNumeric: 'tabular-nums',
    ...(on ? { background: 'rgba(255,255,255,0.09)', color: 'var(--adm-text)', fontWeight: 600, cursor: 'default' } : null),
  });

  return (
    <div>
      <style>{`
        .rev-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        /* Las 7 columnas no caben en móvil: cada reseña se apila
           (selector + autor arriba, reseña completa debajo, acciones al pie). */
        @media (max-width: 900px) {
          .rev-head { display: none !important; }
          .rev-row { display: flex; flex-wrap: wrap; gap: 10px 12px; }
          .rev-row > .rev-c-sel { flex: 0 0 auto; }
          .rev-row > .rev-c-author { flex: 1 1 calc(100% - 36px); }
          .rev-row > .rev-c-text { flex: 1 0 100%; }
          .rev-row > .rev-c-stars, .rev-row > .rev-c-date, .rev-row > .rev-c-state { flex: 0 0 auto; }
          .rev-row > .rev-c-actions { flex: 1 0 100%; }
        }
      `}</style>

      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Reseñas y opiniones"
        subtitle="Las calificaciones que dejan los clientes al terminar su servicio. Solo las publicadas y con comentario se ven en el sitio."
        actions={<Btn icon="ph-download-simple" onClick={exportCsv}>Exportar CSV</Btn>}
      />

      {/* métricas */}
      <Stats>
        <Stat
          label="Total de reseñas"
          icon="ph-chat-centered-text"
          tone="accent"
          value={total}
          hint={thisWeek > 0 ? `+${thisWeek} esta semana` : 'Todas las reseñas del sitio'}
          hintTone={thisWeek > 0 ? 'ok' : undefined}
        />
        <Stat
          label="Calificación promedio"
          icon="ph-star"
          tone="accent"
          value={avg}
          hint={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>/ 5 <Stars n={Math.round(avgNum)} size={12} /></span>}
        />
        <Stat
          label="Por moderar"
          icon="ph-clock"
          tone={pending > 0 ? 'warn' : 'muted'}
          value={pending}
          hint={pending > 0 ? 'Requieren tu atención' : 'Todo al día'}
          hintTone={pending > 0 ? 'warn' : undefined}
        />
        {/* La distribución no es una cifra: va en la misma fila, como barras finas. */}
        <div className="adm-stat">
          <div className="adm-stat-label"><span className="adm-ellipsis">Distribución de calificaciones</span></div>
          <div style={{ display: 'grid', gap: 3, marginTop: 8 }}>
            {dist.map((d) => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5, lineHeight: 1.1, color: 'var(--adm-muted)' }}>
                <span className="adm-num" style={{ width: 22, display: 'inline-flex', alignItems: 'center', gap: 2 }}>{d.star}<Star filled size={9} /></span>
                <span style={{ flex: 1 }}><Bar pct={Math.round((d.count / maxDist) * 100)} /></span>
                <span className="adm-num" style={{ width: 22, textAlign: 'right' }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </Stats>

      {/* toolbar: tabs + búsqueda */}
      <Toolbar end={`${filtered.length} de ${total}`}>
        <SearchBox value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Buscar por cliente, folio, aliado o reseña…" aria-label="Buscar reseña" />
        <Segmented<typeof tab>
          ariaLabel="Filtrar por estado"
          value={tab}
          onChange={changeTab}
          items={[
            { key: 'todas', label: 'Todas', count: total },
            { key: 'pend', label: 'Por revisar', count: pending },
            { key: 'aprob', label: 'Publicadas', count: approved },
          ]}
        />
      </Toolbar>

      {/* barra de selección múltiple */}
      {selectedCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', borderRadius: 8, padding: '7px 10px 7px 14px', marginBottom: 12 }}>
          <span className="adm-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)', marginRight: 6 }}>{selectedCount} seleccionada(s)</span>
          <Btn size="sm" variant="ghost" icon="ph-check" onClick={() => bulk('approve')}>Aprobar</Btn>
          <Btn size="sm" variant="ghost" icon="ph-eye-slash" onClick={() => bulk('hide')}>Ocultar</Btn>
          <Btn size="sm" variant="danger" icon="ph-trash" onClick={() => bulk('delete')}>Eliminar</Btn>
        </div>
      ) : null}

      {/* tabla */}
      <Panel
        flush
        clip
        footer={
          <>
            <span>Mostrando <span className="adm-num">{paged.length}</span> de <span className="adm-num">{filtered.length}</span> reseña(s)</span>
            {pages > 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <IconBtn icon="ph-caret-left" label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur <= 1} />
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className="adm-ibtn" aria-current={p === cur ? 'page' : undefined} onClick={() => setPage(p)} style={pageBtn(p === cur)}>{p}</button>
                ))}
                <IconBtn icon="ph-caret-right" label="Página siguiente" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={cur >= pages} />
              </div>
            ) : null}
          </>
        }
      >
        <div className="adm-thead rev-row rev-head">
          <button type="button" onClick={toggleAll} aria-label="Seleccionar todo" style={box(allSelected)}>{allSelected ? check : null}</button>
          <span>Autor</span><span>Calificación</span><span>Reseña</span><span>Fecha</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {paged.length === 0 ? (
          <EmptyState icon="ph-chat-centered-text" title="No hay reseñas que coincidan" sub="Prueba con otro filtro o término de búsqueda." />
        ) : paged.map((r) => {
          const meta = statusMeta(r);
          const on = !!sel[r.key];
          return (
            <div key={r.key} className="adm-trow rev-row">
              <button type="button" onClick={() => setSel((s) => ({ ...s, [r.key]: !s[r.key] }))} className="rev-c-sel" aria-label="Seleccionar" style={box(on)}>{on ? check : null}</button>
              <div className="rev-c-author" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--adm-text-2)', background: 'var(--adm-raised)', border: '1px solid var(--adm-border)' }}>{initials(r.author)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span className="adm-ellipsis">{r.author}</span>
                    {r.verified ? <i className="ph-bold ph-seal-check" style={{ fontSize: 14, color: 'var(--adm-ok)', flexShrink: 0 }} title={r.fuente === 'servicio' ? 'Servicio cerrado' : 'Compra verificada'} aria-label={r.fuente === 'servicio' ? 'Servicio cerrado' : 'Compra verificada'} /> : null}
                  </div>
                  <div className="adm-cell-sub adm-ellipsis">{[r.folio, r.product, r.aliado ? `Aliado: ${r.aliado}` : null].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
              <span className="rev-c-stars"><Stars n={Math.max(0, Math.min(5, r.rating))} /></span>
              <div className="rev-c-text" title={r.review || undefined} style={{ fontSize: 13.5, color: r.review ? 'var(--adm-text-2)' : 'var(--adm-muted)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.review || 'Solo calificó, sin comentario.'}</div>
              <div className="rev-c-date" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{fmtDate(r.createdAt)}</div>
              <div className="rev-c-state"><StatusText tone={meta.tone}>{meta.label}</StatusText></div>
              <div className="rev-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <IconBtn icon="ph-check" label={r.fuente === 'servicio' ? 'Publicar' : 'Aprobar'} plain onClick={() => setStatus(r, 1)} />
                <IconBtn icon="ph-eye-slash" label="Ocultar" plain onClick={() => setStatus(r, oculta(r))} />
                <IconBtn icon="ph-trash" label="Eliminar" plain danger onClick={() => remove(r)} />
              </div>
            </div>
          );
        })}
      </Panel>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
