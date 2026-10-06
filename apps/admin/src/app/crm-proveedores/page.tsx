import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { CrmProveedores, type ProveedorCrm } from './CrmProveedores';

/**
 * CRM DE PROVEEDORES (2026-10-06): todos los proveedores con su contacto,
 * taller y maquinaria. Pedido del cliente: dentro del panel, sin terceros.
 */
export default async function AdminCrmProveedores() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const provs = (await adminFetch<ProveedorCrm[]>('/admin/proveedores-crm')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <CrmProveedores initial={provs} />
    </AdminShell>
  );
}
