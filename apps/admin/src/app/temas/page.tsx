import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Table, Td } from '@/components/Table';
import { ActionButton } from '@/components/actions';
import { Btn, Chip, PageHeader, StatusText } from '@/components/ui';
import { ThemeDuplicate } from './ThemeDuplicate';

interface ThemeRow {
  id: number;
  slug: string;
  name: string;
  active: boolean;
  hasDraft: boolean;
  publishedAt: string | null;
}

export default async function AdminThemes() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');
  const themes = (await adminFetch<ThemeRow[]>('/admin/themes')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <PageHeader eyebrow={['Ajustes', 'Sitio web']} title="Temas" count={themes.length} />
      <ThemeDuplicate themes={themes.map((t) => ({ id: t.id, name: t.name }))} />
      <Table headers={['Tema', 'Slug', 'Estado', 'Publicado', 'Acciones']}>
        {themes.map((t) => (
          <tr key={t.id}>
            <Td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="adm-cell-title">{t.name}</span>
                {t.hasDraft ? <Chip tone="warn">Borrador sin publicar</Chip> : null}
              </div>
            </Td>
            <Td muted>
              <span className="adm-mono">{t.slug}</span>
            </Td>
            <Td>
              {t.active ? (
                <StatusText tone="ok">Activo</StatusText>
              ) : (
                <ActionButton path={`themes/${t.id}/activate`} method="POST" label="Activar" variant="outline" />
              )}
            </Td>
            <Td muted>
              <span className="adm-num">{t.publishedAt ? new Date(t.publishedAt).toLocaleString('es-MX') : '—'}</span>
            </Td>
            <Td>
              <Btn size="sm" icon="ph-pencil-simple" href={`/temas/${t.id}`}>Editar</Btn>
            </Td>
          </tr>
        ))}
      </Table>
    </AdminShell>
  );
}
