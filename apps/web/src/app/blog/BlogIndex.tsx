'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { BlogCard } from '@maqserv/types';
import { Icon } from '@/components/Icon';

/**
 * Bitácora (blog) — vista de lista.
 *
 * Sistema de diseño 2026-09-30: contenedor, encabezado, pestañas, tarjetas y
 * títulos salen de las clases `ms-*` (EstilosSistema.tsx); lo propio de esta
 * vista va en `<style>` con prefijo `bl-`. Se retiraron las etiquetas en
 * MAYÚSCULAS espaciadas, el "24" gigante de fondo, la cinta de categorías en
 * movimiento y las rayas de 2 px. Las categorías, autor, fecha, vistas y
 * tiempo de lectura son datos reales de la BD (nada inventado).
 */

// Orden canónico de las categorías (coincide con el selector del admin).
const CAT_ORDER = ['Guías', 'Mantenimiento', 'Seguridad', 'Finanzas', 'Noticias', 'Industria', 'General'];

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

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="bl-avatar" style={{ width: size, height: size, fontSize: size > 36 ? 13 : 11 }}>
      {initialsOf(name)}
    </span>
  );
}

function Media({ post, height }: { post: BlogCard; height: number | string }) {
  return (
    <div className="bl-media" style={{ height }}>
      {post.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt={post.title} loading="lazy" />
      ) : (
        <span className="bl-media-ph" aria-hidden><Icon name="article" size={22} /></span>
      )}
    </div>
  );
}

const CSS = `
.bl-tabs{ margin-top:24px; }
.bl-card{ text-decoration:none; color:inherit; display:block; min-width:0; }
.bl-card:hover .bl-t{ color:var(--color-primary); }
.bl-card:focus-visible{ outline:2px solid var(--color-primary); outline-offset:4px; border-radius:12px; }
.bl-t{ transition:color .18s ease; }
.bl-media{ position:relative; border-radius:12px; overflow:hidden; background:var(--color-surface); border:1px solid var(--color-border); }
.bl-media img{ width:100%; height:100%; object-fit:cover; display:block; }
.bl-media-ph{ position:absolute; inset:0; display:grid; place-items:center; color:var(--color-text-muted); background:color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); }
.bl-avatar{ border-radius:50%; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; font-weight:700; color:var(--color-primary-fg); background:var(--color-primary); }
.bl-meta{ display:flex; align-items:center; gap:8px 10px; flex-wrap:wrap; font-size:13px; color:var(--color-text-muted); }
.bl-top{ display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); gap:40px; }
.bl-feat-t{ font-family:var(--font-display); margin:12px 0 10px; font-size:28px; line-height:1.15; font-weight:700; letter-spacing:-.025em; text-wrap:balance; }
.bl-latest{ display:grid; grid-template-columns:104px minmax(0,1fr); gap:16px; padding:18px 0; border-top:1px solid var(--color-border); align-items:start; }
.bl-latest:first-child{ border-top:none; padding-top:0; }
.bl-more{ display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:40px; align-items:start; }
.bl-more-solo{ grid-template-columns:minmax(0,1fr); }
.bl-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap:28px 24px; }
.bl-aside{ position:sticky; top:96px; }
.bl-rank{ display:grid; grid-template-columns:28px minmax(0,1fr); gap:12px; padding:14px 0; border-top:1px solid var(--color-border); align-items:start; }
.bl-rank-n{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; font-size:13px; font-weight:700; color:var(--color-text-muted); border:1px solid var(--color-border); font-variant-numeric:tabular-nums; }
@media (max-width: 900px){
  .bl-top, .bl-more{ grid-template-columns:minmax(0,1fr); }
  .bl-aside{ position:static; }
}
@media (max-width: 640px){
  .bl-feat-t{ font-size:24px; }
  .bl-latest{ grid-template-columns:84px minmax(0,1fr); }
}
`;

