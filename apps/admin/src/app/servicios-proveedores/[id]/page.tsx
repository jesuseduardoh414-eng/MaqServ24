import { notFound, redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FormServicioProveedor, type OpcionesServicio, type ServicioGuardado } from '../FormServicioProveedor';

/** VER Y CORREGIR EL SERVICIO DE UN PROVEEDOR, con todo lo que se capturó (2026-11-12). */
export default async function ServicioProveedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const [opciones, servicio] = await Promise.all([
    adminFetch<OpcionesServicio>('/admin/providers/servicios/opciones'),
    adminFetch<ServicioGuardado>(`/admin/providers/servicios/${n}`),
  ]);
  if (!servicio) notFound();
  const sp = await searchParams;
  const volver = sp.volver === 'ficha' ? `/proveedores?ver=${servicio.proveedorId}&dato=equipos` : '/servicios-proveedores';

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <FormServicioProveedor opciones={opciones ?? { categorias: [], proveedores: [] }} inicial={servicio} volver={volver} />
    </AdminShell>
  );
}
