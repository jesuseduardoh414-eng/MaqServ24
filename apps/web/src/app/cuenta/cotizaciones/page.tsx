import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { QuoteSummary } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE, getSessionUser } from '@/lib/session';
import { Icon } from '@/components/Icon';
import { toneColors } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';
import { AccountShell, EstadoVacio } from '../AccountShell';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'account.quotes.title')} — ${t(theme, 'site.name')}` };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default async function MyQuotesPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login?next=/cuenta/cotizaciones');

  const [theme, user, res] = await Promise.all([
    getTheme(),
    getSessionUser(),
    fetch(`${API_URL}/quotes/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (!user || res.status === 401) redirect('/login?next=/cuenta/cotizaciones');
  const data = (await res.json().catch(() => [])) as QuoteSummary[];
  const quotes = Array.isArray(data) ? data : [];

  // El texto sigue saliendo de los copys; solo el color lo pone el tono.
  /**
   * Se usa el estado CALCULADO, no la columna legacy: una cotizacion respondida
   * a la que se le paso la fecha no puede seguir apareciendo como si el cliente
   * aun pudiera aceptarla.
   */
  const statusOf = (q: QuoteSummary) => {
    // Con servicio abierto, lo que importa es si el aliado ya confirmó, no
    // que el cliente "aceptó" (aceptar el precio es lo que hizo al solicitar).
    if (q.request) {
      const tono = { enviada: 'warn', en_revision: 'warn', aprobada: 'ok', rechazada: 'bad', cancelada: 'bad', completada: 'ok' } as const;
      return { text: q.request.label, tone: tono[q.request.state] };
    }
    switch (q.state) {
      case 'vigente': return { text: 'Vigente', tone: 'ok' as const };
      case 'vencida': return { text: 'Vencida', tone: 'bad' as const };
      case 'aceptada': return { text: 'Aceptada', tone: 'ok' as const };
      case 'rechazada': return { text: 'Descartada', tone: 'warn' as const };
      default: return { text: t(theme, 'quote.status.pending'), tone: 'warn' as const };
    }
  };

  return (
    <AccountShell
      theme={theme}
      user={user}
      active="cotizaciones"
      title={t(theme, 'account.quotes.title')}
      description={quotes.length
        ? 'Tus solicitudes y cotizaciones con su estado. Abre una para ver el detalle, el documento y el avance del servicio.'
        : 'Aquí aparecen los servicios que pides en el cotizador y las cotizaciones que te enviamos.'}
      action={quotes.length ? <Link href="/cotizador" className="ac-btn">Nueva solicitud</Link> : undefined}
    >
      {quotes.length === 0 ? (
        <EstadoVacio
          icono="calculator"
          titulo="Aún no has pedido nada"
          texto="Arma tu solicitud en el cotizador: eliges el equipo o el material, ves el precio y MAQSER24 asigna quién lo atiende."
          accion={{ href: '/cotizador', label: 'Abrir el cotizador' }}
          secundaria={{ href: '/cotizar', label: 'Pedir algo a la medida' }}
        />
      ) : (
        <div className="ac-rows">
          {quotes.map((q) => {
            const st = statusOf(q);
            const c = toneColors(st.tone);
            // El desglose: la API ya lo devolvía. Solo se muestra si hay algo
            // además del subtotal, para no repetir el total dos veces.
            const extras = [
              q.freightCost > 0 ? `traslado ${formatPrice(q.freightCost)}${q.freightDistance ? ` (${q.freightDistance} km)` : ''}` : null,
              q.tax > 0 ? `impuesto ${formatPrice(q.tax)}` : null,
            ].filter(Boolean);
            // Todas se abren (2026-10-05): la pendiente también, para ver lo que
            // se pidió y su estado; antes era una tarjeta muerta sin enlace.
            const pendiente = q.state === 'pendiente';
            return (
              <Link key={q.id} href={`/cuenta/cotizaciones/${q.quoteNumber}`} className="ac-row">
                <div style={{ minWidth: 0 }}>
                  <div className="ac-folio">{q.quoteNumber}</div>
                  <div className="ac-meta">
                    {fmtDate(q.createdAt)}
                    {extras.length ? ` · Subtotal ${formatPrice(q.subtotal)} + ${extras.join(' + ')}` : ''}
                  </div>
                  <div className="ac-chips">
                    <span className="ac-chip" style={{ color: c.fg, background: c.bg, border: `1px solid ${c.border}` }}>{st.text}</span>
                    {pendiente ? <span className="ac-meta" style={{ marginTop: 0, alignSelf: 'center' }}>Un asesor te contactará</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="ac-amount">
                    {pendiente ? 'Por cotizar' : formatPrice(q.total)}
                    <small>{q.state === 'vigente' ? 'Ver y aceptar' : pendiente ? 'Ver solicitud' : 'Ver detalle'}</small>
                  </div>
                  <span aria-hidden style={{ color: 'var(--color-text-muted)', display: 'flex' }}><Icon name="chevronRight" size={18} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
