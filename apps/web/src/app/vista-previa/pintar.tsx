'use server';

import type { ReactNode } from 'react';
import { themeSchema, themeToCss, VISTAS_PREVIA, type BorradorVistaPrevia, type Theme } from '@maqserv/config';
import { getTheme } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import {
  BrandsSection,
  CategoriesSection,
  FaqSection,
  FeaturedSection,
  Hero,
  OfferSection,
  ReviewsSection,
  SectorsSection,
  WhyChooseUsSection,
} from '@/components/home-sections';
import { SiteFooter } from '@/components/SiteHeader';
import { VistaCategorias } from '../categorias/vista';
import { VistaQuienesSomos } from '../quienes-somos/vista';
import { PaginaCatalogo } from '../productos/catalogo';

export type ResultadoVistaPrevia = { ok: true; nodo: ReactNode } | { ok: false; error: string };

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
    case 'home.featured-products':
      contenido = <FeaturedSection theme={theme} />;
      break;
    case 'home.why-choose-us':
      contenido = <WhyChooseUsSection theme={theme} razones={datos.razones} />;
      break;
    case 'home.strategic-sectors':
      contenido = <SectorsSection theme={theme} />;
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
      contenido = <VistaQuienesSomos theme={theme} info={datos.infSitio ?? null} allReasons={datos.razones ?? []} marco={false} />;
      break;
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
