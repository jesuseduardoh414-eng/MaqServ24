'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface Review { id: number; author: string; product: string; rating: number; review: string; status: number; verified?: boolean; createdAt: string | null }

const C = {
  card: '#151A21', cardBorder: '#1F242E', table: '#12161C', head: '#0F1319', rowBorder: '#171C24',
  text: '#E7EAF0', textSoft: '#C2C8D2', muted: '#8B93A0', muted2: '#6B7280',
  line: '#232833', line2: '#3A414F', amber: '#F4B400', green: '#34D399', yellow: '#FBBF24', red: '#F87171',
};
const FONT = "'Inter', system-ui, sans-serif";
const PAGE_SIZE = 8;
const AVATAR = ['#F4B400', '#60A5FA', '#F472B6', '#34D399', '#A78BFA', '#FB923C'];

const initials = (n: string) => n.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusMeta = (s: number) => s === 1
  ? { label: 'Aprobada', color: C.green, bg: 'rgba(52,211,153,.12)' }
  : { label: 'Pendiente', color: C.yellow, bg: 'rgba(251,191,36,.12)' };

const Star = ({ filled }: { filled: boolean }) => filled
  ? <svg width="15" height="15" viewBox="0 0 24 24" fill={C.amber} stroke="none"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg>
  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.line2} strokeWidth="1.6"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg>;
const Stars = ({ n }: { n: number }) => <span style={{ display: 'flex', gap: 2 }}>{Array.from({ length: 5 }, (_, i) => <Star key={i} filled={i < n} />)}</span>;

