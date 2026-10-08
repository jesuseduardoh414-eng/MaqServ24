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
import { TarifasEditor, type EquipoLigable, type ProveedorOpcion } from './TarifasEditor';

export const metadata = { title: 'Tarifas del cotizador' };

export default async function TarifasCotizador() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const [maquinaria, triturados, proveedores, ligables] = await Promise.all([
    adminFetch<CatalogoCotizador>('/admin/quoter/catalog/maquinaria'),
    adminFetch<CatalogoCotizador>('/admin/quoter/catalog/triturados'),
    // Para poner dueño a cada partida: es quien recibe el aviso cuando alguien
    // cotiza eso desde el sitio.
    adminFetch<ProveedorOpcion[]>('/admin/quoter/providers'),
    // Los equipos publicados de los aliados: cada renglón se liga a los suyos.
    adminFetch<EquipoLigable[]>('/admin/quoter/ligables'),
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
            El tabulador con el que cotizan el panel y el sitio. Lo que cambies aquí aplica a las
            cotizaciones <b style={{ color: 'var(--adm-text-2)', fontWeight: 600 }}>nuevas</b>: las ya emitidas conservan los precios con los que se emitieron.
          </>
        }
      />

      {maquinaria === null || triturados === null ? (
        <Note tone="warn" style={{ marginTop: -12, marginBottom: 22 }}>
          La API no respondió y se está mostrando el tabulador de fábrica. Recarga antes de guardar,
          o sobrescribirás lo que hubiera configurado.
        </Note>
      ) : null}

      <TarifasEditor inicial={inicial} proveedores={proveedores ?? []} ligables={ligables ?? []} />
    </AdminShell>
  );
}
