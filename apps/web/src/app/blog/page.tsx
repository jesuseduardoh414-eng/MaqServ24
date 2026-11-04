import type { Metadata } from 'next';
import { migas, paginaSeo, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { getTheme, t } from '@/lib/theme';
import { getBlogs } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { BlogIndex } from './BlogIndex';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/blog', titulo: t(theme, 'seo.blog.title'), descripcion: t(theme, 'seo.blog.description') });
}

export default async function BlogIndexPage() {
  const [theme, blogs] = await Promise.all([getTheme(), getBlogs(60)]);
  // Fallback a los textos por defecto si el tema aún no tiene estas claves
  // (t() devuelve la clave cuando falta). Al publicar desde el admin se guardan.
  const copy = (key: string, def: string) => {
    const v = t(theme, key);
    return v === key ? def : v;
  };

  return (
    <>
      <SiteHeader theme={theme} />
      {/* Migas y el índice del blog con sus artículos (auditoría SEO 2026-11-04: /blog no tenía JSON-LD). */}
      <JsonLd
        data={[
          migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: 'Blog' }]),
          {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: t(theme, 'seo.blog.title'),
            description: t(theme, 'seo.blog.description'),
            url: `${SITE_URL}/blog`,
            inLanguage: 'es',
            publisher: { '@id': `${SITE_URL}/#organization` },
            blogPost: blogs.map((b) => ({
              '@type': 'BlogPosting',
              headline: b.title,
              url: `${SITE_URL}/blog/${b.slug}`,
              ...(b.date ? { datePublished: b.date } : {}),
            })),
          },
        ]}
      />
      <BlogIndex
        posts={blogs}
        eyebrow={copy('blog.hero.eyebrow', 'Diario de obra · Nº 24')}
        title={copy('blog.hero.title', 'Bitácora')}
        subtitle={copy('blog.hero.subtitle', 'Noticias, guías y buenas prácticas sobre maquinaria pesada — directo desde el terreno.')}
      />
      <SiteFooter theme={theme} />
    </>
  );
}
