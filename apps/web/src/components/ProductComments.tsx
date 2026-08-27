import type { ProductComment, ProductCommentsSummary } from '@maqserv/types';
import { Stars } from '@/components/Icon';

/**
 * Opiniones del producto — SOLO LECTURA. Las reseñas se dejan desde "Mis compras"
 * (ligadas a una compra verificada); aquí solo se muestran las aprobadas.
 */
export function ProductComments({
  initial,
  labels,
}: {
  productId: number;
  initial: ProductCommentsSummary;
  labels: { title: string; empty: string; [k: string]: string };
}) {
  const items: ProductComment[] = initial.items;
  const count = initial.count;
  const average = initial.average;

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.8rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>{labels.title}</h2>
        {count > 0 ? (
          <span style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center' }}>
            <Stars value={average} size={16} style={{ color: 'var(--color-warning)' }} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>
              {average} ({count})
            </span>
          </span>
        ) : null}
      </div>

      {count === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{labels.empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: '.7rem' }}>
          {items.map((c) => (
            <article key={c.id} style={{ display: 'grid', gap: '.35rem', padding: '.9rem 1.1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                  <strong>{c.author}</strong>
                  {c.verified ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11.5px', fontWeight: 700, color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 14%, transparent)', padding: '2px 8px', borderRadius: 999 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Compra verificada
                    </span>
                  ) : null}
                </span>
                <Stars value={c.rating} size={14} style={{ color: 'var(--color-warning)' }} />
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--color-text)' }}>{c.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
