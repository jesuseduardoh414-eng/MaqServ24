import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import type { ProviderRow } from '../proveedores/ProvidersManager';
import { ServiciosProveedores } from './ServiciosProveedores';

/**
 * SERVICIOS DE PROVEEDORES (2026-11-12): lo que dan los proveedores, para lo
 * que MAQSER24 no maneja. Toma el lugar de «Mi flota». ?buscar=&donde= llega
 * de «Buscar proveedor» en una solicitud, con la búsqueda ya escrita.
 */
export default async function AdminServiciosProveedores({ searchParams }: { searchParams: Promise<{ buscar?: string; donde?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const provs = (await adminFetch<ProviderRow[]>('/admin/providers')) ?? [];
  const sp = await searchParams;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ServiciosProveedores provs={provs} buscar={sp.buscar?.slice(0, 80)} donde={sp.donde?.slice(0, 80)} />
    </AdminShell>
  );
}
