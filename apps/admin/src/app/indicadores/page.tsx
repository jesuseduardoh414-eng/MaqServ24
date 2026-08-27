import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { AnalyticsBoard, type Tablero } from './AnalyticsBoard';

/**
 * INDICADORES (documento institucional, sección 25).
 *
 * "MAQSER24 debe diseñarse como una empresa de datos desde el principio."
 *
 * El panel de inicio cuenta pendientes: dice qué hay que atender. Esto dice si
 * lo que se hizo sirvió, que es una pregunta distinta y la que nadie podía
 * contestar.
 */
export default async function AdminIndicadores({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; categoria?: string; zona?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;

  const qs = new URLSearchParams();
  if (sp.dias) qs.set('dias', sp.dias);
  if (sp.categoria) qs.set('categoria', sp.categoria);
  if (sp.zona) qs.set('zona', sp.zona);

  const [tablero, categorias] = await Promise.all([
    adminFetch<Tablero>(`/admin/analytics${qs.size ? `?${qs}` : ''}`),
    adminFetch<Array<{ id: number; name: string; slug: string }>>('/admin/catalog/categories'),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <AnalyticsBoard
        tablero={tablero}
        categorias={(categorias ?? []).map((c) => ({ slug: c.slug, name: c.name }))}
        filtros={{ dias: sp.dias ?? '90', categoria: sp.categoria ?? '', zona: sp.zona ?? '' }}
      />
    </AdminShell>
  );
}
