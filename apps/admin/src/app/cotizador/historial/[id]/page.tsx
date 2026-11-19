import { notFound, redirect } from 'next/navigation';
import { COTIZADORES_META } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { PageHeader } from '@/components/ui';
import { DocumentoGuardado } from './DocumentoGuardado';
import { datosDelDocumento, type CotizacionDetalle } from '@/lib/documento-cotizacion';
import { BotonEnviarCliente } from './BotonEnviarCliente';
import { BotonWhatsApp } from './BotonWhatsApp';
import { AccionesEstado } from './AccionesEstado';
import { EstadoCotizacion } from '../EstadoCotizacion';

export default async function DetalleCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const { id } = await params;
  const cot = await adminFetch<CotizacionDetalle>(`/admin/quoter/quotes/${id}`);
  if (!cot) notFound();

  const meta = COTIZADORES_META[cot.tipo];

  // El mismo documento para la vista, el PDF de WhatsApp y el PDF del correo.
  const datos = datosDelDocumento(cot);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <PageHeader
        eyebrow={['2 · Cotizar', ['Cotizaciones emitidas', '/cotizador/historial']]}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className="adm-mono" style={{ fontSize: '0.86em', letterSpacing: '-0.01em' }}>{cot.folio}</span>
            <EstadoCotizacion estado={cot.estado} vencida={cot.vencida} />
          </span>
        }
        subtitle={
          <>
            {meta?.titulo ?? cot.tipo} · {cot.cliente || 'Sin cliente'}
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
          datos={datos}
          acciones={
            <>
              <BotonEnviarCliente id={cot.id} correo={cot.correo} estado={cot.estado} datos={datos} />
              <BotonWhatsApp id={cot.id} datos={datos} telefono={cot.telefono} contacto={cot.atencion || cot.cliente} />
              <AccionesEstado id={cot.id} folio={cot.folio} estado={cot.estado} ligada={cot.ligada ?? false} />
            </>
          }
        />
      </div>
    </AdminShell>
  );
}
