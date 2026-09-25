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
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '60vh' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px clamp(20px, 5vw, 40px) 60px' }}>
          <Link href={`/cuenta/cotizaciones/${d.quoteNumber}`} style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowLeft" size={13} />Solicitud {d.quoteNumber}
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '16px 0 4px', letterSpacing: '-0.02em' }}>Cotización {d.folio}</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 22px', fontSize: 14.5 }}>
            Imprímela o guárdala en PDF con el botón de arriba del documento.
          </p>
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
