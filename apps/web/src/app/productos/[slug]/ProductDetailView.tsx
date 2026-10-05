'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ProductCard as ProductCardDto, ProductComment, ProductDetail, RentalPeriod } from '@maqserv/types';
import { UNIDADES, esUnidadDeTiempo, precioPeriodoCarrito, type Theme } from '@maqserv/config';
import { t as tCopy } from '@/lib/theme';
import { useCart } from '@/components/CartProvider';
import { ProductCard } from '@/components/ProductCard';
import { ProductQuestions } from '@/components/ProductQuestions';
import { AvailabilityBadge } from '@/components/AvailabilityBadge';
import { estadoDeProducto, contextoDisponibilidad } from '@/lib/availability';
import { ProviderTrust } from '@/components/ProviderBadge';
import { Icon, Stars } from '@/components/Icon';
import { formatPrice } from '@/lib/format';

// Mismo panel que la tarjeta del catálogo (ver ProductCard): grafito, no blanco.
const PANEL =
  'radial-gradient(115% 92% at 50% 22%, color-mix(in srgb, var(--color-surface) 82%, var(--color-text) 4%) 0%, var(--color-bg) 88%)';

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();
}
function fmtReviewDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace(/\./g, '');
}

// Etiquetas de las pestañas: del TEMA (requisito duro). La clave interna (desc,
// specs…) no cambia; solo el texto visible.
const TAB_KEYS: Array<[string, string]> = [
  ['desc', 'product.tab.description'],
  ['specs', 'product.tab.specs'],
  ['reviews', 'product.tab.reviews'],
  ['qa', 'product.tab.questions'],
];

/**
 * PRECIO POR PERIODO.
 *
 * El precio mostrado sale de `precioPeriodoCarrito` (@maqserv/config): la MISMA
 * función con la que `orders.service` cobra. Antes cada lado tenía su fórmula
 * (aquí se convertía desde `price_unit`, el server asumía mensual) y un equipo
 * capturado por hora se mostraba bien pero se cobraba ÷20 — hasta en $0. Si la
 * regla de conversión cambia, se cambia ALLÁ, en un solo lugar.
 */
/**
 * OJO: las claves son las del CARRITO ('dia' | 'sem' | 'mes'), no las de
 * `UNIDADES`, que usa 'semana'. La API ya acepta cualquier unidad conocida
 * ('viaje', 'jornada', 'hora'…) y convierte desde `price_unit` con la misma
 * fuente única; `aUnidad`/`aPeriodo` hacen la única traduccion que difiere.
 */
const PERIODS: Array<[string, string]> = [['dia', 'Día'], ['sem', 'Semana'], ['mes', 'Mes']];
const aUnidad = (clave: string): string => (clave === 'sem' ? 'semana' : clave);
const aPeriodo = (unidad: string): string => (unidad === 'semana' ? 'sem' : unidad);

/**
 * Estilos propios de la ficha (prefijo `pd-`). Lo común —botones, chips,
 * pestañas, tarjetas, vacíos— sale del sistema `ms-*`.
 */
