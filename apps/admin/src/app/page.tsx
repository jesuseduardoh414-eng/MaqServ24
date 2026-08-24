import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';

interface Dashboard {
  toPrepare: number;
  shipped: number;
  unpaid: number;
  pendingQuotes: number;
  vendorsPending: number;
  withdrawsPending: number;
  withdrawsAmount: number;
  unansweredQuestions: number;
  pendingReviews: number;
  sold: number;
  orders: number;
  quotes: number;
  products: number;
  customers: number;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const card: React.CSSProperties = { background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 };

/** Cosas que esperan una decisión. Solo se pintan las que tienen algo. */
interface Task { n: number; label: string; sub: string; href: string; icon: string; color: string }

export default async function AdminHome() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const d = await adminFetch<Dashboard>('/admin/dashboard');

  const tasks: Task[] = d
    ? [
      { n: d.toPrepare, label: 'Por preparar', sub: 'Pagadas, esperando que salgan', href: '/ordenes?state=pagado', icon: 'ph-package', color: D.amber },
      { n: d.pendingQuotes, label: 'Cotizaciones sin responder', sub: 'El cliente espera precio', href: '/cotizaciones', icon: 'ph-file-text', color: D.warn },
      { n: d.withdrawsPending, label: 'Retiros por pagar', sub: d.withdrawsAmount > 0 ? `${money(d.withdrawsAmount)} en total` : 'Dinero de vendedores', href: '/retiros', icon: 'ph-hand-coins', color: D.warn },
      { n: d.vendorsPending, label: 'Vendedores por aprobar', sub: 'Solicitudes nuevas', href: '/vendedores?state=pendiente', icon: 'ph-storefront', color: D.warn },
      { n: d.unansweredQuestions, label: 'Preguntas sin responder', sub: 'Dudas sobre productos', href: '/preguntas', icon: 'ph-chat-circle', color: BLUE },
      { n: d.pendingReviews, label: 'Reseñas por moderar', sub: 'Esperan aprobación', href: '/resenas', icon: 'ph-star', color: BLUE },
      { n: d.shipped, label: 'En camino', sub: 'Pendientes de entregar', href: '/ordenes?state=enviado', icon: 'ph-truck', color: BLUE },
    ].filter((t) => t.n > 0)
    : [];

  const stats = d
    ? [
      { v: money(d.sold), l: 'Vendido', s: `${d.orders} pedidos`, href: '/ordenes', c: D.amber },
      { v: String(d.customers), l: 'Clientes que han comprado', s: 'De los registrados', href: '/usuarios?segment=compradores', c: GREEN },
      { v: String(d.products), l: 'Productos activos', s: 'Publicados en el sitio', href: '/productos', c: '#EDEDEC' },
      { v: String(d.quotes), l: 'Cotizaciones', s: 'Recibidas en total', href: '/cotizaciones', c: '#EDEDEC' },
    ]
    : [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .dh-task:hover{ background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.16) !important; }
          .dh-stat:hover{ border-color: rgba(255,255,255,0.16) !important; }
          .dh-cta:hover{ filter: brightness(1.1); }
          @media (max-width: 900px){ .dh-grid{ grid-template-columns: 1fr !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>
              Hola, {admin.name.split(' ')[0]}
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>
              {tasks.length > 0
                ? `Tienes ${tasks.length} ${tasks.length === 1 ? 'cosa' : 'cosas'} esperando tu atención.`
                : 'Todo al día: no hay nada pendiente por atender.'}
            </p>
          </div>
          <Link href="/productos/nuevo" className="dh-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 10, padding: '11px 18px', textDecoration: 'none' }}>
            <i className="ph-bold ph-plus" aria-hidden style={{ fontSize: 14 }} /> Nuevo producto
          </Link>
        </div>

        {/* --- Por atender: lo primero, porque es lo accionable --- */}
        <h2 style={{ margin: '28px 0 14px', fontSize: 12, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase' }}>
          Por atender
        </h2>
        {tasks.length === 0 ? (
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(63,191,143,0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <i className="ph-bold ph-check" style={{ color: GREEN, fontSize: 16 }} />
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#EDEDEC' }}>Nada pendiente</div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 2 }}>
                Cuando entre un pedido, una cotización o una solicitud, aparece aquí.
              </div>
            </div>
          </div>
        ) : (
          <div className="dh-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {tasks.map((t) => (
              <Link key={t.label} href={t.href} className="dh-task" style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', transition: 'background .15s, border-color .15s' }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${t.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${t.color} 26%, transparent)` }}>
                  <i className={`ph-bold ${t.icon}`} style={{ color: t.color, fontSize: 17 }} aria-hidden />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: t.color }}>{t.n}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>{t.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7A7A7F', marginTop: 3 }}>{t.sub}</div>
                </div>
                <i className="ph ph-arrow-right" style={{ color: '#4C4C51', fontSize: 15 }} aria-hidden />
              </Link>
            ))}
          </div>
        )}

        {/* --- Cómo va el negocio --- */}
        <h2 style={{ margin: '30px 0 14px', fontSize: 12, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase' }}>
          El negocio
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {stats.map((s) => (
            <Link key={s.l} href={s.href} className="dh-stat" style={{ ...card, padding: '18px 20px', textDecoration: 'none', display: 'block', transition: 'border-color .15s' }}>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: s.c, letterSpacing: '-0.5px' }}>{s.v}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#B4B4B9', marginTop: 6 }}>{s.l}</div>
              <div style={{ fontSize: 11.5, color: '#5C5C61', marginTop: 2 }}>{s.s}</div>
            </Link>
          ))}
        </div>

        {/* Las 12 sin pagar son de 2021 y no se van a cobrar: informan, no accionan. */}
        {d && d.unpaid > 0 ? (
          <p style={{ margin: '18px 0 0', fontSize: 12, color: '#5C5C61' }}>
            Además hay{' '}
            <Link href="/ordenes?state=pendiente" style={{ color: '#8A8A8F' }}>
              {d.unpaid} {d.unpaid === 1 ? 'orden sin pagar' : 'órdenes sin pagar'}
            </Link>
            , a la espera de que el cliente complete el pago.
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}
