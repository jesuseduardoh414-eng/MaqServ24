'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Bar, Btn, EmptyState, IconBtn, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toast, Toolbar, type Tone,
} from '@/components/ui';

interface Review { id: number; author: string; product: string; rating: number; review: string; status: number; verified?: boolean; createdAt: string | null }

const PAGE_SIZE = 8;

const initials = (n: string) => n.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusMeta = (s: number): { label: string; tone: Tone } => s === 1
  ? { label: 'Aprobada', tone: 'ok' }
  : { label: 'Pendiente', tone: 'warn' };

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
  const [sel, setSel] = useState<Record<number, boolean>>({});
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
      const qOk = !q || r.author.toLowerCase().includes(q) || r.review.toLowerCase().includes(q) || r.product.toLowerCase().includes(q);
      return tabOk && qOk;
    });
  }, [reviews, tab, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const paged = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const visIds = filtered.map((r) => r.id);
  const selectedCount = Object.keys(sel).filter((k) => sel[Number(k)]).length;
  const allSelected = visIds.length > 0 && visIds.every((id) => sel[id]);

  // ---- acciones (optimista + API) ----
  async function apiStatus(id: number, status: number) {
    return fetch(`/api/admin/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  }
  async function setStatus(id: number, status: number) {
    const prev = reviews;
    setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const r = await apiStatus(id, status);
    if (!r.ok) { setReviews(prev); setToast({ ok: false, text: 'No se pudo actualizar la reseña' }); }
  }
  async function remove(id: number) {
    if (!window.confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    const prev = reviews;
    setReviews((rs) => rs.filter((r) => r.id !== id));
    setSel((s) => { const n = { ...s }; delete n[id]; return n; });
    const r = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
    if (!r.ok) { setReviews(prev); setToast({ ok: false, text: 'No se pudo eliminar' }); }
  }
  async function bulk(action: 'approve' | 'hide' | 'delete') {
    const ids = Object.keys(sel).filter((k) => sel[Number(k)]).map(Number);
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm(`¿Eliminar ${ids.length} reseña(s)? No se puede deshacer.`)) return;
    const prev = reviews;
    if (action === 'delete') setReviews((rs) => rs.filter((r) => !ids.includes(r.id)));
    else setReviews((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, status: action === 'approve' ? 1 : 0 } : r)));
    setSel({});
    const results = await Promise.all(ids.map((id) => (action === 'delete'
      ? fetch(`/api/admin/comments/${id}`, { method: 'DELETE' })
      : apiStatus(id, action === 'approve' ? 1 : 0))));
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
    const head = ['Autor', 'Producto', 'Calificación', 'Reseña', 'Estado', 'Verificada', 'Fecha'];
    const rows = reviews.map((r) => [r.author, r.product, String(r.rating), r.review, r.status === 1 ? 'Aprobada' : 'Pendiente', r.verified ? 'Sí' : 'No', fmtDate(r.createdAt)]);
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
        subtitle="Modera las reseñas que tus clientes dejan sobre equipos y servicio."
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
        <SearchBox value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Buscar por autor o reseña…" aria-label="Buscar reseña" />
        <Segmented<typeof tab>
          ariaLabel="Filtrar por estado"
          value={tab}
          onChange={changeTab}
          items={[
            { key: 'todas', label: 'Todas', count: total },
            { key: 'pend', label: 'Pendientes', count: pending },
            { key: 'aprob', label: 'Aprobadas', count: approved },
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
          const meta = statusMeta(r.status);
          const on = !!sel[r.id];
          return (
            <div key={r.id} className="adm-trow rev-row">
              <button type="button" onClick={() => setSel((s) => ({ ...s, [r.id]: !s[r.id] }))} className="rev-c-sel" aria-label="Seleccionar" style={box(on)}>{on ? check : null}</button>
              <div className="rev-c-author" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--adm-text-2)', background: 'var(--adm-raised)', border: '1px solid var(--adm-border)' }}>{initials(r.author)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span className="adm-ellipsis">{r.author}</span>
                    {r.verified ? <i className="ph-bold ph-seal-check" style={{ fontSize: 14, color: 'var(--adm-ok)', flexShrink: 0 }} title="Compra verificada" aria-label="Compra verificada" /> : null}
                  </div>
                  <div className="adm-cell-sub adm-ellipsis">{r.product}</div>
                </div>
              </div>
              <span className="rev-c-stars"><Stars n={Math.max(0, Math.min(5, r.rating))} /></span>
              <div className="rev-c-text" style={{ fontSize: 13.5, color: 'var(--adm-text-2)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.review}</div>
              <div className="rev-c-date" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{fmtDate(r.createdAt)}</div>
              <div className="rev-c-state"><StatusText tone={meta.tone}>{meta.label}</StatusText></div>
              <div className="rev-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <IconBtn icon="ph-check" label="Aprobar" plain onClick={() => setStatus(r.id, 1)} />
                <IconBtn icon="ph-eye-slash" label="Ocultar" plain onClick={() => setStatus(r.id, 0)} />
                <IconBtn icon="ph-trash" label="Eliminar" plain danger onClick={() => remove(r.id)} />
              </div>
            </div>
          );
        })}
      </Panel>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
