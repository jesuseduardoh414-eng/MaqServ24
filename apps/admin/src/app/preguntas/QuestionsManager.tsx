'use client';

import { useMemo, useState, type CSSProperties } from 'react';

export interface AdminQuestion {
  id: number;
  author: string;
  product: string;
  productId: number;
  question: string;
  answer: string | null;
  answered: boolean;
  status: number;
  featured: boolean;
  createdAt: string | null;
}

const C = {
  card: '#151A21', cardBorder: '#1F242E', line: '#232833', line2: '#3A414F', tabsBg: '#101012',
  text: '#E7EAF0', muted: '#8B93A0', muted2: '#6B7280', amber: '#F4B400', green: '#34D399', yellow: '#FBBF24', red: '#F87171',
};
const FONT = "'Inter', system-ui, sans-serif";
const fmt = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};
const inputStyle: CSSProperties = { width: '100%', border: `1px solid ${C.line}`, background: '#0d0d10', color: C.text, borderRadius: 10, padding: '11px 13px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical', outline: 'none' };
const btnPrimary = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: C.amber, color: '#16202E', borderRadius: 11, padding: '9px 16px', fontWeight: 800, fontSize: 13.5, cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0.5, fontFamily: 'inherit' });
const btnGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, borderRadius: 10, padding: '8px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnDanger: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(245,80,80,0.3)', background: 'rgba(245,80,80,0.08)', color: C.red, borderRadius: 10, padding: '8px 11px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };

