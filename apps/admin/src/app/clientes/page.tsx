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
export default async function AdminClientes({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'clientes');
  const clientes = (await adminFetch<ClienteRow[]>('/admin/clients')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {/* ?ver=ID abre esa empresa (2026-10-23): desde Cuentas del sitio y desde otra empresa de la misma cuenta. */}
      <ClientsManager initial={clientes} abrir={Number((await searchParams).ver) || null} />
    </AdminShell>
  );
}
