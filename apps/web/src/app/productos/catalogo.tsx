import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';
import { rutaDeCatalogo, tipoDeCatalogo, type TipoCatalogo, type Theme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getProducts, getCategories, getSubcategories } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { ProductCard } from '@/components/ProductCard';
import { Pagination } from '@/components/Pagination';
import { Band } from '@/components/Band';
import { CatalogFilters } from '@/components/CatalogFilters';
import { filtersToQuery, hasFilters, type CatalogSearch } from '@/lib/catalog-filters';

export type Search = { q?: string; categoria?: string; subcategoria?: string; page?: string } & CatalogSearch;

/**
 * Estilos propios del listado (prefijo `cl-`). Lo común —contenedor,
 * encabezado, chips, tarjetas, vacío— sale del sistema `ms-*`.
 */
const CSS = `
.cl-head{ align-items:flex-end; }
.cl-search{ position:relative; display:flex; gap:8px; width:min(100%, 440px); }
.cl-search-box{ position:relative; flex:1; min-width:0; }
.cl-search-box svg{ position:absolute; left:13px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); pointer-events:none; }
.cl-search-box .ms-input{ padding-left:40px; }
.cl-tabs{ padding-bottom:16px; border-bottom:1px solid var(--color-border); }
.cl-sub{ margin-top:12px; }
.cl-sub .ms-tab{ min-height:32px; padding:0 12px; font-size:13px; font-weight:500; }
.cl-bar{ display:flex; align-items:center; justify-content:space-between; gap:12px 16px; flex-wrap:wrap; margin:20px 0 20px; }
.cl-count{ margin:0; font-size:14px; color:var(--color-text-muted); }
.cl-count b{ color:var(--color-text); font-weight:600; }
.cl-mid{ margin:48px 0; }
@media (max-width: 640px){
  .cl-search{ width:100%; }
  .cl-bar{ flex-direction:column; align-items:stretch; }
}
`;

/**
 * LISTADO DEL CATÁLOGO. Lo comparten /servicios y /productos (2026-09-25):
 * la misma parrilla, filtrada por tipo. Los servicios son las cinco líneas de
 * MAQSER24 y se cotizan; los productos son lo demás y van al carrito. Ver
 * `tipoDeCatalogo`.
 */
export async function metadataCatalogo(kind: TipoCatalogo): Promise<Metadata> {
  const theme = await getTheme();
  // Canonical fijo al listado: las variantes con filtros (?categoria=, ?q=)
  // son la misma página y no deben competir entre sí en el índice.
  return kind === 'servicio'
    ? paginaSeo(theme, { ruta: '/servicios', titulo: t(theme, 'seo.services.title'), descripcion: t(theme, 'seo.services.description') })
    : paginaSeo(theme, { ruta: '/productos', titulo: t(theme, 'seo.catalog.title'), descripcion: t(theme, 'seo.catalog.description') });
}

/**
 * `tema` y `marco` existen para la vista previa del panel (Diseño → Productos →
 * Catálogo): pinta esta misma página con los anuncios sin publicar y sin
 * encabezado ni pie. El sitio no los pasa.
 */
