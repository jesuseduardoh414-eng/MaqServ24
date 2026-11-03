import { redirect } from 'next/navigation';
import { COTIZADORES_META } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { cargarCotizador } from '@/lib/cotizador';
import { AdminShell } from '@/components/AdminShell';
import { CotizadorPanel, type SolicitudACotizar } from '../CotizadorPanel';

export const metadata = { title: 'Cotizador de triturados' };

export default async function CotizadorTriturados({ searchParams }: { searchParams: Promise<{ solicitud?: string; tipo?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  // Los dos tabuladores: una cotización lleva cualquier categoría (2026-11-03).
  const { tabuladores, productos } = await cargarCotizador();

  // ?solicitud=ID: cotizar una solicitud del sitio con el tabulador (2026-10-15).
  const sp = await searchParams;
  const solicitudId = Number(sp.solicitud) || null;
  // ?tipo=ID: "Cotizar" desde Disponibilidad (2026-10-26) abre con ese equipo.
  const fichaId = Number(sp.tipo) || null;
  const solicitud = solicitudId ? await adminFetch<SolicitudACotizar>(`/admin/quoter/solicitud/${solicitudId}`) : null;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <CotizadorPanel tabuladores={tabuladores} entrada="triturados" productos={productos} titulo="Cotizador de triturados" resumen={COTIZADORES_META.triturados.resumen}
        solicitud={solicitud}
        fichaId={fichaId}
        solicitudFallida={!!solicitudId && !solicitud}
      />
    </AdminShell>
  );
}
