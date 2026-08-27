import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { categoryHref, categoryCountLabel } from '@/lib/category-link';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { Band } from '@/components/Band';

const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };
// Panel de la imagen de tarjeta. Era claro; pasa a grafito por lo mismo que el
// del catálogo: el manual pone negro y grafito como fondos prioritarios.
const PANEL =
  'linear-gradient(160deg, color-mix(in srgb, var(--color-surface) 88%, var(--color-text) 4%) 0%, var(--color-bg) 100%)';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `Categorías — ${t(theme, 'site.name')}` };
}

/**
 * Vista dedicada de categorías (/categorias): hero → grid de categorías → promo.
 * Contenido de las tarjetas = categorías del catálogo; el hero, el promo y la
 * presentación viven en theme.tokens.categoriesView (editable en Sección 2 · Vista).
 */
export default async function CategoriasPage() {
  const [theme, categories] = await Promise.all([getTheme(), getCategories()]);
  const cv = theme.tokens.categoriesView;
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };
  const unit = t(theme, 'home.categories.unit');
  const eyebrowColor = cv.eyebrowColor ?? 'var(--color-accent)';
  const titleColor = cv.titleColor ?? 'var(--color-text)';
  const accent = cv.cardAccentColor ?? 'var(--color-primary)';

  const title = cval('home.categoriesPage.title', 'Todas las categorías');
  const parts = title.trim().split(' ');
  const last = parts.length > 1 ? parts.pop() : null;
  const head = parts.join(' ');

  const featured = cv.featuredSlug ? categories.find((c) => c.slug === cv.featuredSlug) : null;
  const rest = featured ? categories.filter((c) => c.slug !== featured.slug) : categories;

  type CatItem = { id: number; name: string; slug: string; image: string | null; productCount: number };

  // Layout "parejo": las filas de tarjetas van completas (cv.columns). Si sobra
  // 1 tarjeta (fila coja), se muestra GRANDE (como la destacada); si sobran 2,
  // se estiran a una fila completa. Así nunca queda un huérfano suelto.
  const cols = cv.columns;
  const r = rest.length % cols;
  const gridItems = r === 0 ? rest : rest.slice(0, rest.length - r);
  const tail = r === 0 ? [] : rest.slice(rest.length - r);

  /** Tarjeta grande horizontal (destacada y sobrantes de 1). */
  const bigCard = (c: CatItem, isFeatured = false) => (
    <Link
      key={`big-${c.id}`}
      href={categoryHref(c)}
      className="lift cat-card cat-featured"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: cv.cardRadius, overflow: 'hidden', textDecoration: 'none', color: 'var(--color-text)' }}
    >
      <div style={{ position: 'relative', minHeight: 280, background: PANEL }}>
        {c.image ? (
          <Image src={c.image} alt={c.name} fill sizes="(max-width:980px) 100vw, 620px" className="zoom" style={{ objectFit: 'contain', padding: 30 }} />
        ) : (
          <span className="ph" style={{ position: 'absolute', inset: 0 }} />
        )}
      </div>
      <div style={{ padding: 'clamp(1.6rem, 3.4vw, 2.8rem)', display: 'grid', alignContent: 'center', gap: '.85rem' }}>
        {isFeatured ? (
          <span style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 7, background: accent, color: 'var(--color-primary-fg)', borderRadius: 'var(--radius-sm)', padding: '5px 14px', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em' }}><Icon name="star" size={12} fill /> Destacada</span>
        ) : null}
        <h2 style={{ margin: 0, fontSize: 'clamp(1.7rem, 3.4vw, 2.6rem)', textTransform: 'uppercase', color: titleColor, lineHeight: 1.03, letterSpacing: '-.01em' }}>{c.name}</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 16, fontWeight: 300 }}>{categoryCountLabel(c, unit)}</p>
        <span style={{ marginTop: '.5rem', justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 9, background: accent, color: 'var(--color-primary-fg)', fontWeight: 800, padding: '13px 24px', borderRadius: 'var(--radius-md)', fontSize: 15 }}>Ver equipos<Icon name="arrowRight" size={15} /></span>
      </div>
    </Link>
  );

  /** Tarjeta catálogo (imagen arriba, texto abajo). */
  const catCard = (c: CatItem) => (
    <Link
      key={c.id}
      href={categoryHref(c)}
      className="lift cat-card"
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: cv.cardRadius, overflow: 'hidden', textDecoration: 'none', color: 'var(--color-text)' }}
    >
      <div style={{ position: 'relative', height: cv.imageHeight, background: PANEL }}>
        {c.image ? (
          <Image src={c.image} alt={c.name} fill sizes="(max-width:560px) 100vw, (max-width:980px) 50vw, 400px" className="zoom" style={{ objectFit: 'contain', padding: 20 }} />
        ) : (
          <span className="ph" style={{ position: 'absolute', inset: 0 }} />
        )}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1.06rem', letterSpacing: '-.01em', lineHeight: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13.5, marginTop: 4, fontWeight: 400 }}>{categoryCountLabel(c, unit)}</div>
        </div>
        <span className="cat-arrow" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: accent, color: 'var(--color-primary-fg)', display: 'grid', placeItems: 'center' }}><Icon name="arrowRight" size={17} /></span>
      </div>
    </Link>
  );

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)' }}>
        {/* Hero superior (configurable) */}
        {cv.hero?.enabled ? <Band block={cv.hero} kind="hero" /> : null}

        <section style={{ ...CONTAINER, paddingTop: 62, paddingBottom: 78 }}>
          {/* Encabezado del grid */}
          <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', marginBottom: 44 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: eyebrowColor, fontWeight: 700, fontSize: '12.5px', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 12 }}>
              <span style={{ width: 24, height: 3, background: accent }} />{cval('home.categoriesPage.eyebrow', 'Catálogo')}
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4.4vw, 2.9rem)', textTransform: 'uppercase', letterSpacing: '-.01em', margin: 0, color: titleColor, lineHeight: 1.03 }}>
              {last ? head : title}{last ? <> <span style={{ color: accent }}>{last}</span></> : null}
            </h1>
            <p style={{ margin: '14px 0 0', color: 'var(--color-text-muted)', fontSize: '16px', lineHeight: 1.6, maxWidth: 560, fontWeight: 300 }}>
              {cval('home.categoriesPage.subtitle', 'Explora nuestra maquinaria por categoría y solicita disponibilidad al instante.')}
            </p>
          </div>

          {categories.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Aún no hay categorías.</p>
          ) : null}

          {/* Destacada grande arriba */}
          {featured ? <div style={{ marginBottom: 24 }}>{bigCard(featured, true)}</div> : null}

          {/* Filas completas de tarjetas catálogo */}
          {gridItems.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 24, marginBottom: tail.length ? 24 : 0 }} className="cat-grid" data-cols={cols}>
              {gridItems.map(catCard)}
            </div>
          ) : null}

          {/* Sobrante: 1 → tarjeta grande (pareja con la destacada); 2+ → fila estirada */}
          {tail.length === 1 ? bigCard(tail[0]) : null}
          {tail.length >= 2 ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tail.length}, minmax(0, 1fr))`, gap: 24 }} className="cat-grid">
              {tail.map(catCard)}
            </div>
          ) : null}
        </section>

        {/* Promo/anuncio inferior (configurable) */}
        {cv.promo?.enabled ? <Band block={cv.promo} kind="promo" /> : null}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
