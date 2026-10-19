import { notFound, redirect } from 'next/navigation';
import { conSeccionesNuevas, defaultTheme, type Copys, type ThemeTokens } from '@maqserv/config';
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

  // Los textos que el código estrenó después de guardar este tema (p. ej. los
  // del acceso, 2026-10-15) no estaban en su copia y no salían en el editor:
  // se listan con su valor de fábrica, y lo guardado manda.
  const copys: Copys = {
    ...theme.copys,
    es: { ...(defaultTheme.copys.es ?? {}), ...(theme.copys?.es ?? {}) },
  };

  // El encabezado lo pinta el editor: los botones de Publicar/Guardar viven en
  // su estado y van a la derecha del título, como en el resto del panel.
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ThemeEditor
        themeId={theme.id}
        themeName={theme.name}
        active={theme.active}
        // Igual que los textos: las secciones que el código estrenó después
        // (Promociones del mes, 2026-10-19) salen en la lista en su lugar.
        initialTokens={{ ...theme.tokens, sections: conSeccionesNuevas(theme.tokens.sections ?? []) }}
        initialCopys={copys}
        hasDraft={theme.hasDraft}
      />
    </AdminShell>
  );
}
