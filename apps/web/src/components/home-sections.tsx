import Link from '@/components/Enlace';
import Image from 'next/image';
import { defaultTheme, recortarSector, textoPlanoSector, type SectorVistaPrevia, type Theme } from '@maqserv/config';
import { IconoRed } from '@/components/RedesSociales';
import { whatsappHref } from '@/lib/telefono';
import type { HomeHero, WhyChooseUsItem } from '@maqserv/types';
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
import { VideoCategoria } from './VideoCategoria';
import { BandaLuz, TrazosLuz } from './BandaLuz';
import { EncabezadoSobrePortada } from './EncabezadoSobrePortada';
import { Carousel, Eyebrow } from '@/components/Carousel';
import { Icon, Stars, type IconName } from '@/components/Icon';
import { CategoryStrip } from '@/components/CategoryStrip';
import { CountUp } from '@/components/CountUp';
import { HomeProductGrid } from '@/components/HomeProductGrid';
import { hrefDeCotizar } from '@/lib/enlace-cotizar';

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
/**
 * Rediseño 2026-11-16 (parte 2, el estilo de «¿Por qué MAQSER24?» que mandó el
 * dueño): titular grande y grueso, etiqueta en MAYÚSCULAS espaciadas (`.ms-kicker`)
 * y subtítulo más legible.
 */
const H2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 2.6vw, 36px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.12, margin: 0, textWrap: 'balance' };
const SUB: React.CSSProperties = { color: 'color-mix(in srgb, var(--color-text) 82%, transparent)', fontSize: 'clamp(15.5px, 1.25vw, 18px)', lineHeight: 1.55, margin: 0, textWrap: 'pretty' };
const CARD_RADIUS = 12;
/** Borde de las tarjetas del inicio (rediseño parte 3): más visible que el del tema, como las de «Red» y «MTY». */
const BORDE_TARJETA = '1px solid color-mix(in srgb, var(--color-text) 20%, transparent)';

/** Encabezado centrado (kicker + título + subtítulo opcional). */
function CenterHead({ eyebrow, title, subtitle, eyebrowColor, titleColor }: { eyebrow: string; title: string; subtitle?: string; eyebrowColor?: string; titleColor?: string }) {
  return (
    <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center' }}>
      <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
      <h2 style={{ ...H2, maxWidth: '24ch', ...(titleColor ? { color: titleColor } : {}) }}>{title}</h2>
      {subtitle ? <p style={{ ...SUB, maxWidth: 620, marginTop: 14 }}>{subtitle}</p> : null}
    </div>
  );
}

/* ============================= HERO ============================= */

/**
 * `contenido` lo pasa la vista previa del panel con el texto e imagen sin
 * publicar (viven en la tabla del hero, no en el tema). El sitio no lo pasa.
 */
/** `**texto**` → negritas (el panel escribe texto normal; esto es lo único que se interpreta). */
function conNegritas(texto: string): React.ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i} className="hx-neg">{parte}</strong> : parte));
}

