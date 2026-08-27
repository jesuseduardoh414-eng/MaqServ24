'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

interface Reviewable {
  productId: number;
  name: string;
  image: string | null;
  orderNumber: string;
  date: string | null;
  reviewed: boolean;
  myRating: number | null;
  myText: string | null;
}

function StarPick({ value, onChange, readOnly }: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} estrellas`}
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: readOnly ? 'default' : 'pointer', fontSize: 22, lineHeight: 1, color: n <= value ? 'var(--color-warning)' : 'var(--color-border)' }}
        >
          {/* El botón ya se anuncia con su aria-label ("N estrellas"): icono decorativo. */}
          <Icon name="star" size={22} fill={n <= value} />
        </button>
      ))}
    </span>
  );
}

/** "Califica tus compras": lista los productos comprados y permite opinar (una vez por producto). */
export function MyReviews({ title }: { title: string }) {
  const [list, setList] = useState<Reviewable[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/proxy/account/reviews/reviewable')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Reviewable[]) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]));
  }, []);

  function openForm(p: Reviewable) {
    setEditing(p.productId);
    setRating(p.myRating ?? 5);
    setText(p.myText ?? '');
    setMsg(null);
  }

  async function submit(productId: number) {
    if (text.trim().length < 3) { setMsg({ ok: false, text: 'Escribe al menos 3 caracteres.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/proxy/account/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, text: text.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ?? 'No se pudo publicar tu opinión'); }
      setList((l) => (l ?? []).map((p) => (p.productId === productId ? { ...p, reviewed: true, myRating: rating, myText: text.trim() } : p)));
      setEditing(null);
      setMsg({ ok: true, text: '¡Gracias por tu opinión!' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  if (list === null) return null; // cargando: no mostrar nada
  if (list.length === 0) return null; // sin compras que reseñar

  const card: React.CSSProperties = { border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)', padding: '1rem 1.2rem', display: 'grid', gap: '.7rem' };
  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '10px 12px', fontFamily: 'inherit', fontSize: '14.5px', lineHeight: 1.5, resize: 'vertical' };

  return (
    // Mismo lenguaje que el listado de pedidos de arriba.
    <section style={{ marginTop: 48, borderTop: '2px solid var(--color-text)', paddingTop: 26 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px' }}>{title}</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: '0 0 18px', lineHeight: 1.6 }}>Comparte tu experiencia con los equipos que rentaste o compraste — se muestran en el producto y en el sitio.</p>
      <div style={{ display: 'grid', gap: '.8rem' }}>
        {list.map((p) => {
          const isEditing = editing === p.productId;
          return (
            <div key={p.productId} style={card}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{p.name}</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12.5px' }}>Compra {p.orderNumber}</span>
                </div>
                {p.reviewed && !isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarPick value={p.myRating ?? 5} readOnly />
                    <button type="button" onClick={() => openForm(p)} style={{ border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', padding: '7px 13px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
                  </div>
                ) : !isEditing ? (
                  <button type="button" onClick={() => openForm(p)} style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Deja tu opinión</button>
                ) : null}
              </div>

              {p.reviewed && !isEditing ? (
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.6 }}>{p.myText}</p>
              ) : null}

              {isEditing ? (
                <div style={{ display: 'grid', gap: '.7rem', borderTop: '1px solid var(--color-border)', paddingTop: '.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Calificación:</span>
                    <StarPick value={rating} onChange={setRating} />
                  </div>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="¿Cómo te fue con este equipo? Cuenta tu experiencia…" style={inputStyle} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => submit(p.productId)} disabled={busy} style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Publicando…' : (p.reviewed ? 'Actualizar' : 'Publicar opinión')}</button>
                    <button type="button" onClick={() => setEditing(null)} disabled={busy} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {msg ? <p role="status" style={{ marginTop: '1rem', fontWeight: 600, fontSize: 'var(--text-sm)', color: msg.ok ? 'var(--color-success)' : 'var(--color-error)' }}>{msg.text}</p> : null}
    </section>
  );
}
