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

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '.3rem' }}>
        Tema: {theme.name}
        {theme.active ? <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-base)' }}> · activo</span> : null}
      </h1>
      <p style={{ color: 'var(--color-text-muted)', margin: '0 0 1.2rem', fontSize: 'var(--text-sm)' }}>
        Los cambios se guardan como borrador; el sitio no cambia hasta Publicar.
      </p>
      <ThemeEditor
        themeId={theme.id}
        initialTokens={theme.tokens}
        initialCopys={theme.copys}
        hasDraft={theme.hasDraft}
      />
    </AdminShell>
  );
}