export async function PaginaCatalogo({ sp, kind, tema, marco = true }: { sp: Search; kind: TipoCatalogo; tema?: Theme; marco?: boolean }) {
  const base = rutaDeCatalogo(kind);
  const page = Number(sp.page ?? 1) || 1;
  const [theme, todasCategorias, result, subcategories] = await Promise.all([
    tema ?? getTheme(),
    getCategories(),
    // El catálogo es la página más visitada: si la API no responde conviene
    // enseñar la página con la parrilla vacía antes que un 500.
    getProducts({
      page,
      kind,
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
  // Solo las categorías de este tipo: en /servicios no se ofrece filtrar por una de productos.
  const categories = todasCategorias.filter((c) => tipoDeCatalogo(c.slug) === kind);

  const q = sp.q ? `&q=${encodeURIComponent(sp.q)}` : '';
  const catalog = theme.tokens.catalog;
  const hasBanner = !!catalog?.banner?.enabled;
  const navLabel = t(theme, kind === 'servicio' ? 'nav.services' : 'nav.products');
  const descripcion = t(theme, kind === 'servicio' ? 'seo.services.description' : 'seo.catalog.description');
  const plural = kind === 'servicio' ? 'servicios' : 'productos';

  // Grupos: 8 fichas → anuncio intermedio → resto → promo. Solo se parte si el
  // anuncio está activo y hay más de 8.
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
    return `${base}${qs ? `?${qs}` : ''}`;
  };

  // Con banner, el h1 es el del banner; el encabezado de trabajo va como h2
  // para no tener dos encabezados principales.
  const HeadTitle = hasBanner ? 'h2' : 'h1';

  return (
    <>
      {marco ? <SiteHeader theme={theme} /> : null}
      {marco ? <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: navLabel }])} /> : null}
      <style>{CSS}</style>
      <main className="ms-page" style={{ minHeight: '60vh' }}>
        {/* h1: con banner, es el único encabezado principal del catálogo. */}
        {hasBanner ? <Band block={catalog!.banner} kind="hero" maxWidth={1180} titleTag="h1" /> : null}

        <div className="ms-wrap" style={{ paddingBottom: split ? 0 : undefined }}>
          <header className="ms-head cl-head">
            <div className="ms-head-txt">
              <HeadTitle className="ms-title">{navLabel}</HeadTitle>
              {descripcion ? <p className="ms-desc">{descripcion}</p> : null}
            </div>
            {/* Buscador (form GET ?q=). Conserva la categoría elegida. */}
            <form action={base} method="get" role="search" className="cl-search">
              {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
              <div className="cl-search-box">
                <Icon name="search" size={17} />
                <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder={searchPh} aria-label={searchPh} className="ms-input" />
              </div>
              <button type="submit" className="ms-btn">Buscar</button>
            </form>
          </header>

          {/* Filtro por categoría */}
          <nav aria-label="Categorías" className="ms-tabs cl-tabs">
            <Link href={`${base}${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ''}`} className="ms-tab" aria-current={!sp.categoria ? 'page' : undefined}>{allLabel}</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`${base}?categoria=${c.slug}${q}`} className="ms-tab" aria-current={sp.categoria === c.slug ? 'page' : undefined}>{c.name}</Link>
            ))}
          </nav>

          {/* Subcategorías de la categoría activa (si hay) */}
          {subcategories.length > 0 ? (
            <nav aria-label="Subcategorías" className="ms-tabs cl-sub">
              {subcategories.map((s) => (
                <Link
                  key={s.id}
                  href={`${base}?categoria=${sp.categoria}&subcategoria=${s.slug}${q}`}
                  className="ms-tab"
                  aria-current={sp.subcategoria === s.slug ? 'page' : undefined}
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          ) : null}

          {/* Barra: conteo (izq) + filtros/orden (der) */}
          <div className="cl-bar">
            <p className="cl-count">
              Mostrando <b className="ms-num">{result.total}</b> {plural}
              {sp.q ? <> para «<b>{sp.q}</b>»</> : null}
            </p>
            <CatalogFilters />
          </div>

          {items.length === 0 ? (
            <div className="ms-empty">
              <span className="ms-ico ms-ico-lg ms-ico-muted"><Icon name="search" size={22} /></span>
              <p className="ms-empty-t">{sp.q ? `Sin resultados para «${sp.q}»` : `Sin ${plural} con estos filtros`}</p>
              <p className="ms-empty-p">{t(theme, 'catalog.empty')}</p>
              <div className="ms-empty-acts">
                {/* Con filtros puestos, "no hay nada" sin salida es un callejón. */}
                {hasFilters(sp) ? (
                  <Link href={`${base}${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ''}`} className="ms-link">
                    Quitar los filtros <Icon name="arrowRight" size={14} />
                  </Link>
                ) : null}
                {sp.q || sp.categoria ? (
                  <Link href={base} className={hasFilters(sp) ? 'ms-link ms-link-muted' : 'ms-link'}>
                    Ver todos los {plural} <Icon name="arrowRight" size={14} />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="ms-cards">
              {firstGroup.map((p) => (
                <ProductCard key={p.id} product={p} theme={theme} />
              ))}
            </div>
          )}

          {/* Si no se parte, la paginación va aquí */}
          {!split ? <Pagination page={result.page} pages={result.pages} makeHref={makeHref} theme={theme} /> : null}
        </div>

        {/* Anuncio intermedio (full-bleed) entre los dos grupos */}
        {split ? <div className="cl-mid"><Band block={catalog!.mid} kind="promo" maxWidth={1180} /></div> : null}

        {/* Segundo grupo + paginación */}
        {split ? (
          <div className="ms-wrap" style={{ paddingTop: 0 }}>
            <div className="ms-cards">
              {restGroup.map((p) => (
                <ProductCard key={p.id} product={p} theme={theme} />
              ))}
            </div>
            <Pagination page={result.page} pages={result.pages} makeHref={makeHref} theme={theme} />
          </div>
        ) : null}

        {/* Promo inferior (configurable) */}
        {catalog?.promo?.enabled ? <Band block={catalog.promo} kind="promo" maxWidth={1180} /> : null}
      </main>
      {marco ? <SiteFooter theme={theme} /> : null}
    </>
  );
}
