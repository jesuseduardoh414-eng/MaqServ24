import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseProductSlug } from '@maqserv/config';
import type { BlogCard, BlogDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getBlog, getBlogs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { BlogShare } from './BlogShare';

type Params = { slug: string };

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

async function fetchBySlug(slug: string): Promise<BlogDetail | null> {
  const id = parseProductSlug(slug);
  if (!id) return null;
  try {
    return await getBlog(id);
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .toUpperCase();
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
  return {
    title: `${blog.metaTitle ?? blog.title} — ${t(theme, 'site.name')}`,
    description: (blog.metaDescription ?? blog.excerpt).slice(0, 160),
    alternates: { canonical: `/blog/${blog.slug}` },
    openGraph: {
      title: blog.title,
      description: blog.excerpt,
      images: blog.image ? [blog.image] : [],
      type: 'article',
    },
  };
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: blog.title,
    image: blog.image ? [blog.image] : [],
    datePublished: blog.date ?? undefined,
    author: blog.author ? { '@type': 'Person', name: blog.author } : undefined,
    articleSection: blog.category,
  };

  return (
    <>
      <SiteHeader theme={theme} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        .blog-article :where(h2,h3) { font-family: ${DISPLAY}; margin: 40px 0 10px; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); line-height: 1.15; }
        .blog-article :where(h4,h5) { font-family: ${DISPLAY}; margin: 32px 0 8px; font-size: 20px; font-weight: 700; color: var(--color-text); }
        .blog-article p { margin: 0 0 22px; font-size: 18px; line-height: 1.75; color: color-mix(in srgb, var(--color-text) 82%, transparent); }
        .blog-article > p:first-of-type { font-size: 21px; line-height: 1.62; color: var(--color-text); font-weight: 500; }
        .blog-article ul, .blog-article ol { margin: 0 0 22px; padding-left: 1.3em; font-size: 18px; line-height: 1.7; color: color-mix(in srgb, var(--color-text) 82%, transparent); }
        .blog-article li { margin-bottom: 8px; }
        .blog-article a { color: var(--color-primary); text-decoration: underline; }
        .blog-article img { max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0 22px; }
        .blog-article blockquote { margin: 0 0 22px; padding-left: 18px; border-left: 3px solid var(--color-primary); color: var(--color-text-muted); font-style: italic; }
        .blog-art-grid { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 56px; align-items: start; }
        @media (max-width: 940px) {
          .blog-art-grid { grid-template-columns: 1fr !important; }
          .blog-art-aside { position: static !important; }
        }
        @media (max-width: 640px) {
          .blog-art-title { font-size: 34px !important; }
          .blog-art-wrap { padding-left: 22px !important; padding-right: 22px !important; }
        }
      `}</style>

      <main className="blog-art-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px 40px', background: 'var(--color-bg)' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 34 }}>
          <Link href="/blog" style={{ color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="arrowLeft" size={12} />BITÁCORA</Link>
          {'  /  '}
          <span style={{ color: 'var(--color-text)' }}>{blog.category}</span>
        </div>

        <div className="blog-art-grid" style={hasAside ? undefined : { gridTemplateColumns: '1fr', maxWidth: 780 }}>
          {/* Artículo */}
          <article style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', color: 'var(--color-text-muted)', marginBottom: 22 }}>
              <span style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="dot" size={12} fill />{blog.category}</span>
              <span>{fmtDate(blog.date)}</span>
              <span>· {blog.readTime}</span>
            </div>
            <h1 className="blog-art-title" style={{ fontFamily: DISPLAY, margin: '0 0 24px', fontSize: 46, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text)' }}>
              {blog.title}
            </h1>
            <p style={{ margin: '0 0 30px', fontSize: 21, lineHeight: 1.5, color: 'var(--color-text-muted)', fontWeight: 500 }}>{deck}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 30, borderBottom: '1px solid var(--color-border)', marginBottom: 30 }}>
              {blog.author ? (
                <>
                  <span style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--color-primary-fg)', background: 'var(--color-primary)' }}>
                    {initialsOf(blog.author)}
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{blog.author}</div>
                </>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>MAQSER24 · BITÁCORA</span>
              )}
            </div>

            {blog.image ? (
              <div style={{ borderRadius: 6, overflow: 'hidden', background: 'var(--color-surface)', marginBottom: 36 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={blog.image} alt={blog.title} style={{ width: '100%', maxHeight: 460, objectFit: 'cover', display: 'block' }} />
              </div>
            ) : null}

            <div className="blog-article" dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />

            <div style={{ marginTop: 48, paddingTop: 26, borderTop: '2px solid var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/blog" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="arrowLeft" size={17} />Volver a la bitácora</Link>
              <BlogShare title={blog.title} />
            </div>
          </article>

          {/* Sidebar: Lo más leído */}
          {hasAside ? (
            <aside className="blog-art-aside" style={{ position: 'sticky', top: 96 }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '28px 24px' }}>
                <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-primary)', marginBottom: 6 }}>RANKING</div>
                <h3 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>Lo más leído</h3>
                {popular.map((post, i) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, padding: '16px 0', borderTop: '1px solid var(--color-border)', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, color: 'color-mix(in srgb, var(--color-text) 22%, transparent)', lineHeight: 1, width: 32 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: 5 }}>{post.category}</div>
                      <h4 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 15, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text)' }}>{post.title}</h4>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </main>

      {/* Sigue leyendo */}
      {related.length > 0 ? (
        <section style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', marginTop: 24 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 40 }}>
              <h2 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>Sigue leyendo</h2>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.14em' }}>RELACIONADOS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 36 }}>
              {related.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ height: 170, borderRadius: 4, overflow: 'hidden', background: 'var(--color-bg)' }}>
                    {post.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.image} alt={post.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))', backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 14px, transparent 14px 28px)' }} />
                    )}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: 'var(--color-text-muted)', margin: '16px 0 8px' }}>{post.category} · {post.readTime}</div>
                  <h3 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 21, lineHeight: 1.12, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{post.title}</h3>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.7 }}>{fmtDate(post.date)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <SiteFooter theme={theme} />
    </>
  );
}
