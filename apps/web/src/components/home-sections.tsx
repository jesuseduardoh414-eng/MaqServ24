import Link from 'next/link';
import Image from 'next/image';
import type { Theme } from '@maqserv/config';
import { t, CONTENT_CACHE } from '@/lib/theme';
import {
  getBlogs,
  getCategories,
  getFaqs,
  getHero,
  getProducts,
  getReviews,
  getSectors,
  getServices,
  getWhyChooseUs,
} from '@/lib/api';
import { categoryHref, categoryCountLabel } from '@/lib/category-link';
import { Carousel, Eyebrow } from '@/components/Carousel';
import { Icon, Stars, type IconName } from '@/components/Icon';
import { CategoryStrip } from '@/components/CategoryStrip';
import { CountUp } from '@/components/CountUp';
import { HomeProductGrid } from '@/components/HomeProductGrid';

/**
 * Secciones de la home con el diseño SEGAshop. Cada una:
 *  - toma su contenido de la BD (vía API) y sus textos de los copys del tema
 *  - se auto-omite (return null) si no hay datos
 *  - usa SOLO tokens (var(--...)) y variables derivadas de globals.css
 * El orden/visibilidad lo decide theme.tokens.sections (ver page.tsx).
 */

const CONTAINER: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };
const H2: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: '-.005em', margin: 0 };

