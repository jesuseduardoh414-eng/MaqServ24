import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { SubscribersSearch } from './SubscribersSearch';
import { DeleteSubscriber, SubscriberTools } from './SubscriberActions';

interface SubRow {
  id: number;
  email: string;
  createdAt: string | null;
  /** Si ya está registrado en el sitio, su id de cliente. */
  customerId: number | null;
}

interface SubsResponse {
  items: SubRow[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
  perfexEnabled: boolean;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const GRID = '2.2fr 1fr 0.9fr';
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

/** Clientes → Suscriptores: los correos del boletín del pie de página. */
export default async function AdminSubscribers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const q = sp.q ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (q) qs.set('search', q);
  const data = await adminFetch<SubsResponse>(`/admin/subscribers?${qs.toString()}`);

  const items = data?.items ?? [];
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;
  const total = data?.counts.all ?? 0;
  const clientes = items.filter((s) => s.customerId).length;

  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/suscriptores?${s}` : '/suscriptores';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .sb-row:hover{ background: rgba(255,255,255,0.022); }
          .sb-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
          .sb-link:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 900px){ .sb-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 8px !important; } .sb-head{ display:none !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Clientes</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Suscriptores</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Suscriptores</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F', maxWidth: '72ch' }}>
              Correos que dejaron en el boletín del pie de página. La plataforma no manda correos: esta lista sirve para llevarlos a tu CRM o exportarlos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: D.amber, boxShadow: `0 0 10px ${D.amber}b3` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>En la lista</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: D.amber, fontFamily: MONO }}>{total}</div>
            </div>
          </div>
        </div>

        {/* Si Perfex no está conectado, los leads nuevos se omiten EN SILENCIO. */}
        {data && !data.perfexEnabled ? (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 11, background: `color-mix(in srgb, ${D.amber} 7%, ${D.card})`, border: `1px solid color-mix(in srgb, ${D.amber} 30%, transparent)`, borderRadius: 12, padding: '13px 17px' }}>
            <i className="ph ph-warning" style={{ color: D.amber, fontSize: 16, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#D4D4D8', lineHeight: 1.55 }}>
              <strong style={{ color: '#FBFBFA' }}>Perfex CRM no está conectado.</strong> Los correos se guardan aquí, pero
              no se están enviando al CRM. Para conectarlo hay que configurar <span style={{ fontFamily: MONO, fontSize: 12 }}>PERFEX_URL</span> y{' '}
              <span style={{ fontFamily: MONO, fontSize: 12 }}>PERFEX_TOKEN</span> en la API. Mientras tanto, exporta la lista.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <SubscribersSearch initial={q} />
          <SubscriberTools perfexEnabled={data?.perfexEnabled ?? false} total={total} />
        </div>

        <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="sb-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>CORREO</div>
            <div style={th}>ALTA</div>
            <div style={{ ...th, textAlign: 'right' }}>ACCIONES</div>
          </div>

          {items.map((s) => (
            <div key={s.id} className="sb-row sb-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 3, alignSelf: 'stretch', minHeight: 22, borderRadius: 3, background: s.customerId ? GREEN : '#2A2A2F', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: '#EDEDEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
                  {/* Distingue un lead frío de alguien que ya te compró. */}
                  {s.customerId ? (
                    <Link href={`/usuarios/${s.customerId}`} className="sb-link" style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textDecoration: 'none' }}>
                      YA ES CLIENTE →
                    </Link>
                  ) : null}
                </div>
              </div>

              <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#5C5C61' }}>
                {s.createdAt
                  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s.createdAt))
                  : 'sistema anterior'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <DeleteSubscriber id={s.id} email={s.email} />
              </div>
            </div>
          ))}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <i className="ph ph-envelope-simple" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>{q ? 'Sin resultados' : 'Aún no hay suscriptores'}</div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5, maxWidth: 440, marginInline: 'auto', lineHeight: 1.5 }}>
                {q ? 'Prueba con otro término.' : 'Aparecen cuando alguien deja su correo en el boletín del pie de página del sitio.'}
              </div>
            </div>
          ) : null}

          {pages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 24px', background: '#131315', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
                <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{data?.total ?? 0}</span> suscriptores{q ? ` para “${q}”` : ''}
                {clientes > 0 ? ` · ${clientes} en esta página ya son clientes` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href={link({ page: String(Math.max(1, page - 1)) })} className="sb-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page <= 1 ? 0.4 : 1, pointerEvents: page <= 1 ? 'none' : 'auto' }}>‹</Link>
                <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {page} / {pages}</span>
                <Link href={link({ page: String(Math.min(pages, page + 1)) })} className="sb-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page >= pages ? 0.4 : 1, pointerEvents: page >= pages ? 'none' : 'auto' }}>›</Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
