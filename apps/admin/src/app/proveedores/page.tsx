import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProvidersManager, type ProviderRow } from './ProvidersManager';

/**
 * RED DE ALIADOS (documento institucional, sección 15).
 *
 * Aquí se dan de alta los proveedores y se lleva su expediente. Lo que NO hay
 * —y es a propósito— es un botón de "marcar como verificado": el sello se
 * calcula del nivel más la vigencia de los documentos.
 */
export default async function AdminProveedores({ searchParams }: { searchParams: Promise<{ ver?: string; dato?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const provs = (await adminFetch<ProviderRow[]>('/admin/providers')) ?? [];
  // ?ver=148&dato=correo (2026-10-27): abre su expediente en su contacto, p. ej.
  // desde "Agregar su correo" de Cobros y pagos.
  const sp = await searchParams;
  const ver = Number(sp.ver) || undefined;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ProvidersManager initial={provs} abrir={ver} enfocarCorreo={sp.dato === 'correo'} />
    </AdminShell>
  );
}
