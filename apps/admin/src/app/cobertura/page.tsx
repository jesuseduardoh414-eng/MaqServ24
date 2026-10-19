import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Note } from '@/components/ui';
import { Cobertura } from './Cobertura';
import type { DatosCobertura } from './cobertura-lib';

/** MAPA Y COBERTURA — con datos reales desde 2026-10-14 (ver admin-cobertura.controller.ts). */
export default async function AdminCobertura() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const datos = await adminFetch<DatosCobertura>('/admin/cobertura');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {datos ? <Cobertura datos={datos} /> : <Note tone="bad">No se pudo cargar la cobertura. Recarga la página en unos segundos.</Note>}
    </AdminShell>
  );
}
