import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  CATALOGO_MAQUINARIA_DEFAULT,
  CATALOGO_TRITURADOS_DEFAULT,
  type CatalogoCotizador,
  type CotizadorTipo,
} from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Note, PageHeader } from '@/components/ui';
import { TarifasEditor } from './TarifasEditor';

export const metadata = { title: 'Tarifas del cotizador' };

export default async function TarifasCotizador() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'tarifas');

  // Los renglones ya no se ligan a mano (2026-10-19): son de su ficha.
  const [maquinaria, triturados] = await Promise.all([
    adminFetch<CatalogoCotizador>('/admin/quoter/catalog/maquinaria'),
    adminFetch<CatalogoCotizador>('/admin/quoter/catalog/triturados'),
  ]);

  const inicial: Record<CotizadorTipo, CatalogoCotizador> = {
    maquinaria: maquinaria ?? CATALOGO_MAQUINARIA_DEFAULT,
    triturados: triturados ?? CATALOGO_TRITURADOS_DEFAULT,
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Tarifas y condiciones"
        subtitle={
          <>
            El tabulador con el que cotizan el panel y el sitio. Lo que cambies aquí aplica a las cotizaciones{' '}
            <b style={{ color: 'var(--adm-text-2)', fontWeight: 600 }}>nuevas</b>; las ya emitidas conservan sus precios.
            El precio de cada equipo o material se pone en su ficha de <a className="adm-link" href="/catalogo/servicios">Inventario</a>; los municipios, en <a className="adm-link" href="/zonas">Zonas</a>.
          </>
        }
      />

      {maquinaria === null || triturados === null ? (
        <Note tone="warn" style={{ marginTop: -12, marginBottom: 22 }}>
          La API no respondió y se está mostrando el tabulador de fábrica. Recarga antes de guardar,
          o sobrescribirás lo que hubiera configurado.
        </Note>
      ) : null}

      {/* La pestaña va en la dirección (?p=); leerla pide Suspense. */}
      <Suspense fallback={null}>
        <TarifasEditor inicial={inicial} />
      </Suspense>
    </AdminShell>
  );
}
