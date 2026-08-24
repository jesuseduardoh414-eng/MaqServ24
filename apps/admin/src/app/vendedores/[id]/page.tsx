import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { VENDOR_STATES, WITHDRAW_STATES, toWithdrawState } from '@maqserv/types';
import { SITE_URL, adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
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

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
const card: React.CSSProperties = { background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 };
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase' };
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';

/**
 * Los textos salen de `WITHDRAW_STATES` (@maqserv/types) — el mismo origen que usa el
 * sitio del vendedor. Aquí se toma `adminLabel` ("Por pagar" = trabajo pendiente);
 * al vendedor se le dice "En revisión". Mismo estado, dos lecturas.
 */
const WITHDRAW_TONE: Record<'warn' | 'ok' | 'bad', string> = { warn: D.amber, ok: GREEN, bad: '#f55' };

function withdrawLabel(raw: string): { label: string; color: string } {
  const s = toWithdrawState(raw);
  if (!s) return { label: raw, color: '#7A7A7F' };
  const info = WITHDRAW_STATES[s];
  return { label: info.adminLabel, color: WITHDRAW_TONE[info.tone] };
}

/** Detalle del vendedor: la solicitud + lo que realmente hace en el marketplace. */
export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const { id } = await params;

  const v = await adminFetch<VendorDetail>(`/admin/vendors/${id}`);
  if (!v) notFound();

  const st = vendorStatus(v.status);
  const a = v.application;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .vd-back:hover{ color:var(--color-primary); }
          .vd-link:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 1000px){ .vd-grid{ grid-template-columns: 1fr !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
          <span>Marketplace</span><span style={{ color: '#4C4C51' }}>/</span>
          <Link href="/vendedores" className="vd-back" style={{ color: '#8A8A8F', textDecoration: 'none' }}>Vendedores</Link>
          <span style={{ color: '#4C4C51' }}>/</span>
          <span style={{ color: '#B4B4B9' }}>{a.shopName ?? v.name}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>{a.shopName ?? '—'}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>
              Solicitó el {day(v.createdAt)} · {v.name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: st.color, background: `color-mix(in srgb, ${st.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${st.color} 26%, transparent)`, borderRadius: 20, padding: '6px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
              {st.label}
            </span>
            <VendorActions vendorId={v.id} status={v.status} size="md" />
          </div>
        </div>

        {/* Qué implica el estado actual, en una línea. */}
        <div style={{ ...card, marginTop: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 11, borderColor: `color-mix(in srgb, ${st.color} 26%, transparent)`, background: `color-mix(in srgb, ${st.color} 6%, ${D.card})` }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: '#D4D4D8' }}>{VENDOR_STATES[st.state].hint}</span>
        </div>

        <div className="vd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, marginTop: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {/* --- La solicitud: esto es lo que hace falta para decidir --- */}
            <div style={card}>
              <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>La solicitud</h2>
              <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#7A7A7F' }}>Lo que el cliente capturó al pedir vender en el sitio.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <Field label="Nombre de la tienda" value={a.shopName} />
                <Field label="Titular" value={a.ownerName ?? v.name} />
                <Field label="Teléfono de la tienda" value={a.shopNumber ?? v.phone} mono />
                <Field label="Registro / RFC" value={a.regNumber} mono />
                <Field label="Dirección" value={a.shopAddress} />
                <Field label="Correo" value={v.email} mono />
              </div>
              {a.shopMessage ? (
                <div style={{ borderTop: `1px solid ${D.cardBorder}`, marginTop: 18, paddingTop: 15 }}>
                  <span style={{ ...th, display: 'block', marginBottom: 7 }}>Mensaje del solicitante</span>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#D4D4D8', lineHeight: 1.6 }}>{a.shopMessage}</p>
                </div>
              ) : null}
              {a.shopDetails ? (
                <div style={{ borderTop: `1px solid ${D.cardBorder}`, marginTop: 15, paddingTop: 15 }}>
                  <span style={{ ...th, display: 'block', marginBottom: 7 }}>Descripción de la tienda</span>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#D4D4D8', lineHeight: 1.6 }}>{a.shopDetails}</p>
                </div>
              ) : null}
            </div>

            {/* --- Productos --- */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Productos publicados</h2>
                <span style={{ fontFamily: MONO, fontSize: 12, color: '#7A7A7F' }}>{v.activeTotal} activos de {v.productTotal}</span>
              </div>
              {v.products.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>Este vendedor no ha publicado ningún equipo.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {v.products.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 12, borderBottom: i < v.products.length - 1 ? `1px solid ${D.cardBorder}` : undefined }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image ?? ''} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#1A1A1D', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/productos/editar/${p.id}`} className="vd-link" style={{ fontSize: 13.5, fontWeight: 600, color: '#EDEDEC', textDecoration: 'none' }}>{p.name}</Link>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#7A7A7F', marginTop: 3 }}>
                          {money(p.price)}{p.isRental ? ' / mes' : ''} · stock {p.stock ?? '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.status === 1 ? GREEN : '#5C5C61', flexShrink: 0 }}>
                        {p.status === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Ventas --- */}
            <div style={card}>
              <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Ventas</h2>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#7A7A7F' }}>Se generan solas cuando un cliente compra su equipo en el checkout.</p>
              {v.orders.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>Todavía no le han comprado.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {v.orders.map((o, i) => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: i < v.orders.length - 1 ? `1px solid ${D.cardBorder}` : undefined }}>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, color: '#EDEDEC' }}>{o.orderNumber}</span>
                      <span style={{ fontSize: 12, color: '#7A7A7F' }}>{o.qty} {o.qty === 1 ? 'pieza' : 'piezas'}</span>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#FBFBFA' }}>{money(o.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* --- Columna derecha --- */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={card}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Saldo</h2>
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: v.balance > 0 ? D.amber : '#5C5C61', letterSpacing: '-1px' }}>
                {money(v.balance)}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#7A7A7F', lineHeight: 1.55 }}>
                Lo que se le debe al vendedor. Al pedir un retiro se le descuenta de inmediato; si rechazas el retiro, se le regresa.
              </p>
            </div>

            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Retiros</h2>
                <Link href="/retiros" className="vd-link" style={{ fontSize: 11.5, fontWeight: 700, color: '#7A7A7F', textDecoration: 'none' }}>Gestionar →</Link>
              </div>
              {v.withdraws.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>No ha pedido ningún retiro.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {v.withdraws.map((w, i) => {
                    const ws = withdrawLabel(w.status);
                    return (
                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 12, borderBottom: i < v.withdraws.length - 1 ? `1px solid ${D.cardBorder}` : undefined }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: '#EDEDEC' }}>{money(w.amount)}</div>
                          <div style={{ fontSize: 11, color: '#5C5C61', marginTop: 3 }}>{w.method ?? '—'} · {day(w.createdAt)}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: ws.color, flexShrink: 0 }}>{ws.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {v.status === 2 ? (
              <Link href={`${SITE_URL}/tienda/${v.id}`} target="_blank" rel="noreferrer" className="vd-link" style={{ fontSize: 12.5, fontWeight: 700, color: '#7A7A7F', textDecoration: 'none' }}>
                Ver su tienda en el sitio →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span style={{ ...th, display: 'block', marginBottom: 5 }}>{label}</span>
      <span style={{ color: value ? '#EDEDEC' : '#5C5C61', fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 12.5 : 13.5, wordBreak: 'break-word' }}>
        {value ?? 'No lo capturó'}
      </span>
    </div>
  );
}
