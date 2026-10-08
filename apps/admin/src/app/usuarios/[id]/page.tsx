import { notFound, redirect } from 'next/navigation';
import { VENDOR_STATES, type VendorState } from '@maqserv/types';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Btn, Chip, PageHeader, Panel, Stat, Stats, StatusText, type Tone } from '@/components/ui';

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

const VENDOR_TONE: Record<'warn' | 'ok' | 'bad', Tone> = { warn: 'warn', ok: 'info', bad: 'bad' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';
const short = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

const QUOTE_LABEL: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pendiente', tone: 'warn' },
  completed: { label: 'Respondida', tone: 'ok' },
  rejected: { label: 'Rechazada', tone: 'bad' },
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
  const p = c.profile;
  const address = [p.address, p.city, p.zip ? `CP ${p.zip}` : null, p.residency].filter(Boolean).join(', ');

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .cd-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
          .cd-q { display: grid; grid-template-columns: minmax(0,1fr) 110px 110px 120px; gap: 12px; align-items: center; }
          @media (max-width: 1000px) { .cd-grid { grid-template-columns: 1fr; } }
          @media (max-width: 560px) {
            .cd-q { display: flex; flex-wrap: wrap; gap: 6px 14px; }
            .cd-q > .cd-q-total { margin-left: auto; }
          }
        `}</style>

        <PageHeader
          eyebrow={['1 · Recibir', ['Cuentas del sitio', '/usuarios']]}
          title={c.name}
          subtitle={`Cliente desde el ${day(c.createdAt)}`}
          actions={vs ? (
            <Btn size="sm" href={`/vendedores/${c.id}`}>
              <StatusText tone={VENDOR_TONE[vs.tone]}>{c.shopName ?? 'Vendedor'} · {vs.label.toLowerCase()}</StatusText>
              <i className="ph ph-arrow-right" aria-hidden />
            </Btn>
          ) : null}
        />

        {/* Resumen */}
        <Stats>
          <Stat label="Cotizaciones" icon="ph-file-text" value={c.stats.quotes} />
          <Stat label="Opiniones" icon="ph-star" value={c.stats.comments} />
          <Stat label="Preguntas" icon="ph-question" value={c.stats.questions} />
        </Stats>

        <div className="cd-grid">
          <div style={{ minWidth: 0 }}>
            {/* Los pedidos del carrito se retiraron (2026-10-08): lo que el cliente
                pide ahora son cotizaciones. */}
            {/* --- Cotizaciones --- */}
            {c.quotes.length > 0 ? (
              <Panel title="Cotizaciones" flush clip>
                {c.quotes.map((q) => {
                  const qs = QUOTE_LABEL[q.status] ?? { label: q.status, tone: 'muted' as Tone };
                  return (
                    <div key={q.id} className="adm-trow cd-q">
                      <span className="adm-mono adm-ellipsis" style={{ color: 'var(--adm-text)' }}>{q.quoteNumber}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{short(q.createdAt)}</span>
                      <span><StatusText tone={qs.tone}>{qs.label}</StatusText></span>
                      <span className="cd-q-total adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)', textAlign: 'right' }}>{money(q.total)}</span>
                    </div>
                  );
                })}
              </Panel>
            ) : null}

            {/* --- Lo que ha dicho en el sitio --- */}
            {c.comments.length > 0 || c.questions.length > 0 ? (
              <Panel title="Opiniones y preguntas" flush clip>
                {c.comments.map((r) => (
                  <div key={`c-${r.id}`} className="adm-trow">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--adm-accent)', letterSpacing: 1 }} title={`${r.rating ?? 0} de 5`}>{'★'.repeat(Math.max(0, Math.min(5, r.rating ?? 0)))}</span>
                      <span style={{ fontSize: 13, color: 'var(--adm-text-2)', fontWeight: 600 }}>{r.product}</span>
                      {r.status === 0 ? <Chip tone="bad">Oculta</Chip> : null}
                      <span style={{ fontSize: 12, color: 'var(--adm-faint)', marginLeft: 'auto' }}>{short(r.createdAt)}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>{r.text}</p>
                  </div>
                ))}
                {c.questions.map((q) => (
                  <div key={`q-${q.id}`} className="adm-trow">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Chip tone="info">Pregunta</Chip>
                      <span style={{ fontSize: 13, color: 'var(--adm-text-2)', fontWeight: 600 }}>{q.product}</span>
                      {!q.answered ? <Chip tone="warn">Sin responder</Chip> : null}
                      <span style={{ fontSize: 12, color: 'var(--adm-faint)', marginLeft: 'auto' }}>{short(q.createdAt)}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>{q.question}</p>
                  </div>
                ))}
              </Panel>
            ) : null}
          </div>

          {/* --- Datos --- */}
          <Panel title="Datos">
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Correo" value={c.email} mono />
              <Field label="Teléfono" value={c.phone} mono />
              <Field label="Dirección" value={address || null} />
            </div>
            <p className="adm-help" style={{ margin: '16px 0 0' }}>
              Estos datos los edita el cliente desde su cuenta en el sitio.
            </p>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="adm-label" style={{ display: 'block', marginBottom: 3 }}>{label}</span>
      <span
        className={value && mono ? 'adm-mono' : undefined}
        style={{ color: value ? 'var(--adm-text)' : 'var(--adm-faint)', fontSize: 13.5, wordBreak: 'break-word' }}
      >
        {value ?? 'No lo capturó'}
      </span>
    </div>
  );
}
