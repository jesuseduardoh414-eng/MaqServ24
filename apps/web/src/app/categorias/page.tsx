import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';
import Image from 'next/image';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { categoryHref, categoryCountLabel } from '@/lib/category-link';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { Band } from '@/components/Band';

// Panel de la imagen de tarjeta. Era claro; pasa a grafito por lo mismo que el
// del catálogo: el manual pone negro y grafito como fondos prioritarios.
const PANEL =
  'linear-gradient(160deg, color-mix(in srgb, var(--color-surface) 88%, var(--color-text) 4%) 0%, var(--color-bg) 100%)';

/** Estilos propios de la vista (prefijo `cv-`). Tarjetas del sistema: radio 12, borde 1 px. */
const CSS = `
.cv-card{ display:flex; flex-direction:column; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; overflow:hidden; text-decoration:none; color:var(--color-text); min-width:0; transition:border-color .18s ease; }
.cv-card:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.cv-card:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.cv-media{ position:relative; background:${PANEL}; border-bottom:1px solid var(--color-border); }
.cv-img{ transition:transform .3s ease; }
.cv-card:hover .cv-img{ transform:scale(1.03); }
.cv-body{ padding:16px 18px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex:1; }
.cv-name{ margin:0; font-size:16px; font-weight:600; line-height:1.3; letter-spacing:-.005em; }
.cv-desc{ margin:4px 0 0; font-size:13.5px; line-height:1.45; color:var(--color-text-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.cv-count{ margin:6px 0 0; font-size:13px; color:var(--color-text-muted); }
.cv-arrow{ flex-shrink:0; color:var(--color-text-muted); transition:transform .18s ease, color .18s ease; display:flex; }
.cv-card:hover .cv-arrow{ color:var(--color-primary); transform:translateX(3px); }
.cv-featured{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); margin-bottom:16px; }
.cv-featured .cv-media{ min-height:280px; border-bottom:none; border-right:1px solid var(--color-border); }
.cv-featured-body{ padding:clamp(22px, 3.4vw, 40px); display:grid; align-content:center; justify-items:start; gap:10px; }
.cv-featured-name{ margin:0; font-family:var(--font-display); font-size:clamp(22px, 2.6vw, 28px); font-weight:700; letter-spacing:-.02em; line-height:1.2; }
@media (max-width: 760px){
  .cv-featured{ grid-template-columns:minmax(0,1fr); }
  .cv-featured .cv-media{ min-height:200px; border-right:none; border-bottom:1px solid var(--color-border); }
}
@media (prefers-reduced-motion: reduce){ .cv-img, .cv-arrow{ transition:none; } }
`;

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/categorias', titulo: t(theme, 'seo.categories.title'), descripcion: t(theme, 'seo.categories.description') });
}

/**
 * Vista dedicada de categorías (/categorias): hero → grid de categorías → promo.
 * Contenido de las tarjetas = categorías del catálogo; el hero, el promo y la
 * presentación viven en theme.tokens.categoriesView (editable en Sección 2 · Vista).
 *
 * Rejilla del sistema (2026-09-30): `auto-fill` con mínimo de 260 px, no un
 * número fijo de columnas; la destacada sigue arriba en grande.
 */
