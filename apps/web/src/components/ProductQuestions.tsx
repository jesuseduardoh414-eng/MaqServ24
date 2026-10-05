'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

interface QA {
  id: number;
  author: string;
  question: string;
  answer: string | null;
  date: string | null;
  answeredAt: string | null;
}

const fmt = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Preguntas y respuestas de un producto (tipo MercadoLibre). El cliente pregunta; el admin responde. */
export function ProductQuestions({ productId }: { productId: number }) {
  const [list, setList] = useState<QA[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/proxy/catalog/products/${productId}/questions`).then((r) => (r.ok ? r.json() : [])).then((d: QA[]) => setList(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/auth/session').then((r) => r.json()).then((d) => setLoggedIn(Boolean(d.user))).catch(() => {});
  }, [productId]);

  async function ask() {
    if (q.trim().length < 5) { setMsg({ ok: false, text: 'Escribe una pregunta de al menos 5 caracteres.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/proxy/catalog/products/${productId}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ?? 'No se pudo enviar tu pregunta'); }
      setQ('');
      setMsg({ ok: true, text: 'Tu pregunta fue enviada. Te responderemos pronto (aparecerá aquí al responderse).' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <div>
        <h2 className="ms-h2">Preguntas y respuestas</h2>
        <p className="ms-h2-desc">Pregunta lo que necesites saber antes de cotizar; la respuesta aparece aquí.</p>
      </div>

      {/* Preguntar */}
      {loggedIn ? (
        <div className="ms-panel" style={{ display: 'grid', gap: 10, padding: 18 }}>
          <label className="ms-field">
            <span className="ms-label">¿Tienes una duda sobre este equipo?</span>
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={500} placeholder="Escribe tu pregunta…" className="ms-textarea" style={{ minHeight: 88 }} />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={ask} disabled={busy} className="ms-btn">{busy ? 'Enviando…' : 'Preguntar'}</button>
            {msg ? (
              <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: msg.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                <Icon name={msg.ok ? 'check' : 'warning'} size={15} />{msg.text}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="ms-alert">
          <span className="ms-ico" style={{ width: 32, height: 32, borderRadius: 8 }}><Icon name="chat" size={16} /></span>
          <p style={{ margin: 0, alignSelf: 'center', color: 'var(--color-text-muted)' }}>
            <Link href="/login" className="ms-link" style={{ display: 'inline' }}>Inicia sesión</Link> para hacer una pregunta sobre este equipo.
          </p>
        </div>
      )}

      {/* Lista de Q&A respondidas */}
      {list.length === 0 ? (
        <div className="ms-empty" style={{ padding: '32px 24px' }}>
          <p className="ms-empty-t" style={{ marginTop: 0 }}>Aún no hay preguntas respondidas</p>
          <p className="ms-empty-p">Sé el primero en preguntar sobre este equipo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((item) => (
            <article key={item.id} className="ms-panel" style={{ display: 'grid', gap: 12, padding: '16px 18px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--color-text)' }}>{item.question}</p>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{item.author}{item.date ? ` · ${fmt(item.date)}` : ''}</span>
              </div>
              {item.answer ? (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 2 }}>Respuesta de MAQSER24</span>
                  <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: 'var(--color-text)' }}>{item.answer}</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