export function QuestionsManager({ initial }: { initial: AdminQuestion[] }) {
  const [list, setList] = useState<AdminQuestion[]>(initial);
  const [tab, setTab] = useState<'pend' | 'resp' | 'todas'>('pend');
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const pending = list.filter((q) => !q.answered).length;
  const answered = list.filter((q) => q.answered).length;
  const filtered = useMemo(() => list.filter((q) => tab === 'todas' || (tab === 'pend' && !q.answered) || (tab === 'resp' && q.answered)), [list, tab]);

  async function answer(id: number) {
    const text = (draft[id] ?? '').trim();
    if (text.length < 2) { setToast({ ok: false, text: 'Escribe una respuesta.' }); return; }
    setBusy(id);
    const prev = list;
    setList((l) => l.map((q) => (q.id === id ? { ...q, answer: text, answered: true } : q)));
    const r = await fetch(`/api/admin/questions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: text }) });
    setBusy(null);
    if (!r.ok) { setList(prev); setToast({ ok: false, text: 'No se pudo guardar la respuesta' }); }
    else { setDraft((d) => { const n = { ...d }; delete n[id]; return n; }); setToast({ ok: true, text: 'Respuesta publicada.' }); }
  }
  async function toggleHide(q: AdminQuestion) {
    setBusy(q.id);
    const next = q.status === 1 ? 0 : 1;
    const prev = list;
    setList((l) => l.map((x) => (x.id === q.id ? { ...x, status: next } : x)));
    const r = await fetch(`/api/admin/questions/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    setBusy(null);
    if (!r.ok) { setList(prev); setToast({ ok: false, text: 'No se pudo actualizar' }); }
  }
  async function toggleFeatured(q: AdminQuestion) {
    const next = q.featured ? 0 : 1;
    const prev = list;
    setList((l) => l.map((x) => (x.id === q.id ? { ...x, featured: !q.featured } : x)));
    const r = await fetch(`/api/admin/questions/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: next }) });
    if (!r.ok) { setList(prev); setToast({ ok: false, text: 'No se pudo destacar' }); }
    else { setToast({ ok: true, text: next ? 'Destacada en el home.' : 'Quitada del home.' }); }
  }
  async function remove(id: number) {
    if (!window.confirm('¿Eliminar esta pregunta?')) return;
    setBusy(id);
    const prev = list;
    setList((l) => l.filter((q) => q.id !== id));
    const r = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    setBusy(null);
    if (!r.ok) { setList(prev); setToast({ ok: false, text: 'No se pudo eliminar' }); }
  }

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Archivo:wght@700;800;900&display=swap" />

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 5px', fontFamily: "'Archivo', sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>Preguntas de productos</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: C.muted }}>Responde las dudas que dejan tus clientes en cada producto. Las respondidas se muestran en la pagina del producto.</p>
      </div>

      {/* `fit-content` + sin envolver = las 3 pestañas nunca bajan de su ancho
          natural (380px) y se salían en móvil. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 4, width: 'fit-content', maxWidth: '100%', marginBottom: 20 }}>
        {([['pend', 'Por responder', pending], ['resp', 'Respondidas', answered], ['todas', 'Todas', list.length]] as const).map(([id, label, count]) => {
          const on = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '8px 15px', borderRadius: 9, cursor: 'pointer', background: on ? C.amber : 'transparent', color: on ? '#16202E' : C.muted }}>
              {label}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: on ? 'rgba(22,32,46,.18)' : (id === 'pend' && count > 0 ? 'rgba(251,191,36,.2)' : C.line), color: on ? '#16202E' : (id === 'pend' && count > 0 ? C.yellow : C.muted) }}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '48px 20px', textAlign: 'center', color: C.muted2 }}>
          {tab === 'pend' ? 'No hay preguntas por responder. ¡Todo al día!' : 'No hay preguntas en esta vista.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.map((q) => (
            <div key={q.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '18px 20px', display: 'grid', gap: 12, opacity: q.status === 1 ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.amber, background: 'rgba(244,180,0,.12)', padding: '2px 9px', borderRadius: 999 }}>{q.product}</span>
                    <span style={{ fontSize: 12, color: C.muted2 }}>{q.author}{q.createdAt ? ` · ${fmt(q.createdAt)}` : ''}</span>
                    {!q.answered ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.yellow }}>● Por responder</span> : null}
                    {q.featured ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.amber }}>★ En el home</span> : null}
                    {q.status === 0 ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted2 }}>Oculta</span> : null}
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>{q.question}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button type="button" onClick={() => toggleHide(q)} disabled={busy === q.id} title={q.status === 1 ? 'Ocultar' : 'Mostrar'} style={btnGhost}><i className={`ph ${q.status === 1 ? 'ph-eye-slash' : 'ph-eye'}`} /></button>
                  <button type="button" onClick={() => remove(q.id)} disabled={busy === q.id} title="Eliminar" style={btnDanger}><i className="ph ph-trash" /></button>
                </div>
              </div>

              {q.answered ? (
                <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                  <span style={{ color: C.green, fontWeight: 800, flexShrink: 0 }}>R:</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.text }}>{q.answer}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => { setDraft((d) => ({ ...d, [q.id]: q.answer ?? '' })); setList((l) => l.map((x) => (x.id === q.id ? { ...x, answered: false } : x))); }} style={{ ...btnGhost, padding: '6px 11px' }}><i className="ph ph-pencil-simple" /> Editar respuesta</button>
                      <button type="button" onClick={() => toggleFeatured(q)} disabled={busy === q.id} style={{ ...btnGhost, padding: '6px 11px', ...(q.featured ? { color: C.amber, borderColor: 'rgba(244,180,0,.4)', background: 'rgba(244,180,0,.1)' } : {}) }}><i className="ph ph-star" style={q.featured ? { fontWeight: 700 } : undefined} /> {q.featured ? 'Destacada en el home' : 'Destacar en el home'}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                  <textarea value={draft[q.id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))} rows={2} placeholder="Escribe tu respuesta…" style={inputStyle} />
                  <div><button type="button" onClick={() => answer(q.id)} disabled={busy === q.id} style={btnPrimary(busy !== q.id)}><i className="ph-bold ph-paper-plane-tilt" /> {busy === q.id ? 'Publicando…' : 'Responder'}</button></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }} onClick={() => setToast(null)}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19 }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
