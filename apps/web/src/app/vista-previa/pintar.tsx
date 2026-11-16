'use server';

import type { ReactNode } from 'react';
import sanitizeHtml from 'sanitize-html';
import {
  CLAVES_BLOQUE_SECTOR,
  contenidoSector,
  productSlug,
  textoSectorAHtml,
  themeSchema,
  themeToCss,
  VISTAS_PREVIA,
  type BorradorVistaPrevia,
  type ClaveBloqueSector,
  type SectorVistaPrevia,
  type Theme,
} from '@maqserv/config';
import type { StrategicSectorDetail } from '@maqserv/types';
import { getTheme } from '@/lib/theme';
import { getCategories, rutaCatalogo } from '@/lib/api';
import { VistaSector } from '@/components/VistaSector';
import {
  BrandsSection,
  CategoriesSection,
  FaqSection,
  FeaturedSection,
  Hero,
  OfferSection,
  PromotionsSection,
  ReviewsSection,
  SectorsSection,
  WhyChooseUsSection,
} from '@/components/home-sections';
import { SiteFooter } from '@/components/SiteHeader';
import { VistaCategorias } from '../categorias/vista';
import { VistaQuienesSomos } from '../quienes-somos/vista';
import { PaginaCatalogo } from '../productos/catalogo';

/**
 * El sector que manda el panel llega por postMessage: se toma solo lo que
 * tiene la forma esperada (textos con tope, URLs http) y se descarta lo demás.
 */
function sectorDelBorrador(v: unknown): SectorVistaPrevia | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const txt = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : null);
  const url = (x: unknown) => (typeof x === 'string' && /^https?:\/\//.test(x) ? x : null);
  const mapa = (x: unknown, max: number) => {
    const r: Partial<Record<ClaveBloqueSector, string>> = {};
    if (x && typeof x === 'object') for (const k of CLAVES_BLOQUE_SECTOR) { const t = txt((x as Record<string, unknown>)[k], max); if (t !== null) r[k] = t; }
    return r;
  };
  const id = Number(o.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    id,
    title: txt(o.title, 190) ?? '',
    image: url(o.image),
    video: url(o.video),
    frase: txt(o.frase, 300),
    textos: mapa(o.textos, 20000),
    titulos: mapa(o.titulos, 80),
    destacados: mapa(o.destacados, 300),
  };
}

export type ResultadoVistaPrevia = { ok: true; nodo: ReactNode } | { ok: false; error: string };

/**
 * El HTML del borrador se limpia igual que la página pública (auditoría
 * 2026-10-28): se pintaba tal cual, y un `<img onerror>` guardado en Quiénes
 * somos corría en el dominio del sitio al abrir la vista previa. Mismas
 * etiquetas que `sanitizeRichHtml` de la API.
 */
function limpio(html: string | null | undefined): string | null {
  if (!html) return html ?? null;
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'span', 'div',
      'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
      'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    disallowedTagsMode: 'discard',
  });
}

/**
 * Pinta UNA sección o página del sitio con los cambios sin publicar del panel.
 *
 * Es una Server Action: el iframe de /vista-previa la llama con lo que el panel
 * le mandó por postMessage y recibe el árbol ya renderizado. Se usan los
 * componentes REALES del sitio, así que lo que se ve es exactamente lo que
 * saldría al publicar.
 *
 * El borrador va ENCIMA del tema publicado: solo trae los tokens y copys de la
 * sección que se está editando. La respuesta solo la ve quien la pidió (no hay
 * URL que compartir), así que no sirve para pintar contenido falso en el sitio.
 */