/** Encabezado centrado (eyebrow + título + subtítulo opcional). */
function CenterHead({ eyebrow, title, subtitle, eyebrowColor, titleColor }: { eyebrow: string; title: string; subtitle?: string; eyebrowColor?: string; titleColor?: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 14, display: 'grid', justifyItems: 'center' }}>
      <Eyebrow color={eyebrowColor} tickColor={eyebrowColor}>{eyebrow}</Eyebrow>
      <h2 style={{ ...H2, fontSize: 'clamp(2rem, 4.4vw, 2.6rem)', marginBottom: 12, ...(titleColor ? { color: titleColor } : {}) }}>{title}</h2>
      {subtitle ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', maxWidth: 540, margin: 0, fontWeight: 300, lineHeight: 1.6 }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/* ============================= HERO ============================= */

export async function Hero({ theme }: { theme: Theme }) {
  const hero = await getHero().catch(() => null);
  const h = theme.tokens.hero; // ajustes configurables (colores, links, toggles, opacidad)
  const rawTitle = (hero?.title ?? t(theme, 'home.hero.title')).trim();
  const accent = t(theme, 'home.hero.titleAccent').trim();
  const hasAccent = !!accent && accent !== 'home.hero.titleAccent';
  // El título del CMS suele traer la frase ENTERA ("Encuentra maquinaria
  // disponible para tu obra") mientras el copy del acento es su segunda mitad:
  // al concatenarlos, el hero pintaba esa mitad dos veces. Si el título ya
  // termina en el acento, se recorta ahí y el acento se pinta una sola vez.
  const dup = hasAccent && rawTitle.toLowerCase().endsWith(accent.toLowerCase());
  const title = dup ? rawTitle.slice(0, rawTitle.length - accent.length).trim() : rawTitle;
  const subtitle = hero?.subtitle ?? t(theme, 'home.hero.subtitle');
  const badge = (hero?.badge ?? '').trim();
  const showBadge = h.showBadge && badge;

  const trust = [
    // Antes eran glifos del teclado. ⛟ y ▤ no existen en muchas fuentes: en
    // esas máquinas el hero mostraba dos cuadros vacíos donde va un icono.
    { icon: 'check' as IconName, title: t(theme, 'home.hero.trust1.title'), text: t(theme, 'home.hero.trust1.text') },
    { icon: 'specs' as IconName, title: t(theme, 'home.hero.trust2.title'), text: t(theme, 'home.hero.trust2.text') },
    { icon: 'truck' as IconName, title: t(theme, 'home.hero.trust3.title'), text: t(theme, 'home.hero.trust3.text') },
    { icon: 'mapPin' as IconName, title: t(theme, 'home.hero.trust4.title'), text: t(theme, 'home.hero.trust4.text') },
  ];

  return (
    <section style={{ position: 'relative', background: 'var(--band)', overflow: 'hidden' }}>
      {/* patrón de puntos + anillo giratorio (el círculo de acento va en el visual) */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '26px 26px', opacity: 0.5 }} />
      <div aria-hidden style={{ position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)', width: 520, height: 520, border: '1px dashed rgba(255,255,255,.12)', borderRadius: '50%', animation: 'spinSlow 60s linear infinite' }} />

      {/* El hero NO usa CONTAINER (1240 px): con el texto centrado en esa caja
          quedaban ~340 px de aire a la izquierda en pantallas grandes, el título
          se partía en más renglones y la banda crecía a lo alto. Caja más ancha
          + menos aire arriba = el mismo texto en menos renglones y un hero que
          ya no se come la pantalla de entrada. */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 clamp(16px, 3vw, 26px)', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(0,.92fr)', gap: 44, alignItems: 'center', paddingTop: 34, paddingBottom: 26 }} className="hero-grid">
        <div>
          {showBadge ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: `color-mix(in srgb, ${h.accentColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${h.accentColor} 35%, transparent)`, borderRadius: 'var(--radius-sm)', padding: '8px 15px', fontSize: '12px', fontWeight: 700, color: h.accentColor, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              <Icon name="star" size={13} fill /> {badge}
            </div>
          ) : null}
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', lineHeight: 1.02, letterSpacing: '-.01em', margin: showBadge ? '22px 0 0' : '0', color: h.titleColor, textTransform: 'uppercase' }}>
            {title}
            {hasAccent ? (
              <>
                {title ? <br /> : null}
                <span style={{ color: h.accentColor }}>{accent}</span>
              </>
            ) : null}
          </h1>
          <p style={{ color: h.subtitleColor, fontSize: '17.5px', lineHeight: 1.62, maxWidth: 460, margin: '22px 0 0', fontWeight: 300 }}>
            {subtitle}
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
            <Link href={h.primaryLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: h.primaryBg, color: h.primaryText, fontWeight: 700, fontSize: '15.5px', padding: '16px 28px', borderRadius: 'var(--radius-md)', textDecoration: 'none', boxShadow: `0 18px 34px -16px color-mix(in srgb, ${h.primaryBg} 60%, transparent)` }}>
              {t(theme, 'home.hero.ctaPrimary')} <Icon name="arrowRight" size={17} />
            </Link>
            <Link href={h.secondaryLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'transparent', color: '#fff', border: `1.5px solid ${h.secondaryBorder}`, fontWeight: 600, fontSize: '15.5px', padding: '16px 28px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>
              {t(theme, 'home.hero.ctaSecondary')}
            </Link>
          </div>

          {h.showTrust ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20, marginTop: 34 }}>
              {trust.map((it) => (
                <div key={it.title} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${h.accentColor} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: h.accentColor, flexShrink: 0 }}>
                    <Icon name={it.icon} size={19} />
                  </span>
                  <span>
                    <span style={{ display: 'block', color: '#fff', fontWeight: 700, fontSize: '13.5px' }}>{it.title}</span>
                    <span style={{ display: 'block', color: 'var(--grey)', fontSize: '11.5px', fontWeight: 300 }}>{it.text}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* visual */}
        <div style={{ position: 'relative', minHeight: 380 }} className="hero-visual">
          {/* círculo de acento: SOLO adorno, detrás y más pequeño que la imagen */}
          <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(340px, 72%)', aspectRatio: '1', borderRadius: '50%', background: h.accentColor, opacity: h.overlay / 100 }} />
          {/* imagen del producto (PNG transparente): más grande que el círculo, puede salirse de él */}
          {hero?.image ? (
            <span style={{ position: 'absolute', top: '50%', left: '52%', transform: 'translate(-50%, -50%)', width: 'min(560px, 118%)', aspectRatio: '1', zIndex: 1, display: 'block' }}>
              {/* La caja (span) queda IGUAL; solo la imagen escala → no altera el resto. */}
              <Image src={hero.image} alt="" fill priority sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'contain', transform: 'scale(1.45)', transformOrigin: 'center' }} />
            </span>
          ) : (
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, fontFamily: 'monospace', fontSize: '12px', color: 'rgba(0,0,0,.55)', background: 'rgba(255,255,255,.35)', padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}>PNG transparente</span>
          )}
          {h.showStats ? (
            <>
              <div style={{ position: 'absolute', zIndex: 2, left: -12, top: 36, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow)', animation: 'floatY 6s ease-in-out infinite' }}>
                <CountUp value={t(theme, 'home.hero.stat1.num')} style={{ fontWeight: 800, fontSize: '28px', color: 'var(--color-text)' }} />
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 300 }}>{t(theme, 'home.hero.stat1.label')}</div>
              </div>
              <div style={{ position: 'absolute', zIndex: 2, right: -6, bottom: 44, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 11, animation: 'floatY2 7s ease-in-out infinite' }}>
                <div style={{ color: h.accentColor }}><Stars value={5} size={13} /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-text)' }}>{t(theme, 'home.hero.stat2.num')}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 300 }}>{t(theme, 'home.hero.stat2.label')}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ========================= CATEGORÍAS ========================= */

