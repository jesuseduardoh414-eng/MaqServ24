'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProductCard as ProductCardDto, ProductComment, ProductDetail, RentalPeriod } from '@maqserv/types';
import type { Theme } from '@maqserv/config';
import { useCart } from '@/components/CartProvider';
import { ProductCard } from '@/components/ProductCard';
import { ProductQuestions } from '@/components/ProductQuestions';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { estadoDeProducto } from '@/lib/availability';
import { ProviderTrust } from '@/components/ProviderBadge';
import { formatPrice } from '@/lib/format';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';
// Mismo panel que la tarjeta del catálogo (ver ProductCard): grafito, no blanco.
const PANEL =
  'radial-gradient(115% 92% at 50% 22%, color-mix(in srgb, var(--color-surface) 82%, var(--color-text) 4%) 0%, var(--color-bg) 88%)';

function starsStr(r: number): string {
  const full = Math.round(r);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();
}
function fmtReviewDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase();
}

const TABS: Array<[string, string]> = [['desc', 'Descripción'], ['specs', 'Ficha técnica'], ['reviews', 'Opiniones'], ['qa', 'Preguntas']];

// Precio por periodo (derivado del mensual, como el diseño): sem = mes/4, día = mes/20.
function periodPrice(base: number, key: string): number {
  if (key === 'mes') return base;
  if (key === 'sem') return Math.round(base / 4 / 100) * 100;
  return Math.round(base / 20 / 100) * 100;
}
const unitLabelOf = (key: string): string => (key === 'mes' ? 'MES' : key === 'sem' ? 'SEMANA' : 'DÍA');
const PERIODS: Array<[string, string]> = [['dia', 'Día'], ['sem', 'Semana'], ['mes', 'Mes']];

