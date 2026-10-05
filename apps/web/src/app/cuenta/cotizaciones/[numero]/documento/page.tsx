import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { CalculoCotizacion, EmpresaCotizador, FirmaCotizador } from '@maqserv/config';
import { NOINDEX } from '@/lib/seo';
import { getTheme } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { DocumentoCliente } from './DocumentoCliente';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = { robots: NOINDEX, title: 'Documento de cotización' };

interface Documento {
  folio: string;
  tipo: string;
  quoteNumber: string;
  cliente: string;
  obra: string | null;
  atencion: string | null;
  municipio: string | null;
  notas: string | null;
  documento: {
    calc: CalculoCotizacion;
    empresa: EmpresaCotizador;
    firma: FirmaCotizador;
    saludo: string;
    version: string;
    emitida: string;
  };
}

/**
 * EL DOCUMENTO DE LA COTIZACIÓN (2026-09-25). "Yo quiero que se haga así":
 * el cliente pidió el documento de siempre, como el de PUCSA, para cada
 * solicitud. Es el mismo que guarda el cotizador (folio, empresa, partidas,
 * condiciones, firma) y se puede imprimir o guardar en PDF.
 */
export default async function DocumentoCotizacion({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/quotes/${encodeURIComponent(numero)}/documento`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (res.status === 401) redirect('/login');
  if (!res.ok) notFound();
  const d = (await res.json()) as Documento;
  const branding = theme.tokens.branding ?? {};
  const logo = branding.logoLight ?? branding.logoAlt ?? null;

  return (
    <>
      <SiteHeader theme={theme} />
      <main className="ms-page" style={{ minHeight: '60vh' }}>
        {/* Marco con las piezas comunes; el documento imprimible va tal cual. */}
        <div className="ms-wrap" style={{ maxWidth: 980 }}>
          <Link href={`/cuenta/cotizaciones/${d.quoteNumber}`} className="ms-link ms-link-muted" style={{ marginBottom: 18 }}>
            <Icon name="arrowLeft" size={14} />Solicitud {d.quoteNumber}
          </Link>
          <header className="ms-head" style={{ marginBottom: 22 }}>
            <div className="ms-head-txt">
              <h1 className="ms-title">Cotización {d.folio}</h1>
              <p className="ms-desc">Imprímela o guárdala en PDF con el botón de arriba del documento.</p>
            </div>
          </header>
          <DocumentoCliente
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
              mostrarPrecios: true,
              logo,
            }}
          />
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