export async function pintarVistaPrevia(b: BorradorVistaPrevia): Promise<ResultadoVistaPrevia> {
  if (!b || !VISTAS_PREVIA.includes(b.vista)) return { ok: false, error: 'Vista desconocida.' };

  const base = await getTheme();
  const tokens = b.tokens && typeof b.tokens === 'object' ? b.tokens : {};
  const copys = b.copys && typeof b.copys === 'object' ? b.copys : {};
  const parsed = themeSchema.safeParse({
    ...base,
    tokens: { ...base.tokens, ...tokens },
    copys: { ...base.copys, es: { ...(base.copys.es ?? {}), ...copys } },
  });
  if (!parsed.success) {
    const campo = parsed.error.issues[0]?.path.join('.') ?? '';
    return { ok: false, error: `Hay un valor que el sitio no acepta${campo ? ` (${campo})` : ''}.` };
  }
  const theme: Theme = parsed.data;
  const datos = b.datos ?? {};

  let contenido: ReactNode = null;
  switch (b.vista) {
    case 'home.hero': {
      const h = datos.hero;
      contenido = <Hero theme={theme} contenido={h === undefined ? undefined : h ? { ...h, feature1: null, feature2: null } : null} />;
      break;
    }
    case 'home.categories':
      contenido = <CategoriesSection theme={theme} />;
      break;
    case 'home.promotions':
      contenido = <PromotionsSection theme={theme} />;
      break;
    case 'home.featured-products':
      contenido = <FeaturedSection theme={theme} />;
      break;
    case 'home.why-choose-us':
      contenido = <WhyChooseUsSection theme={theme} razones={datos.razones} />;
      break;
    case 'home.strategic-sectors':
      contenido = <SectorsSection theme={theme} borrador={sectorDelBorrador(datos.sector)} />;
      break;
    case 'home.offer':
      contenido = <OfferSection theme={theme} />;
      break;
    case 'home.reviews':
      contenido = <ReviewsSection theme={theme} />;
      break;
    case 'home.faq':
      contenido = <FaqSection theme={theme} />;
      break;
    case 'home.brands':
      contenido = <BrandsSection theme={theme} />;
      break;
    case 'pagina.categorias':
      contenido = <VistaCategorias theme={theme} categories={await getCategories().catch(() => [])} marco={false} />;
      break;
    case 'pagina.catalogo':
      // Hoy MAQSER24 solo tiene servicios: /productos manda a /servicios, así que
      // los anuncios del catálogo se ven sobre el listado de servicios.
      contenido = await PaginaCatalogo({ sp: {}, kind: 'servicio', tema: theme, marco: false });
      break;
    case 'pagina.quienes-somos':
      contenido = (
        <VistaQuienesSomos
          theme={theme}
          info={datos.infSitio ? { ...datos.infSitio, descripcion: limpio(datos.infSitio.descripcion), mision: limpio(datos.infSitio.mision), vision: limpio(datos.infSitio.vision), objetivos: limpio(datos.infSitio.objetivos) } : null}
          allReasons={datos.razones ?? []}
          marco={false}
        />
      );
      break;
    case 'pagina.sector': {
      // La página del sector que se edita, con lo escrito aunque no se haya guardado.
      const d = sectorDelBorrador(datos.sector);
      if (!d) return { ok: false, error: 'Abre un sector para ver su página.' };
      const limpiar = (html: string | null) => (html ? limpio(html) || null : null);
      const columnas = {
        description: d.textos.sobre ?? null,
        trayectoria: d.textos.trayectoria ?? null,
        esencia: d.textos.esencia ?? null,
        servicios: d.textos.servicios ?? null,
        excelencia: d.textos.excelencia ?? null,
        servicios_lista: d.textos.lista ?? null,
      };
      const c = contenidoSector(columnas, { frase: d.frase, titulos: d.titulos, destacados: d.destacados }, limpiar);
      const titulo = d.title.trim() || 'Sector sin nombre';
      const sector: StrategicSectorDetail = {
        id: d.id,
        slug: productSlug(titulo, d.id),
        title: titulo,
        description: limpiar(textoSectorAHtml(columnas.description)),
        image: d.image,
        video: d.video,
        trayectoria: null,
        esencia: null,
        servicios: null,
        excelencia: null,
        serviciosLista: [],
        frase: c.frase,
        bloques: c.bloques,
        lista: c.lista,
      };
      contenido = <VistaSector theme={theme} sector={sector} catalogo={await rutaCatalogo()} />;
      break;
    }
    case 'sitio.footer':
      contenido = <SiteFooter theme={theme} />;
      break;
  }

  return {
    ok: true,
    nodo: (
      <>
        {/* Va después del <style> del layout: con la misma especificidad, gana. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme.tokens) }} />
        {contenido}
      </>
    ),
  };
}
