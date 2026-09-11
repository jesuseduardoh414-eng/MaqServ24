import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ClientsManager, type ClienteRow } from './ClientsManager';

/**
 * CLIENTES Y OBRAS (documento institucional, sección 17 · Módulo Clientes).
 *
 * Va aparte de Cuentas a propósito: una cuenta es alguien que entra al sitio;
 * un cliente es la empresa que contrata, y la mayoría de las solicitudes las
 * hace alguien sin registrarse. Confundirlos obligaría a inventarle una cuenta
 * a quien nunca la pidió.
 */
export default async function AdminClientes() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'clientes');
  const clientes = (await adminFetch<ClienteRow[]>('/admin/clients')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <ClientsManager initial={clientes} />
    </AdminShell>
  );
}