export function BlogIndex({ posts, eyebrow, title, subtitle }: { posts: BlogCard[]; eyebrow: string; title: string; subtitle: string }) {
  const [cat, setCat] = useState('Todas');

  const present = useMemo(() => {
    const set = new Set(posts.map((p) => p.category));
    const ordered = CAT_ORDER.filter((c) => set.has(c));
    const extra = [...set].filter((c) => !CAT_ORDER.includes(c));
    return [...ordered, ...extra];
  }, [posts]);

  const chips = ['Todas', ...present];
  // Pestañas solo con 2+ categorías reales; con una sola (p. ej. todo
  // "General") se ocultan para que el encabezado quede limpio.
  const showCategories = present.length >= 2;
  const isTodas = cat === 'Todas';

  const featured = posts[0];
  const latest = posts.slice(1, 4);
  const gridTodas = posts.slice(4);
  const popular = [...posts].sort((a, b) => b.views - a.views).slice(0, 5);
  const filtered = posts.filter((p) => p.category === cat);

  return (
    <div className="ms-page">
      <style>{CSS}</style>
      <main className="ms-wrap">
        {/* ENCABEZADO */}
        <header className="ms-hero" style={{ paddingTop: 16 }}>
          {eyebrow ? <p className="ms-kicker">{eyebrow}</p> : null}
          <h1 className="ms-hero-title">{title}</h1>
          {subtitle ? <p className="ms-hero-desc">{subtitle}</p> : null}
          {showCategories ? (
            <div className="ms-tabs bl-tabs" role="tablist" aria-label="Categorías">
              {chips.map((c) => (
                <button key={c} type="button" role="tab" className="ms-tab" aria-selected={c === cat} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {posts.length === 0 ? (
          <div className="ms-empty">
            <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="article" size={22} /></span>
            <p className="ms-empty-t">Aún no hay entradas en la bitácora</p>
          </div>
        ) : isTodas ? (
          <>
            {/* ÚLTIMAS HISTORIAS */}
            <section className="ms-section">
              <div className="ms-sec-head">
                <h2 className="ms-h2">Últimas historias</h2>
              </div>
              <div className="bl-top">
                {featured ? (
                  <Link href={`/blog/${featured.slug}`} className="bl-card">
                    <Media post={featured} height="clamp(200px, 30vw, 320px)" />
                    <div className="bl-meta" style={{ marginTop: 16 }}>
                      <span className="ms-chip ms-chip-info">{featured.category}</span>
                      <span>{fmtDate(featured.date)} · {featured.readTime}</span>
                    </div>
                    <h3 className="bl-feat-t bl-t">{featured.title}</h3>
                    <p style={{ margin: '0 0 16px', fontSize: 15.5, lineHeight: 1.6, color: 'var(--color-text-muted)', maxWidth: '60ch' }}>{featured.excerpt}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {featured.author ? (
                        <>
                          <Avatar name={featured.author} />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{featured.author}</span>
                        </>
                      ) : null}
                      <span className="ms-link" style={{ marginLeft: featured.author ? 8 : 0 }}>Leer artículo<Icon name="arrowRight" size={15} /></span>
                    </div>
                  </Link>
                ) : null}

                {latest.length > 0 ? (
                  <div style={{ minWidth: 0 }}>
                    {latest.map((post) => (
                      <Link key={post.id} href={`/blog/${post.slug}`} className="bl-card bl-latest">
                        <Media post={post} height={84} />
                        <div style={{ minWidth: 0 }}>
                          <div className="bl-meta" style={{ marginBottom: 6 }}>
                            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{post.category}</span>
                            <span>· {post.readTime}</span>
                          </div>
                          <h3 className="bl-t" style={{ fontFamily: 'var(--font-display)', margin: '0 0 6px', fontSize: 17, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-.01em' }}>{post.title}</h3>
                          <span className="ms-small ms-muted">{fmtDate(post.date)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {/* MÁS ARTÍCULOS + LO MÁS LEÍDO */}
            {gridTodas.length > 0 || popular.length > 0 ? (
              <section className="ms-section" style={{ marginTop: 64 }}>
                <div className={`bl-more${gridTodas.length > 0 ? '' : ' bl-more-solo'}`}>
                  {gridTodas.length > 0 ? (
                    <div style={{ minWidth: 0 }}>
                      <div className="ms-sec-head">
                        <h2 className="ms-h2">Más artículos</h2>
                        <span className="ms-chip">{gridTodas.length} {gridTodas.length === 1 ? 'artículo' : 'artículos'}</span>
                      </div>
                      <div className="bl-grid">
                        {gridTodas.map((post) => (
                          <GridCard key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <aside className="ms-panel bl-aside">
                    <h2 className="ms-h2" style={{ marginBottom: 8 }}>Lo más leído</h2>
                    {popular.map((post, i) => (
                      <Link key={post.id} href={`/blog/${post.slug}`} className="bl-card bl-rank">
                        <span className="bl-rank-n" aria-hidden>{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ms-small ms-muted" style={{ marginBottom: 3 }}>{post.category}</div>
                          <h3 className="bl-t" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.35, fontWeight: 600 }}>{post.title}</h3>
                        </div>
                      </Link>
                    ))}
                  </aside>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          /* Vista filtrada por categoría */
          <section className="ms-section">
            <div className="ms-sec-head">
              <h2 className="ms-h2">{cat}</h2>
              <span className="ms-chip">{filtered.length} {filtered.length === 1 ? 'artículo' : 'artículos'}</span>
            </div>
            {filtered.length > 0 ? (
              <div className="bl-grid">
                {filtered.map((post) => (
                  <GridCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="ms-muted" style={{ fontSize: 15 }}>No hay artículos en esta categoría todavía.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function GridCard({ post }: { post: BlogCard }) {
  return (
    <Link href={`/blog/${post.slug}`} className="bl-card">
      <Media post={post} height={190} />
      <div className="bl-meta" style={{ marginTop: 14 }}>
        <span className="ms-chip">{post.category}</span>
        <span>{post.readTime}</span>
      </div>
      <h3 className="bl-t" style={{ fontFamily: 'var(--font-display)', margin: '10px 0 8px', fontSize: 19, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-.015em' }}>{post.title}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{post.excerpt}</p>
      <div className="bl-meta">
        {post.author ? (
          <>
            <Avatar name={post.author} size={24} />
            <span>{post.author} · {fmtDate(post.date)}</span>
          </>
        ) : (
          <span>{fmtDate(post.date)}</span>
        )}
      </div>
    </Link>
  );
}
