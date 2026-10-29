import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo, tieneModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, Panel } from '@/components/ui';
import { Cobertura } from '../cobertura/Cobertura';
import type { DatosCobertura } from '../cobertura/cobertura-lib';
import { Zonas, type SaludZona, type Zona } from './Zonas';

export const metadata = { title: 'Zonas y cobertura' };

/**
 * ZONAS Y COBERTURA (2026-10-26). Antes dos pantallas: Zonas (dónde vende
 * MAQSER24, en Configuración) y Mapa y cobertura (qué aliados llegan, en
 * Cotizar). Decisión del dueño: es lo mismo visto desde dos lados; va junto,
 * como configuración. Todos la ven; solo Dirección (configuración) la edita.
 * El mapa pasó a Servicios en curso. Datos: apps/api/src/common/zonas.ts y
 * admin-cobertura.controller.ts.
 */
export default async function AdminZonas() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'inicio');
  const [d, cobertura] = await Promise.all([
    adminFetch<{ zonas: Zona[]; salud: SaludZona[]; sugerencias: string[] }>('/admin/zonas'),
    adminFetch<DatosCobertura>('/admin/cobertura'),
  ]);
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {d ? (
        <Zonas
          zonas={d.zonas}
          salud={d.salud}
          sugerencias={d.sugerencias}
          // Las bases de los aliados y su alcance vienen de la cobertura (ya en km de carretera; el mapa los pasa a recta).
          aliados={(cobertura?.aliados ?? []).filter((a) => !a.fuera).map((a) => ({ id: a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, radioKm: a.radioKm != null ? Math.round(a.radioKm / 1.32) : null }))}
          puedeEditar={tieneModulo(admin, 'configuracion')}
          cobertura={cobertura ? <Cobertura datos={cobertura} incrustado /> : null}
        />
      ) : (
        <Panel><EmptyState icon="ph-warning" title="No se pudieron cargar las zonas" sub="Recarga la página en unos segundos." /></Panel>
      )}
    </AdminShell>
  );
}
