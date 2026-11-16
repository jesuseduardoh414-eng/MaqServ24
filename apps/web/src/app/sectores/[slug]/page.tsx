import type { Metadata } from 'next';
import { paginaSeo, migas } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { notFound } from 'next/navigation';
import { parseProductSlug, textoPlanoSector } from '@maqserv/config';
import type { StrategicSectorDetail } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { getSector, rutaCatalogo } from '@/lib/api';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { VistaSector } from '@/components/VistaSector';

type Params = { slug: string };

async function fetchBySlug(slug: string): Promise<StrategicSectorDetail | null> {
  const id = parseProductSlug(slug);
  if (!id) return null;
  try {
    return await getSector(id);
  } catch (err) {
    // 404 real → notFound(); API caída → error boundary (no un 404 indexable).
    if (err instanceof Error && /→ 404/.test(err.message)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const [theme, sector] = await Promise.all([getTheme(), fetchBySlug(slug)]);
  if (!sector) return { title: t(theme, 'site.name') };
  // La frase corta describe el sector; sin ella, el principio de «Sobre este sector».
  const descripcion = sector.frase ?? textoPlanoSector(sector.description);
  return paginaSeo(theme, {
    ruta: `/sectores/${sector.slug}`,
    // "Maquinaria y servicios para Infraestructura": el nombre solo quedaba en 26 caracteres.
    titulo: t(theme, 'seo.sector.title').replace('{sector}', sector.title),
    descripcion: descripcion ? descripcion.slice(0, 160) : undefined,
    imagen: sector.image,
  });
}

/** El contenido vive en `VistaSector`: la vista previa del panel pinta el mismo. */
export default async function SectorPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [theme, sector, catalogo] = await Promise.all([getTheme(), fetchBySlug(slug), rutaCatalogo()]);
  if (!sector) notFound();

  return (
    <>
      <SiteHeader theme={theme} />
      <JsonLd data={migas([{ nombre: t(theme, 'nav.home'), ruta: '/' }, { nombre: sector.title }])} />
      <VistaSector theme={theme} sector={sector} catalogo={catalogo} />
      <SiteFooter theme={theme} />
    </>
  );
}
