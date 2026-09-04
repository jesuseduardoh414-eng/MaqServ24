import type { Metadata } from 'next';
import Link from 'next/link';
import { getTheme, t } from '@/lib/theme';
import { getProducts, getCategories, getSubcategories } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { ProductCard } from '@/components/ProductCard';
import { Pagination } from '@/components/Pagination';
import { Band } from '@/components/Band';
import { CatalogFilters } from '@/components/CatalogFilters';
import { filtersToQuery, hasFilters, type CatalogSearch } from '@/lib/catalog-filters';

type Search = { q?: string; categoria?: string; subcategoria?: string; page?: string } & CatalogSearch;

const CONTAINER: React.CSSProperties = { maxWidth: 1320, margin: '0 auto', padding: '0 clamp(16px, 4vw, 26px)' };

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'catalog.title')} — ${t(theme, 'site.name')}` };
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const [theme, categories, result, subcategories] = await Promise.all([
    getTheme(),
    getCategories(),
    // El catálogo es la página más visitada: si la API no responde conviene
    // enseñar la página con la parrilla vacía antes que un 500. Pasa cuando la
    // API de Render (plan free) está despertando y la función de Vercel se
    // corta antes.
    getProducts({
      page,
      search: sp.q,
      category: sp.categoria,
      subcategory: sp.subcategoria,
      // Precio / calificación / disponibilidad / orden: la barra los pone en la URL.
      ...filtersToQuery(sp),
    }).catch((err) => {
      console.warn('[catalogo] la API no respondió; se pinta el catálogo vacío:', err);
      return { items: [], total: 0, page, pages: 1 };
    }),
    sp.categoria ? getSubcategories(sp.categoria).catch(() => []) : Promise.resolve([]),
  ]);

  const q = sp.q ? `&q=${encodeURIComponent(sp.q)}` : '';
  const catalog = theme.tokens.catalog;
  const hasBanner = !!catalog?.banner?.enabled;

  // Grupos de 10: 10 productos → anuncio intermedio → 10 productos → promo.
  // 10 = 2 filas completas en desktop (5 col), así no quedan huecos. Solo se
  // parte si el anuncio está activo y hay más de 10 productos.
  const items = result.items;
  const CHUNK = 8;
  const split = !!catalog?.mid?.enabled && items.length > CHUNK;
  const firstGroup = split ? items.slice(0, CHUNK) : items;
  const restGroup = split ? items.slice(CHUNK) : [];
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };
  const allLabel = cval('catalog.filter.all', 'Todos');
  const searchPh = cval('catalog.search.placeholder', 'Buscar equipo, marca…');

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set('q', sp.q);
    if (sp.categoria) params.set('categoria', sp.categoria);
    if (sp.subcategoria) params.set('subcategoria', sp.subcategoria);
    // Los filtros viajan con la paginación: sin esto, pasar a la página 2 los perdía.
    for (const k of ['precio', 'calif', 'disp', 'orden'] as const) {
      if (sp[k]) params.set(k, sp[k]);
    }
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/productos${qs ? `?${qs}` : ''}`;
  };

  // Buscador (form GET ?q=). `floating` = flotando sobre el borde del banner.
  const searchForm = (floating: boolean) => (
    <form
      action="/productos"
      method="get"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 16, boxShadow: '0 30px 60px -24px rgba(0,0,0,.55)', padding: 8,
        ...(floating
          ? { position: 'absolute', left: '50%', bottom: -32, transform: 'translateX(-50%)', zIndex: 6, width: 'min(680px, 90%)' }
          : { width: '100%', maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }),
      }}
    >
      {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
      <span style={{ paddingLeft: 14, color: 'var(--color-text-muted)', fontSize: 20, flexShrink: 0 }}>⌕</span>
      <input
        type="search" name="q" defaultValue={sp.q ?? ''} placeholder={searchPh}
        style={{ flex: 1, minWidth: 0, height: 52, border: 'none', background: 'transparent', color: 'var(--color-text)', padding: '0 14px', fontSize: '16px', fontFamily: 'inherit' }}
      />
      <button type="submit" style={{ flexShrink: 0, height: 52, padding: '0 28px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>Buscar</button>
    </form>
  );

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)', minHeight: '60vh' }}>
        {/* Banner + buscador flotante sobre su borde inferior */}
        {hasBanner ? (
          <div style={{ position: 'relative' }}>
            <Band block={catalog!.banner} kind="hero" maxWidth={1320} />
            {searchForm(true)}
          </div>
        ) : null}

        <div style={{ ...CONTAINER, paddingTop: hasBanner ? 74 : 40, paddingBottom: split ? 52 : 56 }}>
          {/* Si no hay banner, el buscador va aquí arriba */}
          {!hasBanner ? <div style={{ marginBottom: 30 }}>{searchForm(false)}</div> : null}

          {/* Filtro por categoría — fila con scroll horizontal (una línea) */}
          <div className="cat-scroll" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
            <Chip href={`/productos${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ''}`} active={!sp.categoria}>{allLabel}</Chip>
            {categories.map((c) => (
              <Chip key={c.id} href={`/productos?categoria=${c.slug}${q}`} active={sp.categoria === c.slug}>{c.name}</Chip>
            ))}
          </div>

          {/* Subcategorías de la categoría activa (si hay) */}
          {subcategories.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              {subcategories.map((s) => (
                <Link
                  key={s.id}
                  href={`/productos?categoria=${sp.categoria}&subcategoria=${s.slug}${q}`}
                  style={{
                    fontSize: '13px', fontWeight: sp.subcategoria === s.slug ? 700 : 500, textDecoration: 'none',
                    padding: '7px 13px', borderRadius: 'var(--radius-sm)',
                    color: sp.subcategoria === s.slug ? 'var(--color-text)' : 'var(--color-text-muted)',
                    background: sp.subcategoria === s.slug ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
                  }}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          ) : null}

          {/* Barra: conteo (izq) + filtros/orden (der) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '26px 0 22px' }}>
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', fontWeight: 300 }}>
              Mostrando <b style={{ color: 'var(--color-text)', fontWeight: 700 }}>{result.total}</b> productos
              {sp.q ? <> para «<b style={{ color: 'var(--color-text)' }}>{sp.q}</b>»</> : null}
            </div>
            <CatalogFilters />
          </div>

          {/* Productos — primer grupo (a todo lo ancho) */}
          {items.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{t(theme, 'catalog.empty')}</p>
              {/* Con filtros puestos, "no hay nada" sin salida es un callejón. */}
              {hasFilters(sp) ? (
                <Link
                  href={`/productos${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}
                >
                  Quitar los filtros
                  <Icon name="arrowRight" size={14} />
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="prod-grid">
              {firstGroup.map((p) => (
                <ProductCard key={p.id} product={p} theme={theme} />
              ))}
            </div>
          )}

          {/* Si no se parte, la paginación va aquí */}
          {!split ? <Pagination page={result.page} pages={result.pages} makeHref={makeHref} theme={theme} /> : null}
        </div>

        {/* Anuncio intermedio (full-bleed) entre los dos grupos de 10 */}
        {split ? <Band block={catalog!.mid} kind="promo" maxWidth={1320} /> : null}

        {/* Segundo grupo (10) + paginación */}
        {split ? (
          <div style={{ ...CONTAINER, paddingTop: 44, paddingBottom: 56 }}>
            <div className="prod-grid">
              {restGroup.map((p) => (
                <ProductCard key={p.id} product={p} theme={theme} />
              ))}
            </div>
            <Pagination page={result.page} pages={result.pages} makeHref={makeHref} theme={theme} />
          </div>
        ) : null}

        {/* Promo inferior (configurable) */}
        {catalog?.promo?.enabled ? <Band block={catalog.promo} kind="promo" maxWidth={1320} /> : null}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}

/** Chip de categoría (filtro). Activo = oscuro (tinta); inactivo = texto tenue. */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={active ? undefined : 'cat-chip-quiet'}
      style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', whiteSpace: 'nowrap',
        fontSize: '14px', fontWeight: active ? 700 : 600,
        padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '1px solid transparent',
        background: active ? 'var(--color-secondary)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
      }}
    >
      {children}
    </Link>
  );
}
