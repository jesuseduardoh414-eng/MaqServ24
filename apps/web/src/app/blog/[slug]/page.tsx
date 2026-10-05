import type { Metadata } from 'next';
import { paginaSeo, migas, SITE_URL, IMAGEN_OG } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { parseProductSlug } from '@maqserv/config';
import type { BlogCard, BlogDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getBlog, getBlogs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { BlogShare } from './BlogShare';

type Params = { slug: string };

const DISPLAY = 'var(--font-display)';

async function fetchBySlug(slug: string): Promise<BlogDetail | null> {
  const id = parseProductSlug(slug);
  if (!id) return null;
  try {
    return await getBlog(id);
  } catch (err) {
    // 404 real → notFound(); API caída → error boundary (no un 404 indexable).
    if (err instanceof Error && /→ 404/.test(err.message)) return null;
    throw err;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter((w) => w[0] && w[0] === w[0].toUpperCase());
  const ini = parts.slice(0, 2).map((w) => w[0]).join('');
  return ini || name.slice(0, 2).toUpperCase();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [theme, blog] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!blog) return { title: t(theme, 'site.name') };
  // Con metaTitle del panel va tal cual (ya viene pensado entero); si no, título + sitio.
  return paginaSeo(theme, {
    ruta: `/blog/${blog.slug}`,
    titulo: blog.metaTitle || blog.title,
    sinSufijo: !!blog.metaTitle,
    descripcion: (blog.metaDescription || blog.excerpt).slice(0, 160),
    imagen: blog.image,
    tipo: 'article',
  });
}

export default async function BlogPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [theme, blog, all] = await Promise.all([getTheme(), fetchBySlug(slug), getBlogs(12).catch(() => [] as BlogCard[])]);
  if (!blog) notFound();

  const others = all.filter((b) => b.id !== blog.id);
  // Sidebar "Lo más leído": por vistas reales.
  const popular = [...others].sort((a, b) => b.views - a.views).slice(0, 5);
  // "Sigue leyendo": misma categoría primero, luego el resto.
  const sameCat = others.filter((b) => b.category === blog.category);
  const related = [...sameCat, ...others.filter((b) => b.category !== blog.category)].slice(0, 3);
  const hasAside = popular.length > 0;
  // Subtítulo: preferimos la meta descripción (resumen escrito a mano) para que
  // no repita el primer párrafo del cuerpo; si no hay, usamos el extracto.
  const deck = blog.metaDescription?.trim() || blog.excerpt;

  const sitio = t(theme, 'site.name');
  const urlArticulo = `${SITE_URL}/blog/${blog.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': urlArticulo },
    url: urlArticulo,
    headline: blog.title,
    description: deck,
    image: blog.image ? [blog.image] : [`${SITE_URL}${IMAGEN_OG}`],
    datePublished: blog.date ?? undefined,
    // El byline sale del campo `source` del panel; si está vacío, firma la marca.
    author: blog.author ? { '@type': 'Person', name: blog.author } : { '@type': 'Organization', name: sitio, url: SITE_URL },
    publisher: { '@type': 'Organization', name: sitio, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/maqser24-logo.png` } },
    articleSection: blog.category,
  };

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={[jsonLd, migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: t(theme, 'nav.blog'), ruta: '/blog' }, { nombre: blog.title }])]} />
      {/* Sistema de diseño 2026-09-30: contenedor, títulos, tarjetas y chips
          salen de `ms-*`; aquí solo lo propio del artículo (prefijo `blog-`). */}
      <style>{`
        .blog-article :where(h2,h3) { font-family: ${DISPLAY}; margin: 36px 0 10px; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); line-height: 1.2; }
        .blog-article :where(h4,h5) { font-family: ${DISPLAY}; margin: 28px 0 8px; font-size: 19px; font-weight: 700; color: var(--color-text); }
        .blog-article p { margin: 0 0 20px; font-size: 17px; line-height: 1.75; color: color-mix(in srgb, var(--color-text) 84%, transparent); }
        .blog-article > p:first-of-type { font-size: 19px; line-height: 1.65; color: var(--color-text); }
        .blog-article ul, .blog-article ol { margin: 0 0 20px; padding-left: 1.3em; font-size: 17px; line-height: 1.7; color: color-mix(in srgb, var(--color-text) 84%, transparent); }
        .blog-article li { margin-bottom: 8px; }
        .blog-article a { color: var(--color-primary); text-decoration: underline; }
        .blog-article img { max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0 20px; }
        .blog-article blockquote { margin: 0 0 20px; padding: 4px 0 4px 16px; border-left: 2px solid var(--color-primary); color: var(--color-text-muted); font-style: italic; }
        .blog-art-grid { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 48px; align-items: start; }
        .blog-art-solo { grid-template-columns: minmax(0,1fr); max-width: 780px; }
        .blog-art-title { margin: 12px 0 0; font-family: ${DISPLAY}; font-size: clamp(30px, 4.4vw, 44px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; text-wrap: balance; }
        .blog-meta { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; font-size: 13.5px; color: var(--color-text-muted); }
        .blog-crumb { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--color-text-muted); text-decoration: none; }
        .blog-crumb:hover { color: var(--color-text); }
        .blog-media { position: relative; height: min(440px, 52vw); border-radius: 12px; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); margin-bottom: 32px; }
        .blog-art-aside { position: sticky; top: 96px; }
        .blog-rank { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 12px; padding: 14px 0; border-top: 1px solid var(--color-border); align-items: start; text-decoration: none; color: inherit; }
        .blog-rank:hover h3, .blog-rel:hover h3 { color: var(--color-primary); }
        .blog-rank-n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 700; color: var(--color-text-muted); border: 1px solid var(--color-border); font-variant-numeric: tabular-nums; }
        .blog-rel { text-decoration: none; color: inherit; display: block; min-width: 0; }
        .blog-rel h3, .blog-rank h3 { transition: color .18s ease; }
        .blog-rel-img { height: 170px; border-radius: 12px; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); }
        @media (max-width: 940px) {
          .blog-art-grid { grid-template-columns: minmax(0,1fr); }
          .blog-art-aside { position: static; }
        }
      `}</style>

      <div className="ms-page">
        <main className="ms-wrap">
          <nav aria-label="Ruta" style={{ marginBottom: 28 }}>
            <Link href="/blog" className="blog-crumb"><Icon name="arrowLeft" size={14} />Bitácora</Link>
            <span className="ms-muted" style={{ margin: '0 8px' }}>/</span>
            <span style={{ fontSize: 13.5 }}>{blog.category}</span>
          </nav>

          <div className={`blog-art-grid${hasAside ? '' : ' blog-art-solo'}`}>
            {/* Artículo */}
            <article style={{ minWidth: 0 }}>
              <div className="blog-meta">
                <span className="ms-chip ms-chip-info">{blog.category}</span>
                <span>{fmtDate(blog.date)}</span>
                <span>· {blog.readTime}</span>
              </div>
              <h1 className="blog-art-title">{blog.title}</h1>
              <p className="ms-hero-desc" style={{ marginTop: 14 }}>{deck}</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 28 }}>
                {blog.author ? (
                  <>
                    <span aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-fg)', background: 'var(--color-primary)' }}>
                      {initialsOf(blog.author)}
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{blog.author}</div>
                  </>
                ) : (
                  <span className="ms-small ms-muted">MAQSER24 · Bitácora</span>
                )}
              </div>

              {blog.image ? (
                // next/image con `fill`: es el LCP del artículo — el <img> crudo
                // servía el original de Storage sin resize ni webp.
                <div className="blog-media">
                  <Image src={blog.image} alt={blog.title} fill priority sizes="(max-width: 940px) 100vw, 780px" style={{ objectFit: 'cover' }} />
                </div>
              ) : null}

              <div className="blog-article" dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />

              <div style={{ marginTop: 40, paddingTop: 22, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <Link href="/blog" className="ms-link"><Icon name="arrowLeft" size={15} />Volver a la bitácora</Link>
                <BlogShare title={blog.title} />
              </div>
            </article>

            {/* Lateral: Lo más leído */}
            {hasAside ? (
              <aside className="blog-art-aside">
                <div className="ms-panel">
                  <h2 className="ms-h2" style={{ marginBottom: 8 }}>Lo más leído</h2>
                  {popular.map((post, i) => (
                    <Link key={post.id} href={`/blog/${post.slug}`} className="blog-rank">
                      <span className="blog-rank-n" aria-hidden>{i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ms-small ms-muted" style={{ marginBottom: 3 }}>{post.category}</div>
                        <h3 style={{ margin: 0, fontSize: 14.5, lineHeight: 1.35, fontWeight: 600 }}>{post.title}</h3>
                      </div>
                    </Link>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>

          {/* Sigue leyendo */}
          {related.length > 0 ? (
            <section className="ms-section" style={{ marginTop: 64, paddingTop: 40, borderTop: '1px solid var(--color-border)' }}>
              <div className="ms-sec-head">
                <h2 className="ms-h2">Sigue leyendo</h2>
              </div>
              <div className="ms-cards" style={{ gap: 24 }}>
                {related.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="blog-rel">
                    <div className="blog-rel-img">
                      {post.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.image} alt={post.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div aria-hidden style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)' }}><Icon name="article" size={22} /></div>
                      )}
                    </div>
                    <div className="blog-meta" style={{ margin: '14px 0 6px' }}>
                      <span className="ms-chip">{post.category}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h3 style={{ fontFamily: DISPLAY, margin: '0 0 6px', fontSize: 18, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.015em' }}>{post.title}</h3>
                    <span className="ms-small ms-muted">{fmtDate(post.date)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <SiteFooter theme={theme} />
    </>
  );
}
