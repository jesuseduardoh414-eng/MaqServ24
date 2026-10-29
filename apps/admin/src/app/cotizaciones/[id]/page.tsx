import { notFound, redirect } from 'next/navigation';
import { getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FichaCotizacion } from './FichaCotizacion';

export const metadata = { title: 'Cotización' };

/**
 * La ficha de una cotización (2026-10-23): lo que se cotiza a detalle, sus
 * costos y el resumen, para ver y editar. Se llega con "Volver a cotizar"
 * desde Solicitudes.
 */
export default async function FichaDeCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizaciones');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <FichaCotizacion id={id} />
    </AdminShell>
  );
}
