import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  CATALOGO_MAQUINARIA_DEFAULT,
  CATALOGO_TRITURADOS_DEFAULT,
  type CatalogoCotizador,
  type CotizadorTipo,
} from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D } from '@/components/design-tokens';
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
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '4px 0 20px' }}>
        <header style={{ marginBottom: 20 }}>
          <Link href="/cotizador" style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="ph ph-arrow-left" /> Cotizador
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 27, letterSpacing: '-0.025em', color: D.text }}>Tarifas y condiciones</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2, maxWidth: '72ch' }}>
            El tabulador con el que cotizan el panel y el sitio. Lo que cambies aquí aplica a las
            cotizaciones <b>nuevas</b>: las ya emitidas conservan los precios con los que se emitieron.
          </p>
          {maquinaria === null || triturados === null ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: D.warn }}>
              La API no respondió y se está mostrando el tabulador de fábrica. Recarga antes de guardar,
              o sobrescribirás lo que hubiera configurado.
            </p>
          ) : null}
        </header>

        <TarifasEditor inicial={inicial} proveedores={proveedores ?? []} ligables={ligables ?? []} />
      </div>
    </AdminShell>
  );
}