export default async function CategoriasPage() {
  const [theme, categories] = await Promise.all([getTheme(), getCategories()]);
  const cv = theme.tokens.categoriesView;
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    // Vacío cuenta como ausente: en producción el título estaba guardado como
    // '' y la página salía con un <h1> sin texto.
    return v === key || !v.trim() ? def : v;
  };
  const unit = t(theme, 'home.categories.unit');
  const titleColor = cv.titleColor ?? 'var(--color-text)';

  const title = cval('home.categoriesPage.title', 'Todas las categorías');

  const featured = cv.featuredSlug ? categories.find((c) => c.slug === cv.featuredSlug) : null;
  const rest = featured ? categories.filter((c) => c.slug !== featured.slug) : categories;

  type CatItem = { id: number; name: string; slug: string; image: string | null; description: string | null; productCount: number };

  /** Tarjeta grande horizontal (la destacada). */
  const bigCard = (c: CatItem) => (
    <Link key={`big-${c.id}`} href={categoryHref(c)} className="cv-card cv-featured">
      <div className="cv-media">
        {c.image ? (
          <Image src={c.image} alt={c.name} fill sizes="(max-width:760px) 100vw, 620px" className="cv-img" style={{ objectFit: 'contain', padding: 30 }} />
        ) : (
          <span className="ph" style={{ position: 'absolute', inset: 0 }} />
        )}
      </div>
      <div className="cv-featured-body">
        <span className="ms-chip ms-chip-info"><Icon name="star" size={12} fill />Destacada</span>
        <h2 className="cv-featured-name" style={{ color: titleColor }}>{c.name}</h2>
        {c.description ? <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 15, lineHeight: 1.55 }}>{c.description}</p> : null}
        <p className="ms-small ms-muted" style={{ margin: 0 }}>{categoryCountLabel(c, unit)}</p>
        {/* Sin equipos la tarjeta lleva a cotizar (categoryHref): el botón no puede prometer "Ver equipos". */}
        <span className="ms-btn" style={{ marginTop: 6 }}>{c.productCount > 0 ? 'Ver equipos' : 'Solicitar cotización'}<Icon name="arrowRight" size={15} /></span>
      </div>
    </Link>
  );

  /** Tarjeta de catálogo (imagen arriba, texto abajo). */
  const catCard = (c: CatItem) => (
    <Link key={c.id} href={categoryHref(c)} className="cv-card">
      <div className="cv-media" style={{ height: Math.min(cv.imageHeight ?? 200, 220) }}>
        {c.image ? (
          <Image src={c.image} alt={c.name} fill sizes="(max-width:560px) 100vw, (max-width:980px) 50vw, 400px" className="cv-img" style={{ objectFit: 'contain', padding: 20 }} />
        ) : (
          <span className="ph" style={{ position: 'absolute', inset: 0 }} />
        )}
      </div>
      <div className="cv-body">
        <div style={{ minWidth: 0 }}>
          <h2 className="cv-name">{c.name}</h2>
          {c.description ? <p className="cv-desc">{c.description}</p> : null}
          <p className="cv-count">{categoryCountLabel(c, unit)}</p>
        </div>
        <span className="cv-arrow"><Icon name="arrowRight" size={18} /></span>
      </div>
    </Link>
  );

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: t(theme, 'nav.categories') }])} />
      <style>{CSS}</style>
      <main className="ms-page">
        {/* Hero superior (configurable) */}
        {/* Es un anuncio: el h1 de la página es el del encabezado, más abajo. */}
        {cv.hero?.enabled ? <Band block={cv.hero} kind="hero" maxWidth={1180} titleTag="p" /> : null}

        <section className="ms-wrap">
          <header className="ms-head">
            <div className="ms-head-txt">
              <p className="ms-kicker" style={cv.eyebrowColor ? { color: cv.eyebrowColor } : undefined}>{cval('home.categoriesPage.eyebrow', 'Catálogo')}</p>
              <h1 className="ms-title" style={{ color: titleColor }}>{title}</h1>
              <p className="ms-desc">
                {cval('home.categoriesPage.subtitle', 'Explora nuestra maquinaria por categoría y solicita disponibilidad al instante.')}
              </p>
            </div>
          </header>

          {categories.length === 0 ? (
            <div className="ms-empty">
              <span className="ms-ico ms-ico-muted"><Icon name="grid" size={20} /></span>
              <p className="ms-empty-t">Aún no hay categorías</p>
              <p className="ms-empty-p">Mientras tanto puedes ver todos los servicios o pedir una cotización.</p>
              <div className="ms-empty-acts">
                <Link href="/servicios" className="ms-link">Ver servicios <Icon name="arrowRight" size={14} /></Link>
                <Link href="/cotizar" className="ms-link ms-link-muted">Cotizar <Icon name="arrowRight" size={14} /></Link>
              </div>
            </div>
          ) : null}

          {/* Destacada grande arriba */}
          {featured ? bigCard(featured) : null}

          {rest.length ? <div className="ms-cards">{rest.map(catCard)}</div> : null}
        </section>

        {/* Promo/anuncio inferior (configurable) */}
        {cv.promo?.enabled ? <Band block={cv.promo} kind="promo" maxWidth={1180} /> : null}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
