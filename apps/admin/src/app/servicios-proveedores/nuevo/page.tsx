import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FormServicioProveedor, type OpcionesServicio } from '../FormServicioProveedor';

/**
 * ALTA DEL SERVICIO DE UN PROVEEDOR (2026-11-12). ?proveedor=<id> llega de su
 * ficha (ya elegido); ?volver=ficha regresa a ella al guardar.
 */
export default async function NuevoServicioProveedor({ searchParams }: { searchParams: Promise<{ proveedor?: string; volver?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'proveedores');
  const opciones = (await adminFetch<OpcionesServicio>('/admin/providers/servicios/opciones')) ?? { categorias: [], proveedores: [] };
  const sp = await searchParams;
  const pid = Number(sp.proveedor);
  const proveedor = Number.isInteger(pid) && opciones.proveedores.some((p) => p.id === pid) ? pid : undefined;
  const volver = proveedor && sp.volver === 'ficha' ? `/proveedores?ver=${proveedor}&dato=equipos` : '/servicios-proveedores';

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <FormServicioProveedor opciones={opciones} proveedorInicial={proveedor} volver={volver} />
    </AdminShell>
  );
}