export async function CategoriesSection({ theme }: { theme: Theme }) {
  const cs = theme.tokens.categories; // ajustes de presentación (locales a esta sección)
  if (!cs.show) return null;
  const categories = await getCategories();
  if (categories.length === 0) return null;
  // Copy con fallback: si la clave no existe en la BD, usa el valor por defecto.
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };
  const unit = t(theme, 'home.categories.unit');
  const eyebrowColor = cs.eyebrowColor ?? 'var(--color-accent)';
  const titleColor = cs.titleColor ?? 'var(--color-text)';
  const accent = cs.cardAccentColor ?? 'var(--color-primary)';
  // Regla de avance: múltiplo de perView ⇒ pagina de perView en perView; si no, de 1 en 1.
  const step = categories.length % cs.perView === 0 ? cs.perView : 1;
  return (
    <section style={{ ...CONTAINER, paddingTop: 82, paddingBottom: 40 }}>
      <CategoryStrip
        eyebrow={t(theme, 'home.categories.eyebrow')}
        title={t(theme, 'home.categories.title')}
        subtitle={cval('home.categories.subtitle', 'Maquinaria pesada lista para tu obra. Elige una categoría y solicita disponibilidad al instante.')}
        viewAllLabel={cval('home.categories.viewAll', 'Ver todas las categorías')}
        viewAllHref="/categorias"
        eyebrowColor={eyebrowColor}
        titleColor={titleColor}
        accentColor={accent}
        perView={cs.perView}
        step={step}
      >
        {categories.map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c)}
            data-cat-card
            className="lift cat-card"
            style={{ scrollSnapAlign: 'start', position: 'relative', display: 'block', height: cs.imageHeight, borderRadius: cs.cardRadius, overflow: 'hidden', textDecoration: 'none', color: 'var(--color-text)', background: 'var(--surface-2)', border: '1px solid var(--color-border)' }}
          >
            {/* Imagen a sangre (cover) */}
            {c.image ? (
              <Image src={c.image} alt={c.name} fill sizes="280px" className="zoom" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />
            )}
            {/* Velo oscuro para legibilidad del texto */}
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,8,.9) 2%, rgba(6,6,8,.35) 42%, rgba(6,6,8,0) 72%)' }} />
            {/* Nombre + conteo encima (abajo-izquierda) */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 16px 15px', display: 'grid', gap: 4 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '-.01em', lineHeight: 1.12 }}>{c.name}</span>
              <span style={{ color: accent, fontWeight: 700, fontSize: '12.5px' }}>{categoryCountLabel(c, unit)}</span>
            </div>
          </Link>
        ))}
      </CategoryStrip>
    </section>
  );
}

/* ======================= PRODUCTOS DESTACADOS ======================= */