export async function Hero({ theme, contenido }: { theme: Theme; contenido?: HomeHero | null }) {
  const hero = contenido !== undefined ? contenido : await getHero().catch(() => null);
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
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key || !v.trim() ? def : v;
  };
  const lema = cval('home.hero.tagline', '').trim();
  const contacto = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const numeroWa = contacto.whatsapp || contacto.phone;
  const wa = numeroWa ? whatsappHref(numeroWa, 'Hola, quiero una cotización.') : null;

  const trust = [
    // Antes eran glifos del teclado. ⛟ y ▤ no existen en muchas fuentes: en
    // esas máquinas el hero mostraba dos cuadros vacíos donde va un icono.
    { icon: 'check' as IconName, title: t(theme, 'home.hero.trust1.title'), text: t(theme, 'home.hero.trust1.text') },
    { icon: 'specs' as IconName, title: t(theme, 'home.hero.trust2.title'), text: t(theme, 'home.hero.trust2.text') },
    { icon: 'truck' as IconName, title: t(theme, 'home.hero.trust3.title'), text: t(theme, 'home.hero.trust3.text') },
    { icon: 'mapPin' as IconName, title: t(theme, 'home.hero.trust4.title'), text: t(theme, 'home.hero.trust4.text') },
  ];

  return (
    // Rediseño 2026-11-16 (el dueño: «se ve muy simple»): la portada toma el
    // mundo de «¿Por qué MAQSER24?» a toda intensidad — brillo azul detrás del
    // titular y del visual, rejilla de plano de obra que se desvanece, trazos de
    // luz en las esquinas, titular en la letra gruesa, botón con resplandor,
    // casillas con borde azul y tarjetas semitransparentes sobre el video.
    <section className="hx" style={{ background: 'var(--band-capa)' }}>
      <style>{HERO_CSS}</style>
      <div aria-hidden className="hx-rejilla" />
      <div aria-hidden className="hx-brillo hx-brillo-a" />
      <div aria-hidden className="hx-brillo hx-brillo-b" />
      <TrazosLuz partes="abajo" />
      <EncabezadoSobrePortada />

      {/* El hero NO usa CONTAINER (1240 px): con el texto centrado en esa caja
          quedaban ~340 px de aire a la izquierda en pantallas grandes, el título
          se partía en más renglones y la banda crecía a lo alto. Caja más ancha
          + menos aire arriba = el mismo texto en menos renglones y un hero que
          ya no se come la pantalla de entrada. */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 clamp(16px, 3vw, 26px)', position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 700px) minmax(0, 1fr)', gap: 'clamp(32px, 3.5vw, 56px)', alignItems: 'center', paddingTop: 'clamp(20px, 3.2vh, 40px)', paddingBottom: 'clamp(28px, 4.5vh, 52px)', width: '100%' }} className="hero-grid">
        {/* En el celular esta columna se deshace (`display: contents`) para que el
            visual quede entre el título y la descripción (2026-11-12); ver globals.css. */}
        <div className="hero-texto">
          {showBadge ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `color-mix(in srgb, ${h.accentColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${h.accentColor} 35%, transparent)`, borderRadius: 8, padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: h.accentColor }}>
              <Icon name="star" size={13} fill /> {badge}
            </div>
          ) : null}
          {/* Único titular grande del sitio, tipo oración. El acento solo cambia el color. */}
          <h1 className="hx-titulo" style={{ margin: showBadge ? '20px 0 0' : '0', color: h.titleColor }}>
            {title}
            {hasAccent ? (
              <>
                {title ? <br /> : null}
                <span className="hx-acento" style={{ color: h.accentColor }}>{accent}</span>
              </>
            ) : null}
          </h1>
          {/* `pre-line`: el texto del hero trae dos párrafos separados por una
              línea en blanco (lo que se ofrece / qué decirnos). */}
          <p className="hero-sub hx-sub" style={{ color: h.subtitleColor }}>
            {conNegritas(subtitle)}
          </p>
          {/* Frase con barra azul (2026-11-16, imagen del dueño). Vacía = no sale. */}
          {lema ? <p className="hx-lema">{lema}</p> : null}
          {/* Botones del sistema (`ms-btn`): colores y enlaces siguen saliendo
              del tema; el texto va tal cual lo escribe el panel. */}
          <div className="ms-hero-acts" style={{ marginTop: 22 }}>
            <Link href={hrefDeCotizar(h.primaryLink)} data-evento="cta_hero_primario" className="ms-btn ms-btn-lg hx-cta" style={{ background: h.primaryBg, color: h.primaryText }}>
              {t(theme, 'home.hero.ctaPrimary')} <Icon name="arrowRight" size={17} />
            </Link>
            {/* "Cotiza por WhatsApp" en lugar de "Ver disponibilidad" (2026-10-19,
                pedido del cliente). Sin número, vuelve el botón secundario de antes. */}
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" data-evento="cta_hero_whatsapp" className="ms-btn ms-btn-lg ms-btn-sec hx-sec" style={{ color: '#fff', borderColor: h.secondaryBorder }}>
                <span style={{ display: 'flex', color: '#25D366' }}><IconoRed red="whatsapp" /></span>
                {cval('home.hero.ctaWhatsapp', 'Cotiza por WhatsApp')}
              </a>
            ) : (
              <Link href={h.secondaryLink} data-evento="cta_hero_secundario" className="ms-btn ms-btn-lg ms-btn-sec hx-sec" style={{ color: '#fff', borderColor: h.secondaryBorder }}>
                {t(theme, 'home.hero.ctaSecondary')}
              </Link>
            )}
          </div>

          {h.showTrust ? (
            <div className="hero-trust hx-trust">
              {trust.map((it) => (
                <div key={it.title} className="hx-punto">
                  <span className="hx-ico" aria-hidden style={{ color: h.accentColor }}>
                    <Icon name={it.icon} size={17} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="hx-punto-t">{it.title}</span>
                    <span className="hx-punto-d">{it.text}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* visual */}
        {/* En el celular también se ve (2026-11-12): entre el título y la descripción; ver
            `.hero-visual` en globals.css. Sin video ni imagen (solo el círculo) no sale ahí. */}
        <div style={{ position: 'relative', minHeight: 380, ...(h.video ? { display: 'grid', alignItems: 'center' } : {}) }} className="hero-visual" data-video={h.video ? '' : undefined} data-vacio={!h.video && !hero?.image ? '' : undefined}>
          {h.video ? (
            // Video en movimiento en lugar de la imagen (Diseño → Hero), en un
            // marco con resplandor azul: es la pieza que más pesa de la portada.
            <div className="hx-marco">
              <VideoCategoria
                src={h.video}
                poster={null}
                style={{ position: 'relative', inset: 'auto', height: 'auto', maxHeight: 'min(560px, 62vh)', objectFit: 'contain', borderRadius: 16, background: '#000' }}
              />
            </div>
          ) : (
            /* círculo de acento: SOLO adorno, detrás y más pequeño que la imagen */
            <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(340px, 72%)', aspectRatio: '1', borderRadius: '50%', background: h.accentColor, opacity: h.overlay / 100 }} />
          )}
          {/* imagen del producto (PNG transparente): más grande que el círculo, puede salirse de él */}
          {h.video ? null : hero?.image ? (
            <span className="hero-img" style={{ position: 'absolute', top: '50%', left: '52%', transform: 'translate(-50%, -50%)', width: 'min(560px, 118%)', aspectRatio: '1', zIndex: 1, display: 'block' }}>
              <Image src={hero.image} alt={`${title} ${accent}`.trim()} fill priority sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'contain', transform: 'scale(1.45)', transformOrigin: 'center' }} />
            </span>
          ) : null}
          {h.showStats ? (
            <>
              {/* Cifras flotantes: tarjetas semitransparentes (se leen sobre el video), cifra en azul. */}
              <div className="hero-stat hx-stat" style={{ left: -14, top: 34 }}>
                <CountUp value={t(theme, 'home.hero.stat1.num')} style={{ ...CIFRA, fontSize: '34px' }} />
                <div className="hx-stat-l">{t(theme, 'home.hero.stat1.label')}</div>
              </div>
              <div className="hero-stat hx-stat" style={{ right: -10, bottom: 40, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ color: h.accentColor }}><Stars value={5} size={13} /></div>
                <div>
                  <div className="hx-stat-n">{t(theme, 'home.hero.stat2.num')}</div>
                  <div className="hx-stat-l">{t(theme, 'home.hero.stat2.label')}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const HERO_CSS = `
.hx{ position:relative; overflow:hidden; isolation:isolate; }
/* Menú y portada como una sola pieza (2026-11-16): en el inicio la portada sube
   por detrás del menú, que va transparente arriba y recupera su fondo al bajar
   (data-desplazado, ver EncabezadoSobrePortada). La portada llena la primera
   pantalla (sin la barra de contacto) y su contenido va centrado. */
:root{ --alto-hdr: 75px; }
@media (max-width: 1199px){ :root{ --alto-hdr: 71px; } }
.sh-hdr ~ main > .hx:first-child{ margin-top: calc(-1 * var(--alto-hdr)); padding-top: var(--alto-hdr); min-height: calc(100svh - 39px); display:flex; flex-direction:column; justify-content:center; }
.sh-hdr{ background: transparent !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; transition: background .3s ease, box-shadow .3s ease; }
html[data-desplazado] .sh-hdr{ background: linear-gradient(180deg, color-mix(in srgb, var(--band) 97%, transparent), color-mix(in srgb, var(--band) 90%, transparent)) !important;
  -webkit-backdrop-filter: blur(14px) saturate(140%) !important; backdrop-filter: blur(14px) saturate(140%) !important; box-shadow: 0 12px 30px -20px rgba(0,0,0,.9); }
.hx-rejilla{ position:absolute; inset:0; pointer-events:none; opacity:.55;
  background-image:
    linear-gradient(color-mix(in srgb, #fff 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, #fff 6%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 75% 70% at 28% 42%, #000 25%, transparent 78%);
  mask-image: radial-gradient(ellipse 75% 70% at 28% 42%, #000 25%, transparent 78%); }
.hx-brillo{ position:absolute; border-radius:50%; pointer-events:none; filter: blur(90px); }
.hx-brillo-a{ width:640px; height:440px; left:-180px; top:-140px; background: color-mix(in srgb, var(--color-primary) 26%, transparent); }
.hx-brillo-b{ width:620px; height:560px; right:-140px; top:14%; background: color-mix(in srgb, var(--color-primary) 20%, transparent); }
.hx-titulo{ font-family: var(--font-display); font-weight:800; font-size: clamp(2rem, min(3.1vw, 5.4vh), 3rem); line-height:1.08; letter-spacing:-.02em; text-wrap:balance; }
.hx-sub{ font-size: clamp(15px, min(1.15vw, 1.95vh), 17px); line-height:1.55; max-width: 680px; margin: 16px 0 0; white-space: pre-line; text-wrap: pretty; }
.hx-neg{ color:#fff; font-weight:800; }
.hx-lema{ margin: 16px 0 0; padding: 3px 0 3px 16px; border-left: 3px solid var(--color-primary); color:#fff; font-family: var(--font-display); font-weight:800; font-size: clamp(15.5px, 1.25vw, 18px); line-height:1.4; text-wrap: balance; }
.hx-cta{ box-shadow: 0 14px 34px -12px color-mix(in srgb, var(--color-primary) 75%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 22%, transparent);
  transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s cubic-bezier(.16,1,.3,1), filter .2s; }
.hx-cta:hover{ transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 20px 44px -12px color-mix(in srgb, var(--color-primary) 85%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 28%, transparent); }
.hx-sec{ background: color-mix(in srgb, #fff 4%, transparent); backdrop-filter: blur(6px); transition: background .2s, border-color .2s; }
.hx-sec:hover{ background: color-mix(in srgb, #fff 9%, transparent); }
.hx-trust{ display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: 700px; gap: 14px 18px; margin-top: 24px; padding-top: 20px; border-top: 1px solid color-mix(in srgb, #fff 12%, transparent); }
.hx-punto{ display:flex; align-items:flex-start; gap:12px; min-width:0; }
.hx-ico{ flex-shrink:0; width:36px; height:36px; border-radius:9px; display:grid; place-items:center; border:2px solid currentColor;
  background: color-mix(in srgb, currentColor 14%, transparent); box-shadow: 0 0 16px color-mix(in srgb, currentColor 28%, transparent); }
.hx-punto-t{ display:block; color:#fff; font-family: var(--font-display); font-weight:800; font-size:14.5px; line-height:1.3; }
.hx-punto-d{ display:block; color: color-mix(in srgb, #fff 62%, transparent); font-size:13px; line-height:1.4; margin-top:2px; }
.hx-marco{ position:relative; border-radius:18px; padding:1px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--color-primary) 85%, #fff), color-mix(in srgb, var(--color-primary) 20%, transparent) 40%, color-mix(in srgb, #fff 14%, transparent) 70%, color-mix(in srgb, var(--color-primary) 70%, transparent));
  box-shadow: 0 40px 90px -36px color-mix(in srgb, var(--color-primary) 70%, transparent), 0 24px 60px -30px rgba(0,0,0,.8); }
.hx-marco > video{ border-radius:17px !important; }
.hx-stat{ position:absolute; z-index:2; border-radius:14px; padding:14px 18px;
  background: color-mix(in srgb, var(--color-surface) 70%, transparent); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  box-shadow: 0 18px 40px -18px rgba(0,0,0,.75), inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent); }
.hx-stat-n{ font-family: var(--font-display); font-weight:800; font-size:16px; color: var(--color-text); }
.hx-stat-l{ font-size:12.5px; color: var(--color-text-muted); margin-top:3px; }
@media (max-width: 1100px){ .hx-trust{ grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 560px; } }
/* Celular: los dos botones en una sola fila. */
@media (max-width: 600px){
  .hx .ms-hero-acts{ display:grid !important; grid-template-columns: 1fr 1fr; gap: 8px !important; }
  .hx .ms-hero-acts .ms-btn{ min-width:0; justify-content:center; padding: 13px 8px !important; font-size: 12.5px !important; white-space: nowrap; gap: 6px; }
  .hx .hx-cta svg{ display:none; }
}
@media (max-width: 900px){
  .hx-brillo-a{ width:420px; height:320px; left:-160px; }
  .hx-brillo-b{ width:380px; height:360px; right:-160px; }
  .hx-trust{ margin-top: 28px; padding-top: 20px; }
}
@media (prefers-reduced-motion: reduce){ .hx-cta{ transition:none; } .hx-cta:hover{ transform:none; } }
`;

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
  // Los videos de categoría son de celular, en vertical (9:16). Con uno solo,
  // toda la banda pasa a tarjetas verticales: con la altura fija del tema el
  // video perdía casi la mitad de arriba y de abajo.
  const vertical = categories.some((c) => c.video);
  return (
    <BandaLuz lado="izquierda">
    <section style={{ ...CONTAINER, paddingTop: 82, paddingBottom: 72 }}>
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
            style={{ scrollSnapAlign: 'start', position: 'relative', display: 'block', ...(vertical ? { aspectRatio: '9 / 16' } : { height: cs.imageHeight }), borderRadius: cs.cardRadius, overflow: 'hidden', textDecoration: 'none', color: 'var(--color-text)', background: 'var(--surface-2)', border: BORDE_TARJETA }}
          >
            {/* Video en bucle si la categoría tiene (la foto queda de portada); si no, imagen a sangre (cover) */}
            {c.video ? (
              <VideoCategoria src={c.video} poster={c.image} className="zoom" />
            ) : c.image ? (
              <Image src={c.image} alt={c.name} fill sizes="280px" className="zoom" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />
            )}
            {/* Velo oscuro para legibilidad del texto */}
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,8,.9) 2%, rgba(6,6,8,.35) 42%, rgba(6,6,8,0) 72%)' }} />
            {/* Nombre + conteo encima (abajo-izquierda) */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 16px 15px', display: 'grid', gap: 4 }}>
              <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.08rem', letterSpacing: '-.015em', lineHeight: 1.2 }}>{c.name}</span>
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
    </BandaLuz>
  );
}

/* ======================= PROMOCIONES DEL MES ======================= */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Hoy en Monterrey (AAAA-MM-DD). La vigencia se cuenta en hora local: en UTC, una promoción «hasta el 31» se apagaba el 31 a las 6 p. m. */
const hoyEnMonterrey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
/** "2026-10-31" → "31 de octubre". Al mediodía, para que ningún huso lo corra de día. */
const fechaLarga = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Monterrey' });

/**
 * Promociones del mes (2026-10-19): tarjetas con video que se cargan en el
 * panel (Sitio web → Secciones del home → Promociones del mes).
 *
 * Una promoción con fecha «vigente hasta» se oculta sola al día siguiente: no
 * hay que acordarse de quitarla a fin de mes. Sin ninguna vigente, la sección
 * no pinta nada (ni el título).
 *
 * El texto va encima del video, abajo, con el mismo velo de las categorías; el
 * video se reproduce solo al verse y trae su botón de sonido.
 */
export async function PromotionsSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.promotions;
  if (!cfg || cfg.show === false) return null;
  const hoy = hoyEnMonterrey();
  const promos = cfg.items.filter(
    (p) => p.enabled && (p.video || p.image || p.title.trim()) && !(p.until && FECHA.test(p.until) && p.until < hoy),
  );
  if (promos.length === 0) return null;
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };
  const accent = cfg.accentColor ?? 'var(--color-primary)';
  const vertical = cfg.format !== 'horizontal';
  return (
    // Banda de luz (2026-11-16, el dueño: «esas partes como que les falta»): como Categorías y «¿Por qué?».
    <BandaLuz>
    <section style={{ ...CONTAINER, paddingTop: 'clamp(44px, 7vh, 72px)', paddingBottom: 'clamp(44px, 7vh, 72px)' }}>
      {/* El mismo carrusel giratorio de Categorías (pedido del cliente,
          2026-10-19): gira aunque sean pocas, repitiendo la tanda; con una sola
          promoción se queda quieta y centrada. */}
      <CategoryStrip
        eyebrow={cval('home.promotions.eyebrow', 'Promociones')}
        title={cval('home.promotions.title', 'Promociones del mes')}
        eyebrowColor={cfg.eyebrowColor ?? ''}
        titleColor={cfg.titleColor ?? ''}
        ancho={vertical ? 'min(300px, 76cqw, calc((100svh - 290px) * 9 / 16))' : 'min(560px, 86cqw)'}
        siempre
        etiquetaAnterior="Promociones anteriores"
        etiquetaSiguiente="Promociones siguientes"
      >
        {promos.map((p, i) => (
          // Vertical: el texto va encima del video, abajo, con velo (como las
          // categorías). Horizontal: debajo del video; encima tapaba la mitad,
          // y en un teléfono la tarjeta mide 190 px y el texto chocaba con la etiqueta.
          <article
            key={p.id || i}
            style={{
              position: 'relative',
              ...(vertical ? { aspectRatio: '9 / 16' } : { display: 'flex', flexDirection: 'column' }),
              scrollSnapAlign: 'start',
              borderRadius: CARD_RADIUS,
              overflow: 'hidden',
              isolation: 'isolate',
              background: vertical ? 'var(--surface-2)' : 'var(--color-surface)',
              border: BORDE_TARJETA,
            }}
          >
            <div style={vertical ? { position: 'absolute', inset: 0 } : { position: 'relative', aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
              {p.video ? (
                <VideoCategoria src={p.video} poster={p.image} sonido />
              ) : p.image ? (
                <Image src={p.image} alt={p.title} fill sizes={vertical ? '300px' : '(max-width: 640px) 86vw, 560px'} style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph" style={{ position: 'absolute', inset: 0 }} />
              )}
              {/* Velo para leer el texto sobre cualquier video */}
              {vertical ? <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(6,6,8,.92) 4%, rgba(6,6,8,.45) 38%, rgba(6,6,8,0) 66%)' }} /> : null}
              {p.badge.trim() ? (
                <span style={{ position: 'absolute', zIndex: 2, top: 12, left: 12, background: accent, color: 'var(--color-primary-fg)', fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: '7px 10px', borderRadius: 6 }}>
                  {p.badge}
                </span>
              ) : null}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 18,
                ...(vertical ? { position: 'absolute', zIndex: 2, left: 0, right: 0, bottom: 0 } : { flex: 1 }),
              }}
            >
              {p.title.trim() ? <h3 style={{ color: vertical ? '#fff' : 'var(--color-text)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-.01em', lineHeight: 1.2, margin: 0, textWrap: 'balance' }}>{p.title}</h3> : null}
              {p.text.trim() ? (
                <p style={{ color: vertical ? 'rgba(255,255,255,.8)' : 'var(--color-text-muted)', fontSize: '13.5px', lineHeight: 1.45, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.text}</p>
              ) : null}
              {p.until && FECHA.test(p.until) ? (
                <span style={{ color: vertical ? 'rgba(255,255,255,.66)' : 'var(--color-text-muted)', fontSize: '12.5px' }}>Vigente hasta el {fechaLarga(p.until)}</span>
              ) : null}
              {p.cta.trim() ? (
                // `marginTop: auto`: en horizontal las tarjetas de una fila miden lo mismo y los botones quedan alineados abajo.
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <Link href={hrefDeCotizar(p.ctaLink)} className="ms-btn" style={{ background: accent }}>
                    {p.cta} <Icon name="arrowRight" size={15} />
                  </Link>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </CategoryStrip>
    </section>
    </BandaLuz>
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
  // "Ver todo" siempre a /servicios (2026-10-08): /productos ya solo redirige.
  const verTodo = '/servicios';
  if (products.length === 0) return null;

  // Carrusel giratorio desde 2026-10-20: el encabezado (título, flechas y "Ver
  // todo") lo pinta el carrusel, igual que en Categorías; `align` ya solo
  // acomoda las pestañas.
  return (
    <BandaLuz lado="izquierda">
    <section>
      <div style={{ ...CONTAINER, paddingTop: 'clamp(44px, 8vh, 80px)', paddingBottom: 'clamp(44px, 8vh, 80px)' }}>
        <HomeProductGrid
          products={products}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          theme={theme}
          align={f.align}
          showTabs={f.showTabs}
          eyebrow={t(theme, 'home.featured.eyebrow')}
          title={t(theme, 'home.featured.title')}
          subtitle={t(theme, 'home.featured.subtitle')}
          viewAllLabel={t(theme, 'home.featured.viewAll')}
          viewAllHref={verTodo}
          eyebrowColor={f.eyebrowColor ?? ''}
          titleColor={f.titleColor ?? ''}
        />
      </div>
    </section>
    </BandaLuz>
  );
}

/* ======================= POR QUÉ ELEGIRNOS ======================= */

/** `razones` lo pasa la vista previa del panel con la lista recién editada. */
export async function WhyChooseUsSection({ theme, razones }: { theme: Theme; razones?: WhyChooseUsItem[] }) {
  const cfg = theme.tokens.whyChooseUs;
  if (cfg && cfg.show === false) return null;
  // Solo las razones marcadas para el home (o ambas); las de 'about' se omiten aquí.
  const items = (razones ?? (await getWhyChooseUs())).filter((w) => w.placement !== 'about');
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
  const tagline = t(theme, 'home.whyChooseUs.tagline');
  const marca = t(theme, 'site.name');
  return (
    // «¿POR QUÉ MAQSER24?» (2026-11-16, diseño que mandó el dueño): banda con
    // fondo degradado y trazos de luz en las esquinas, titular grande, razones
    // con casilla marcada, cifras en tarjetas con borde y una frase al pie.
    <BandaLuz>
    <section className="pq-banda">
      <style>{PQ_CSS}</style>
      <div style={{ ...CONTAINER, paddingTop: 'clamp(44px, 7.5vh, 80px)', paddingBottom: 'clamp(44px, 7.5vh, 80px)', position: 'relative' }}>
        {/* `minmax(300px,…)` mantenía 2 columnas hasta muy abajo: en tablet daba
            dos columnas de ~356px y el texto (4 razones + 2 cifras) no respiraba.
            `.why-grid` lo apila a partir de 900px. */}
        {/* Cabe en una pantalla (2026-11-16, el dueño: «la sigo viendo muy grande,
            debe abarcar como máximo la pantalla completa»): la imagen ya no tiene
            alto propio, toma el del texto (`stretch`), y textos y espacios se
            ajustan también a la altura de la pantalla (ver PQ_CSS). */}
        <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .74fr) minmax(0, 1.26fr)', gap: 'clamp(32px, 3.6vw, 56px)', alignItems: 'stretch' }}>
          <div style={{ position: 'relative', minHeight: 340 }} className="why-visual">
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', border: BORDE_TARJETA, background: 'var(--surface-2)' }}>
              {/* Video en bucle si hay (2026-11-16), con la imagen de portada; si no, la imagen. */}
              {cfg?.video ? (
                <VideoCategoria src={cfg.video} poster={image} boton />
              ) : image ? (
                <Image src={image} alt={t(theme, 'home.whyChooseUs.title')} fill sizes="(max-width:900px) 100vw, 45vw" style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph" style={{ position: 'absolute', inset: 0 }} />
              )}
            </div>
            {cfg?.showYearsBadge !== false ? (
              // `right: -18` la saca del marco a propósito (diseño). En móvil eso
              // la dejaba fuera de la pantalla: `.why-badge` la mete al borde.
              <div className="why-badge" style={{ position: 'absolute', right: -18, top: 44, background: 'var(--color-surface)', border: BORDE_TARJETA, borderRadius: CARD_RADIUS, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
                <CountUp value={t(theme, 'home.whyChooseUs.years.num')} style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '30px', letterSpacing: '-.025em', lineHeight: 1.1, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }} />
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 2 }}>{t(theme, 'home.whyChooseUs.years.label')}</div>
              </div>
            ) : null}
          </div>

          <div style={{ minWidth: 0 }}>
            <p className="pq-eyebrow" style={cfg?.eyebrowColor ? { color: cfg.eyebrowColor } : undefined}>{t(theme, 'home.whyChooseUs.eyebrow')}</p>
            <h2 className="pq-titulo" style={cfg?.titleColor ? { color: cfg.titleColor } : undefined}>{t(theme, 'home.whyChooseUs.title')}</h2>
            <p className="pq-sub">{t(theme, 'home.whyChooseUs.subtitle')}</p>
            <div className="pq-razones">
              {items.map((w) => (
                <div key={w.id} className="pq-razon">
                  <span className="pq-check" aria-hidden style={{ color: accent }}>
                    <Icon name="check" size={18} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="pq-razon-t">{w.title}</h3>
                    <p className="pq-razon-d">{w.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {cfg?.showStats !== false && stats.length > 0 ? (
              // Cada cifra es su propia tarjeta con borde; el azul queda en la
              // cifra, que es el dato. `statsBg`/`statsFg` siguen mandando si el
              // cliente los configura en Diseño → Quiénes somos.
              <div className="pq-cifras">
                {stats.map((s) => (
                  <div key={s.label || s.num} className="pq-cifra" style={cfg?.statsBg ? { background: statsBg, color: statsFg } : undefined}>
                    <CountUp value={s.num} style={cfg?.statsBg ? { ...CIFRA, color: numColor, background: 'none', WebkitTextFillColor: 'currentColor' } : CIFRA} />
                    {s.label ? <div className="pq-cifra-l">{s.label}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {tagline.trim() && tagline !== 'home.whyChooseUs.tagline' ? (
              <p className="pq-pie"><b>{marca}</b> · {tagline}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
    </BandaLuz>
  );
}

/** La cifra («Red», «MTY»): grande y en azul con un brillo de arriba abajo, como el diseño. */
const CIFRA: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(28px, min(2.5vw, 4.4vh), 40px)',
  lineHeight: 1,
  letterSpacing: '-.02em',
  fontVariantNumeric: 'tabular-nums',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 55%, #fff), var(--color-primary) 70%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'var(--color-primary)',
};

const PQ_CSS = `
/* Proporciones del diseño del dueño (2026-11-16): todo en la letra de titulares
   (Montserrat), titular en dos renglones y el texto a la medida de la imagen. */
.pq-banda{ font-family: var(--font-display); }
.pq-eyebrow{ margin:0 0 10px; font-size:clamp(12.5px, min(.95vw, 1.6vh), 14.5px); font-weight:800; letter-spacing:.04em; text-transform:uppercase; color: var(--color-primary); }
.pq-titulo{ margin:0; font-family: var(--font-display); font-weight:800; font-size: clamp(26px, min(2.5vw, 4.3vh), 38px); line-height:1.1; letter-spacing:-.02em; color: var(--color-text); text-wrap: balance; }
.pq-sub{ margin:12px 0 clamp(18px, 2.6vh, 28px); max-width: 680px; font-size: clamp(14.5px, min(1.1vw, 1.85vh), 17px); font-weight:500; line-height:1.5; color: color-mix(in srgb, var(--color-text) 86%, transparent); text-wrap: pretty; }
.pq-razones{ display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(14px, 2.2vh, 22px) 30px; margin-bottom: clamp(18px, 2.6vh, 28px); }
.pq-razon{ display:flex; gap:14px; align-items:flex-start; min-width:0; }
.pq-check{ flex-shrink:0; width:30px; height:30px; border-radius:8px; border:2px solid currentColor; display:grid; place-items:center;
  background: color-mix(in srgb, currentColor 14%, transparent); box-shadow: 0 0 14px color-mix(in srgb, currentColor 22%, transparent); }
.pq-check svg{ stroke-width: 2.6; width:16px; height:16px; }
.pq-razon-t{ margin:3px 0 4px; font-size: clamp(14.5px, min(1.05vw, 1.75vh), 16.5px); font-weight: 800; line-height:1.25; color: var(--color-text); }
.pq-razon-d{ margin:0; font-size: clamp(13.5px, min(.92vw, 1.6vh), 14.5px); font-weight:500; line-height:1.45; color: color-mix(in srgb, var(--color-text) 82%, transparent); }
.pq-cifras{ display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:14px; }
.pq-cifra{ text-align:center; padding: clamp(12px, 1.8vh, 18px) 16px; border-radius: 14px; border: 1.5px solid color-mix(in srgb, var(--color-text) 34%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-text) 6%, transparent), color-mix(in srgb, var(--color-text) 2%, transparent)); }
.pq-cifra-l{ margin-top:6px; font-size: clamp(13px, min(.95vw, 1.6vh), 14.5px); font-weight:500; line-height:1.4; color: color-mix(in srgb, var(--color-text) 92%, transparent); }
.pq-pie{ margin: clamp(16px, 2.4vh, 26px) 0 0; padding-top: clamp(12px, 1.8vh, 16px); border-top: 1px solid color-mix(in srgb, var(--color-text) 24%, transparent); font-size: 14.5px; font-weight:500; color: color-mix(in srgb, var(--color-text) 88%, transparent); text-align:center; }
.pq-pie b{ font-weight: 800; letter-spacing: .06em; color: var(--color-text); margin-right: 4px; }
@media (max-width: 640px){
  .pq-razones{ grid-template-columns: 1fr; gap: 20px; }
}
`;

/* ======================= SECTORES ESTRATÉGICOS ======================= */

export async function SectorsSection({ theme, borrador }: { theme: Theme; borrador?: SectorVistaPrevia | null }) {
  const cfg = theme.tokens.sectors;
  if (cfg && cfg.show === false) return null;
  // En la vista previa del panel, la tarjeta del sector que se edita sale con lo
  // escrito aunque no se haya guardado (título y frase corta).
  const sobre = borrador ? textoPlanoSector(borrador.textos.sobre) : '';
  const sectors = (await getSectors())
    .map((s) => (borrador && s.id === borrador.id
      ? { ...s, title: borrador.title.trim() || s.title, description: borrador.frase?.trim() || (sobre ? recortarSector(sobre, 200) : null) }
      : s))
    .slice(0, cfg?.limit ?? 4);
  if (sectors.length === 0) return null;
  const cardH = cfg?.cardHeight ?? 340;
  const ctaColor = cfg?.ctaColor ?? 'var(--color-primary)';
  return (
    <BandaLuz lado="izquierda">
    <section>
      <div style={{ ...CONTAINER, paddingTop: 'clamp(44px, 8vh, 78px)', paddingBottom: 'clamp(44px, 8vh, 78px)' }}>
        <div style={{ marginBottom: 'clamp(24px, 3.6vh, 36px)' }}>
          <CenterHead eyebrow={t(theme, 'home.sectors.eyebrow')} title={t(theme, 'home.sectors.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
        </div>
        <style>{SC_CSS}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
          {sectors.map((s, i) => (
            <Link
              key={s.id}
              href={`/sectores/${s.slug}`}
              className="lift sc-tarjeta"
              style={{ position: 'relative', height: cardH, borderRadius: CARD_RADIUS, overflow: 'hidden', border: BORDE_TARJETA, textDecoration: 'none', display: 'block' }}
            >
              {/* Video en bucle si el sector tiene (la foto queda de portada); si no, la foto. */}
              {s.video ? (
                <VideoCategoria src={s.video} poster={s.image} className="zoom" />
              ) : s.image ? (
                <Image src={s.image} alt={s.title} fill sizes="(max-width:640px) 100vw, 25vw" className="zoom" style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph zoom" style={{ position: 'absolute', inset: 0 }} />
              )}
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,14,.95) 8%, rgba(8,10,14,.25) 60%, transparent)' }} />
              {/* Rediseño 2026-11-16: número del sector en azul, como las cifras de la referencia. */}
              <span aria-hidden className="sc-num">{String(i + 1).padStart(2, '0')}</span>
              <span style={{ position: 'absolute', left: 20, right: 20, bottom: 20, color: '#fff' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18.5px', letterSpacing: '-.015em', lineHeight: 1.2 }}>{s.title}</span>
                <span aria-hidden className="sc-raya" />
                {s.description ? (
                  // La tarjeta tiene alto fijo (token `cardHeight`): sin recortar,
                  // una descripción larga empujaba el CTA fuera de la tarjeta.
                  // Sin `display` inline: lo fija `.sector-desc` (recorte a 3
                  // líneas), y un inline le ganaría a la clase.
                  <span className="sector-desc" style={{ fontSize: '13px', color: 'rgba(255,255,255,.78)', lineHeight: 1.5, marginBottom: 12 }}>{s.description}</span>
                ) : null}
                <span className="sc-cta" style={{ color: ctaColor }}>{t(theme, 'home.sectors.cta')}<Icon name="arrowRight" size={13} /></span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
    </BandaLuz>
  );
}

const SC_CSS = `
.sc-num{ position:absolute; top:16px; left:18px; z-index:1; font-family: var(--font-display); font-weight:800; font-size:15px; letter-spacing:.04em; line-height:1;
  padding:8px 10px; border-radius:10px; color:#fff; border:1px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
  background: color-mix(in srgb, #06080c 55%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  box-shadow: 0 0 18px -6px var(--color-primary); }
.sc-raya{ display:block; width:36px; height:2px; margin:10px 0 10px; border-radius:2px; background: var(--color-primary); box-shadow: 0 0 10px var(--color-primary); transition: width .3s ease; }
.sc-tarjeta:hover .sc-raya{ width:76px; }
.sc-cta{ font-weight:700; font-size:13.5px; display:inline-flex; align-items:center; gap:6px; }
.sc-cta svg{ transition: transform .2s ease; }
.sc-tarjeta:hover .sc-cta svg{ transform: translateX(4px); }
@media (prefers-reduced-motion: reduce){ .sc-raya, .sc-cta svg{ transition:none; } }
`;

/* ============================= OFERTA ============================= */

export async function OfferSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.offer;
  if (cfg && cfg.show === false) return null;
  const bg = cfg?.bg ?? 'var(--band)';
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  const titleColor = cfg?.titleColor ?? '#fff';
  const ctaLink = cfg?.ctaLink || '/servicios'; // /productos ya solo redirige (2026-10-08)
  // Rediseño 2026-11-16 (el dueño: «se ve muy simple… en esa parte también se va
  // a poder meter un video»): tarjeta con rejilla de plano y brillo, etiqueta con
  // punto que late, titular grande y el visual (imagen o video) más alto,
  // enmarcado con esquinas de luz como los trazos de la referencia.
  return (
    <section style={{ ...CONTAINER, paddingTop: 'clamp(44px, 9vh, 88px)', paddingBottom: 'clamp(44px, 9vh, 88px)' }}>
      <style>{OF_CSS}</style>
      <div className="of-tarjeta" style={{ background: bg }}>
        <div aria-hidden className="of-rejilla" />
        <div aria-hidden className="of-brillo" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accent} 26%, transparent), transparent 62%)` }} />
        <div className="of-grid">
          <div style={{ minWidth: 0 }}>
            {/* Algo aclarado: en modo claro el azul del tema es oscuro y sobre la tarjeta marina casi no se leía. */}
            <span className="of-chip" style={{ color: `color-mix(in srgb, ${accent} 78%, #fff)` }}>
              <span aria-hidden className="of-punto" />
              {t(theme, 'home.offer.badge')}
            </span>
            <h2 className="of-titulo" style={{ color: titleColor }}>{t(theme, 'home.offer.title')}</h2>
            {/* El subtítulo sigue al color del título (configurable) al 72%:
                con el blanco fijo, un admin que eligiera fondo claro dejaba
                este texto invisible mientras el título sí se adaptaba. */}
            <p className="of-sub" style={{ color: `color-mix(in srgb, ${titleColor} 74%, transparent)` }}>{t(theme, 'home.offer.subtitle')}</p>
            <Link href={ctaLink} className="ms-btn ms-btn-lg of-cta" style={{ background: accent }}>
              {t(theme, 'home.offer.cta')} <Icon name="arrowRight" size={17} />
            </Link>
          </div>
          <div className="of-media">
            <span aria-hidden className="of-esq of-esq-a" />
            <span aria-hidden className="of-esq of-esq-b" />
            <span aria-hidden className="of-esq of-esq-c" />
            <span aria-hidden className="of-esq of-esq-d" />
            <div className="of-marco">
              {/* Video en bucle si hay (2026-11-16), con la imagen de portada; si no, la imagen. */}
              {cfg?.video ? (
                <VideoCategoria src={cfg.video} poster={cfg.image} boton />
              ) : cfg?.image ? (
                <Image src={cfg.image} alt={t(theme, 'home.offer.title')} fill sizes="(max-width:900px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
              ) : (
                <span className="ph" style={{ position: 'absolute', inset: 0 }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const OF_CSS = `
.of-tarjeta{ position:relative; overflow:hidden; isolation:isolate; border-radius:20px;
  border:1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  box-shadow: 0 44px 100px -44px color-mix(in srgb, var(--color-primary) 65%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 9%, transparent); }
.of-rejilla{ position:absolute; inset:0; z-index:-1; pointer-events:none;
  background-image: linear-gradient(color-mix(in srgb, #fff 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, #fff 5%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse 65% 90% at 25% 50%, #000 15%, transparent 75%); mask-image: radial-gradient(ellipse 65% 90% at 25% 50%, #000 15%, transparent 75%); }
.of-brillo{ position:absolute; z-index:-1; right:-8%; top:-45%; width:640px; height:640px; border-radius:50%; pointer-events:none; }
.of-grid{ display:grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: clamp(28px, 4vw, 60px); align-items:center; padding: clamp(24px, min(4.5vw, 6vh), 60px); }
.of-chip{ display:inline-flex; align-items:center; gap:9px; font-family: var(--font-display); font-weight:800; font-size:12.5px; letter-spacing:.08em; text-transform:uppercase; line-height:1;
  padding:8px 13px; border-radius:999px; border:1px solid color-mix(in srgb, currentColor 45%, transparent); background: color-mix(in srgb, currentColor 12%, transparent); }
.of-punto{ width:7px; height:7px; border-radius:50%; background: currentColor; animation: of-pulso 2.2s ease-out infinite; }
@keyframes of-pulso{ 0%{ box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 65%, transparent); } 75%,100%{ box-shadow: 0 0 0 9px transparent; } }
.of-titulo{ font-family: var(--font-display); font-weight:800; font-size: clamp(30px, 3.5vw, 50px); line-height:1.04; letter-spacing:-.025em; margin:20px 0 16px; text-wrap:balance; }
.of-sub{ font-size: clamp(15.5px, 1.2vw, 17.5px); line-height:1.6; max-width:46ch; margin:0 0 30px; text-wrap:pretty; }
.of-cta{ box-shadow: 0 14px 34px -12px color-mix(in srgb, var(--color-primary) 80%, transparent); transition: transform .2s ease, box-shadow .2s ease; }
.of-cta:hover{ transform: translateY(-2px); box-shadow: 0 20px 44px -12px color-mix(in srgb, var(--color-primary) 95%, transparent); }
.of-media{ position:relative; padding:14px; min-width:0; }
.of-marco{ position:relative; aspect-ratio: 16 / 10; border-radius:14px; overflow:hidden; background: color-mix(in srgb, #fff 5%, transparent);
  border:1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  box-shadow: 0 30px 70px -28px color-mix(in srgb, var(--color-primary) 75%, transparent); }
.of-esq{ position:absolute; width:38px; height:38px; border:0 solid var(--color-primary); pointer-events:none;
  filter: drop-shadow(0 0 5px var(--color-primary)); }
.of-esq-a{ top:0; left:0; border-top-width:2px; border-left-width:2px; border-top-left-radius:8px; }
.of-esq-b{ top:0; right:0; border-top-width:2px; border-right-width:2px; border-top-right-radius:8px; }
.of-esq-c{ bottom:0; left:0; border-bottom-width:2px; border-left-width:2px; border-bottom-left-radius:8px; }
.of-esq-d{ bottom:0; right:0; border-bottom-width:2px; border-right-width:2px; border-bottom-right-radius:8px; }
@media (max-width: 860px){
  .of-grid{ grid-template-columns: 1fr; }
  .of-media{ order:-1; padding:10px; }
}
@media (prefers-reduced-motion: reduce){ .of-punto{ animation:none; } }
`;

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
            style={{ margin: 0, scrollSnapAlign: 'start', flex: '0 0 min(400px, 84vw)', background: 'var(--color-surface)', border: BORDE_TARJETA, borderRadius: CARD_RADIUS, padding: 24, display: 'flex', flexDirection: 'column' }}
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
  // Rediseño 2026-11-16: línea de luz arriba, título como etiqueta azul entre
  // dos líneas y las marcas en Montserrat gruesa, que se encienden al pasar.
  return (
    <section className="mc">
      <style>{MC_CSS}</style>
      <div className="mc-cab">
        <span aria-hidden className="mc-linea" />
        <p className="mc-titulo">{brands.title}</p>
        <span aria-hidden className="mc-linea mc-linea-d" />
      </div>
      <div className="marquee-mask" style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 18, whiteSpace: 'nowrap', alignItems: 'center', padding: '6px 0' }}>
          {loop.map((b, i) => (
            <div key={`${b}-${i}`} aria-hidden={i >= list.length} className="mc-marca">
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MC_CSS = `
.mc{ position:relative; overflow:hidden; padding: 46px 0 50px; border-top:1px solid var(--color-border); border-bottom:1px solid var(--color-border);
  background: radial-gradient(900px 180px at 50% 0%, color-mix(in srgb, var(--color-primary) 11%, transparent), transparent 70%), var(--fondo-capa); }
.mc::before{ content:''; position:absolute; top:-1px; left:50%; width:min(620px, 72vw); height:1px; transform:translateX(-50%);
  background: linear-gradient(90deg, transparent, var(--color-primary), transparent); box-shadow: 0 0 14px var(--color-primary); }
.mc-cab{ display:flex; align-items:center; justify-content:center; gap:16px; margin:0 auto 26px; padding:0 16px; }
.mc-titulo{ margin:0; font-family: var(--font-display); font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color: var(--color-primary); text-align:center; text-wrap:balance; }
.mc-linea{ flex:0 1 120px; height:1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 75%, transparent)); }
.mc-linea-d{ transform: scaleX(-1); }
.mc-marca{ flex:0 0 auto; height:66px; min-width:172px; padding:0 28px; display:flex; align-items:center; justify-content:center; border-radius:12px;
  border:1px solid color-mix(in srgb, var(--color-text) 16%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-text) 6%, transparent), color-mix(in srgb, var(--color-text) 2%, transparent));
  font-family: var(--font-display); font-weight:800; font-size:17px; letter-spacing:.05em; text-transform:uppercase;
  color: color-mix(in srgb, var(--color-text) 66%, transparent); transition: color .2s ease, border-color .2s ease, box-shadow .2s ease; }
.mc-marca:hover{ color: var(--color-text); border-color: color-mix(in srgb, var(--color-primary) 65%, transparent); box-shadow: 0 0 24px -6px color-mix(in srgb, var(--color-primary) 75%, transparent); }
@media (max-width: 640px){ .mc{ padding: 36px 0 40px; } .mc-marca{ height:56px; min-width:140px; padding:0 20px; font-size:15px; } }
`;

/* ============================= FAQ ============================= */

/** Cuántas preguntas caben en el home; el resto va a /preguntas-frecuentes. */
export const FAQ_EN_HOME = 6;

export async function FaqSection({ theme }: { theme: Theme }) {
  const cfg = theme.tokens.faq;
  if (cfg && cfg.show === false) return null;
  // Sin preguntas publicadas la sección sigue: es donde se pregunta (2026-10-12).
  // Solo las 6 más recientes: las demás, en /preguntas-frecuentes (con buscador).
  const todas = await getFaqs();
  const faqs = todas.slice(0, FAQ_EN_HOME);
  const accent = cfg?.accentColor ?? 'var(--color-primary)';
  return (
    // `id` para poder enlazar aquí desde Ayuda (/#faq). La lista completa vive en /preguntas-frecuentes.
    <BandaLuz lado="izquierda">
    <section id="faq" style={{ maxWidth: 840, margin: '0 auto', padding: '80px clamp(16px, 4vw, 26px) 80px', scrollMarginTop: 90 }}>
      <div style={{ marginBottom: 32 }}>
        <CenterHead eyebrow={t(theme, 'home.faq.eyebrow')} title={t(theme, 'home.faq.title')} eyebrowColor={cfg?.eyebrowColor ?? undefined} titleColor={cfg?.titleColor ?? undefined} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {faqs.map((f) => (
          <details key={f.id} name="home-faq" className="faq" style={{ background: 'var(--color-surface)', border: BORDE_TARJETA, borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
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
      <div className="ms-panel" style={{ marginTop: faqs.length ? 18 : 0, display: 'flex', gap: '12px 20px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '16.5px', color: 'var(--color-text)' }}>{faqs.length ? '¿No encuentras tu respuesta?' : '¿Tienes una pregunta?'}</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Pregúntanos. Te contestamos por correo y, si le sirve a más gente, la publicamos.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {todas.length > FAQ_EN_HOME ? (
            <Link href="/preguntas-frecuentes" className="ms-btn ms-btn-sec">Ver todas ({todas.length})</Link>
          ) : null}
          <Link href="/preguntas-frecuentes?preguntar=1#preguntar" className="ms-btn">Hacer una pregunta</Link>
        </div>
      </div>
    </section>
    </BandaLuz>
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

