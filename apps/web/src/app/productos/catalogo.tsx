import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import Link from '@/components/Enlace';
import { COTIZADORES_SITIO, CUESTIONARIOS, LINEA_TRANSPORTE, rutaDeCatalogo, tipoDeCatalogo, type TipoCatalogo, type Theme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getProducts, getCategories, getSubcategories } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { ProductCard } from '@/components/ProductCard';
import { CategoryStrip } from '@/components/CategoryStrip';
import { Pagination } from '@/components/Pagination';
import { Band } from '@/components/Band';
import { PestanasCategorias } from '@/components/PestanasCategorias';
import { filtersToQuery, hasFilters, type CatalogSearch } from '@/lib/catalog-filters';

export type Search = { q?: string; categoria?: string; subcategoria?: string; page?: string } & CatalogSearch;

/**
 * Al elegir una categoría (o buscar, «Ver todos», cambiar de página) la página
 * baja sola hasta los resultados (2026-11-18, el dueño: «cada vez que yo
 * seleccione una opción de las categorías, me debe mandar hacia abajo en donde
 * está»). `scroll-margin-top` deja libre el menú fijo.
 */
const ANCLA = '#resultados';

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
.cl-tabs{ padding-bottom:16px; border-bottom:1px solid var(--color-border); scroll-margin-top:92px; }
.cl-sub{ margin-top:12px; }
.cl-sub .ms-tab{ min-height:32px; padding:0 12px; font-size:13px; font-weight:500; }
.cl-bar{ display:flex; align-items:center; justify-content:space-between; gap:12px 16px; flex-wrap:wrap; margin:20px 0 20px; }
.cl-count{ margin:0; font-size:14px; color:var(--color-text-muted); }
.cl-count b{ color:var(--color-text); font-weight:600; }
.cl-mid{ margin:48px 0; }
.cl-feat{ margin:8px 0 44px; scroll-margin-top:150px; }
/* Pestañas fijas debajo del menú (2026-11-18): una línea que se desliza de lado si no caben. */
.cl-tabs-fijas{ position:sticky; z-index:20; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; padding:12px 0;
  background: color-mix(in srgb, var(--color-bg) 86%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--color-bg) 86%, transparent); clip-path: inset(0 -100vmax); }
.cl-tabs-fijas::-webkit-scrollbar{ display:none; }
/* Cotizador sin equipos en catálogo (la venta): tarjeta a su cuestionario. */
.cl-cuestionario{ display:flex; align-items:center; justify-content:space-between; gap:16px 24px; flex-wrap:wrap; padding:22px 24px; border-radius:14px;
  border:1px solid color-mix(in srgb, var(--color-primary) 40%, transparent); background: color-mix(in srgb, var(--color-surface) 80%, transparent); }