export async function FeaturedSection({ theme }: { theme: Theme }) {
  const f = theme.tokens.featured ?? { limit: 8, showTabs: true, align: 'left' as const, eyebrowColor: null, titleColor: null };
  const [featured, categories] = await Promise.all([
    getProducts({ featured: true }).then((r) => r.items).catch(() => []),
    getCategories().catch(() => []),
  ]);
  const products = (featured.length > 0 ? featured : (await getProducts({}).catch(() => ({ items: [] }))).items).slice(0, f.limit);
  if (products.length === 0) return null;

  const isCenter = f.align === 'center';
  return (
    <section style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 80 }}>
        {/* Encabezado (alineación configurable) + "Ver todo" */}
        {isCenter ? (
          <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', marginBottom: 4 }}>
            <Eyebrow color={f.eyebrowColor ?? undefined}>{t(theme, 'home.featured.eyebrow')}</Eyebrow>
            <h2 style={{ ...H2, fontSize: 'clamp(2rem, 4.4vw, 2.6rem)', margin: '0 0 12px', color: f.titleColor ?? undefined }}>{t(theme, 'home.featured.title')}</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', margin: 0, fontWeight: 300, lineHeight: 1.6, maxWidth: 560 }}>{t(theme, 'home.featured.subtitle')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 620 }}>
              <Eyebrow color={f.eyebrowColor ?? undefined}>{t(theme, 'home.featured.eyebrow')}</Eyebrow>
              <h2 style={{ ...H2, fontSize: 'clamp(2rem, 4.4vw, 2.6rem)', margin: '0 0 12px', color: f.titleColor ?? undefined }}>{t(theme, 'home.featured.title')}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', margin: 0, fontWeight: 300, lineHeight: 1.6 }}>{t(theme, 'home.featured.subtitle')}</p>
            </div>
            <Link href="/productos" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 10, border: '1.5px solid var(--color-text)', color: 'var(--color-text)', fontWeight: 700, fontSize: '14.5px', padding: '13px 24px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>
              {t(theme, 'home.featured.viewAll')} <Icon name="arrowRight" size={17} />
            </Link>
          </div>
        )}
        <HomeProductGrid
          products={products}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          theme={theme}
          align={f.align}
          showTabs={f.showTabs}
        />
        {isCenter ? (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href="/productos" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, border: '1.5px solid var(--color-text)', color: 'var(--color-text)', fontWeight: 700, fontSize: '15px', padding: '15px 30px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>
              {t(theme, 'home.featured.viewAll')} <Icon name="arrowRight" size={17} />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ======================= POR QUÉ ELEGIRNOS ======================= */

export async function WhyChooseUsSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.whyChooseUs;
  if (cfg && cfg.show === false) return null;
  // Solo las razones marcadas para el home (o ambas); las de 'about' se omiten aquí.
  const items = (await getWhyChooseUs()).filter((w) => w.placement !== 'about');
  if (items.length === 0) return null;

  // Imagen principal: solo la del token (se sube en «Imagen y estilo»). Las
  // razones son texto ◆ sin imagen. Colores: el token manda; null ⇒ tema.
  const image = cfg?.image ?? null;
  const statsBg = cfg?.statsBg ?? 'var(--color-primary)';
  const statsFg = cfg?.statsFg ?? 'var(--color-primary-fg)';
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  const stats = [
    { num: t(theme, 'home.whyChooseUs.stat1.num'), label: t(theme, 'home.whyChooseUs.stat1.label') },
    { num: t(theme, 'home.whyChooseUs.stat2.num'), label: t(theme, 'home.whyChooseUs.stat2.label') },
    { num: t(theme, 'home.whyChooseUs.stat3.num'), label: t(theme, 'home.whyChooseUs.stat3.label') },
  ];
  return (
    <section style={{ ...CONTAINER, paddingTop: 88, paddingBottom: 88 }}>
      {/* `minmax(300px,…)` mantenía 2 columnas hasta muy abajo: en tablet daba
          dos columnas de ~356px y el texto (4 razones + 3 cifras) no respiraba.
          `.why-grid` lo apila a partir de 900px. */}
      <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center' }}>
        <div style={{ position: 'relative', minHeight: 420 }} className="why-visual">
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)', background: 'var(--surface-2)' }}>
            {image ? (
              <Image src={image} alt="" fill sizes="(max-width:900px) 100vw, 45vw" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="ph" style={{ position: 'absolute', inset: 0 }} />
            )}
          </div>
          {cfg?.showYearsBadge !== false ? (
            // `right: -18` la saca del marco a propósito (diseño). En móvil eso
            // la dejaba fuera de la pantalla: `.why-badge` la mete al borde.
            <div className="why-badge" style={{ position: 'absolute', right: -18, top: 44, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow)', animation: 'floatY 6s ease-in-out infinite' }}>
              <CountUp value={t(theme, 'home.whyChooseUs.years.num')} style={{ fontWeight: 800, fontSize: '30px', color: 'var(--color-text)' }} />
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: 300 }}>{t(theme, 'home.whyChooseUs.years.label')}</div>
            </div>
          ) : null}
        </div>

        <div>
          <Eyebrow color={cfg?.eyebrowColor ?? undefined} tickColor={cfg?.eyebrowColor ?? undefined}>{t(theme, 'home.whyChooseUs.eyebrow')}</Eyebrow>
          <h2 style={{ ...H2, fontSize: 'clamp(2rem, 4vw, 2.5rem)', marginBottom: 16, ...(cfg?.titleColor ? { color: cfg.titleColor } : {}) }}>{t(theme, 'home.whyChooseUs.title')}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '16.5px', lineHeight: 1.62, maxWidth: 470, margin: '0 0 30px', fontWeight: 300 }}>
            {t(theme, 'home.whyChooseUs.subtitle')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '22px 30px', marginBottom: 34 }}>
            {items.map((w) => (
              <div key={w.id}>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9, color: 'var(--color-text)' }}>
                  <Icon name="diamond" size={14} style={{ color: accent }} />{w.title}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', lineHeight: 1.55, fontWeight: 300 }}>{w.description}</div>
              </div>
            ))}
          </div>
          {cfg?.showStats !== false ? (
            <div className="why-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: statsBg, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 18px 36px -20px color-mix(in srgb, var(--color-primary) 85%, transparent)' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ padding: '22px 16px', textAlign: 'center', color: statsFg, borderRight: i < 2 ? `1px solid color-mix(in srgb, ${statsFg} 14%, transparent)` : 'none' }}>
                  <CountUp value={s.num} style={{ fontWeight: 800, fontSize: '28px', display: 'block' }} />
                  <div style={{ fontSize: '12px', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ======================= SECTORES ESTRATÉGICOS ======================= */

export async function SectorsSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.sectors;
  if (cfg && cfg.show === false) return null;
  const sectors = (await getSectors()).slice(0, cfg?.limit ?? 4);
  if (sectors.length === 0) return null;
  const cardH = cfg?.cardHeight ?? 340;
  const ctaColor = cfg?.ctaColor ?? 'var(--color-primary)';
  return (
    <section style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ ...CONTAINER, paddingTop: 78, paddingBottom: 78 }}>
        <div style={{ marginBottom: 44 }}>
          <CenterHead eyebrow={t(theme, 'home.sectors.eyebrow')} title={t(theme, 'home.sectors.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22 }}>
          {sectors.map((s) => (
            <Link
              key={s.id}
              href={`/sectores/${s.slug}`}
              className="lift"
              style={{ position: 'relative', height: cardH, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)', textDecoration: 'none', display: 'block' }}
            >
              {s.image ? (
                <Image src={s.image} alt={s.title} fill sizes="(max-width:640px) 100vw, 25vw" className="zoom" style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />
              )}
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,26,27,.94) 8%, rgba(26,26,27,.2) 60%, transparent)' }} />
              <span style={{ position: 'absolute', left: 20, right: 20, bottom: 20, color: '#fff' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '16px', marginBottom: 8, letterSpacing: '.01em' }}>{s.title}</span>
                {s.description ? (
                  // La tarjeta tiene alto fijo (token `cardHeight`): sin recortar,
                  // una descripción larga empujaba el CTA fuera de la tarjeta.
                  // Sin `display` inline: lo fija `.sector-desc` (recorte a 3
                  // líneas), y un inline le ganaría a la clase.
                  <span className="sector-desc" style={{ fontSize: '12.5px', color: 'rgba(255,255,255,.78)', lineHeight: 1.5, marginBottom: 12, fontWeight: 300 }}>{s.description}</span>
                ) : null}
                <span style={{ color: ctaColor, fontWeight: 700, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{t(theme, 'home.sectors.cta')}<Icon name="arrowRight" size={13} /></span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================= OFERTA ============================= */

export async function OfferSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.offer;
  if (cfg && cfg.show === false) return null;
  const bg = cfg?.bg ?? 'var(--band)';
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  const titleColor = cfg?.titleColor ?? '#fff';
  const ctaLink = cfg?.ctaLink || '/productos';
  return (
    <section style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 80 }}>
      {/* Borde gunmetal: en oscuro la banda es negra como la página, y sin él
          la tarjeta perdería su silueta. El gris va aquí, en el elemento. */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)', background: bg, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow)' }}>
        <div aria-hidden style={{ position: 'absolute', right: '-4%', top: '-30%', width: 440, height: 440, background: `radial-gradient(circle, color-mix(in srgb, ${accent} 32%, transparent), transparent 62%)`, borderRadius: '50%' }} />
        <div aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '44%', backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 15px, transparent 15px 30px)', borderLeft: '1px solid rgba(255,255,255,.06)' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 30, alignItems: 'center', padding: 'clamp(32px, 5vw, 50px)' }}>
          <div>
            <span style={{ display: 'inline-block', background: accent, color: 'var(--color-primary-fg)', fontWeight: 800, fontSize: '12px', letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 18 }}>
              {t(theme, 'home.offer.badge')}
            </span>
            <h2 style={{ ...H2, fontSize: 'clamp(1.8rem, 3.6vw, 2.3rem)', lineHeight: 1.08, color: titleColor, margin: '0 0 14px' }}>{t(theme, 'home.offer.title')}</h2>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: '15.5px', maxWidth: 440, margin: '0 0 26px', lineHeight: 1.55, fontWeight: 300 }}>{t(theme, 'home.offer.subtitle')}</p>
            <Link href={ctaLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: accent, color: 'var(--color-primary-fg)', fontWeight: 700, fontSize: '15px', padding: '15px 28px', borderRadius: 'var(--radius-md)', textDecoration: 'none', boxShadow: `0 16px 32px -16px color-mix(in srgb, ${accent} 95%, transparent)` }}>
              {t(theme, 'home.offer.cta')} <Icon name="arrowRight" size={17} />
            </Link>
          </div>
          <div style={{ position: 'relative', height: 230, borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}>
            {cfg?.image ? (
              <Image src={cfg.image} alt="" fill sizes="(max-width:900px) 100vw, 45vw" style={{ objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 15px, rgba(255,255,255,.02) 15px 30px)' }} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================= RESEÑAS ============================= */

export async function ReviewsSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.reviews;
  if (cfg && cfg.show === false) return null;
  const reviews = await getReviews(cfg?.limit ?? 8);
  if (reviews.length === 0) return null;
  const role = t(theme, 'home.reviews.role');
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  return (
    <section style={{ ...CONTAINER, paddingTop: 20, paddingBottom: 80 }}>
      <Carousel eyebrow={t(theme, 'home.reviews.eyebrow')} title={t(theme, 'home.reviews.title')} step={422} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined}>
        {reviews.map((r) => (
          <figure
            key={r.id}
            style={{ margin: 0, scrollSnapAlign: 'start', flex: '0 0 min(400px, 84vw)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 30, boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', lineHeight: 0.6, color: accent }}>&ldquo;</div>
            <div style={{ color: accent, margin: '8px 0 14px' }}>
              <Stars value={r.rating} size={15} />
            </div>
            <blockquote style={{ fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px', fontWeight: 300, color: 'var(--color-text)' }}>{r.review}</blockquote>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-secondary)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.author.charAt(0).toUpperCase()}
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>{r.author}</span>
                <span style={{ display: 'block', color: 'var(--grey)', fontSize: '12.5px', fontWeight: 300 }}>{r.product ? r.product : role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </Carousel>
    </section>
  );
}

/* ============================= MARCAS ============================= */

export async function BrandsSection({ theme }: { theme: Theme }) {
  // Del token `brands`, que es la MISMA lista que pinta /quienes-somos. Antes esto
  // leía el copy `home.brands.list` y las dos listas ya habían divergido.
  const brands = theme.tokens.brands;
  const list = brands.list.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  const loop = [...list, ...list]; // duplicado para marquee sin costura
  return (
    <section style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', overflow: 'hidden', padding: '34px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 22, color: 'var(--grey)', fontSize: '12px', letterSpacing: '.18em', fontWeight: 700, textTransform: 'uppercase' }}>
        {brands.title}
      </div>
      <div className="marquee-mask" style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 26, whiteSpace: 'nowrap', alignItems: 'center' }}>
          {loop.map((b, i) => (
            <div key={`${b}-${i}`} style={{ flex: '0 0 auto', height: 52, width: 140, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: 'var(--grey)', background: 'var(--surface-2)' }}>
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================= FAQ ============================= */

export async function FaqSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.faq;
  if (cfg && cfg.show === false) return null;
  const faqs = await getFaqs();
  if (faqs.length === 0) return null;
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  return (
    // `id` para poder enlazar aquí desde Ayuda (/#faq); no hay página /faq propia.
    <section id="faq" style={{ maxWidth: 840, margin: '0 auto', padding: '80px clamp(16px, 4vw, 26px) 40px', scrollMarginTop: 90 }}>
      <div style={{ marginBottom: 38 }}>
        <CenterHead eyebrow={t(theme, 'home.faq.eyebrow')} title={t(theme, 'home.faq.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map((f) => (
          <details key={f.id} name="home-faq" className="faq" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: 'var(--color-text)' }}>
              {f.question}
              <span className="faq-plus" style={{ fontSize: '22px', color: accent, flexShrink: 0 }}>+</span>
            </summary>
            <div
              style={{ padding: '0 24px 22px', color: 'var(--color-text-muted)', fontSize: '14.5px', lineHeight: 1.6, fontWeight: 300 }}
              dangerouslySetInnerHTML={{ __html: f.answer }}
            />
          </details>
        ))}
      </div>
    </section>
  );
}

/* ============ Secciones opcionales (desactivadas por defecto) ============ */

export async function ServicesSection({ theme }: { theme: Theme }) {
  const services = await getServices();
  if (services.length === 0) return null;
  return (
    <section style={{ ...CONTAINER, paddingTop: 60, paddingBottom: 60 }}>
      <div style={{ marginBottom: 30 }}>
        {/* Mismo arreglo que en Blog: el eyebrow es su propio copy. */}
        <CenterHead eyebrow={t(theme, 'home.services.eyebrow')} title={t(theme, 'home.services.title')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
        {services.map((s) => (
          <div key={s.id} className="lift" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ position: 'relative', aspectRatio: '16 / 9' }}>
              {s.photo ? <Image src={s.photo} alt={s.title} fill sizes="33vw" className="zoom" style={{ objectFit: 'cover' }} /> : <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />}
            </div>
            <div style={{ padding: 18, display: 'grid', gap: '.4rem' }}>
              <strong>{s.title}</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', fontWeight: 300 }}>{s.text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export async function BlogSection({ theme }: { theme: Theme }) {
  // Cuántas entradas: configurable en el módulo Blog. Antes estaba fijo en 3.
  const blogs = await getBlogs(theme.tokens.blog.limit);
  if (blogs.length === 0) return null;
  return (
    <section style={{ ...CONTAINER, paddingTop: 60, paddingBottom: 60 }}>
      <div style={{ marginBottom: 30 }}>
        {/* eyebrow y título son copys DISTINTOS: pasar el mismo a los dos hacía
            que `CenterHead` lo pintara duplicado. */}
        <CenterHead eyebrow={t(theme, 'home.blog.eyebrow')} title={t(theme, 'home.blog.title')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {blogs.map((b) => (
          <Link key={b.id} href={`/blog/${b.slug}`} className="lift" style={{ textDecoration: 'none', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'block' }}>
            <span style={{ position: 'relative', aspectRatio: '16 / 9', display: 'block' }}>
              {b.image ? <Image src={b.image} alt={b.title} fill sizes="33vw" className="zoom" style={{ objectFit: 'cover' }} /> : <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />}
            </span>
            <span style={{ padding: 18, display: 'grid', gap: '.4rem' }}>
              <strong style={{ lineHeight: 1.3 }}>{b.title}</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', fontWeight: 300 }}>{b.excerpt}</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{t(theme, 'home.blog.readMore')}<Icon name="arrowRight" size={13.5} /></span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

