import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { VENDOR_STATES, type VendorState } from '@maqserv/types';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';

interface CustomerDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string | null;
  vendorState: VendorState | null;
  shopName: string | null;
  profile: { address: string | null; city: string | null; zip: string | null; residency: string | null };
  stats: { orders: number; spent: number; quotes: number; comments: number; questions: number };
  quotes: Array<{ id: number; quoteNumber: string; total: number; status: string; createdAt: string | null }>;
  comments: Array<{ id: number; productId: number; product: string; rating: number | null; text: string; status: number; createdAt: string }>;
  questions: Array<{ id: number; productId: number; product: string; question: string; answered: boolean; createdAt: string }>;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const VENDOR_TONE: Record<'warn' | 'ok' | 'bad', string> = { warn: D.amber, ok: BLUE, bad: '#f55' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const card: React.CSSProperties = { background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 };
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase' };
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';
const short = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

const QUOTE_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: D.amber },
  completed: { label: 'Respondida', color: GREEN },
  rejected: { label: 'Rechazada', color: '#f55' },
};

/** Ficha del cliente: todo lo que ha hecho en el sitio, en un solo lugar. */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const { id } = await params;

  const c = await adminFetch<CustomerDetail>(`/admin/users/${id}`);
  if (!c) notFound();

  const vs = c.vendorState ? VENDOR_STATES[c.vendorState] : null;
  const vColor = vs ? VENDOR_TONE[vs.tone] : null;
  const p = c.profile;
  const address = [p.address, p.city, p.zip ? `CP ${p.zip}` : null, p.residency].filter(Boolean).join(', ');

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .cd-back:hover{ color:var(--color-primary); }
          .cd-link:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 1000px){ .cd-grid{ grid-template-columns: 1fr !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
          <span>Clientes</span><span style={{ color: '#4C4C51' }}>/</span>
          <Link href="/usuarios" className="cd-back" style={{ color: '#8A8A8F', textDecoration: 'none' }}>Directorio</Link>
          <span style={{ color: '#4C4C51' }}>/</span>
          <span style={{ color: '#B4B4B9' }}>{c.name}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>{c.name}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>Cliente desde el {day(c.createdAt)}</p>
          </div>
          {vs && vColor ? (
            <Link
              href={`/vendedores/${c.id}`}
              className="cd-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700, color: vColor, background: `color-mix(in srgb, ${vColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${vColor} 26%, transparent)`, borderRadius: 20, padding: '7px 14px' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: vColor }} />
              {c.shopName ?? 'Vendedor'} · {vs.label.toLowerCase()} →
            </Link>
          ) : null}
        </div>

        {/* Resumen */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Cotizaciones', value: String(c.stats.quotes), color: '#B4B4B9' },
            { label: 'Opiniones', value: String(c.stats.comments), color: '#B4B4B9' },
            { label: 'Preguntas', value: String(c.stats.questions), color: '#B4B4B9' },
          ].map((s) => (
            <div key={s.label} style={{ ...card, padding: '14px 18px', minWidth: 140, flex: '1 1 140px' }}>
              <div style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: s.color, fontFamily: MONO }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="cd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, marginTop: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {/* Los pedidos del carrito se retiraron (2026-10-08): lo que el cliente
                pide ahora son cotizaciones. */}
            {/* --- Cotizaciones --- */}
            {c.quotes.length > 0 ? (
              <div style={card}>
                <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Cotizaciones</h2>
                <div style={{ display: 'grid', gap: 10 }}>
                  {c.quotes.map((q, i) => {
                    const qs = QUOTE_LABEL[q.status] ?? { label: q.status, color: '#7A7A7F' };
                    return (
                      <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: i < c.quotes.length - 1 ? `1px solid ${D.cardBorder}` : undefined }}>
                        <span style={{ fontFamily: MONO, fontSize: 12.5, color: '#EDEDEC' }}>{q.quoteNumber}</span>
                        <span style={{ fontSize: 11, color: '#5C5C61' }}>{short(q.createdAt)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: qs.color }}>{qs.label}</span>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: '#FBFBFA' }}>{money(q.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* --- Lo que ha dicho en el sitio --- */}
            {c.comments.length > 0 || c.questions.length > 0 ? (
              <div style={card}>
                <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Opiniones y preguntas</h2>
                <div style={{ display: 'grid', gap: 14 }}>
                  {c.comments.map((r) => (
                    <div key={`c-${r.id}`} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: D.amber, fontWeight: 700 }}>{'★'.repeat(Math.max(0, Math.min(5, r.rating ?? 0)))}</span>
                        <span style={{ fontSize: 12.5, color: '#B4B4B9', fontWeight: 600 }}>{r.product}</span>
                        {r.status === 0 ? <span style={{ fontSize: 10.5, color: '#f55', fontWeight: 700 }}>OCULTA</span> : null}
                        <span style={{ fontSize: 11, color: '#5C5C61', marginLeft: 'auto' }}>{short(r.createdAt)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#8A8A8F', lineHeight: 1.5 }}>{r.text}</p>
                    </div>
                  ))}
                  {c.questions.map((q) => (
                    <div key={`q-${q.id}`} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#5b9dff', fontWeight: 700 }}>PREGUNTA</span>
                        <span style={{ fontSize: 12.5, color: '#B4B4B9', fontWeight: 600 }}>{q.product}</span>
                        {!q.answered ? <span style={{ fontSize: 10.5, color: D.amber, fontWeight: 700 }}>SIN RESPONDER</span> : null}
                        <span style={{ fontSize: 11, color: '#5C5C61', marginLeft: 'auto' }}>{short(q.createdAt)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#8A8A8F', lineHeight: 1.5 }}>{q.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* --- Datos --- */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={card}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Datos</h2>
              <div style={{ display: 'grid', gap: 13, fontSize: 13 }}>
                <Field label="Correo" value={c.email} mono />
                <Field label="Teléfono" value={c.phone} mono />
                <Field label="Dirección" value={address || null} />
              </div>
              <p style={{ margin: '16px 0 0', fontSize: 11.5, color: '#5C5C61', lineHeight: 1.5 }}>
                Estos datos los edita el cliente desde su cuenta en el sitio.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span style={{ ...th, display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ color: value ? '#EDEDEC' : '#5C5C61', fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 12.5 : 13.5, wordBreak: 'break-word' }}>
        {value ?? 'No lo capturó'}
      </span>
    </div>
  );
}
