import { redirect } from 'next/navigation';
import { CATALOGO_TRITURADOS_DEFAULT, COTIZADORES_META, type CatalogoCotizador } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { CotizadorPanel } from '../CotizadorPanel';

export const metadata = { title: 'Cotizador de triturados' };

export default async function CotizadorTriturados() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const catalogo = (await adminFetch<CatalogoCotizador>('/admin/quoter/catalog/triturados')) ?? CATALOGO_TRITURADOS_DEFAULT;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <CotizadorPanel catalogo={catalogo} titulo="Cotizador de triturados" resumen={COTIZADORES_META.triturados.resumen} />
    </AdminShell>
  );
}
