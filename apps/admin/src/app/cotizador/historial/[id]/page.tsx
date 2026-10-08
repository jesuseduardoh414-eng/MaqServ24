import { notFound, redirect } from 'next/navigation';
import type { CalculoCotizacion, CotizadorTipo, EmpresaCotizador, FirmaCotizador } from '@maqserv/config';
import { COTIZADORES_META } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { PageHeader } from '@/components/ui';
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
      <PageHeader
        eyebrow={['2 · Cotizar', ['Cotizaciones emitidas', '/cotizador/historial']]}
        title={<span className="adm-mono" style={{ fontSize: '0.86em', letterSpacing: '-0.01em' }}>{cot.folio}</span>}
        subtitle={
          <>
            {meta?.titulo ?? cot.tipo} · {cot.cliente}
            {cot.origen === 'sitio' ? ' · solicitada desde el sitio' : cot.admin ? ` · capturada por ${cot.admin}` : ''}
            {/* El tabulador con el que se emitió. Si hoy es otro, esta cotización
                sigue valiendo lo que decía — por eso se guarda la versión. */}
            <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--adm-faint)' }}>
              Tabulador versión {cot.documento.version}
            </span>
          </>
        }
      />

      {/* El documento es papel: se queda en un ancho de lectura, alineado con
          el encabezado. */}
      <div style={{ maxWidth: 1000 }}>
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
