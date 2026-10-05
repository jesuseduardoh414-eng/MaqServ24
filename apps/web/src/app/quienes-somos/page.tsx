import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import { getTheme, t } from '@/lib/theme';
import { getWhyChooseUs } from '@/lib/api';
import { VistaQuienesSomos, type InfSitio } from './vista';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

async function getInfSitio(): Promise<InfSitio | null> {
  return fetch(`${API_URL}/content/inf-sitio`, { next: { revalidate: 60 } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/quienes-somos', titulo: t(theme, 'seo.about.title'), descripcion: t(theme, 'seo.about.description') });
}

/**
 * /quienes-somos. El cuerpo vive en `vista.tsx` para que la vista previa del
 * panel (Diseño → Quiénes somos → Página completa) pinte el MISMO componente.
 */
export default async function AboutPage() {
  const [theme, info, allReasons] = await Promise.all([getTheme(), getInfSitio(), getWhyChooseUs().catch(() => [])]);
  return <VistaQuienesSomos theme={theme} info={info} allReasons={allReasons} />;
}
