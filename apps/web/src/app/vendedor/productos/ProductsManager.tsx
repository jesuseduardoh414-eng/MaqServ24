'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Category, VendorProductRow } from '@maqserv/types';
import { formatPrice } from '@/lib/format';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

const card: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: '22px 24px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)',
  background: 'color-mix(in srgb, var(--color-text) 3%, var(--color-surface))',
  border: '1px solid var(--color-border)', borderRadius: 10, padding: '13px 15px', outline: 'none',
};

export function ProductsManager({
  products,
  categories,
  labels,
}: {
  products: VendorProductRow[];
  categories: Category[];
  labels: {
    newTitle: string;
    name: string;
    category: string;
    price: string;
    oldPrice: string;
    stock: string;
    brand: string;
    description: string;
    photo: string;
    isRental: string;
    rentalFreight: string;
    create: string;
    created: string;
    deactivate: string;
    empty: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setLoading(true);
    // multipart directo: el proxy conserva el boundary
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!isRental) {
      fd.delete('isRental');
      fd.delete('rentalFreight');
    } else {
      fd.set('isRental', 'true');
    }
    const res = await fetch('/api/proxy/vendor/products', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(typeof data?.message === 'string' ? data.message : 'No pudimos publicar el producto');
      return;
    }
    setOk(true);
    form.reset();
    setIsRental(false);
    router.refresh();
  }

  async function deactivate(id: number, name: string) {
    if (!window.confirm(`¿Quitar “${name}” del catálogo? Dejará de aparecer en el sitio.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/vendor/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No pudimos desactivar el producto');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos desactivar el producto');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={card}>
        <h2 style={{ fontFamily: DISPLAY, margin: '0 0 20px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
          {labels.newTitle}
        </h2>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 18 }} encType="multipart/form-data">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            <div>
              <label style={labelStyle} htmlFor="pm-name">{labels.name}</label>
              <input id="pm-name" name="name" required minLength={2} maxLength={250} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="pm-cat">{labels.category}</label>
              <select id="pm-cat" name="categoryId" required style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">{labels.category}…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
            <div>
              <label style={labelStyle} htmlFor="pm-price">{labels.price}</label>
              <input id="pm-price" name="price" type="number" step="0.01" min={0} required style={{ ...inputStyle, fontFamily: MONO }} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="pm-old">{labels.oldPrice}</label>
              <input id="pm-old" name="oldPrice" type="number" step="0.01" min={0} style={{ ...inputStyle, fontFamily: MONO }} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="pm-stock">{labels.stock}</label>
              <input id="pm-stock" name="stock" type="number" min={0} style={{ ...inputStyle, fontFamily: MONO }} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="pm-brand">{labels.brand}</label>
              <input id="pm-brand" name="brand" maxLength={190} style={inputStyle} />
            </div>
          </div>

          <div>
            {/* La API acepta 10 000 caracteres: pedirlos en una sola línea no tenía sentido. */}
            <label style={labelStyle} htmlFor="pm-desc">{labels.description}</label>
            <textarea id="pm-desc" name="description" required minLength={4} maxLength={10000} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          <div>
            <label style={labelStyle} htmlFor="pm-photo">{labels.photo}</label>
            <input id="pm-photo" type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/avif" style={{ ...inputStyle, padding: '11px 14px', cursor: 'pointer' }} />
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, color: 'var(--color-text)', cursor: 'pointer' }}>
            <input type="checkbox" name="isRental" checked={isRental} onChange={(e) => setIsRental(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
            {labels.isRental}
          </label>
          {isRental ? (
            <div>
              <label style={labelStyle} htmlFor="pm-freight">{labels.rentalFreight}</label>
              <input id="pm-freight" name="rentalFreight" type="number" step="0.01" min={0} style={{ ...inputStyle, fontFamily: MONO, maxWidth: 280 }} />
            </div>
          ) : null}

          {error ? (
            <p role="alert" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)', color: 'var(--color-error)', padding: '13px 16px', borderRadius: 10, fontSize: 14.5, fontWeight: 600 }}>
              <span style={{ fontSize: 17 }}>⚠</span> {error}
            </p>
          ) : null}
          {ok ? (
            <p role="status" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)', color: 'var(--color-success)', padding: '13px 16px', borderRadius: 10, fontSize: 14.5, fontWeight: 600 }}>
              <span style={{ fontSize: 17 }}>✓</span> {labels.created}
            </p>
          ) : null}

          <div>
            <button type="submit" disabled={loading} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '15px 34px', borderRadius: 100, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? '…' : `${labels.create} →`}
            </button>
          </div>
        </form>
      </section>

      {products.length === 0 ? (
        <div style={{ ...card, padding: '46px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 15.5, color: 'var(--color-text-muted)' }}>{labels.empty}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {products.map((p) => (
            <div key={p.id} className="vn-card" style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', opacity: p.status === 1 ? 1 : 0.5 }}>
              <div style={{ position: 'relative', width: 60, height: 60, background: 'var(--color-bg)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {p.image ? <Image src={p.image} alt="" fill sizes="60px" style={{ objectFit: 'contain' }} /> : null}
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{p.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, letterSpacing: '0.04em' }}>
                  {formatPrice(p.price)}{p.isRental ? ' / MES' : ''}{p.stock !== null ? ` · STOCK ${p.stock}` : ''}
                </div>
              </div>
              {p.status === 1 ? (
                <button
                  type="button"
                  onClick={() => deactivate(p.id, p.name)}
                  disabled={busyId === p.id}
                  style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 100, padding: '9px 16px', cursor: busyId === p.id ? 'wait' : 'pointer', opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  {labels.deactivate}
                </button>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>INACTIVO</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
