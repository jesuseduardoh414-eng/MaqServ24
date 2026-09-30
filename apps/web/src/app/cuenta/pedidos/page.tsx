import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { OrderSummary } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE, getSessionUser } from '@/lib/session';
import { Icon } from '@/components/Icon';
import { orderStatusLabel, paymentStatusLabel, toneColors, type StatusLabel } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';
import { AccountShell, EstadoVacio } from '../AccountShell';
import { MyReviews } from './MyReviews';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'account.orders.title')} — ${t(theme, 'site.name')}` };
}

function Chip({ st }: { st: StatusLabel }) {
  const c = toneColors(st.tone);
  return <span className="ac-chip" style={{ color: c.fg, background: c.bg, border: `1px solid ${c.border}` }}>{st.text}</span>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default async function MyOrdersPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login?next=/cuenta/pedidos');

  const [theme, user, ordersRes] = await Promise.all([
    getTheme(),
    getSessionUser(),
    fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (!user || ordersRes.status === 401) redirect('/login?next=/cuenta/pedidos');
  const orders = (await ordersRes.json().catch(() => [])) as OrderSummary[];
  const lista = Array.isArray(orders) ? orders : [];

  return (
    <AccountShell
      theme={theme}
      user={user}
      active="pedidos"
      title={t(theme, 'account.orders.title')}
      description={lista.length
        ? `${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}. Abre uno para ver el pago, la entrega y su historial.`
        : 'Aquí aparecen las compras y rentas que pagas en el sitio.'}
    >
      {lista.length === 0 ? (
        <EstadoVacio
          icono="box"
          titulo="Todavía no tienes pedidos"
          texto="Casi todo en MAQSER24 se cotiza primero: pides el servicio, te confirmamos precio y equipo, y aquí ves lo que pagaste y cómo va la entrega."
          accion={{ href: '/cotizador', label: 'Cotizar un servicio' }}
          secundaria={{ href: '/servicios', label: 'Ver servicios' }}
        />
      ) : (
        <div className="ac-rows">
          {lista.map((o) => (
            <Link key={o.id} href={`/pedido/${o.orderNumber}`} className="ac-row">
              <div style={{ minWidth: 0 }}>
                <div className="ac-folio">{o.orderNumber}</div>
                <div className="ac-meta">
                  {[fmtDate(o.createdAt), o.method, `${o.totalQty} ${o.totalQty === 1 ? 'equipo' : 'equipos'}`].filter(Boolean).join(' · ')}
                </div>
                <div className="ac-chips">
                  <Chip st={orderStatusLabel(o.status)} />
                  <Chip st={paymentStatusLabel(o.paymentStatus)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="ac-amount">{formatPrice(o.total)}<small>Total</small></div>
                <span aria-hidden style={{ color: 'var(--color-text-muted)', display: 'flex' }}><Icon name="chevronRight" size={18} /></span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <MyReviews title="Califica tus compras" />
    </AccountShell>
  );
}
