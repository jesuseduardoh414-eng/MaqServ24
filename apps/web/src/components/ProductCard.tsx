'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ProductCard as ProductCardDto } from '@maqserv/types';
import { UNIDADES, type Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { formatPrice } from '@/lib/format';
import { AvailabilityBadge, CHIP_BG, CHIP_BORDER, CHIP_FG } from '@/components/AvailabilityBadge';
import { estadoDeProducto } from '@/lib/availability';
import { ProviderTrust } from '@/components/ProviderBadge';
import { Icon } from '@/components/Icon';
import { AgregarACotizacion } from '@/components/AgregarACotizacion';

// Panel radial de la foto del producto. Era claro (#ffffff -> #e9ebef) del
// diseño anterior; en una identidad dark-first un recuadro blanco por tarjeta
// pelea con la marca (08 / FONDOS AUTORIZADOS: negro y grafito prioritarios).
// Se puede pasar a grafito porque las 27 fotos activas tienen transparencia:
// ninguna trae fondo blanco incrustado que quedaría como un cuadro.
const PANEL =
  'radial-gradient(115% 92% at 50% 22%, color-mix(in srgb, var(--color-surface) 82%, var(--color-text) 4%) 0%, var(--color-bg) 88%)';

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
 * radial claro + badge + marca + nombre + specs + precio + botón Cotizar.
 * Auto-contenida: usa la wishlist. Sin "Agregar al carrito" desde 2026-10-08:
 * ya no se vende nada en línea, todo se cotiza. Se usa en el home (destacados),
 * catálogo, favoritos y tienda. Estilos por tokens del tema.
 */
/**
 * Debajo del precio: "/mes", "/viaje", "/tonelada".
 *
 * Antes decia "/mes" para todo lo que fuera renta. Para maquinaria era cierto,
 * pero una pipa se cobra por viaje y un triturado por tonelada: la tarjeta
 * estaba diciendo un precio mensual que nadie cobra asi.
 */
function unidadCorta(p: { isRental: boolean; priceUnit: string | null }): string | null {
  if (p.priceUnit) return UNIDADES[p.priceUnit]?.singular ?? p.priceUnit;
  // Sin unidad guardada, la renta vieja seguia siendo mensual.
  return p.isRental ? 'mes' : null;
}

export function ProductCard({ product: p, theme, initialFaved = false }: { product: ProductCardDto; theme: Theme; initialFaved?: boolean }) {
  const router = useRouter();
  const [faved, setFaved] = useState(initialFaved);
  // Foto que no carga (p. ej. un enlace roto en Storage): se cae a las rayas
  // en vez de enseñar el icono roto con el texto alternativo encima.
  const [imgFail, setImgFail] = useState(false);

  const quoteMode = theme.tokens.quoteMode;
  const discount = p.oldPrice && p.price && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  // Prioridad del badge: descuento > destacado > renta. Textos del TEMA
  // (requisito duro: todo copy editable en Panel → Diseño).
  // Un solo chip gris plata con texto negro para las tres variantes: la palabra
  // distingue, no el color (antes cada una traía su propio fondo de color).
  const badge = discount
    ? `-${discount}%`
    : p.featured
      ? t(theme, 'product.badge.featured')
      : p.isRental
        ? t(theme, 'product.badge.rental')
        : null;
  // Un SERVICIO enseña "Se cotiza" en vez de importe. Toda ficha vive bajo
  // /servicios (2026-10-08): /productos/<slug> solo redirige.
  const esServicio = p.kind === 'servicio';
  const ficha = `/servicios/${p.slug}`;
  // El modo (renta/venta) y la DISPONIBILIDAD ya no van juntos en una cadena:
  // el manual pide que el estado se lea de un vistazo y con su propio color
  // (21 / ESTADOS DE DISPONIBILIDAD).
  const modo = esServicio ? t(theme, 'product.mode.service') : p.isRental ? t(theme, 'product.mode.rental') : t(theme, 'product.mode.sale');
  const disp = estadoDeProducto(p);
  // Cotizar SIEMPRE es posible desde la card: lleva al cotizador con este equipo cargado.
  const quoteHref = `/cotizar?producto=${p.slug}`;
  const quoteOnly = quoteMode || esServicio || p.price === null; // servicio o sin precio: cotizar es la acción

  async function toggleFav() {
    const res = await fetch('/api/proxy/wishlist/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id }),
    });
    if (res.status === 401) { router.push('/login'); return; }
    const d = await res.json().catch(() => null);
    if (typeof d?.inWishlist === 'boolean') setFaved(d.inWishlist);
  }

  return (
    // `prod-card` = contenedor de container-query (regla en globals.css): el pie
    // se reacomoda según el ancho de LA TARJETA, no el de la ventana. La card se
    // usa en 5 rejillas distintas (home, catálogo, favoritos, tienda,
    // relacionados) y con media queries había que acertarle a cada una.
    <div className="pc prod-card">
      <style>{CSS}</style>
      {/* Panel de imagen (grafito, foto contenida sin recortar) */}
      <Link href={ficha} className="pc-media" tabIndex={-1}>
        {p.image && !imgFail ? (
          <Image src={p.image} alt={p.name} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 33vw, 25vw" className="pc-img" style={{ objectFit: 'contain', padding: 16 }} onError={() => setImgFail(true)} />
        ) : (
          // Mismo lenguaje que el resto del sitio para "sin imagen": rayas
          // discretas (`.ph`), no texto de desarrollador.
          <span className="ph" style={{ position: 'absolute', inset: 0 }} />
        )}
        {badge ? (
          <span style={{ position: 'absolute', top: 12, left: 12, background: CHIP_BG, color: CHIP_FG, border: `1px solid ${CHIP_BORDER}`, fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: 6 }}>{badge}</span>
        ) : null}
      </Link>

      <button type="button" className="pc-fav" aria-label={faved ? t(theme, 'wishlist.remove') : t(theme, 'wishlist.add')} aria-pressed={faved} onClick={toggleFav}
        style={{ color: faved ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
        {/* El botón ya dice "Favorito" en su aria-label: el icono va decorativo. */}
        <Icon name="heart" size={15} fill={faved} />
      </button>

      <div className="pc-body">
        {p.brand ? <span className="pc-brand">{p.brand}</span> : null}
        <Link href={ficha} className="pc-name">{p.name}</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{modo}</span>
          <AvailabilityBadge info={disp} />
        </div>
        {/* Quién lo suministra: el manual lo pide en la tarjeta, no solo en la ficha. */}
        {p.provider ? <div style={{ marginTop: 8 }}><ProviderTrust p={p.provider} /></div> : null}

        <div className="pc-spacer" />
        <div className="prod-card-foot" style={{ paddingTop: 14, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="prod-card-price" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            {esServicio ? (
              // Un servicio no enseña importe: se cotiza con fechas y obra.
              <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
                Se cotiza{p.priceUnit && UNIDADES[p.priceUnit] ? ` por ${UNIDADES[p.priceUnit].singular}` : ''}
              </div>
            ) : quoteMode || p.price === null ? (
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.3 }}>{t(theme, 'product.price.onQuote')}</div>
            ) : (
              <>
                <div className="ms-num" style={{ fontWeight: 700, fontSize: '19px', color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-.01em' }}>
                  {formatPrice(p.price)}{unidadCorta(p) ? <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>/{unidadCorta(p)}</span> : null}
                </div>
                {p.oldPrice && p.oldPrice > (p.price ?? 0) ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'line-through', fontWeight: 500 }}>{formatPrice(p.oldPrice)}</span>
                ) : null}
              </>
            )}
          </div>
          <div className="prod-card-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            {quoteOnly ? (
              <>
                <Link href={quoteHref} data-evento="producto_cotizar" className="ms-btn ms-btn-sm">{t(theme, 'product.card.quote')}</Link>
                {/* Para juntar varios en una sola solicitud (lista del encabezado). */}
                <AgregarACotizacion item={{ id: p.id, slug: p.slug, name: p.name, image: p.image, isRental: p.isRental }} />
              </>
            ) : (
              <>
                {/* Antes, un producto con precio y en existencia llevaba aquí
                    "Agregar" al carrito. Sin compras en línea solo queda la ficha. */}
                <Link href={ficha} className="ms-btn ms-btn-sm ms-btn-sec">{t(theme, 'product.card.view')}</Link>
                <Link href={quoteHref} data-evento="producto_cotizar" className="ms-link" style={{ fontSize: 12.5 }}>{t(theme, 'product.card.quote')}<Icon name="arrowRight" size={12} /></Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Estilos propios de la tarjeta (prefijo `pc-`). Tarjeta del sistema: radio 12,
 * borde 1 px, sin sombra; al pasar el cursor solo se aclara el borde.
 */
const CSS = `
.pc{ position:relative; display:flex; flex-direction:column; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; overflow:hidden; min-width:0; transition:border-color .18s ease; }
.pc:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.pc-media{ position:relative; display:block; height:200px; overflow:hidden; background:${PANEL}; border-bottom:1px solid var(--color-border); }
.pc-img{ transition:transform .3s ease; }
.pc:hover .pc-img{ transform:scale(1.03); }
.pc-fav{ position:absolute; top:12px; right:12px; width:36px; height:36px; border-radius:8px; background:color-mix(in srgb, var(--color-bg) 82%, transparent); border:1px solid var(--color-border); cursor:pointer; display:grid; place-items:center; transition:border-color .18s ease; }
.pc-fav:hover{ border-color:var(--color-text-muted); }
.pc-fav:focus-visible, .pc-name:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.pc-body{ padding:16px 18px 18px; display:flex; flex-direction:column; flex:1; gap:0; }
.pc-brand{ font-size:12.5px; font-weight:500; color:var(--color-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pc-name{ display:block; margin:4px 0 10px; font-size:15.5px; font-weight:600; line-height:1.35; letter-spacing:-.005em; color:var(--color-text); text-decoration:none; min-height:42px; }
.pc-name:hover{ color:var(--color-primary); }
.pc-spacer{ flex:1; min-height:16px; }
@media (prefers-reduced-motion: reduce){ .pc-img{ transition:none; } }
`;