const CSS = `
.pd-crumbs{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:0 0 28px; font-size:13px; color:var(--color-text-muted); }
.pd-crumbs a{ color:var(--color-text-muted); text-decoration:none; }
.pd-crumbs a:hover{ color:var(--color-text); }
.pd-crumbs [aria-current]{ color:var(--color-text); }
.pd-grid{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); gap:56px; align-items:start; }
.pd-gal{ position:relative; height:460px; border-radius:14px; overflow:hidden; border:1px solid var(--color-border); background:${PANEL}; }
.pd-nav{ position:absolute; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:8px; border:1px solid var(--color-border); background:color-mix(in srgb, var(--color-bg) 85%, transparent); color:var(--color-text); cursor:pointer; display:grid; place-items:center; }
.pd-thumbs{ display:grid; grid-template-columns:repeat(auto-fill, minmax(72px, 1fr)); gap:10px; margin-top:12px; }
.pd-thumb{ position:relative; height:68px; cursor:pointer; border-radius:8px; overflow:hidden; padding:0; border:1px solid var(--color-border); background:${PANEL}; }
.pd-thumb[aria-current="true"]{ border-color:var(--color-primary); box-shadow:0 0 0 1px var(--color-primary); }
.pd-brand{ margin:0 0 8px; font-size:13.5px; font-weight:500; color:var(--color-text-muted); }
.pd-name{ margin:0 0 14px; font-family:var(--font-display); font-size:clamp(27px, 3vw, 34px); font-weight:700; line-height:1.15; letter-spacing:-.025em; text-wrap:balance; overflow-wrap:anywhere; }
.pd-rate{ display:flex; align-items:center; gap:10px 12px; flex-wrap:wrap; margin-bottom:22px; font-size:13px; color:var(--color-text-muted); }
.pd-rate .pd-stars{ color:var(--color-primary); display:inline-flex; }
.pd-block{ margin-bottom:22px; }
.pd-list{ margin:12px 0 0; padding:0; list-style:none; display:grid; gap:8px; font-size:14.5px; line-height:1.5; }
.pd-list li{ display:flex; gap:10px; align-items:flex-start; }
.pd-list li > svg{ flex-shrink:0; margin-top:3px; color:var(--color-success); }
.pd-price{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.pd-price-n{ font-family:var(--font-display); font-size:34px; font-weight:700; letter-spacing:-.025em; line-height:1.1; font-variant-numeric:tabular-nums; }
.pd-short{ margin:0 0 24px; font-size:15.5px; line-height:1.6; color:var(--color-text-muted); }
.pd-periods{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-top:8px; }
.pd-period{ border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text); border-radius:8px; padding:10px; min-height:44px; cursor:pointer; text-align:center; font-family:inherit; transition:border-color .18s ease; }
.pd-period:hover{ border-color:var(--color-text-muted); }
.pd-period[aria-pressed="true"]{ border-color:color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 12%, transparent); }
.pd-period b{ display:block; font-size:14.5px; font-weight:600; }
.pd-period span{ display:block; margin-top:2px; font-size:12.5px; color:var(--color-text-muted); font-variant-numeric:tabular-nums; }
.pd-ctx{ display:flex; gap:8px; align-items:flex-start; font-size:13px; color:var(--color-text-muted); margin-bottom:20px; }
.pd-ctx svg{ flex-shrink:0; margin-top:1px; }
.pd-quick{ display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:24px; }
.pd-quick > div{ border:1px solid var(--color-border); border-radius:12px; padding:12px 14px; background:var(--color-surface); min-width:0; }
.pd-quick dt{ font-size:12.5px; color:var(--color-text-muted); margin-bottom:4px; }
.pd-quick dd{ margin:0; font-size:16px; font-weight:600; overflow-wrap:anywhere; }
.pd-buy{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.pd-buy .ms-btn{ flex:1; min-width:180px; }
.pd-qty{ display:flex; align-items:center; border:1px solid var(--color-border); border-radius:8px; overflow:hidden; background:var(--color-bg); }
.pd-qty button{ background:transparent; border:none; width:44px; height:48px; cursor:pointer; color:var(--color-text); font-size:20px; font-family:inherit; }
.pd-qty button:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); }
.pd-qty output{ width:34px; text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }
.pd-fav{ width:50px; padding:0; flex:0 0 auto !important; min-width:0 !important; }
.pd-fav[aria-pressed="true"]{ color:var(--color-primary); border-color:var(--color-primary); }
.pd-promises{ list-style:none; margin:22px 0 0; padding:0; display:grid; gap:8px; font-size:13px; color:var(--color-text-muted); }
.pd-promises li{ display:flex; gap:8px; align-items:center; }
.pd-promises svg{ color:var(--color-success); flex-shrink:0; }
.pd-meta{ margin-top:24px; padding-top:18px; border-top:1px solid var(--color-border); display:grid; gap:10px; font-size:13.5px; }
.pd-meta > div{ display:flex; gap:12px; align-items:center; }
.pd-meta dt{ width:88px; flex-shrink:0; color:var(--color-text-muted); }
.pd-meta dd{ margin:0; min-width:0; overflow-wrap:anywhere; }
.pd-share{ display:flex; gap:8px; }
.pd-share a{ width:32px; height:32px; border:1px solid var(--color-border); border-radius:8px; display:grid; place-items:center; color:var(--color-text); text-decoration:none; font-size:12.5px; font-weight:600; }
.pd-share a:hover{ border-color:var(--color-text-muted); }
.pd-tabs-wrap{ margin-top:64px; }
.pd-tabs{ flex-wrap:nowrap; overflow-x:auto; padding-bottom:16px; border-bottom:1px solid var(--color-border); }
.pd-tabpanel{ padding:28px 0 8px; }
.pd-article{ max-width:760px; }
.pd-article :where(h2,h3){ font-family:var(--font-display); margin:28px 0 10px; font-size:20px; font-weight:700; letter-spacing:-.015em; color:var(--color-text); }
.pd-article p{ margin:0 0 16px; font-size:16px; line-height:1.7; color:color-mix(in srgb, var(--color-text) 82%, transparent); }
.pd-article ul,.pd-article ol{ margin:0 0 16px; padding-left:1.3em; font-size:16px; line-height:1.7; color:color-mix(in srgb, var(--color-text) 82%, transparent); }
.pd-article li{ margin-bottom:6px; }
.pd-specs{ max-width:760px; margin:0; padding:0 22px; }
.pd-specs > div{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; padding:14px 0; border-bottom:1px solid var(--color-border); }
.pd-specs > div:last-child{ border-bottom:none; }
.pd-specs dt{ font-size:14px; color:var(--color-text-muted); }
.pd-specs dd{ margin:0; font-size:15px; font-weight:600; overflow-wrap:anywhere; }
.pd-reviews{ display:grid; grid-template-columns:240px minmax(0,1fr); gap:40px; align-items:start; }
.pd-score{ text-align:center; }
.pd-score-n{ font-family:var(--font-display); font-size:44px; font-weight:700; line-height:1; letter-spacing:-.02em; }
.pd-review{ padding:0 0 22px; margin-bottom:22px; border-bottom:1px solid var(--color-border); }
.pd-review:last-child{ border-bottom:none; margin-bottom:0; }
.pd-avatar{ width:40px; height:40px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:13px; font-weight:600; color:var(--color-text); background:color-mix(in srgb, var(--color-primary) 18%, var(--color-surface)); border:1px solid color-mix(in srgb, var(--color-primary) 30%, transparent); }
.pd-related{ margin-top:56px; }
@media (max-width: 900px){
  .pd-grid{ grid-template-columns:minmax(0,1fr); gap:28px; }
  .pd-gal{ height:360px; }
  .pd-reviews{ grid-template-columns:minmax(0,1fr); gap:24px; }
}
@media (max-width: 640px){
  .pd-gal{ height:280px; }
  .pd-tabs-wrap{ margin-top:44px; }
  .pd-specs{ padding:0 16px; }
  .pd-specs > div{ grid-template-columns:minmax(0,1fr); gap:2px; }
}
`;

