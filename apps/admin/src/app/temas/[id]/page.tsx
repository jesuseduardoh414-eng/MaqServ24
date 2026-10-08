import { notFound, redirect } from 'next/navigation';
import type { Copys, ThemeTokens } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ThemeEditor } from './ThemeEditor';

interface ThemeFull {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  tokens: ThemeTokens;
  copys: Copys;
  hasDraft: boolean;
}

export default async function ThemeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');
  const { id } = await params;
  const theme = await adminFetch<ThemeFull>(`/admin/themes/${id}`);
  if (!theme) notFound();

  // El encabezado lo pinta el editor: los botones de Publicar/Guardar viven en
  // su estado y van a la derecha del título, como en el resto del panel.
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ThemeEditor
        themeId={theme.id}
        themeName={theme.name}
        active={theme.active}
        initialTokens={theme.tokens}
        initialCopys={theme.copys}
        hasDraft={theme.hasDraft}
      />
    </AdminShell>
  );
}