const GRID = '44px 1.5fr 1.1fr 2.4fr 1fr 1.1fr 116px';

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

  const th: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted2 };
  const box = (on: boolean): CSSProperties => ({ width: 19, height: 19, borderRadius: 5, border: `1.8px solid ${on ? C.amber : C.line2}`, background: on ? C.amber : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 });
  const act = (color: string): CSSProperties => ({ width: 32, height: 32, border: 'none', background: 'transparent', borderRadius: 8, color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Archivo:wght@700;800;900&display=swap" />
      <style>{`
        .rev-row:hover{ background:#191E27 !important; }
        .act-btn:hover{ background:#232833 !important; }
        @media(max-width:1080px){ .rev-metrics{ grid-template-columns:1fr 1fr !important; } }
        @media(max-width:620px){ .rev-metrics{ grid-template-columns:1fr !important; } }
        /* Las 7 columnas no caben en móvil: cada reseña pasa a tarjeta
           (selector + autor arriba, reseña completa debajo, acciones al pie). */
        @media (max-width: 900px) {
          .rev-head { display:none !important; }
          .rev-row { display:flex !important; flex-wrap:wrap; align-items:center; gap:10px 12px !important; padding:16px !important; }
          .rev-row > .rev-c-sel { flex:0 0 auto; }
          .rev-row > .rev-c-author { flex:1 1 calc(100% - 36px); }
          .rev-row > .rev-c-text { flex:1 0 100%; }
          .rev-row > .rev-c-stars, .rev-row > .rev-c-date, .rev-row > .rev-c-state { flex:0 0 auto; }
          .rev-row > .rev-c-actions { flex:1 0 100%; }
        }
      `}</style>

      {/* título */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 5px', fontFamily: "'Archivo', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>Reseñas y opiniones</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: C.muted }}>Modera las reseñas que tus clientes dejan sobre equipos y servicio.</p>
        </div>
        <button type="button" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.card, border: `1px solid ${C.line}`, color: C.text, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
          Exportar CSV
        </button>
      </div>

      {/* métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 1.5fr', gap: 18, marginBottom: 24 }} className="rev-metrics">
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><span style={{ fontSize: 13, color: C.muted }}>Total de reseñas</span><span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,180,0,.12)', color: C.amber, display: 'grid', placeItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span></div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{total}</div>
          {thisWeek > 0 ? <div style={{ marginTop: 8, fontSize: 12.5, color: C.green }}>+{thisWeek} esta semana</div> : <div style={{ marginTop: 8, fontSize: 12.5, color: C.muted2 }}>Todas las reseñas del sitio</div>}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><span style={{ fontSize: 13, color: C.muted }}>Calificación promedio</span><span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244,180,0,.12)', color: C.amber, display: 'grid', placeItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg></span></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontFamily: "'Archivo', sans-serif", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{avg}</span><span style={{ fontSize: 14, color: C.muted2 }}>/ 5</span></div>
          <div style={{ marginTop: 10 }}><Stars n={Math.round(avgNum)} /></div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><span style={{ fontSize: 13, color: C.muted }}>Por moderar</span><span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,191,36,.12)', color: C.yellow, display: 'grid', placeItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span></div>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{pending}</div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: pending > 0 ? C.yellow : C.muted2 }}>{pending > 0 ? 'Requieren tu atención' : 'Todo al día'}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Distribución de calificaciones</div>
          {dist.map((d) => (
            <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: C.muted, width: 26, display: 'flex', alignItems: 'center', gap: 2 }}>{d.star}<svg width="11" height="11" viewBox="0 0 24 24" fill={C.amber} stroke="none"><polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" /></svg></span>
              <div style={{ flex: 1, height: 7, background: C.line, borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((d.count / maxDist) * 100)}%`, background: C.amber, borderRadius: 999, transition: 'width .3s' }} /></div>
              <span style={{ fontSize: 12, color: C.muted2, width: 22, textAlign: 'right' }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* toolbar: tabs + búsqueda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 4, flexWrap: 'wrap', maxWidth: '100%' }}>
          {([['todas', 'Todas', total], ['pend', 'Pendientes', pending], ['aprob', 'Aprobadas', approved]] as const).map(([id, label, count]) => {
            const on = tab === id;
            return (
              <button key={id} type="button" onClick={() => changeTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '8px 15px', borderRadius: 9, cursor: 'pointer', background: on ? C.amber : 'transparent', color: on ? '#16202E' : C.muted }}>
                {label}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: on ? 'rgba(22,32,46,.18)' : C.line, color: on ? '#16202E' : C.muted }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 11, background: C.card, border: `1px solid ${C.line}`, borderRadius: 11, padding: '9px 14px', minWidth: 280 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Buscar por autor o reseña…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, fontFamily: 'inherit', fontSize: 13.5 }} />
        </div>
      </div>

      {/* barra de selección múltiple */}
      {selectedCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(244,180,0,.08)', border: '1px solid rgba(244,180,0,.25)', borderRadius: 12, padding: '12px 18px', marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.amber }}>{selectedCount} seleccionada(s)</span>
          <div style={{ width: 1, height: 20, background: 'rgba(244,180,0,.25)' }} />
          <button type="button" onClick={() => bulk('approve')} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: C.green, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Aprobar</button>
          <button type="button" onClick={() => bulk('hide')} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22" /></svg>Ocultar</button>
          <button type="button" onClick={() => bulk('delete')} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', color: C.red, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>Eliminar</button>
        </div>
      ) : null}

      {/* tabla */}
      <div style={{ background: C.table, border: `1px solid ${C.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div className="rev-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, alignItems: 'center', padding: '14px 22px', borderBottom: `1px solid ${C.cardBorder}`, background: C.head }}>
          <button type="button" onClick={toggleAll} aria-label="Seleccionar todo" style={box(allSelected)}>{allSelected ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16202E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}</button>
          <span style={th}>Autor</span><span style={th}>Calificación</span><span style={th}>Reseña</span><span style={th}>Fecha</span><span style={th}>Estado</span><span style={{ ...th, textAlign: 'right' }}>Acciones</span>
        </div>

        {paged.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted2 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.line2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.muted }}>No hay reseñas que coincidan</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Prueba con otro filtro o término de búsqueda.</div>
          </div>
        ) : paged.map((r) => {
          const meta = statusMeta(r.status);
          const on = !!sel[r.id];
          return (
            <div key={r.id} className="rev-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, alignItems: 'center', padding: '16px 22px', borderBottom: `1px solid ${C.rowBorder}`, transition: 'background .12s' }}>
              <button type="button" onClick={() => setSel((s) => ({ ...s, [r.id]: !s[r.id] }))} className="rev-c-sel" aria-label="Seleccionar" style={box(on)}>{on ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16202E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}</button>
              <div className="rev-c-author" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#16202E', background: AVATAR[r.id % AVATAR.length] }}>{initials(r.author)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.author}
                    {r.verified ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-label="Compra verificada"><polyline points="20 6 9 17 4 12" /></svg> : null}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product}</div>
                </div>
              </div>
              <span className="rev-c-stars"><Stars n={Math.max(0, Math.min(5, r.rating))} /></span>
              <div className="rev-c-text" style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.review}</div>
              <div className="rev-c-date" style={{ fontSize: 13, color: C.muted }}>{fmtDate(r.createdAt)}</div>
              <div className="rev-c-state"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, color: meta.color, background: meta.bg }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />{meta.label}</span></div>
              <div className="rev-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <button type="button" className="act-btn" onClick={() => setStatus(r.id, 1)} aria-label="Aprobar" title="Aprobar" style={act(C.green)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></button>
                <button type="button" className="act-btn" onClick={() => setStatus(r.id, 0)} aria-label="Ocultar" title="Ocultar" style={act(C.muted)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22" /></svg></button>
                <button type="button" className="act-btn" onClick={() => remove(r.id)} aria-label="Eliminar" title="Eliminar" style={act(C.red)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderTop: `1px solid ${C.cardBorder}`, flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: C.muted2 }}>Mostrando {paged.length} de {filtered.length} reseña(s)</span>
          {pages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur <= 1} style={{ width: 34, height: 34, border: `1px solid ${C.line}`, background: 'transparent', borderRadius: 9, color: cur <= 1 ? C.line2 : C.muted, cursor: cur <= 1 ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)} style={{ minWidth: 34, height: 34, border: p === cur ? 'none' : `1px solid ${C.line}`, background: p === cur ? C.amber : 'transparent', borderRadius: 9, color: p === cur ? '#16202E' : C.muted, fontFamily: 'inherit', fontSize: 13.5, fontWeight: p === cur ? 700 : 600, cursor: 'pointer' }}>{p}</button>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={cur >= pages} style={{ width: 34, height: 34, border: `1px solid ${C.line}`, background: 'transparent', borderRadius: 9, color: cur >= pages ? C.line2 : C.muted, cursor: cur >= pages ? 'default' : 'pointer', display: 'grid', placeItems: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg></button>
            </div>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19 }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