export function ProductDetailView({ product, theme, rating, reviews, related, quoteMode }: {
  product: ProductDetail;
  theme: Theme;
  rating: { average: number; count: number };
  reviews: ProductComment[];
  related: ProductCardDto[];
  quoteMode: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('desc');
  const [added, setAdded] = useState(false);
  // Unidad en la que esta capturado el precio. Sin ella, la renta vieja era mensual.
  const unidadBase = product.priceUnit ?? (product.isRental ? 'mes' : null);
  const porTiempo = esUnidadDeTiempo(unidadBase);
  const [period, setPeriod] = useState(porTiempo ? aPeriodo(unidadBase!) : (unidadBase ?? 'mes'));
  const [fav, setFav] = useState<boolean | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  // Fotos que no cargan (enlace roto en Storage): se cae a las rayas.
  const [rotas, setRotas] = useState<Record<string, true>>({});

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
  const effPrice = product.price !== null
    ? (isR && porTiempo ? precioPeriodoCarrito(product.price, unidadBase!, period) : product.price)
    : null;
  // La etiqueta sale de la unidad real: MES, VIAJE, TONELADA... (así la guarda el carrito)
  const effUnit = unidadBase ? (UNIDADES[porTiempo ? aUnidad(period) : unidadBase]?.singular ?? unidadBase).toUpperCase() : null;
  // En pantalla va en tipo oración: "MXN / mes".
  const priceUnit = isR ? `MXN / ${(effUnit ?? '').toLowerCase()}` : 'MXN';
  // Los cuatro estados del manual (21 / ESTADOS DE DISPONIBILIDAD) en vez del
  // par disponible/bajo pedido. Misma fuente que las tarjetas del catálogo.
  const disp = estadoDeProducto(product);
  const ctxDisp = contextoDisponibilidad(product.availability);
  const quickSpecs = product.specs.slice(0, 3);
  // Un SERVICIO no se compra aquí: el precio es "desde" y el total (fechas,
  // traslado, IVA) lo da el cotizador con la máquina ya elegida.
  const esServicio = product.kind === 'servicio';
  const canBuy = !quoteMode && !esServicio && product.price !== null && product.inStock;
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
    // 'wa' no se pinta: es la clave con la que el <a> decide poner el icono.
    ['wa', `https://wa.me/?text=${enc(`${product.name} ${shareUrl}`)}`],
  ];

  const favBtn = (
    <button type="button" onClick={toggleFav} aria-pressed={fav === true} aria-label="Favoritos" title="Favoritos" className="ms-btn ms-btn-sec ms-btn-lg pd-fav">
      <Icon name="heart" size={19} fill={!!fav} />
    </button>
  );

  return (
    <div className="ms-page">
      <style>{CSS}</style>

      <main className="ms-wrap">
        <nav aria-label="Ruta" className="pd-crumbs">
          <Link href="/">Inicio</Link>
          <span aria-hidden>/</span>
          <Link href={esServicio ? '/servicios' : '/productos'}>{esServicio ? 'Servicios' : 'Productos'}</Link>
          {product.categoryName ? <><span aria-hidden>/</span><span aria-current="page">{product.categoryName}</span></> : null}
        </nav>

        <div className="pd-grid">
          {/* Galería */}
          <div style={{ minWidth: 0 }}>
            <div className="pd-gal">
              {mainImg && !rotas[mainImg] ? (
                // next/image: es el LCP de la ficha — antes el <img> crudo
                // servía el original de Storage sin resize ni webp.
                <Image src={mainImg} alt={product.name} fill priority sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'contain', padding: 28 }} onError={() => setRotas((r) => ({ ...r, [mainImg]: true }))} />
              ) : (
                <span className="ph" aria-hidden style={{ position: 'absolute', inset: 0 }} />
              )}
              {images.length > 1 ? (
                <>
                  <button type="button" aria-label="Anterior" onClick={() => move(-1)} className="pd-nav" style={{ left: 12 }}><Icon name="chevronLeft" size={18} /></button>
                  <button type="button" aria-label="Siguiente" onClick={() => move(1)} className="pd-nav" style={{ right: 12 }}><Icon name="chevronRight" size={18} /></button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="pd-thumbs">
                {images.slice(0, 8).map((src, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)} className="pd-thumb" aria-current={i === active ? 'true' : undefined} aria-label={`Foto ${i + 1}`}>
                    {rotas[src] ? <span className="ph" style={{ position: 'absolute', inset: 0 }} /> : (
                      <Image src={src} alt="" fill sizes="120px" style={{ objectFit: 'contain', padding: 6 }} onError={() => setRotas((r) => ({ ...r, [src]: true }))} />
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Información */}
          <div style={{ minWidth: 0 }}>
            {product.brand ? <p className="pd-brand">{product.brand}</p> : null}
            <h1 className="pd-name">{product.name}</h1>

            {/* Sin reseñas, las estrellas van VACIAS. El `|| 5` que habia aqui
                pintaba cinco estrellas llenas junto a "Sin opiniones aun": una
                calificacion perfecta inventada en los 25 de 27 productos que no
                tienen ni una opinion. */}
            <div className="pd-rate">
              <span className="pd-stars"><Stars value={rating.average} size={15} /></span>
              <span>{rating.count > 0 ? `${rating.average.toFixed(1)} · ${rating.count} opiniones` : 'Sin opiniones aún'}</span>
              <span><AvailabilityBadge info={disp} tamano="ficha" /></span>
            </div>

            {esServicio ? (
              /* UN SERVICIO NO ENSEÑA IMPORTES (2026-09-25): el precio depende de
                 fechas, obra y traslado, y lo da el cotizador. Aquí va cómo se
                 cotiza: unidades, mínimo, horario y de dónde sale el traslado. */
              <section className="ms-panel pd-block" style={{ padding: '18px 20px' }}>
                <h2 className="ms-h3">Se cotiza en línea</h2>
                <ul className="pd-list">
                  {(() => {
                    // `?? []`: una respuesta cacheada de la API vieja no trae el campo.
                    const unidades = ((product.pricingUnits ?? []).length ? product.pricingUnits : product.priceUnit ? [product.priceUnit] : [])
                      .map((u) => UNIDADES[u]?.singular ?? u);
                    const principal = product.priceUnit ? UNIDADES[product.priceUnit] : undefined;
                    const check = <Icon name="check" size={15} />;
                    return (
                      <>
                        {unidades.length ? <li>{check}<span>Se cobra por {unidades.length > 1 ? `${unidades.slice(0, -1).join(', ')} o ${unidades[unidades.length - 1]}` : unidades[0]}.</span></li> : null}
                        {product.minUnits && principal ? <li>{check}<span>Mínimo {product.minUnits} {product.minUnits === 1 ? principal.singular : principal.plural}.</span></li> : null}
                        {product.schedule ? <li>{check}<span>Atiende {product.schedule}.</span></li> : null}
                        {product.attributes?.operador ? <li>{check}<span>Operador: {product.attributes.operador.toLowerCase()}.</span></li> : null}
                        {product.attributes?.combustible ? <li>{check}<span>Combustible: {product.attributes.combustible.toLowerCase()}.</span></li> : null}
                        <li>{check}<span>Traslado calculado por distancia hasta tu obra{product.availability?.location ? ` desde ${product.availability.location}` : ''}.</span></li>
                      </>
                    );
                  })()}
                </ul>
                <p className="ms-hint" style={{ marginTop: 12, fontSize: 13.5 }}>Dinos fechas y obra: el precio sale al momento y la máquina queda apartada al solicitar.</p>
              </section>
            ) : !quoteMode && product.price !== null ? (
              <div className="pd-price pd-block">
                <span className="pd-price-n">{formatPrice(effPrice as number)}</span>
                <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{priceUnit}</span>
              </div>
            ) : (
              <p className="pd-block" style={{ margin: '0 0 22px', fontSize: 16, fontWeight: 600 }}>Precio bajo cotización</p>
            )}

            {short ? <p className="pd-short">{short}</p> : null}

            {isR && porTiempo && !quoteMode && !esServicio && product.price !== null ? (
              <div className="pd-block">
                <span className="ms-label">Periodo de renta</span>
                <div className="pd-periods" role="group" aria-label="Periodo de renta">
                  {PERIODS.map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setPeriod(key)} className="pd-period" aria-pressed={period === key}>
                      <b>{label}</b>
                      <span>{formatPrice(precioPeriodoCarrito(product.price as number, unidadBase!, key))}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Dónde está y desde cuándo no se confirma: el documento pide que la
                ubicación forme parte del producto, no un adorno. */}
            {ctxDisp ? (
              <p className="pd-ctx" style={{ margin: '0 0 20px' }}><Icon name="mapPin" size={15} />{ctxDisp}</p>
            ) : null}

            {/* Quién suministra el equipo y con qué señales de confianza (22 / PROVEEDORES). */}
            {product.provider ? (
              <div className="pd-block">
                <ProviderTrust p={product.provider} tamano="ficha" />
              </div>
            ) : null}

            {quickSpecs.length > 0 ? (
              <dl className="pd-quick" style={{ marginTop: 0 }}>
                {quickSpecs.map((q, i) => (
                  <div key={i}>
                    <dt>{q.label}</dt>
                    <dd>{q.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {/* cantidad + agregar */}
            {canBuy ? (
              <>
                <div className="pd-buy">
                  <div className="pd-qty">
                    <button type="button" aria-label="Quitar uno" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" aria-label="Agregar uno" onClick={() => setQty((q) => q + 1)}>+</button>
                  </div>
                  <button type="button" onClick={addToCart} className="ms-btn ms-btn-lg">
                    {added ? <><Icon name="check" size={17} />Añadido</> : <><Icon name="cart" size={17} />Añadir al carrito</>}
                  </button>
                </div>
                <div className="pd-buy">
                  <button type="button" onClick={buyNow} className="ms-btn ms-btn-sec ms-btn-lg">Comprar ahora</button>
                  {favBtn}
                </div>
                {/* COTIZAR SIEMPRE, tambien en los equipos que se pueden comprar.
                    Antes aqui habia un 'Solicitar informacion' que abria el correo:
                    una peticion suelta, sin capacidad, sin fechas y sin ubicacion, que
                    obligaba a llamar de vuelta. El cotizador pregunta lo que hace falta
                    segun el servicio, y ademas la plataforma se centra en cotizar. */}
                <Link href={`/cotizar?producto=${product.slug}`} data-evento="producto_solicitar_cotizacion" className="ms-link" style={{ marginTop: 6 }}>
                  Cotizar este equipo
                  <Icon name="arrowRight" size={15} />
                </Link>
              </>
            ) : (
              <div className="pd-buy">
                <Link href={`/cotizar?producto=${product.slug}`} data-evento="producto_solicitar_cotizacion" className="ms-btn ms-btn-lg">{esServicio ? 'Cotizar este servicio' : 'Solicitar cotización'}<Icon name="arrowRight" size={16} /></Link>
                {favBtn}
              </div>
            )}

            {/* Antes decia 'ENTREGA EN OBRA · SEGURO INCLUIDO · SOPORTE 24/7'. Las tres
                eran promesas fijas en TODAS las fichas, sin que nada las respaldara: el
                seguro depende del aliado y el 24/7 es justo el ejemplo que el manual
                prohibe (27 / IDENTIDAD). Se sustituyen por lo que si es verdad del
                modelo: se cotiza el traslado, el aliado tiene expediente y el estado
                se confirma antes de comprometerlo. */}
            <ul className="pd-promises">
              <li><Icon name="check" size={14} />Traslado cotizado por distancia</li>
              <li><Icon name="check" size={14} />Proveedor con expediente</li>
              <li><Icon name="check" size={14} />Disponibilidad confirmada antes de asignar</li>
            </ul>

            {/* SKU / etiquetas / compartir */}
            <dl className="pd-meta">
              <div><dt>SKU</dt><dd className="ms-num">MX-{product.id}</dd></div>
              {product.tags.length > 0 ? (
                <div><dt>Etiquetas</dt><dd>{product.tags.join(', ')}</dd></div>
              ) : null}
              <div>
                <dt>Compartir</dt>
                <dd className="pd-share">
                  {shares.map(([label, href]) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label === 'wa' ? <Icon name="phone" size={13} label="WhatsApp" /> : label}</a>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Pestañas: chips del sistema en una sola fila (se desplaza de lado si
            no caben, sin partirse en dos renglones). */}
        <div className="pd-tabs-wrap">
          <div role="tablist" aria-label="Información del equipo" className="ms-tabs no-sb pd-tabs">
            {TAB_KEYS.map(([key, copyKey]) => [key, tCopy(theme, copyKey)] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                data-pd-tab={key}
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className="ms-tab"
              >
                {label}{key === 'reviews' && rating.count > 0 ? <span className="ms-num" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{rating.count}</span> : null}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="pd-tabpanel">
            {tab === 'desc' ? (
              <div className="pd-article" dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : null}

            {tab === 'specs' ? (
              product.specs.length > 0 ? (
                <dl className="ms-panel pd-specs">
                  {product.specs.map((row, i) => (
                    <div key={i}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="ms-empty">
                  <span className="ms-ico ms-ico-muted"><Icon name="specs" size={20} /></span>
                  <p className="ms-empty-t">Sin ficha técnica</p>
                  <p className="ms-empty-p">Este equipo aún no tiene ficha técnica cargada.</p>
                </div>
              )
            ) : null}

            {tab === 'reviews' ? (
              rating.count > 0 ? (
                <div className="pd-reviews">
                  <div className="ms-panel pd-score">
                    <div className="pd-score-n ms-num">{rating.average.toFixed(1)}</div>
                    <div style={{ color: 'var(--color-primary)', margin: '10px 0 6px', display: 'flex', justifyContent: 'center' }}><Stars value={rating.average} size={17} /></div>
                    <div className="ms-small ms-muted">{rating.count} {rating.count === 1 ? 'opinión' : 'opiniones'}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {reviews.map((r) => (
                      <article key={r.id} className="pd-review">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <span className="pd-avatar" aria-hidden>{initialsOf(r.author)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {r.author}
                              {r.verified ? <span className="ms-chip ms-chip-ok"><Icon name="check" size={12} />Compra verificada</span> : null}
                            </div>
                            <div style={{ color: 'var(--color-primary)', display: 'flex', marginTop: 3 }}><Stars value={r.rating} size={13} /></div>
                          </div>
                          <span className="ms-small ms-muted" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtReviewDate(r.date)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{r.text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ms-empty">
                  <span className="ms-ico ms-ico-muted"><Icon name="star" size={20} /></span>
                  <p className="ms-empty-t">Aún no hay opiniones</p>
                  <p className="ms-empty-p">Las reseñas provienen de clientes que rentaron este equipo — podrás calificarlo desde <b>Mis compras</b> después de tu renta.</p>
                </div>
              )
            ) : null}

            {tab === 'qa' ? <ProductQuestions productId={product.id} /> : null}
          </div>
        </div>

        {/* Relacionados */}
        {related.length > 0 ? (
          <section className="pd-related">
            <div className="ms-sec-head">
              <h2 className="ms-h2">También te puede servir</h2>
            </div>
            <div className="ms-cards">
              {related.map((rp) => (
                <ProductCard key={rp.id} product={rp} theme={theme} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
