import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo, tieneModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Cobros, type DatosCobros, type Filtro } from './Cobros';

/** COBROS Y PAGOS (2026-10-27): una sola lista en lugar de Cobranza a clientes y Pagos a aliados. */
export default async function AdminCobros({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  const f = (await searchParams).f;
  const filtro: Filtro = f === 'cobrar' || f === 'pagar' ? f : 'todos';
  const datos = await adminFetch<DatosCobros>('/admin/dinero/cuentas');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Cobros
        datos={datos ?? { diaDePago: 5, porCobrar: 0, vencido: 0, porPagar: 0, listoParaPagar: 0, cuentas: [] }}
        filtroInicial={filtro}
        puedeProveedores={tieneModulo(admin, 'proveedores')}
      />
    </AdminShell>
  );
}
