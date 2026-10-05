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
/**
 * Título de sección del home (sistema de diseño 2026-09-30): tipo oración,
 * sin MAYÚSCULAS forzadas, hasta 34 px. Solo el hero lleva un titular grande.
 */
const H2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.15, margin: 0, textWrap: 'balance' };
const SUB: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '15.5px', lineHeight: 1.6, margin: 0, textWrap: 'pretty' };
const CARD_RADIUS = 12;

/** Encabezado centrado (kicker + título + subtítulo opcional). */
function CenterHead({ eyebrow, title, subtitle, eyebrowColor, titleColor }: { eyebrow: string; title: string; subtitle?: string; eyebrowColor?: string; titleColor?: string }) {
  return (
    <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center' }}>
      <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
      <h2 style={{ ...H2, maxWidth: '24ch', ...(titleColor ? { color: titleColor } : {}) }}>{title}</h2>
      {subtitle ? <p style={{ ...SUB, maxWidth: 560, marginTop: 10 }}>{subtitle}</p> : null}
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
      {/* Patrón de puntos discreto. El anillo punteado que giraba se retiró:
          el sistema pide movimiento corto, no adornos en bucle. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '26px 26px', opacity: 0.5 }} />

      {/* El hero NO usa CONTAINER (1240 px): con el texto centrado en esa caja
          quedaban ~340 px de aire a la izquierda en pantallas grandes, el título
          se partía en más renglones y la banda crecía a lo alto. Caja más ancha
          + menos aire arriba = el mismo texto en menos renglones y un hero que
          ya no se come la pantalla de entrada. */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 clamp(16px, 3vw, 26px)', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(0,.92fr)', gap: 44, alignItems: 'center', paddingTop: 34, paddingBottom: 26 }} className="hero-grid">
        <div>
          {showBadge ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `color-mix(in srgb, ${h.accentColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${h.accentColor} 35%, transparent)`, borderRadius: 8, padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: h.accentColor }}>
              <Icon name="star" size={13} fill /> {badge}
            </div>
          ) : null}
          {/* Único titular grande del sitio: máx. 56 px, tipo oración (sin
              MAYÚSCULAS forzadas). El acento solo cambia el color del texto. */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.25rem, 4.4vw, 3.5rem)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-.02em', margin: showBadge ? '20px 0 0' : '0', color: h.titleColor, textWrap: 'balance' }}>
            {title}
            {hasAccent ? (
              <>
                {title ? <br /> : null}
                <span style={{ color: h.accentColor }}>{accent}</span>
              </>
            ) : null}
          </h1>
          {/* `pre-line`: el texto del hero trae dos párrafos separados por una
              línea en blanco (lo que se ofrece / qué decirnos). Sin esto se
              pintaban pegados en un solo bloque. */}
          <p style={{ color: h.subtitleColor, fontSize: '16.5px', lineHeight: 1.6, maxWidth: 540, margin: '20px 0 0', whiteSpace: 'pre-line', textWrap: 'pretty' }}>
            {subtitle}
          </p>
          {/* Botones del sistema (`ms-btn`): colores y enlaces siguen saliendo
              del tema; el texto va tal cual lo escribe el panel. */}
          <div className="ms-hero-acts" style={{ marginTop: 28 }}>
            <Link href={h.primaryLink} data-evento="cta_hero_primario" className="ms-btn ms-btn-lg" style={{ background: h.primaryBg, color: h.primaryText }}>
              {t(theme, 'home.hero.ctaPrimary')} <Icon name="arrowRight" size={17} />
            </Link>
            <Link href={h.secondaryLink} data-evento="cta_hero_secundario" className="ms-btn ms-btn-lg ms-btn-sec" style={{ color: '#fff', borderColor: h.secondaryBorder }}>
              {t(theme, 'home.hero.ctaSecondary')}
            </Link>
          </div>

          {h.showTrust ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 18, marginTop: 32 }}>
              {trust.map((it) => (
                <div key={it.title} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <span className="ms-ico" aria-hidden style={{ color: h.accentColor, background: `color-mix(in srgb, ${h.accentColor} 12%, transparent)`, borderColor: `color-mix(in srgb, ${h.accentColor} 28%, transparent)` }}>
                    <Icon name={it.icon} size={18} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: '#fff', fontWeight: 600, fontSize: '13.5px' }}>{it.title}</span>
                    <span style={{ display: 'block', color: 'var(--grey)', fontSize: '12.5px' }}>{it.text}</span>
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
              <Image src={hero.image} alt={`${title} ${accent}`.trim()} fill priority sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'contain', transform: 'scale(1.45)', transformOrigin: 'center' }} />
            </span>
          ) : (
            // Sin imagen configurada: el círculo de acento queda solo como
            // visual. El chip "PNG transparente" era una nota para el admin
            // que veía el usuario final.
            null
          )}
          {h.showStats ? (
            <>
              {/* Cifras flotantes: tarjeta del sistema (radio 12, borde 1 px), quietas. */}
              <div style={{ position: 'absolute', zIndex: 2, left: -12, top: 36, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: CARD_RADIUS, padding: '14px 18px', boxShadow: 'var(--shadow)' }}>
                <CountUp value={t(theme, 'home.hero.stat1.num')} style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', letterSpacing: '-.025em', lineHeight: 1.1, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }} />
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginTop: 2 }}>{t(theme, 'home.hero.stat1.label')}</div>
              </div>
              <div style={{ position: 'absolute', zIndex: 2, right: -6, bottom: 44, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: CARD_RADIUS, padding: '13px 16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ color: h.accentColor }}><Stars value={5} size={13} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>{t(theme, 'home.hero.stat2.num')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t(theme, 'home.hero.stat2.label')}</div>
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
  const unitOne = t(theme, 'home.categories.unit.one');
  const eyebrowColor = cs.eyebrowColor ?? 'var(--color-accent)';
  const titleColor = cs.titleColor ?? 'var(--color-text)';
  const accent = cs.cardAccentColor ?? 'var(--color-primary)';
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
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-.01em', lineHeight: 1.2 }}>{c.name}</span>
              {/* Qué entra en la categoría ("Arena, grava, base hidráulica y CNC"): se edita en Catálogo → Categorías. */}
              {c.description ? (
                <span style={{ color: 'rgba(255,255,255,.76)', fontSize: '12.5px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</span>
              ) : null}
              <span style={{ color: accent, fontWeight: 700, fontSize: '12.5px' }}>{categoryCountLabel(c, unit, unitOne)}</span>
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
  // "Ver todo" va al listado del tipo que se está enseñando (hoy, servicios).
  const verTodo = products.length > 0 && products.every((p) => p.kind === 'producto') ? '/productos' : '/servicios';
  if (products.length === 0) return null;

  const isCenter = f.align === 'center';
  return (
    <section style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ ...CONTAINER, paddingTop: 80, paddingBottom: 80 }}>
        {/* Encabezado (alineación configurable) + "Ver todo" */}
        {isCenter ? (
          <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', marginBottom: 4 }}>
            <Eyebrow color={f.eyebrowColor ?? undefined}>{t(theme, 'home.featured.eyebrow')}</Eyebrow>
            <h2 style={{ ...H2, color: f.titleColor ?? undefined }}>{t(theme, 'home.featured.title')}</h2>
            <p style={{ ...SUB, marginTop: 10, maxWidth: 560 }}>{t(theme, 'home.featured.subtitle')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 620, minWidth: 0 }}>
              <Eyebrow color={f.eyebrowColor ?? undefined}>{t(theme, 'home.featured.eyebrow')}</Eyebrow>
              <h2 style={{ ...H2, color: f.titleColor ?? undefined }}>{t(theme, 'home.featured.title')}</h2>
              <p style={{ ...SUB, marginTop: 10 }}>{t(theme, 'home.featured.subtitle')}</p>
            </div>
            <Link href={verTodo} className="ms-btn ms-btn-sec">
              {t(theme, 'home.featured.viewAll')} <Icon name="arrowRight" size={16} />
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
            <Link href={verTodo} className="ms-btn ms-btn-sec">
              {t(theme, 'home.featured.viewAll')} <Icon name="arrowRight" size={16} />
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
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  // Por defecto, superficie oscura y letra normal: el azul deja de ser el
  // fondo de la banda y pasa a la cifra (ver la nota larga donde se pintan).
  const statsBg = cfg?.statsBg ?? 'var(--surface-2)';
  const statsFg = cfg?.statsFg ?? 'var(--color-text)';
  /**
   * Color de la cifra.
   *
   * Con el fondo por defecto va en el acento, porque es el dato. Si el cliente
   * eligió un fondo propio —pongamos azul— la cifra vuelve al color de texto
   * que él mismo configuró: pintarla de acento sobre su acento la borraría.
   */
  const numColor = cfg?.statsBg ? statsFg : accent;
  /**
   * Las cifras, SIN las vacías.
   *
   * Son tres ranuras fijas y este tema solo llena dos: la tercera se pintaba
   * igual, como un tercio de banda en blanco que parecía un fallo de carga. Un
   * dato sin contenido no es un dato.
   */
  const stats = [1, 2, 3]
    .map((n) => ({
      num: t(theme, `home.whyChooseUs.stat${n}.num`),
      label: t(theme, `home.whyChooseUs.stat${n}.label`),
    }))
    // `t()` devuelve la propia clave cuando el copy no existe; eso también es
    // "vacío" y no debe acabar impreso en la página.
    .filter((s) => s.num.trim() && !s.num.startsWith('home.whyChooseUs.'));
  return (
    <section style={{ ...CONTAINER, paddingTop: 88, paddingBottom: 88 }}>
      {/* `minmax(300px,…)` mantenía 2 columnas hasta muy abajo: en tablet daba
          dos columnas de ~356px y el texto (4 razones + 3 cifras) no respiraba.
          `.why-grid` lo apila a partir de 900px. */}
      <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center' }}>
        <div style={{ position: 'relative', minHeight: 420 }} className="why-visual">
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--surface-2)' }}>
            {image ? (
              <Image src={image} alt={t(theme, 'home.whyChooseUs.title')} fill sizes="(max-width:900px) 100vw, 45vw" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="ph" style={{ position: 'absolute', inset: 0 }} />
            )}
          </div>
          {cfg?.showYearsBadge !== false ? (
            // `right: -18` la saca del marco a propósito (diseño). En móvil eso
            // la dejaba fuera de la pantalla: `.why-badge` la mete al borde.
            <div className="why-badge" style={{ position: 'absolute', right: -18, top: 44, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: CARD_RADIUS, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
              <CountUp value={t(theme, 'home.whyChooseUs.years.num')} style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '30px', letterSpacing: '-.025em', lineHeight: 1.1, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }} />
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 2 }}>{t(theme, 'home.whyChooseUs.years.label')}</div>
            </div>
          ) : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <Eyebrow color={cfg?.eyebrowColor ?? undefined}>{t(theme, 'home.whyChooseUs.eyebrow')}</Eyebrow>
          <h2 style={{ ...H2, ...(cfg?.titleColor ? { color: cfg.titleColor } : {}) }}>{t(theme, 'home.whyChooseUs.title')}</h2>
          <p style={{ ...SUB, maxWidth: 480, margin: '12px 0 28px' }}>
            {t(theme, 'home.whyChooseUs.subtitle')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '20px 28px', marginBottom: 30 }}>
            {items.map((w) => (
              <div key={w.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                <span className="ms-ico" aria-hidden style={{ width: 32, height: 32, borderRadius: 8, color: accent }}>
                  <Icon name="check" size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '15.5px', marginBottom: 4, color: 'var(--color-text)' }}>{w.title}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.55 }}>{w.description}</div>
                </div>
              </div>
            ))}
          </div>
          {cfg?.showStats !== false && stats.length > 0 ? (
            /*
              Cada cifra es su propia tarjeta, no una franja partida en tres.
              Dos motivos:

              1. EL MANUAL. El azul eléctrico significa ACCIÓN y datos, y no
                 rellena superficies (11-12 / COLOR FUNCIONAL). La banda entera
                 en azul con letra negra era justo lo contrario: el color como
                 fondo y el dato apagado encima. Ahora manda la superficie
                 oscura y el azul se queda en la cifra, que es el dato.
              2. Con tarjetas sueltas, la rejilla puede envolver a una o dos
                 columnas sin que queden bordes internos colgando ni celdas a
                 medias — que era lo que obligaba a la media query a
                 estirar la primera a todo el ancho.

              `statsBg`/`statsFg` siguen mandando si el cliente los configura
              desde Diseño → Sección 4; esto solo cambia a qué caen por defecto.
            */
            <div
              className="why-stats"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${stats.length > 1 ? '150px' : '100%'}, 1fr))`,
                gap: 12,
              }}
            >
              {stats.map((s) => (
                <div
                  key={s.label || s.num}
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: statsBg,
                    color: statsFg,
                    border: '1px solid var(--color-border)',
                    borderRadius: CARD_RADIUS,
                  }}
                >
                  <CountUp value={s.num} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', display: 'block', color: numColor, letterSpacing: '-.025em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }} />
                  {s.label ? <div style={{ fontSize: '13px', marginTop: 4, lineHeight: 1.4 }}>{s.label}</div> : null}
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
        <div style={{ marginBottom: 36 }}>
          <CenterHead eyebrow={t(theme, 'home.sectors.eyebrow')} title={t(theme, 'home.sectors.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
          {sectors.map((s) => (
            <Link
              key={s.id}
              href={`/sectores/${s.slug}`}
              className="lift"
              style={{ position: 'relative', height: cardH, borderRadius: CARD_RADIUS, overflow: 'hidden', border: '1px solid var(--color-border)', textDecoration: 'none', display: 'block' }}
            >
              {s.image ? (
                <Image src={s.image} alt={s.title} fill sizes="(max-width:640px) 100vw, 25vw" className="zoom" style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />
              )}
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,26,27,.94) 8%, rgba(26,26,27,.2) 60%, transparent)' }} />
              <span style={{ position: 'absolute', left: 20, right: 20, bottom: 20, color: '#fff' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', marginBottom: 6, letterSpacing: '-.01em', lineHeight: 1.25 }}>{s.title}</span>
                {s.description ? (
                  // La tarjeta tiene alto fijo (token `cardHeight`): sin recortar,
                  // una descripción larga empujaba el CTA fuera de la tarjeta.
                  // Sin `display` inline: lo fija `.sector-desc` (recorte a 3
                  // líneas), y un inline le ganaría a la clase.
                  <span className="sector-desc" style={{ fontSize: '13px', color: 'rgba(255,255,255,.78)', lineHeight: 1.5, marginBottom: 12 }}>{s.description}</span>
                ) : null}
                <span style={{ color: ctaColor, fontWeight: 600, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{t(theme, 'home.sectors.cta')}<Icon name="arrowRight" size={13} /></span>
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
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, background: bg, border: '1px solid var(--color-border)' }}>
        <div aria-hidden style={{ position: 'absolute', right: '-4%', top: '-30%', width: 440, height: 440, background: `radial-gradient(circle, color-mix(in srgb, ${accent} 24%, transparent), transparent 62%)`, borderRadius: '50%' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 30, alignItems: 'center', padding: 'clamp(24px, 5vw, 48px)' }}>
          <div style={{ minWidth: 0 }}>
            {/* Etiqueta en tipo oración (chip), no en MAYÚSCULAS espaciadas. */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`, fontWeight: 600, fontSize: '13px', padding: '4px 10px', borderRadius: 6, marginBottom: 16 }}>
              {t(theme, 'home.offer.badge')}
            </span>
            <h2 style={{ ...H2, color: titleColor, margin: '0 0 12px' }}>{t(theme, 'home.offer.title')}</h2>
            {/* El subtítulo sigue al color del título (configurable) al 72%:
                con el blanco fijo, un admin que eligiera fondo claro dejaba
                este texto invisible mientras el título sí se adaptaba. */}
            <p style={{ color: `color-mix(in srgb, ${titleColor} 72%, transparent)`, fontSize: '15.5px', maxWidth: 460, margin: '0 0 24px', lineHeight: 1.6 }}>{t(theme, 'home.offer.subtitle')}</p>
            <Link href={ctaLink} className="ms-btn ms-btn-lg" style={{ background: accent }}>
              {t(theme, 'home.offer.cta')} <Icon name="arrowRight" size={17} />
            </Link>
          </div>
          <div style={{ position: 'relative', height: 230, borderRadius: CARD_RADIUS, overflow: 'hidden', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}>
            {cfg?.image ? (
              <Image src={cfg.image} alt={t(theme, 'home.offer.title')} fill sizes="(max-width:900px) 100vw, 45vw" style={{ objectFit: 'cover' }} />
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
      <Carousel eyebrow={t(theme, 'home.reviews.eyebrow')} title={t(theme, 'home.reviews.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined}>
        {reviews.map((r) => (
          <figure
            key={r.id}
            style={{ margin: 0, scrollSnapAlign: 'start', flex: '0 0 min(400px, 84vw)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: CARD_RADIUS, padding: 24, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ color: accent, marginBottom: 14 }}>
              <Stars value={r.rating} size={15} />
            </div>
            <blockquote style={{ fontSize: '15px', lineHeight: 1.6, margin: '0 0 22px', color: 'var(--color-text)', flex: 1 }}>{r.review}</blockquote>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
              <span aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: 'var(--color-secondary)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.author.charAt(0).toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '14.5px', color: 'var(--color-text)' }}>{r.author}</span>
                <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '13px' }}>{r.product ? r.product : role}</span>
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
      <p style={{ textAlign: 'center', margin: '0 auto 20px', padding: '0 16px', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 500 }}>
        {brands.title}
      </p>
      <div className="marquee-mask" style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 26, whiteSpace: 'nowrap', alignItems: 'center' }}>
          {loop.map((b, i) => (
            <div key={`${b}-${i}`} aria-hidden={i >= list.length} style={{ flex: '0 0 auto', height: 52, minWidth: 140, padding: '0 18px', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}>
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
      <div style={{ marginBottom: 32 }}>
        <CenterHead eyebrow={t(theme, 'home.faq.eyebrow')} title={t(theme, 'home.faq.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {faqs.map((f) => (
          <details key={f.id} name="home-faq" className="faq" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
            <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', cursor: 'pointer', fontWeight: 600, fontSize: '15.5px', color: 'var(--color-text)' }}>
              {f.question}
              <span className="faq-plus" aria-hidden style={{ fontSize: '22px', lineHeight: 1, color: accent, flexShrink: 0 }}>+</span>
            </summary>
            <div
              style={{ padding: '0 22px 20px', color: 'var(--color-text-muted)', fontSize: '14.5px', lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: f.answer }}
            />
          </details>
        ))}
      </div>
    </section>
  );
}

/* ============ Secciones opcionales (desactivadas por defecto) ============ */

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
      <div className="ms-cards">
        {blogs.map((b) => (
          <Link key={b.id} href={`/blog/${b.slug}`} className="ms-panel" style={{ padding: 0, overflow: 'hidden', display: 'block' }}>
            <span style={{ position: 'relative', aspectRatio: '16 / 9', display: 'block', background: 'var(--surface-2)' }}>
              {b.image ? <Image src={b.image} alt={b.title} fill sizes="(max-width: 640px) 100vw, 33vw" style={{ objectFit: 'cover' }} /> : <span className="ph" style={{ position: 'absolute', inset: 0 }} />}
            </span>
            <span style={{ padding: 18, display: 'grid', gap: 8 }}>
              <strong style={{ lineHeight: 1.3, fontSize: '16px' }}>{b.title}</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.55 }}>{b.excerpt}</span>
              <span className="ms-link" style={{ fontSize: '13.5px' }}>{t(theme, 'home.blog.readMore')}<Icon name="arrowRight" size={14} /></span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

