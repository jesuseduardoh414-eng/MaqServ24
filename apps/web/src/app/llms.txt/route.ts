import { NextResponse } from 'next/server';
import { getBlogs, getSectors } from '@/lib/api';
import { getTheme, t } from '@/lib/theme';
import { SITE_URL } from '@/lib/seo';

/**
 * /llms.txt: resumen del sitio en Markdown para asistentes y buscadores con
 * IA (misma idea que robots.txt, pero para modelos de lenguaje). Solo enlaza
 * páginas públicas; lo dinámico (artículos, sectores) sale de la API y, si no
 * responde, se publica igual con las rutas fijas.
 */
export const revalidate = 3600;

export async function GET() {
  const theme = await getTheme();
  const sitio = t(theme, 'site.name');
  const [blogs, sectores] = await Promise.all([getBlogs(60).catch(() => []), getSectors().catch(() => [])]);

  const lineas = [
    `# ${sitio}`,
    '',
    `> ${t(theme, 'seo.home.description')}`,
    '',
    `${sitio} es una plataforma en línea para coordinar obra en México: renta de maquinaria pesada con operador, triturados y materiales para construcción, transporte y servicios de obra, y soluciones asfálticas. Cada servicio lo presta un proveedor de la red; la plataforma cotiza, coordina y da seguimiento. Idioma: español (es-MX).`,
    '',
    '## Páginas principales',
    '',
    `- [Inicio](${SITE_URL}/): ${t(theme, 'seo.home.description')}`,
    `- [Catálogo](${SITE_URL}/productos): ${t(theme, 'seo.catalog.description')}`,
    `- [Categorías](${SITE_URL}/categorias): ${t(theme, 'seo.categories.description')}`,
    `- [Cotizador en línea](${SITE_URL}/cotizador): ${t(theme, 'seo.quoter.description')}`,
    `- [Cotizador de maquinaria](${SITE_URL}/cotizador/maquinaria): ${t(theme, 'seo.quoter.machinery.description')}`,
    `- [Cotizador de triturados](${SITE_URL}/cotizador/triturados): ${t(theme, 'seo.quoter.aggregates.description')}`,
    `- [Quiénes somos](${SITE_URL}/quienes-somos): ${t(theme, 'seo.about.description')}`,
    `- [Contacto](${SITE_URL}/contacto): ${t(theme, 'seo.contact.description')}`,
    `- [Blog](${SITE_URL}/blog): ${t(theme, 'seo.blog.description')}`,
    '',
    '## Legales',
    '',
    `- [Aviso de privacidad](${SITE_URL}/privacidad)`,
    `- [Términos y condiciones](${SITE_URL}/terminos)`,
  ];

  if (sectores.length > 0) {
    lineas.push('', '## Sectores que atendemos', '');
    for (const s of sectores) lineas.push(`- [${s.title}](${SITE_URL}/sectores/${s.slug})`);
  }
  if (blogs.length > 0) {
    lineas.push('', '## Artículos del blog', '');
    for (const b of blogs) lineas.push(`- [${b.title}](${SITE_URL}/blog/${b.slug})${b.excerpt ? `: ${b.excerpt.replace(/\s+/g, ' ').trim().slice(0, 160)}` : ''}`);
  }
  lineas.push('', '## Otros recursos', '', `- [Sitemap](${SITE_URL}/sitemap.xml)`, `- [robots.txt](${SITE_URL}/robots.txt)`, '');

  return new NextResponse(lineas.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
