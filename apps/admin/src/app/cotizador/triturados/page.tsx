import { redirect } from 'next/navigation';
import { CATALOGO_TRITURADOS_DEFAULT, COTIZADORES_META, type CatalogoCotizador } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { CotizadorPanel, type SolicitudACotizar } from '../CotizadorPanel';

export const metadata = { title: 'Cotizador de triturados' };

export default async function CotizadorTriturados({ searchParams }: { searchParams: Promise<{ solicitud?: string; tipo?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const catalogo = (await adminFetch<CatalogoCotizador>('/admin/quoter/catalog/triturados')) ?? CATALOGO_TRITURADOS_DEFAULT;

  // ?solicitud=ID: cotizar una solicitud del sitio con el tabulador (2026-10-15).
  const sp = await searchParams;
  const solicitudId = Number(sp.solicitud) || null;
  // ?tipo=ID: "Cotizar" desde Disponibilidad (2026-10-26) abre con ese equipo.
  const fichaId = Number(sp.tipo) || null;
  const solicitud = solicitudId ? await adminFetch<SolicitudACotizar>(`/admin/quoter/solicitud/${solicitudId}`) : null;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <CotizadorPanel catalogo={catalogo} titulo="Cotizador de triturados" resumen={COTIZADORES_META.triturados.resumen}
        solicitud={solicitud}
        fichaId={fichaId}
        solicitudFallida={!!solicitudId && !solicitud}
      />
    </AdminShell>
  );
}
