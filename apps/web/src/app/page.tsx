import type { ReactNode } from 'react';
import { paginaSeo, sinHtml, telefonoE164, SITE_URL, IMAGEN_OG } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';
import { defaultTheme, type Theme } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { getFaqs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import {
  BlogSection,
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

/**
 * Home con SECCIONES CONFIGURABLES: qué se muestra y en qué orden lo decide
 * `theme.tokens.sections` (editable desde el admin en F4). Las claves sin
 * componente registrado se omiten sin romper.
 *
 * Retiradas: `home.success-cases` (el cliente decidió no incluir el módulo) y
 * `home.banners` (legacy; su editor ya se había quitado del menú) en jul 2026;
 * `home.services` en sep 2026, porque nunca se encendió en el sitio.
 */
const SECTIONS: Record<string, (props: { theme: Theme }) => Promise<ReactNode> | ReactNode> = {
  'home.hero': Hero,
  'home.categories': CategoriesSection,
  'home.featured-products': FeaturedSection,
  'home.strategic-sectors': SectorsSection,
  'home.why-choose-us': WhyChooseUsSection,
  'home.offer': OfferSection,
  'home.brands': BrandsSection,
  'home.blog': BlogSection,
  'home.reviews': ReviewsSection,
  'home.faq': FaqSection,
};

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/', titulo: t(theme, 'seo.home.title'), descripcion: t(theme, 'seo.home.description') });
}

/**
 * Datos estructurados de la portada: Organization (con el teléfono y correo de
 * Diseño → Contacto), WebSite (con la búsqueda del catálogo) y FAQPage si la
 * sección de preguntas está encendida y tiene contenido (mismas preguntas
 * que pinta FaqSection; el fetch se deduplica dentro de la petición).
 */
async function datosEstructurados(theme: Theme, faqEncendida: boolean) {
  const sitio = t(theme, 'site.name');
  const c = theme.tokens.contact ?? defaultTheme.tokens.contact;
  const tel = telefonoE164(c.phone);
  const datos: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: sitio,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/maqser24-logo.png`,
      image: `${SITE_URL}${IMAGEN_OG}`,
      description: t(theme, 'site.tagline'),
      ...(tel || c.email
        ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', availableLanguage: 'es', ...(tel ? { telephone: tel } : {}), ...(c.email ? { email: c.email } : {}) }] }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: sitio,
      url: SITE_URL,
      inLanguage: 'es',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/productos?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  ];
  if (faqEncendida) {
    const faqs = await getFaqs().catch(() => []);
    if (faqs.length > 0) {
      datos.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: sinHtml(f.answer) } })),
      });
    }
  }
  return datos;
}

export default async function Home() {
  const theme = await getTheme();
  const enabled = theme.tokens.sections
    .filter((s) => s.enabled && SECTIONS[s.key])
    .sort((a, b) => a.order - b.order);
  const datos = await datosEstructurados(theme, enabled.some((s) => s.key === 'home.faq'));

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={datos} />
      <main>
        {enabled.map((s) => {
          const Section = SECTIONS[s.key];
          return <Section key={s.key} theme={theme} />;
        })}
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
