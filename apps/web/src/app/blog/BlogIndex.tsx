'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { BlogCard } from '@maqserv/types';

/**
 * Bitácora (blog) — vista de lista del diseño "Blog.dc.html".
 * Todo el color/tipografía sale de tokens (--color-*) para respetar la
 * regla de diseño configurable. Las categorías, autor, fecha, vistas y
 * tiempo de lectura son datos reales de la BD (nada inventado).
 */

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';
const DARK = 'var(--band)';
const AMBER = 'var(--color-primary)';

// Orden canónico de las categorías (coincide con el selector del admin).
const CAT_ORDER = ['Guías', 'Mantenimiento', 'Seguridad', 'Finanzas', 'Noticias', 'Industria', 'General'];

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

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: size > 36 ? 13 : 11, fontWeight: 700,
        color: 'var(--color-primary-fg)', background: AMBER,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

function Media({ post, height, radius = 3, label = true }: { post: BlogCard; height: number | string; radius?: number; label?: boolean }) {
  if (post.image) {
    return (
      <div style={{ height, borderRadius: radius, overflow: 'hidden', background: 'var(--color-surface)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.image} alt={post.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div
      style={{
        height, borderRadius: radius,
        background: 'color-mix(in srgb, var(--color-primary) 7%, var(--color-surface))',
        backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 14px, transparent 14px 28px)',
        display: 'flex', alignItems: 'flex-end', padding: 14,
      }}
    >
      {label ? (
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '5px 9px', borderRadius: 4, letterSpacing: '.04em' }}>
          {post.category}
        </span>
      ) : null}
    </div>
  );
}

