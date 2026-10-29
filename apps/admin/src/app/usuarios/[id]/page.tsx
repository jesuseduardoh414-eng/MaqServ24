import Link from '@/components/Enlace';
import { notFound, redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Chip, PageHeader, Panel, Stat, Stats, StatusText, type Tone } from '@/components/ui';

interface CustomerDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string | null;
  profile: { address: string | null; city: string | null; zip: string | null; residency: string | null };
  stats: { empresas: number; sites: number; quotes: number; comments: number; questions: number };
  /** Cuenta → empresas → obras (2026-10-23). */
  empresas: Array<{
    id: number;
    name: string;
    status: number;
    sites: Array<{ id: number; name: string; address: string | null; municipality: string | null; status: number; quotes: number }>;
  }>;
  quotes: Array<{
    id: number; quoteNumber: string; total: number; status: string; createdAt: string | null;
    empresa: string | null; obra: string | null; linea: string;
  }>;
  comments: Array<{ id: number; productId: number; product: string; rating: number | null; text: string; status: number; createdAt: string }>;
  questions: Array<{ id: number; productId: number | null; product: string; question: string; answered: boolean; createdAt: string }>;
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';
const short = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

const QUOTE_LABEL: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Por cotizar', tone: 'warn' },
  completed: { label: 'Respondida', tone: 'ok' },
  rejected: { label: 'Rechazada', tone: 'bad' },
};

/**
 * Ficha de la cuenta: para qué empresas pide, las obras de cada una, sus
 * solicitudes y lo que ha dicho en el sitio. Las empresas y obras se editan en
 * Clientes y obras; aquí cada una lleva a su ficha (2026-10-23).
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const { id } = await params;

  const c = await adminFetch<CustomerDetail>(`/admin/users/${id}`);
  if (!c) notFound();

  const p = c.profile;
  const address = [p.address, p.city, p.zip ? `CP ${p.zip}` : null, p.residency].filter(Boolean).join(', ');

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .cd-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
          .cd-q { display: grid; grid-template-columns: 112px minmax(0,1fr) 96px 104px 110px; gap: 12px; align-items: center; }
          .cd-obra { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--adm-border); }
          @media (max-width: 1000px) { .cd-grid { grid-template-columns: 1fr; } }
          @media (max-width: 640px) {
            .cd-q { display: flex; flex-wrap: wrap; gap: 6px 14px; }
            .cd-q > .cd-q-total { margin-left: auto; }
          }
        `}</style>

        <PageHeader
          eyebrow={['1 · Recibir', ['Cuentas del sitio', '/usuarios']]}
          title={c.name}
          subtitle={`Cuenta del sitio desde el ${day(c.createdAt)}`}
        />

        {/* Resumen */}
        <Stats>
          <Stat label="Empresas" icon="ph-buildings" value={c.stats.empresas} />
          <Stat label="Obras" icon="ph-map-pin" value={c.stats.sites} />
          <Stat label="Solicitudes" icon="ph-file-text" value={c.stats.quotes} />
          <Stat label="Opiniones y preguntas" icon="ph-chat-circle" value={c.stats.comments + c.stats.questions} />
        </Stats>

        <div className="cd-grid">
          <div style={{ minWidth: 0 }}>
            {/* --- Empresas y obras --- */}
            <Panel title="Empresas y obras">
              {c.empresas.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-muted)' }}>
                  Todavía sin empresa: nace al confirmar su correo o con su primera solicitud.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 18 }}>
                  {c.empresas.map((e) => (
                    <div key={e.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Link href={`/clientes?ver=${e.id}`} className="adm-cell-title adm-link">{e.name}</Link>
                        {e.status === 0 ? <Chip tone="muted">Inactiva</Chip> : null}
                        <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                          {e.sites.length === 0 ? 'sin obras' : `${e.sites.length} obra${e.sites.length === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      {e.sites.map((s) => (
                        <div key={s.id} className="cd-obra">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, color: s.status === 1 ? 'var(--adm-text)' : 'var(--adm-faint)', fontWeight: 500 }}>
                              {s.name}{s.status === 1 ? '' : ' · dada de baja'}
                            </div>
                            {s.address || s.municipality ? (
                              <div className="adm-ellipsis" style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginTop: 2 }}>
                                {/* La dirección de una obra nueva ya trae el municipio al final. */}
                                {s.address && s.municipality && s.address.includes(s.municipality)
                                  ? s.address
                                  : [s.address, s.municipality].filter(Boolean).join(', ')}
                              </div>
                            ) : null}
                          </div>
                          <span className="adm-num" style={{ fontSize: 12.5, color: s.quotes > 0 ? 'var(--adm-text-2)' : 'var(--adm-faint)' }}>
                            {s.quotes} solicitud{s.quotes === 1 ? '' : 'es'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* --- Solicitudes --- */}
            {c.quotes.length > 0 ? (
              <Panel title="Solicitudes" flush clip>
                {c.quotes.map((q) => {
                  const qs = QUOTE_LABEL[q.status] ?? { label: q.status, tone: 'muted' as Tone };
                  return (
                    <div key={q.id} className="adm-trow cd-q">
                      <span className="adm-mono adm-ellipsis" style={{ color: 'var(--adm-text)' }}>{q.quoteNumber}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="adm-ellipsis" style={{ display: 'block', fontSize: 13, color: 'var(--adm-text-2)' }}>{q.linea}</span>
                        <span className="adm-ellipsis" style={{ display: 'block', fontSize: 12, color: 'var(--adm-muted)' }}>
                          {[q.empresa, q.obra ?? 'sin obra'].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{short(q.createdAt)}</span>
                      <span><StatusText tone={qs.tone}>{qs.label}</StatusText></span>
                      <span className="cd-q-total adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: q.total > 0 ? 'var(--adm-text)' : 'var(--adm-faint)', textAlign: 'right' }}>
                        {q.total > 0 ? money(q.total) : 'sin precio'}
                      </span>
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
