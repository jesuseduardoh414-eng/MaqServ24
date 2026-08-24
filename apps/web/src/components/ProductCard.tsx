'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ProductCard as ProductCardDto } from '@maqserv/types';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { formatPrice } from '@/lib/format';
import { useCart } from '@/components/CartProvider';

// Panel radial de la foto del producto. Era claro (#ffffff -> #e9ebef) del
// diseño anterior; en una identidad dark-first un recuadro blanco por tarjeta
// pelea con la marca (08 / FONDOS AUTORIZADOS: negro y grafito prioritarios).
// Se puede pasar a grafito porque las 27 fotos activas tienen transparencia:
// ninguna trae fondo blanco incrustado que quedaría como un cuadro.
const PANEL =
  'radial-gradient(115% 92% at 50% 22%, color-mix(in srgb, var(--color-surface) 82%, var(--color-text) 4%) 0%, var(--color-bg) 88%)';

const addBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-primary)',
  color: 'var(--color-primary-fg)', border: 'none', fontWeight: 700, fontSize: '12.5px',
  padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textDecoration: 'none',
  whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
  boxShadow: '0 10px 20px -13px color-mix(in srgb, var(--color-primary) 95%, transparent)',
};

/** Precio respetando el Modo Cotización del tema. (usado también en el detalle) */
export function Price({ theme, price, oldPrice }: { theme: Theme; price: number | null; oldPrice?: number | null }) {
  if (theme.tokens.quoteMode || price === null) {
    return <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{t(theme, 'product.price.onQuote')}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'baseline' }}>
      <strong style={{ color: 'var(--color-text)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>{formatPrice(price)}</strong>
      {oldPrice ? <s style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{formatPrice(oldPrice)}</s> : null}
    </span>
  );
}

/**
 * Card de producto (diseño "Productos - Destacados y Catálogo"): panel de imagen
 * radial claro + badge + marca + nombre + specs + precio + botón Agregar.
 * Auto-contenida: usa el carrito y la wishlist. Se usa en el home (destacados),
 * catálogo, favoritos y tienda. Estilos por tokens del tema.
 */
export function ProductCard({ product: p, theme, initialFaved = false }: { product: ProductCardDto; theme: Theme; initialFaved?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const [faved, setFaved] = useState(initialFaved);
  const [added, setAdded] = useState(false);

  const quoteMode = theme.tokens.quoteMode;
  const discount = p.oldPrice && p.price && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  // Prioridad del badge: descuento > destacado ("Nuevo") > renta.
  const badge = discount
    ? { text: `-${discount}%`, bg: 'var(--color-primary)', fg: 'var(--color-primary-fg)' }
    : p.featured
      ? { text: 'Destacado', bg: 'var(--color-accent)', fg: '#fff' }
      : p.isRental
        ? { text: 'Renta', bg: 'var(--color-secondary)', fg: '#fff' }
        : null;
  const canAdd = !quoteMode && p.inStock && !p.isRental && p.price !== null;
  const spec = `${p.isRental ? 'Renta' : 'Venta'}${p.inStock ? ' · Disponible' : ' · Bajo pedido'}`;
  // Cotizar SIEMPRE es posible desde la card: lleva al cotizador con este equipo cargado.
  const quoteHref = `/cotizar?producto=${p.slug}`;
  const quoteOnly = quoteMode || p.price === null; // sin precio público: cotizar es la acción principal

  function add() {
    cart.add({ productId: p.id, slug: p.slug, name: p.name, price: p.price ?? 0, image: p.image });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }
  async function toggleFav() {
    const res = await fetch('/api/proxy/wishlist/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const d = await res.json().catch(() => null);
    if (typeof d?.inWishlist === 'boolean') setFaved(d.inWishlist);
  }

  return (
    // `prod-card` = contenedor de container-query: el pie se reacomoda según el
    // ancho de LA TARJETA, no el de la ventana. La card se usa en 5 rejillas
    // distintas (home, catálogo, favoritos, tienda, relacionados) y con media
    // queries había que acertarle a cada una.
    <div className="lift prod-card" style={{ position: 'relative', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
      {/* Panel de imagen (radial claro, foto contenida sin recortar) */}
      <Link href={`/productos/${p.slug}`} style={{ position: 'relative', height: 210, display: 'block', overflow: 'hidden', background: PANEL }}>
        {p.image ? (
          <Image src={p.image} alt={p.name} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 33vw, 25vw" className="zoom" style={{ objectFit: 'contain', padding: 16 }} />
        ) : (
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11 }}>[ sin imagen ]</span>
        )}
        {badge ? (
          <span style={{ position: 'absolute', top: 13, left: 13, background: badge.bg, color: badge.fg, fontSize: '11px', fontWeight: 800, padding: '5px 11px', borderRadius: 'var(--radius-sm)' }}>{badge.text}</span>
        ) : null}
      </Link>

      <button type="button" aria-label="Favorito" aria-pressed={faved} onClick={toggleFav}
        style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)', border: '1px solid var(--color-border)', color: faved ? 'var(--color-error)' : 'var(--color-text-muted)', fontSize: '15px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
        {faved ? '♥' : '♡'}
      </button>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 16 }}>
          <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand ?? ''}</span>
        </div>
        <Link href={`/productos/${p.slug}`} style={{ fontWeight: 700, fontSize: '15.5px', lineHeight: 1.3, margin: '8px 0 4px', color: 'var(--color-text)', textDecoration: 'none', minHeight: 40, display: 'block' }}>{p.name}</Link>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: 300 }}>{spec}</div>

        <div className="prod-card-foot" style={{ marginTop: 'auto', paddingTop: 15, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div className="prod-card-price" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            {quoteMode || p.price === null ? (
              <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--color-accent)', lineHeight: 1 }}>{t(theme, 'product.price.onQuote')}</div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--color-text)', lineHeight: 1 }}>
                  {formatPrice(p.price)}{p.isRental ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>/mes</span> : null}
                </div>
                {p.oldPrice && p.oldPrice > (p.price ?? 0) ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'line-through', fontWeight: 500 }}>{formatPrice(p.oldPrice)}</span>
                ) : null}
              </>
            )}
          </div>
          <div className="prod-card-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
            {quoteOnly ? (
              <Link href={quoteHref} style={addBtn}>Cotizar</Link>
            ) : (
              <>
                {canAdd ? (
                  <button type="button" onClick={add} style={addBtn}>
                    {added ? '✓ Agregado' : <><span style={{ fontSize: '14px', marginTop: -1 }}>+</span>Agregar</>}
                  </button>
                ) : (
                  <Link href={`/productos/${p.slug}`} style={addBtn}>Ver</Link>
                )}
                <Link href={quoteHref} style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Cotizar →</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
