import type { Metadata } from 'next';
import Link from '@/components/Enlace';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { CalculoCotizacion, EmpresaCotizador, FirmaCotizador } from '@maqserv/config';
import { ALIADO_COOKIE } from '@/lib/cookies';
import { getTheme } from '@/lib/theme';
import { SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { EncabezadoPortal } from '../../EncabezadoPortal';
import { DocumentoAliado } from './DocumentoAliado';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Documento de cotización',
  robots: { index: false, follow: false },
};

interface Documento {
  folio: string;
  quoteNumber: string;
  cliente: string;
  obra: string | null;
  atencion: string | null;
  municipio: string | null;
  notas: string | null;
  /** El documento traía servicios de otros aliados: aquí va solo lo suyo. */
  parcial?: boolean;
  documento: {
    calc: CalculoCotizacion;
    empresa: EmpresaCotizador;
    firma: FirmaCotizador;
    saludo: string;
    emitida: string;
  };
}

/**
 * EL DOCUMENTO DE LA COTIZACIÓN, EN EL PORTAL DEL ALIADO (2026-10-19). "Al
 * proveedor, en su portal debe aparecerle el documento de la cotización": el
 * mismo que recibió el cliente, con folio, partidas, condiciones y firma, para
 * que sepa exactamente qué se vendió antes de decir que sí. Si el documento
 * traía servicios de otros aliados, la API ya lo manda recortado a lo suyo.
 *
 * Misma credencial que el portal (cookie del enlace). Sin ella, o con el
 * enlace vencido, se manda al portal, que ya sabe explicar qué pasó.
 */
export default async function DocumentoParaAliado({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!/^\d{1,9}$/.test(assignmentId)) notFound();
  const token = (await cookies()).get(ALIADO_COOKIE)?.value;
  if (!token) redirect('/aliado');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/aliado/solicitudes/${assignmentId}/documento`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (res.status === 401) redirect('/aliado');
  if (!res.ok) notFound();
  const d = (await res.json()) as Documento;
  const branding = theme.tokens.branding ?? {};
  const logo = branding.logoLight ?? branding.logoAlt ?? null;

  return (
    <>
      <EncabezadoPortal theme={theme} />
      <main className="ms-page" style={{ minHeight: '60vh' }}>
        <div className="ms-wrap" style={{ maxWidth: 980 }}>
          <Link href="/aliado?v=solicitudes" className="ms-link ms-link-muted" style={{ marginBottom: 18 }}>
            <Icon name="arrowLeft" size={14} />Volver a tu panel
          </Link>
          <header className="ms-head" style={{ marginBottom: 22 }}>
            <div className="ms-head-txt">
              <h1 className="ms-title">Cotización {d.folio}</h1>
              <p className="ms-desc">
                {d.parcial
                  ? `Tu parte de la cotización que aceptó el cliente: solo lo de la solicitud ${d.quoteNumber}.`
                  : `La que recibió el cliente por la solicitud ${d.quoteNumber}.`}{' '}
                Sin importes; lo que te pagamos está en tu portal. Imprímela o guárdala en PDF con el botón de arriba del documento.
              </p>
            </div>
          </header>
          <DocumentoAliado
            datos={{
              titulo: 'Cotización de servicio',
              folio: d.folio,
              fecha: d.documento.emitida,
              cliente: d.cliente,
              obra: d.obra ?? '',
              atencion: d.atencion ?? '',
              municipio: d.municipio ?? '',
              notas: d.notas ?? '',
              empresa: d.documento.empresa,
              firma: d.documento.firma,
              saludo: d.documento.saludo,
              calc: d.documento.calc,
              // Sin importes: son el precio al cliente (decisión de Dirección,
              // 2026-10-23). Lo suyo está en el portal como "Te pagamos".
              mostrarPrecios: false,
              notaSinPrecios: 'Los importes de la cotización no se muestran aquí. Lo que te pagamos por este servicio está en tu portal.',
              logo,
            }}
          />
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
