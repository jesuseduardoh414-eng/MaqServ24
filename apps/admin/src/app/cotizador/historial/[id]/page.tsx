import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { CalculoCotizacion, CotizadorTipo, EmpresaCotizador, FirmaCotizador } from '@maqserv/config';
import { COTIZADORES_META } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D } from '@/components/design-tokens';
import { DocumentoGuardado } from './DocumentoGuardado';
import { BotonEnviarCliente } from './BotonEnviarCliente';

interface CotizacionDetalle {
  id: number;
  tipo: CotizadorTipo;
  folio: string;
  origen: string;
  estado: string;
  cliente: string;
  obra: string | null;
  atencion: string | null;
  municipio: string | null;
  correo: string | null;
  telefono: string | null;
  notas: string | null;
  documento: {
    calc: CalculoCotizacion;
    empresa: EmpresaCotizador;
    firma: FirmaCotizador;
    saludo: string;
    version: string;
    emitida: string;
  };
  admin: string | null;
  fecha: string | null;
}

export default async function DetalleCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const { id } = await params;
  const cot = await adminFetch<CotizacionDetalle>(`/admin/quoter/quotes/${id}`);
  if (!cot) notFound();

  const meta = COTIZADORES_META[cot.tipo];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4px 0 40px' }}>
        <header style={{ marginBottom: 20 }}>
          <Link href="/cotizador/historial" style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="ph ph-arrow-left" /> Historial
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 27, letterSpacing: '-0.025em', color: D.text }}>{cot.folio}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2 }}>
            {meta?.titulo ?? cot.tipo} · {cot.cliente}
            {cot.origen === 'sitio' ? ' · solicitada desde el sitio' : cot.admin ? ` · capturada por ${cot.admin}` : ''}
          </p>
          {/* El tabulador con el que se emitió. Si hoy es otro, esta cotización
              sigue valiendo lo que decía — por eso se guarda la versión. */}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: D.muted }}>
            Tabulador versión {cot.documento.version}
          </p>
        </header>

        <DocumentoGuardado
          datos={{
            titulo: `Cotización de ${meta?.titulo?.toLowerCase() ?? cot.tipo}`,
            folio: cot.folio,
            fecha: cot.documento.emitida,
            cliente: cot.cliente,
            obra: cot.obra ?? '',
            atencion: cot.atencion ?? '',
            municipio: cot.municipio ?? '',
            notas: cot.notas ?? '',
            empresa: cot.documento.empresa,
            firma: cot.documento.firma,
            saludo: cot.documento.saludo,
            calc: cot.documento.calc,
            mostrarPrecios: true,
          }}
          acciones={<BotonEnviarCliente id={cot.id} correo={cot.correo} estado={cot.estado} />}
        />
      </div>
    </AdminShell>
  );
}
