import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { VENDOR_STATES, WITHDRAW_STATES, toWithdrawState } from '@maqserv/types';
import { SITE_URL, adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, Note, PageHeader, Panel, PanelLink, Stat, Stats, StatusText, Thumb, type Tone } from '@/components/ui';
import { vendorStatus } from '../vendor-status';
import { VendorActions } from '../VendorActions';

interface VendorDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: number;
  balance: number;
  createdAt: string | null;
  productTotal: number;
  activeTotal: number;
  application: {
    shopName: string | null;
    ownerName: string | null;
    shopNumber: string | null;
    shopAddress: string | null;
    regNumber: string | null;
    shopMessage: string | null;
    shopDetails: string | null;
  };
  products: Array<{ id: number; slug: string; name: string; price: number; stock: number | null; status: number; image: string | null; isRental: boolean }>;
  orders: Array<{ id: number; orderNumber: string; qty: number; price: number; status: string }>;
  withdraws: Array<{ id: number; amount: number; method: string | null; reference: string | null; status: string; createdAt: string | null }>;
}

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';

/**
 * Los textos salen de `WITHDRAW_STATES` (@maqserv/types) — el mismo origen que usa el
 * sitio del vendedor. Aquí se toma `adminLabel` ("Por pagar" = trabajo pendiente);
 * al vendedor se le dice "En revisión". Mismo estado, dos lecturas.
 */
function withdrawLabel(raw: string): { label: string; tone: Tone } {
  const s = toWithdrawState(raw);
  if (!s) return { label: raw, tone: 'muted' };
  const info = WITHDRAW_STATES[s];
  return { label: info.adminLabel, tone: info.tone };
}