const secTitle: React.CSSProperties = { fontFamily: DISPLAY, margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' };
const secTag: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.14em' };

export function BlogIndex({ posts, eyebrow, title, subtitle }: { posts: BlogCard[]; eyebrow: string; title: string; subtitle: string }) {
  const [cat, setCat] = useState('Todas');

  const present = useMemo(() => {
    const set = new Set(posts.map((p) => p.category));
    const ordered = CAT_ORDER.filter((c) => set.has(c));
    const extra = [...set].filter((c) => !CAT_ORDER.includes(c));
    return [...ordered, ...extra];
  }, [posts]);

  const chips = ['Todas', ...present];
  // Chips y marquee solo con 2+ categorías reales; con una sola (p. ej. todo
  // "General") se ocultan para que el hero quede limpio.
  const showCategories = present.length >= 2;
  const isTodas = cat === 'Todas';

  const featured = posts[0];
  const latest = posts.slice(1, 4);
  const gridTodas = posts.slice(4);
  const popular = [...posts].sort((a, b) => b.views - a.views).slice(0, 5);
  const filtered = posts.filter((p) => p.category === cat);
  const grid = isTodas ? gridTodas : filtered;

  const marquee = showCategories
    ? Array(2).fill(present.map((c) => c.toUpperCase()).join('   ✦   ')).join('   ✦   ')
    : '';

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <style>{`
        .blog-cta:hover { color: var(--color-primary) !important; }
        .blog-card { text-decoration: none; color: inherit; display: block; }
        @media (max-width: 900px) {
          .blog-container { padding-left: 20px !important; padding-right: 20px !important; }
          .blog-todas-grid, .blog-more-wrap { grid-template-columns: 1fr !important; }
          .blog-more-cards { grid-template-columns: 1fr !important; }
          .blog-filtered-grid { grid-template-columns: 1fr 1fr !important; }
          .blog-hero-title { font-size: 68px !important; }
          .blog-more-aside { position: static !important; }
        }
        @media (max-width: 560px) {
          .blog-filtered-grid { grid-template-columns: 1fr !important; }
          .blog-hero-title { font-size: 46px !important; }
          .blog-featured-title { font-size: 28px !important; }
        }
      `}</style>

      {/* HERO */}
      <section style={{ background: DARK, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: -70, right: -30, fontFamily: DISPLAY, fontSize: 300, fontWeight: 800, color: 'rgba(255,255,255,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>24</div>
        <div className="blog-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '76px 40px 40px', position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.28em', color: AMBER, marginBottom: 22, textTransform: 'uppercase' }}>{eyebrow}</div>
          <h1 className="blog-hero-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 104, lineHeight: 0.86, fontWeight: 800, letterSpacing: '-0.05em' }}>{title}</h1>
          {subtitle ? (
            <p style={{ margin: '26px 0 0', fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,.62)', maxWidth: '52ch' }}>{subtitle}</p>
          ) : null}
          {showCategories ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 40 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: 'rgba(255,255,255,.42)', marginRight: 6 }}>EXPLORAR</span>
              {chips.map((c) => {
                const on = c === cat;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
                      padding: '8px 15px', borderRadius: 100,
                      border: `1px solid ${on ? AMBER : 'rgba(255,255,255,.18)'}`,
                      background: on ? AMBER : 'transparent',
                      color: on ? 'var(--color-primary-fg)' : 'rgba(255,255,255,.8)',
                      transition: 'all .18s ease',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {marquee ? (
          <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,.09)', marginTop: 44, padding: '12px 0' }}>
            <div style={{ display: 'inline-flex', whiteSpace: 'nowrap', animation: 'blogmarq 26s linear infinite', fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', color: 'rgba(255,255,255,.32)' }}>
              <span>{marquee}&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;</span>
            </div>
          </div>
        ) : null}
        <style>{`@keyframes blogmarq { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </section>

      {posts.length === 0 ? (
        <div className="blog-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Aún no hay entradas en la bitácora.
        </div>
      ) : isTodas ? (
        <main className="blog-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 40px 40px' }}>
          {/* ÚLTIMAS HISTORIAS */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 40 }}>
            <h2 style={secTitle}>Últimas historias</h2>
            <span style={secTag}>LO MÁS NUEVO</span>
          </div>

          <div className="blog-todas-grid" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 52, marginBottom: 88 }}>
            {/* Destacado */}
            {featured ? (
              <Link href={`/blog/${featured.slug}`} className="blog-card">
                <Media post={featured} height={320} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', margin: '22px 0 14px' }}>
                  <span style={{ color: AMBER }}>● {featured.category}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{fmtDate(featured.date)} · {featured.readTime}</span>
                </div>
                <h3 className="blog-featured-title" style={{ fontFamily: DISPLAY, margin: '0 0 14px', fontSize: 38, lineHeight: 1.03, fontWeight: 700, letterSpacing: '-0.03em' }}>{featured.title}</h3>
                <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.6, color: 'var(--color-text-muted)', maxWidth: '52ch' }}>{featured.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {featured.author ? (
                    <>
                      <Avatar name={featured.author} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{featured.author}</span>
                    </>
                  ) : null}
                  <span className="blog-cta" style={{ marginLeft: featured.author ? 14 : 0, fontFamily: DISPLAY, fontWeight: 700, color: 'var(--color-text)' }}>Leer artículo →</span>
                </div>
              </Link>
            ) : null}

            {/* Últimas */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {latest.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="blog-card"
                  style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 18, padding: '22px 0', borderTop: '1px solid var(--color-border)', alignItems: 'start' }}
                >
                  <Media post={post} height={104} label={false} />
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                      <span style={{ color: 'var(--color-text)' }}>{post.category}</span> · {post.readTime}
                    </div>
                    <h4 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 19, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em' }}>{post.title}</h4>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.7 }}>{fmtDate(post.date)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* MÁS ARTÍCULOS + LO MÁS LEÍDO */}
          {(gridTodas.length > 0 || popular.length > 0) ? (
            <div className="blog-more-wrap" style={{ display: 'grid', gridTemplateColumns: gridTodas.length > 0 ? '1fr 340px' : '1fr', gap: 56, alignItems: 'start' }}>
              {gridTodas.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 36 }}>
                    <h2 style={secTitle}>Más artículos</h2>
                    <span style={secTag}>{String(gridTodas.length).padStart(2, '0')} ARTÍCULOS</span>
                  </div>
                  <div className="blog-more-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '44px 40px' }}>
                    {gridTodas.map((post) => (
                      <GridCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              ) : null}

              <aside className="blog-more-aside" style={{ position: 'sticky', top: 96, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '32px 28px' }}>
                <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: AMBER, marginBottom: 6 }}>RANKING</div>
                <h3 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Lo más leído</h3>
                {popular.map((post, i) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, padding: '18px 0', borderTop: '1px solid var(--color-border)', alignItems: 'center' }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, color: 'color-mix(in srgb, var(--color-text) 22%, transparent)', lineHeight: 1, width: 38 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: 5 }}>{post.category}</div>
                      <h4 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 15, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.01em' }}>{post.title}</h4>
                    </div>
                  </Link>
                ))}
              </aside>
            </div>
          ) : null}
        </main>
      ) : (
        /* Vista filtrada por categoría */
        <main className="blog-container" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 40px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 40 }}>
            <h2 style={{ ...secTitle, fontSize: 34 }}>{cat}</h2>
            <span style={secTag}>{String(filtered.length).padStart(2, '0')} ARTÍCULOS</span>
          </div>
          {filtered.length > 0 ? (
            <div className="blog-filtered-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '48px 36px' }}>
              {filtered.map((post) => (
                <GridCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>No hay artículos en esta categoría todavía.</p>
          )}
        </main>
      )}
    </div>
  );
}

function GridCard({ post }: { post: BlogCard }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card" style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 16 }}>
      <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: MONO, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--color-text-muted)', alignSelf: 'start', paddingTop: 2 }}>{post.category}</div>
      <div>
        <Media post={post} height={200} />
        <h3 style={{ fontFamily: DISPLAY, margin: '20px 0 10px', fontSize: 23, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em' }}>{post.title}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{post.excerpt}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
          {post.author ? (
            <>
              <Avatar name={post.author} size={26} />
              <span>{post.author} · {fmtDate(post.date)}</span>
            </>
          ) : (
            <span>{fmtDate(post.date)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
