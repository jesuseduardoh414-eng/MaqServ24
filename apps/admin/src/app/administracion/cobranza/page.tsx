import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Cobranza, type CuentaCobro } from './Cobranza';

/** COBRANZA (2026-10-22, Fase A): datos reales de money/ en la API. */
export default async function AdminCobranza({ searchParams }: { searchParams: Promise<{ cobradas?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  const cobradas = (await searchParams).cobradas === '1';
  const datos = await adminFetch<{ porCobrar: number; vencido: number; cuentas: CuentaCobro[] }>(`/admin/dinero/cobranza${cobradas ? '?cobradas=1' : ''}`);
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Cobranza datos={datos ?? { porCobrar: 0, vencido: 0, cuentas: [] }} cobradas={cobradas} />
    </AdminShell>
  );
}
