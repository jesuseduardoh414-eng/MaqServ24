import type { Metadata } from 'next';
import { paginaSeo } from '@/lib/seo';
import { getTheme, t } from '@/lib/theme';
import { getCategories } from '@/lib/api';
import { VistaCategorias } from './vista';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return paginaSeo(theme, { ruta: '/categorias', titulo: t(theme, 'seo.categories.title'), descripcion: t(theme, 'seo.categories.description') });
}

/**
 * Vista dedicada de categorías (/categorias). El cuerpo vive en `vista.tsx`
 * para que la vista previa del panel (Diseño → Categorías) pinte el MISMO
 * componente con los cambios sin publicar.
 */
export default async function CategoriasPage() {
  const [theme, categories] = await Promise.all([getTheme(), getCategories()]);
  return <VistaCategorias theme={theme} categories={categories} />;
}
