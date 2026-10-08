'use client';

import { useMemo, useState } from 'react';
import { Btn, Chip, EmptyState, IconBtn, PageHeader, Panel, Segmented, StatusText, Toast, Toolbar } from '@/components/ui';

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

const fmt = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Preguntas de productos"
        subtitle="Responde las dudas que dejan tus clientes en cada producto. Las respondidas se muestran en la página del producto."
      />

      {/* Segmented envuelve: las 3 pestañas no se salen en móvil. */}
      <Toolbar end={`${filtered.length} de ${list.length}`}>
        <Segmented<typeof tab>
          ariaLabel="Filtrar preguntas"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'pend', label: 'Por responder', count: pending },
            { key: 'resp', label: 'Respondidas', count: answered },
            { key: 'todas', label: 'Todas', count: list.length },
          ]}
        />
      </Toolbar>

      <Panel flush clip>
        {filtered.length === 0 ? (
          <EmptyState
            icon="ph-question"
            title={tab === 'pend' ? 'No hay preguntas por responder. ¡Todo al día!' : 'No hay preguntas en esta vista.'}
          />
        ) : filtered.map((q) => (
          <div key={q.id} className="adm-trow" style={{ display: 'grid', gap: 12, paddingTop: 16, paddingBottom: 16, opacity: q.status === 1 ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Chip>{q.product}</Chip>
                  <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{q.author}{q.createdAt ? ` · ${fmt(q.createdAt)}` : ''}</span>
                  {!q.answered ? <StatusText tone="warn">Por responder</StatusText> : null}
                  {q.featured ? <Chip tone="accent"><i className="ph-bold ph-star" aria-hidden />En el home</Chip> : null}
                  {q.status === 0 ? <Chip tone="muted">Oculta</Chip> : null}
                </div>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--adm-text)', lineHeight: 1.45 }}>{q.question}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <IconBtn icon={q.status === 1 ? 'ph-eye-slash' : 'ph-eye'} label={q.status === 1 ? 'Ocultar' : 'Mostrar'} onClick={() => toggleHide(q)} disabled={busy === q.id} />
                <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => remove(q.id)} disabled={busy === q.id} />
              </div>
            </div>

            {q.answered ? (
              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--adm-border)', paddingTop: 12 }}>
                <span style={{ color: 'var(--adm-ok)', fontWeight: 600, flexShrink: 0 }}>R:</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--adm-text-2)' }}>{q.answer}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="ghost" icon="ph-pencil-simple" onClick={() => { setDraft((d) => ({ ...d, [q.id]: q.answer ?? '' })); setList((l) => l.map((x) => (x.id === q.id ? { ...x, answered: false } : x))); }}>
                      Editar respuesta
                    </Btn>
                    <Btn
                      size="sm"
                      icon="ph-star"
                      onClick={() => toggleFeatured(q)}
                      disabled={busy === q.id}
                      aria-pressed={q.featured}
                      style={q.featured ? { color: 'var(--adm-accent)', borderColor: 'color-mix(in srgb, var(--adm-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--adm-accent) 8%, transparent)' } : undefined}
                    >
                      {q.featured ? 'Destacada en el home' : 'Destacar en el home'}
                    </Btn>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--adm-border)', paddingTop: 12 }}>
                <textarea className="adm-textarea" value={draft[q.id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))} rows={2} placeholder="Escribe tu respuesta…" aria-label={`Respuesta a: ${q.question}`} />
                <div>
                  <Btn size="sm" icon="ph-paper-plane-tilt" onClick={() => answer(q.id)} disabled={busy === q.id}>
                    {busy === q.id ? 'Publicando…' : 'Responder'}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </Panel>

      {/* El aviso se queda hasta que se toca: no tiene temporizador. */}
      {toast ? (
        <div onClick={() => setToast(null)} style={{ cursor: 'pointer' }}>
          <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast>
        </div>
      ) : null}
    </div>
  );
}
