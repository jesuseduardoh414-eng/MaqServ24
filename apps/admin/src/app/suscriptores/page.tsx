import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NEWSLETTER_ACTIVO } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, IconBtn, Note, PageHeader, Panel, Stat, Stats, Toolbar } from '@/components/ui';
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

const GRID = 'minmax(0,2.2fr) minmax(0,1fr) minmax(0,0.9fr)';

/** Clientes → Suscriptores: los correos del boletín del pie de página. */
export default async function AdminSubscribers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  if (!NEWSLETTER_ACTIVO) redirect('/'); // boletín apagado: la pantalla no existe
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
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .sb-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
          @media (max-width: 900px) {
            .sb-thead { display: none !important; }
            .sb-row { grid-template-columns: minmax(0,1fr) auto; row-gap: 6px; }
            .sb-row > .sb-c-email { grid-column: 1 / -1; }
          }
        `}</style>

        <PageHeader
          eyebrow={['Clientes', 'Suscriptores']}
          title="Suscriptores"
          subtitle="Correos que dejaron en el boletín del pie de página. La plataforma no manda correos: esta lista sirve para llevarlos a tu CRM o exportarlos."
          actions={<SubscriberTools perfexEnabled={data?.perfexEnabled ?? false} total={total} />}
        />

        <Stats>
          <Stat label="En la lista" icon="ph-envelope-simple" tone="accent" value={total} />
        </Stats>

        {/* Si Perfex no está conectado, los leads nuevos se omiten EN SILENCIO. */}
        {data && !data.perfexEnabled ? (
          <Note tone="warn" style={{ marginBottom: 20 }}>
            <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Perfex CRM no está conectado.</strong> Los correos se guardan aquí, pero
            no se están enviando al CRM. Para conectarlo hay que configurar <span className="adm-mono">PERFEX_URL</span> y{' '}
            <span className="adm-mono">PERFEX_TOKEN</span> en la API. Mientras tanto, exporta la lista.
          </Note>
        ) : null}

        <Toolbar end={`${data?.total ?? 0} de ${total}`}>
          <SubscribersSearch initial={q} />
        </Toolbar>

        <Panel
          flush
          clip
          footer={pages > 1 ? (
            <>
              <span>
                <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{data?.total ?? 0}</span> suscriptores{q ? ` para “${q}”` : ''}
                {clientes > 0 ? ` · ${clientes} en esta página ya son clientes` : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {page <= 1
                  ? <IconBtn icon="ph-caret-left" label="Página anterior" disabled />
                  : <IconBtn icon="ph-caret-left" label="Página anterior" href={link({ page: String(page - 1) })} />}
                <span className="adm-num" style={{ color: 'var(--adm-text-2)', fontWeight: 500, padding: '0 4px' }}>Página {page} / {pages}</span>
                {page >= pages
                  ? <IconBtn icon="ph-caret-right" label="Página siguiente" disabled />
                  : <IconBtn icon="ph-caret-right" label="Página siguiente" href={link({ page: String(page + 1) })} />}
              </div>
            </>
          ) : undefined}
        >
          <div className="adm-thead sb-row sb-thead">
            <div>Correo</div>
            <div>Alta</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {items.map((s) => (
            <div key={s.id} className="adm-trow sb-row">
              <div className="sb-c-email" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span className="adm-ellipsis" style={{ fontSize: 14, fontWeight: 500, color: 'var(--adm-text)' }}>{s.email}</span>
                {/* Distingue un lead frío de alguien que ya te compró. */}
                {s.customerId ? (
                  <Link href={`/usuarios/${s.customerId}`} className="adm-chip t-ok" style={{ textDecoration: 'none', flexShrink: 0 }}>
                    Ya es cliente <i className="ph ph-arrow-right" aria-hidden />
                  </Link>
                ) : null}
              </div>

              <div className="adm-num" style={{ fontSize: 13, color: s.createdAt ? 'var(--adm-text-2)' : 'var(--adm-faint)' }}>
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
            <EmptyState
              icon="ph-envelope-simple"
              title={q ? 'Sin resultados' : 'Aún no hay suscriptores'}
              sub={q ? 'Prueba con otro término.' : 'Aparecen cuando alguien deja su correo en el boletín del pie de página del sitio.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