.cl-cuestionario-t{ margin:0; font-family: var(--font-display); font-weight:800; font-size:18px; color: var(--color-text); }
.cl-cuestionario-d{ margin:6px 0 0; font-size:14.5px; line-height:1.55; color: var(--color-text-muted); max-width:62ch; }
.cl-feat .ms-title{ font-size:clamp(22px, 2.4vw, 26px); }
@media (max-width: 640px){
  .cl-search{ width:100%; }
  .cl-bar{ flex-direction:column; align-items:stretch; }
}
`;

/**
 * LISTADO DEL CATÁLOGO. Lo comparten /servicios y /productos (2026-09-25):
 * la misma parrilla, filtrada por tipo. Los servicios son las cinco líneas de
 * MAQSER24 y se cotizan; los productos son lo demás. Ver `tipoDeCatalogo`.
 *
 * Desde 2026-10-08 no hay venta en línea: /productos solo redirige a
 * /servicios y este módulo lo usa /servicios (y la vista previa del panel).
 */
/** Todos los equipos del catálogo de ese tipo (todas las páginas de la API, hasta 10). */
async function todosLosDelCatalogo(kind: TipoCatalogo) {
  const primera = await getProducts({ kind, page: 1 }).catch(() => null);
  if (!primera) return [];
  const resto = await Promise.all(
    Array.from({ length: Math.max(0, Math.min(primera.pages, 10) - 1) }, (_, i) => getProducts({ kind, page: i + 2 }).catch(() => null)),
  );
  return [primera, ...resto].flatMap((r) => r?.items ?? []);
}

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
  /*
   * VITRINA (2026-10-20, pedido del cliente): en "Todos", sin búsqueda ni
   * filtros, los destacados van arriba en el carrusel giratorio —caben los que
   * sean, no solo los 4 de una fila— y la parrilla enseña los DEMÁS (8 →
   * anuncio → 8 → paginación → promo), así ninguno sale dos veces. Con
   * búsqueda, filtros u orden va todo junto en la parrilla: quien busca algo
   * concreto no tiene que mirar también el carrusel para encontrarlo.
   *
   * POR CATEGORÍA (2026-10-21, pedido del cliente): con una categoría elegida
   * va TODO en un renglón, en el mismo carrusel de los destacados, en vez de
   * bajar a una segunda fila. Sus destacados van en esa misma tira (la
   * relevancia los pone primero), así que ahí no hay carrusel aparte.
   */
  const porCategoria = !!sp.categoria;
  const vitrina = !porCategoria && !sp.q && !hasFilters(sp);
  const filtro = {
    kind,
    search: sp.q,
    category: sp.categoria,
    subcategory: sp.subcategoria,
    // Precio / calificación / disponibilidad / orden: la barra los pone en la URL.
    ...filtersToQuery(sp),
  };
  const vacio = { items: [], total: 0, page, pages: 1 };
  const [theme, todasCategorias, result, subcategories] = await Promise.all([
    tema ?? getTheme(),
    getCategories(),
    // El catálogo es la página más visitada: si la API no responde conviene
    // enseñar la página con la parrilla vacía antes que un 500. En «Todos» no
    // hace falta: ahí va una fila por categoría (ver abajo).
    vitrina
      ? Promise.resolve(vacio)
      : getProducts({ page, ...filtro }).catch((err) => {
          console.warn('[catalogo] la API no respondió; se pinta el catálogo vacío:', err);
          return vacio;
        }),
    sp.categoria ? getSubcategories(sp.categoria).catch(() => []) : Promise.resolve([]),
  ]);
  // Solo las categorías de este tipo: en /servicios no se ofrece filtrar por una de productos.
  const categories = todasCategorias.filter((c) => tipoDeCatalogo(c.slug) === kind);
  /*
   * POR SECCIONES, COMO LOS COTIZADORES (2026-11-18, el dueño: «en lugar de que
   * aparezca destacados aparezcan en orden de como están las categorías» y luego
   * «lo que quiero es que se clasifiquen como vienen en los cotizadores»): en
   * «Todos» va una fila por cotizador del sitio, en el orden del menú Cotizador
   * (Renta de maquinaria, Servicios de agua, Acarreos, Carpeta asfáltica,
   * Materiales, Triturados, Venta de maquinaria). Cada equipo va en la de su
   * cotizador (`quoter`); el que no tiene, en la de su categoría. Así
   * «Transporte» se parte en agua y acarreos. Un cotizador sin equipos pero con
   * cuestionario (la venta) sale con una tarjeta que lleva a él.
   */
  const todosLosServicios = vitrina ? await todosLosDelCatalogo(kind) : [];
  const claveDe = (p: (typeof todosLosServicios)[number]): string | null => {
    if (p.quoter && COTIZADORES_SITIO.some((c) => c.clave === p.quoter)) return p.quoter;
    if (p.categorySlug === LINEA_TRANSPORTE) return /agua|pipa/i.test(p.name) ? 'agua' : 'acarreos';
    return COTIZADORES_SITIO.find((c) => c.linea === p.categorySlug)?.clave ?? null;
  };
  const secciones = vitrina
    ? [
        ...COTIZADORES_SITIO.map((c) => ({ clave: c.clave, titulo: c.titulo, resumen: c.resumen, items: todosLosServicios.filter((p) => claveDe(p) === c.clave) }))
          .filter((s) => s.items.length > 0 || !!CUESTIONARIOS[s.clave]),
        // Lo que no cae en ningún cotizador (no debería haber), al final.
        ...(todosLosServicios.some((p) => !claveDe(p))
          ? [{ clave: 'otros', titulo: 'Otros servicios', resumen: '', items: todosLosServicios.filter((p) => !claveDe(p)) }]
          : []),
      ]
    : [];
  const totalSecciones = todosLosServicios.length;
  /** La pestaña de un enlace viejo `?categoria=`: la del cotizador de esa categoría. */
  const pestanaActiva = sp.categoria ? COTIZADORES_SITIO.find((c) => c.linea === sp.categoria)?.clave ?? null : null;

  const q = sp.q ? `&q=${encodeURIComponent(sp.q)}` : '';
  const catalog = theme.tokens.catalog;
  const hasBanner = !!catalog?.banner?.enabled;
  const navLabel = t(theme, kind === 'servicio' ? 'nav.services' : 'nav.products');
  const descripcion = t(theme, kind === 'servicio' ? 'seo.services.description' : 'seo.catalog.description');
  const plural = kind === 'servicio' ? 'servicios' : 'productos';
  // Título de la tira por categoría: la subcategoría si hay una elegida.
  const nombreTira =
    subcategories.find((s) => s.slug === sp.subcategoria)?.name ??
    categories.find((c) => c.slug === sp.categoria)?.name ??
    navLabel;

  // Grupos: 8 fichas → anuncio intermedio → resto → promo. Solo se parte si el
  // anuncio está activo y hay más de 8 en la parrilla (la tira no se parte).
  const items = result.items;
  const CHUNK = 8;
  const split = !porCategoria && !!catalog?.mid?.enabled && items.length > CHUNK;
  const firstGroup = split ? items.slice(0, CHUNK) : items;
  const restGroup = split ? items.slice(CHUNK) : [];
  const cval = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };
  const allLabel = cval('catalog.filter.all', 'Todos');
  const introServicios = kind === 'servicio'
    ? cval('catalog.services.intro', '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [];
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
    return `${base}${qs ? `?${qs}` : ''}${ANCLA}`;
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
              {/* Servicios lleva su texto propio (2026-11-18), en párrafos; si está vacío, la descripción de siempre. */}
              {introServicios.length ? (
                introServicios.map((p) => <p key={p} className="ms-desc cl-intro">{p}</p>)
              ) : descripcion ? <p className="ms-desc">{descripcion}</p> : null}
            </div>
            {/* Buscador (form GET ?q=). Conserva la categoría elegida. */}
            <form action={`${base}${ANCLA}`} method="get" role="search" className="cl-search">
              {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
              <div className="cl-search-box">
                <Icon name="search" size={17} />
                <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder={searchPh} aria-label={searchPh} className="ms-input" />
              </div>
              <button type="submit" className="ms-btn">Buscar</button>
            </form>
          </header>

          {/* Filtro por categoría */}
          {/* Pestañas (2026-11-18): bajan a la fila de su categoría sin recargar ni quitar las demás. */}
          <PestanasCategorias
            base={base}
            cats={(vitrina ? secciones : COTIZADORES_SITIO).map((c) => ({ slug: c.clave, name: c.titulo }))}
            todosLabel={allLabel}
            activa={pestanaActiva}
          />

          {/* Subcategorías de la categoría activa (si hay) */}
          {subcategories.length > 0 ? (
            <nav aria-label="Subcategorías" className="ms-tabs cl-sub">
              {subcategories.map((s) => (
                <Link
                  key={s.id}
                  href={`${base}?categoria=${sp.categoria}&subcategoria=${s.slug}${q}${ANCLA}`}
                  className="ms-tab"
                  aria-current={sp.subcategoria === s.slug ? 'page' : undefined}
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          ) : null}

          {/* Barra: el conteo. Los filtros «Disponibilidad» y «Ordenar por» se
              quitaron (2026-11-18, el dueño: «eso que está encerrado, elimínalo»). */}
          <div className="cl-bar cl-lista">
            <p className="cl-count">
              Mostrando <b className="ms-num">{vitrina ? totalSecciones : result.total}</b> {plural}
              {sp.q ? <> para «<b>{sp.q}</b>»</> : null}
            </p>
          </div>

          {/* «Todos»: una fila por cotizador, en el orden del menú Cotizador. */}
          {secciones.map((s) => (
            <div className="cl-feat" key={s.clave} id={`cat-${s.clave}`}>
              {s.items.length > 0 ? (
                <CategoryStrip
                  eyebrow=""
                  title={s.titulo}
                  eyebrowColor=""
                  titleColor=""
                  ancho="min(290px, 80cqw)"
                  siempre
                  etiquetaAnterior={`${s.titulo}: anteriores`}
                  etiquetaSiguiente={`${s.titulo}: siguientes`}
                >
                  {s.items.map((p) => (
                    <ProductCard key={p.id} product={p} theme={theme} />
                  ))}
                </CategoryStrip>
              ) : (
                // Sin equipos en catálogo (la venta): su cuestionario.
                <>
                  {/* Mismo título que el de las filas con carrusel (el de CategoryStrip). */}
                  <h2 className="ms-title" style={{ margin: '0 0 22px', fontSize: 'clamp(26px, 2.6vw, 36px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.12 }}>{s.titulo}</h2>
                  <div className="cl-cuestionario">
                    <div style={{ minWidth: 0 }}>
                      <p className="cl-cuestionario-t">Cuéntanos qué equipo buscas</p>
                      <p className="cl-cuestionario-d">{s.resumen}. Nos dices el equipo, la marca, el modelo y el año, y te mandamos opciones con precio.</p>
                    </div>
                    <Link href={`/cotizador/${s.clave}`} className="ms-btn ms-btn-lg">Cotizar <Icon name="arrowRight" size={16} /></Link>
                  </div>
                </>
              )}
            </div>
          ))}

          {vitrina && secciones.length > 0 ? null : items.length === 0 ? (
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
          ) : porCategoria ? (
            <div className="cl-feat">
              <CategoryStrip
                eyebrow=""
                title={nombreTira}
                eyebrowColor=""
                titleColor=""
                ancho="min(290px, 80cqw)"
                siempre
                etiquetaAnterior={`${nombreTira}: anteriores`}
                etiquetaSiguiente={`${nombreTira}: siguientes`}
              >
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} theme={theme} />
                ))}
              </CategoryStrip>
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