/** Detalle del vendedor: la solicitud + lo que realmente hace en el marketplace. */
export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'marketplace');
  const { id } = await params;

  const v = await adminFetch<VendorDetail>(`/admin/vendors/${id}`);
  if (!v) notFound();

  const st = vendorStatus(v.status);
  const stTone = VENDOR_STATES[st.state].tone;
  const a = v.application;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .vd-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
          .vd-grid .adm-panel + .adm-panel { margin-top: 0; }
          @media (max-width: 1000px) { .vd-grid { grid-template-columns: minmax(0,1fr); } }
          .vd-sale { display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 16px; align-items: center; }
        `}</style>

        <PageHeader
          eyebrow={['Marketplace', ['Vendedores', '/vendedores'], a.shopName ?? v.name]}
          title={a.shopName ?? '—'}
          subtitle={`Solicitó el ${day(v.createdAt)} · ${v.name}`}
          actions={
            <>
              <StatusText tone={stTone}>{st.label}</StatusText>
              <VendorActions vendorId={v.id} status={v.status} size="md" />
            </>
          }
        />

        {/* Qué implica el estado actual, en una línea. */}
        <Note tone={stTone} style={{ marginBottom: 20 }}>{VENDOR_STATES[st.state].hint}</Note>

        <div className="vd-grid">
          <div style={{ display: 'grid', gap: 20 }}>
            {/* --- La solicitud: esto es lo que hace falta para decidir --- */}
            <Panel title="La solicitud" desc="Lo que el cliente capturó al pedir vender en el sitio.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px 20px' }}>
                <Field label="Nombre de la tienda" value={a.shopName} />
                <Field label="Titular" value={a.ownerName ?? v.name} />
                <Field label="Teléfono de la tienda" value={a.shopNumber ?? v.phone} mono />
                <Field label="Registro / RFC" value={a.regNumber} mono />
                <Field label="Dirección" value={a.shopAddress} />
                <Field label="Correo" value={v.email} />
              </div>
              {a.shopMessage ? (
                <div style={{ borderTop: '1px solid var(--adm-border)', marginTop: 18, paddingTop: 16 }}>
                  <span className="adm-label" style={{ display: 'block', marginBottom: 6 }}>Mensaje del solicitante</span>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--adm-text-2)', lineHeight: 1.6 }}>{a.shopMessage}</p>
                </div>
              ) : null}
              {a.shopDetails ? (
                <div style={{ borderTop: '1px solid var(--adm-border)', marginTop: 16, paddingTop: 16 }}>
                  <span className="adm-label" style={{ display: 'block', marginBottom: 6 }}>Descripción de la tienda</span>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--adm-text-2)', lineHeight: 1.6 }}>{a.shopDetails}</p>
                </div>
              ) : null}
            </Panel>

            {/* --- Productos --- */}
            <Panel
              flush
              clip
              title="Productos publicados"
              action={<span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-muted)', whiteSpace: 'nowrap' }}>{v.activeTotal} activos de {v.productTotal}</span>}
            >
              {v.products.length === 0 ? (
                <EmptyState icon="ph-package" title="Este vendedor no ha publicado ningún equipo." />
              ) : (
                v.products.map((p) => (
                  <div key={p.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Thumb src={p.image} icon="ph-package" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/productos/editar/${p.id}`} className="adm-link adm-cell-title" style={{ display: 'block' }}>
                        <span className="adm-ellipsis" style={{ display: 'block' }}>{p.name}</span>
                      </Link>
                      <div className="adm-cell-sub adm-num">
                        {money(p.price)}{p.isRental ? ' / mes' : ''} · stock {p.stock ?? '—'}
                      </div>
                    </div>
                    <StatusText tone={p.status === 1 ? 'ok' : 'muted'}>{p.status === 1 ? 'Activo' : 'Inactivo'}</StatusText>
                  </div>
                ))
              )}
            </Panel>

            {/* --- Ventas --- */}
            <Panel flush clip title="Ventas" desc="Se generan solas cuando un cliente compra su equipo en el checkout.">
              {v.orders.length === 0 ? (
                <EmptyState icon="ph-receipt" title="Todavía no le han comprado." />
              ) : (
                v.orders.map((o) => (
                  <div key={o.id} className="adm-trow vd-sale">
                    <span className="adm-mono adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text)' }}>{o.orderNumber}</span>
                    <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{o.qty} {o.qty === 1 ? 'pieza' : 'piezas'}</span>
                    <span className="adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)', textAlign: 'right' }}>{money(o.price)}</span>
                  </div>
                ))
              )}
            </Panel>
          </div>

          {/* --- Columna derecha --- */}
          <div style={{ display: 'grid', gap: 20 }}>
            {/* El saldo es una sola cifra: va en texto plano, no en una caja. */}
            <div>
              <Stats style={{ marginBottom: 8 }}>
                <Stat label="Saldo" icon="ph-wallet" tone="accent" value={money(v.balance)} valueTone={v.balance > 0 ? undefined : 'muted'} />
              </Stats>
              <p className="adm-help" style={{ margin: 0, fontSize: 12.5 }}>
                Lo que se le debe al vendedor. Al pedir un retiro se le descuenta de inmediato; si rechazas el retiro, se le regresa.
              </p>
            </div>

            <Panel flush clip title="Retiros" action={<PanelLink href="/retiros">Gestionar</PanelLink>}>
              {v.withdraws.length === 0 ? (
                <EmptyState icon="ph-hand-coins" title="No ha pedido ningún retiro." />
              ) : (
                v.withdraws.map((w) => {
                  const ws = withdrawLabel(w.status);
                  return (
                    <div key={w.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' }}>{money(w.amount)}</div>
                        <div className="adm-cell-sub">{w.method ?? '—'} · {day(w.createdAt)}</div>
                      </div>
                      <StatusText tone={ws.tone}>{ws.label}</StatusText>
                    </div>
                  );
                })
              )}
            </Panel>

            {v.status === 2 ? (
              <a href={`${SITE_URL}/tienda/${v.id}`} target="_blank" rel="noreferrer" className="adm-panel-link">
                Ver su tienda en el sitio <i className="ph ph-arrow-up-right" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className="adm-label" style={{ display: 'block', marginBottom: 4 }}>{label}</span>
      <span
        className={mono && value ? 'adm-mono' : undefined}
        style={{ fontSize: 14, color: value ? 'var(--adm-text)' : 'var(--adm-faint)', wordBreak: 'break-word' }}
      >
        {value ?? 'No lo capturó'}
      </span>
    </div>
  );
}
