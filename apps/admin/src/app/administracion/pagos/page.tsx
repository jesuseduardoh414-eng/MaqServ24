import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Pagos, type AliadoPago } from './Pagos';

/** PAGOS A ALIADOS (2026-10-22, Fase A): datos reales de money/ en la API. */
export default async function AdminPagos({ searchParams }: { searchParams: Promise<{ pagados?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  const pagados = (await searchParams).pagados === '1';
  const datos = await adminFetch<{ paraPagar: AliadoPago[]; esperando: AliadoPago[]; pagados: AliadoPago[] }>(`/admin/dinero/pagos${pagados ? '?pagados=1' : ''}`);
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Pagos datos={datos ?? { paraPagar: [], esperando: [], pagados: [] }} pagados={pagados} />
    </AdminShell>
  );
}