export function ProductDetailView({ product, theme, rating, reviews, related, inquiryHref, quoteMode }: {
  product: ProductDetail;
  theme: Theme;
  rating: { average: number; count: number };
  reviews: ProductComment[];
  related: ProductCardDto[];
  inquiryHref: string | null;
  quoteMode: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('desc');
  const [added, setAdded] = useState(false);
  const [period, setPeriod] = useState('mes');
  const [fav, setFav] = useState<boolean | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
    fetch('/api/proxy/wishlist/ids')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: number[]) => setFav(Array.isArray(ids) && ids.includes(product.id)))
      .catch(() => setFav(false));
  }, [product.id]);

  const images = [product.image, ...product.gallery].filter((x): x is string => Boolean(x));
  const [active, setActive] = useState(0);
  const mainImg = images[active] ?? null;
  const nImg = Math.max(1, images.length);
  const move = (d: number) => setActive((a) => (a + d + nImg) % nImg);

  const isR = product.isRental;
  const effPrice = product.price !== null ? (isR ? periodPrice(product.price, period) : product.price) : null;
  const effUnit = isR ? unitLabelOf(period) : null;
  const priceUnit = isR ? `MXN / ${effUnit}` : 'MXN';
  // Los cuatro estados del manual (21 / ESTADOS DE DISPONIBILIDAD) en vez del
  // par disponible/bajo pedido. Misma fuente que las tarjetas del catálogo.
  const disp = estadoDeProducto(product);
  const quickSpecs = product.specs.slice(0, 3);
  const canBuy = !quoteMode && product.price !== null && product.inStock;
  const short = product.short ?? '';

  function addToCart() {
    if (effPrice === null) return;
    cart.add({ productId: product.id, slug: product.slug, name: product.name, price: effPrice, image: product.image, unitLabel: effUnit ?? undefined, period: isR ? (period as RentalPeriod) : undefined }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }
  function buyNow() {
    if (effPrice === null) return;
    cart.add({ productId: product.id, slug: product.slug, name: product.name, price: effPrice, image: product.image, unitLabel: effUnit ?? undefined, period: isR ? (period as RentalPeriod) : undefined }, qty);
    router.push('/carrito');
  }
  async function toggleFav() {
    const r = await fetch('/api/proxy/wishlist/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
    if (r.status === 401) { router.push('/login'); return; }
    const d = await r.json().catch(() => null);
    if (typeof d?.inWishlist === 'boolean') setFav(d.inWishlist);
  }

  const enc = encodeURIComponent;
  const shares: Array<[string, string]> = [
    ['f', `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`],
    ['in', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`],
    ['X', `https://twitter.com/intent/tweet?text=${enc(product.name)}&url=${enc(shareUrl)}`],
    ['✆', `https://wa.me/?text=${enc(`${product.name} ${shareUrl}`)}`],
  ];

  const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 4%, transparent) 0 16px, transparent 16px 32px)';

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <style>{`
        .pd-article :where(h2,h3){ font-family:${DISPLAY}; margin:28px 0 10px; font-size:22px; font-weight:700; letter-spacing:-0.02em; color:var(--color-text); }
        .pd-article p{ margin:0 0 18px; font-size:18px; line-height:1.72; color:color-mix(in srgb, var(--color-text) 78%, transparent); }
        .pd-article ul,.pd-article ol{ margin:0 0 18px; padding-left:1.3em; font-size:18px; line-height:1.7; color:color-mix(in srgb, var(--color-text) 78%, transparent); }
        .pd-article li{ margin-bottom:6px; }
        @media (max-width: 900px){
          .pd-grid{ grid-template-columns:1fr !important; gap:32px !important; }
          /* .pd-related NO se toca aquí: su auto-fill minmax(260px,1fr) ya se
             ajusta solo. Forzarlo a 1fr dejaba UNA tarjeta gigante a lo ancho
             de la tablet. */
          .pd-quickspecs{ grid-template-columns:1fr 1fr !important; }
          .pd-reviews-grid{ grid-template-columns:1fr !important; }
          .pd-name{ font-size:34px !important; }
          .pd-wrap{ padding-left:22px !important; padding-right:22px !important; }
        }
      `}</style>

      <main className="pd-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 40px' }}>
        {/* breadcrumb */}
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 34 }}>
          <Link href="/" style={{ color: 'var(--color-text-muted)' }}>INICIO</Link> / <Link href="/productos" style={{ color: 'var(--color-text-muted)' }}>PRODUCTOS</Link>
          {product.categoryName ? <> / <span style={{ color: 'var(--color-text)' }}>{product.categoryName}</span></> : null}
        </div>

        <div className="pd-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'start' }}>
          {/* gallery */}
          <div>
            <div style={{ position: 'relative', height: 480, borderRadius: 4, overflow: 'hidden', background: mainImg ? PANEL : 'var(--color-surface)', backgroundImage: mainImg ? undefined : stripe, display: 'flex', alignItems: 'flex-end', padding: 14 }}>
              {mainImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainImg} alt={product.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 28 }} />
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '5px 9px', borderRadius: 4, position: 'relative' }}>foto: {product.name}</span>
              )}
              {images.length > 1 ? (
                <>
                  <button type="button" aria-label="Anterior" onClick={() => move(-1)} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>‹</button>
                  <button type="button" aria-label="Siguiente" onClick={() => move(1)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>›</button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12 }}>
                {images.slice(0, 8).map((src, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)} style={{ height: 72, cursor: 'pointer', borderRadius: 3, overflow: 'hidden', padding: 0, border: `2px solid ${i === active ? 'var(--color-text)' : 'var(--color-border)'}`, background: PANEL }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* info */}
          <div>
            {product.brand ? <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 12, textTransform: 'uppercase' }}>{product.brand}</div> : null}
            <h1 className="pd-name" style={{ fontFamily: DISPLAY, margin: '0 0 16px', fontSize: 46, lineHeight: 0.98, fontWeight: 800, letterSpacing: '-0.04em' }}>{product.name}</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-primary)', fontSize: 16, letterSpacing: 2 }}>{starsStr(rating.average || 5)}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)' }}>{rating.count > 0 ? `${rating.average.toFixed(1)} · ${rating.count} opiniones` : 'Sin opiniones aún'}</span>
              <span style={{ marginLeft: 'auto' }}><AvailabilityBadge info={disp} tamano="ficha" /></span>
            </div>

            {!quoteMode && product.price !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '22px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(effPrice as number)}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>{priceUnit}</span>
              </div>
            ) : (
              <div style={{ padding: '22px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', fontFamily: MONO, fontSize: 14, color: 'var(--color-text-muted)' }}>Precio bajo cotización</div>
            )}

            {short ? <p style={{ margin: '22px 0 26px', fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{short}</p> : <div style={{ height: 22 }} />}

            {isR && !quoteMode && product.price !== null ? (
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-text-muted)', marginBottom: 10 }}>PERIODO DE RENTA</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {PERIODS.map(([key, label]) => {
                    const on = period === key;
                    return (
                      <button key={key} type="button" onClick={() => setPeriod(key)} style={{ border: `1px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, background: on ? 'var(--color-text)' : 'var(--color-bg)', color: on ? 'var(--color-bg)' : 'var(--color-text)', borderRadius: 4, padding: '12px 10px', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15 }}>{label}</div>
                        <div style={{ fontFamily: MONO, fontSize: 11, marginTop: 3, color: on ? 'color-mix(in srgb, var(--color-bg) 65%, transparent)' : 'var(--color-text-muted)' }}>{formatPrice(periodPrice(product.price as number, key))}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Quién suministra el equipo y con qué señales de confianza (22 / PROVEEDORES). */}
            {product.provider ? (
              <div style={{ marginBottom: 30 }}>
                <ProviderTrust p={product.provider} tamano="ficha" />
              </div>
            ) : null}

            {quickSpecs.length > 0 ? (
              <div className="pd-quickspecs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 30 }}>
                {quickSpecs.map((q, i) => (
                  <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: '14px 16px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>{q.label}</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{q.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* qty + add */}
            {canBuy ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 100, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ background: 'transparent', border: 'none', width: 44, height: 48, fontSize: 22, cursor: 'pointer', color: 'var(--color-text)' }}>−</button>
                    <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, width: 36, textAlign: 'center' }}>{qty}</span>
                    <button type="button" onClick={() => setQty((q) => q + 1)} style={{ background: 'transparent', border: 'none', width: 44, height: 48, fontSize: 22, cursor: 'pointer', color: 'var(--color-text)' }}>+</button>
                  </div>
                  <button type="button" onClick={addToCart} style={{ flex: 1, minWidth: 200, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '16px 28px', borderRadius: 100, cursor: 'pointer' }}>{added ? '✓ Añadido' : 'Añadir al carrito'}</button>
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                  <button type="button" onClick={buyNow} style={{ flex: 1, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', padding: '16px 28px', borderRadius: 100, cursor: 'pointer' }}>Comprar ahora</button>
                  <button type="button" onClick={toggleFav} aria-pressed={fav === true} title="Favoritos" style={{ width: 56, fontSize: 20, background: 'var(--color-bg)', color: 'var(--color-primary)', border: `1px solid ${fav ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 100, cursor: 'pointer' }}>{fav ? '♥' : '♡'}</button>
                </div>
                {inquiryHref ? (
                  <a href={inquiryHref} style={{ display: 'block', textAlign: 'center', width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-text)', padding: '14px 20px', borderRadius: 100, textDecoration: 'none', boxSizing: 'border-box' }}>Solicitar información</a>
                ) : null}
              </>
            ) : (
              <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                <Link href={`/cotizar?producto=${product.slug}`} style={{ flex: 1, minWidth: 200, textAlign: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', textDecoration: 'none', padding: '16px 30px', borderRadius: 100 }}>Solicitar cotización →</Link>
                <button type="button" onClick={toggleFav} aria-pressed={fav === true} title="Favoritos" style={{ width: 56, fontSize: 20, background: 'var(--color-bg)', color: 'var(--color-primary)', border: `1px solid ${fav ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 100, cursor: 'pointer' }}>{fav ? '♥' : '♡'}</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 24, marginTop: 26, fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
              <span>✓ ENTREGA EN OBRA</span><span>✓ SEGURO INCLUIDO</span><span>✓ SOPORTE 24/7</span>
            </div>

            {/* SKU / etiquetas / compartir */}
            <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--color-border)', display: 'grid', gap: 12, fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <div style={{ display: 'flex', gap: 12 }}><span style={{ width: 80, flexShrink: 0 }}>SKU</span><span style={{ color: 'var(--color-text)' }}>MX-{product.id}</span></div>
              {product.tags.length > 0 ? (
                <div style={{ display: 'flex', gap: 12 }}><span style={{ width: 80, flexShrink: 0 }}>ETIQUETAS</span><span style={{ color: 'var(--color-text)' }}>{product.tags.join(', ')}</span></div>
              ) : null}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ width: 80, flexShrink: 0 }}>COMPARTIR</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  {shares.map(([label, href]) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, border: '1px solid var(--color-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)', textDecoration: 'none', fontSize: 12 }}>{label}</a>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ marginTop: 80 }}>
          <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-text)', flexWrap: 'wrap' }}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: 'none', padding: '14px 20px', color: tab === key ? 'var(--color-text)' : 'var(--color-text-muted)', borderBottom: `3px solid ${tab === key ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -2, letterSpacing: '-0.01em' }}>{label}{key === 'reviews' && rating.count > 0 ? ` (${rating.count})` : ''}</button>
            ))}
          </div>

          <div style={{ padding: '44px 0' }}>
            {tab === 'desc' ? (
              <div className="pd-article" style={{ maxWidth: 760 }} dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : null}

            {tab === 'specs' ? (
              product.specs.length > 0 ? (
                <div style={{ maxWidth: 760 }}>
                  {product.specs.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{row.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--color-text-muted)' }}>Este equipo aún no tiene ficha técnica cargada.</p>
            ) : null}

            {tab === 'reviews' ? (
              rating.count > 0 ? (
                <div className="pd-reviews-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 56, alignItems: 'start' }}>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 4, padding: 28, textAlign: 'center' }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{rating.average.toFixed(1)}</div>
                    <div style={{ color: 'var(--color-primary)', fontSize: 18, letterSpacing: 2, margin: '8px 0' }}>{starsStr(rating.average)}</div>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)' }}>{rating.count} OPINIONES</div>
                  </div>
                  <div>
                    {reviews.map((r, i) => (
                      <div key={r.id} style={{ padding: '0 0 26px', marginBottom: 26, borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <span style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--color-primary-fg)', background: 'var(--color-primary)' }}>{initialsOf(r.author)}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{r.author}{r.verified ? <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--color-success)', border: '1px solid color-mix(in srgb,var(--color-success) 40%,transparent)', borderRadius: 4, padding: '1px 5px' }}>✓ COMPRA</span> : null}</div>
                            <div style={{ color: 'var(--color-primary)', fontSize: 13, letterSpacing: 1 }}>{starsStr(r.rating)}</div>
                          </div>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{fmtReviewDate(r.date)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{r.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', maxWidth: 560 }}>Aún no hay opiniones. Las reseñas provienen de clientes que rentaron este equipo — podrás calificarlo desde <b>Mis compras</b> después de tu renta.</p>
              )
            ) : null}

            {tab === 'qa' ? <ProductQuestions productId={product.id} /> : null}
          </div>
        </div>

        {/* related */}
        {related.length > 0 ? (
          <div style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 36 }}>
              <h2 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>También te puede servir</h2>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>RELACIONADOS</span>
            </div>
            <div className="pd-related" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
              {related.map((rp) => (
                <ProductCard key={rp.id} product={rp} theme={theme} />
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
