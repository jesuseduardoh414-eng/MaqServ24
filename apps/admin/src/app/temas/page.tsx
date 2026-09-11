import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Table, Td } from '@/components/Table';
import { ActionButton } from '@/components/actions';
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
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.2rem' }}>Temas</h1>
      <div style={{ display: 'grid', gap: '1.2rem' }}>
        <ThemeDuplicate themes={themes.map((t) => ({ id: t.id, name: t.name }))} />
        <Table headers={['Tema', 'Slug', 'Estado', 'Publicado', 'Acciones']}>
          {themes.map((t) => (
            <tr key={t.id}>
              <Td>
                <strong>{t.name}</strong>
                {t.hasDraft ? <span style={{ color: 'var(--color-warning)', fontSize: 'var(--text-sm)' }}> · borrador sin publicar</span> : null}
              </Td>
              <Td muted>{t.slug}</Td>
              <Td>
                {t.active ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>Activo</span>
                ) : (
                  <ActionButton path={`themes/${t.id}/activate`} method="POST" label="Activar" variant="ghost" />
                )}
              </Td>
              <Td muted>{t.publishedAt ? new Date(t.publishedAt).toLocaleString('es-MX') : '—'}</Td>
              <Td>
                <Link
                  href={`/temas/${t.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'var(--color-primary-fg)',
                    background: 'var(--color-primary)',
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                    padding: '.4em .9em',
                    borderRadius: 'var(--radius-button)',
                  }}
                >
                  Editar
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
    </AdminShell>
  );
}
