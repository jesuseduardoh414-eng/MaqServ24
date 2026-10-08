import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VENDOR_STATES, type VendorState } from '@maqserv/types';
import { MARKETPLACE_ACTIVO } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Chip, EmptyState, PageHeader, Panel, Segmented, Stat, Stats, Toolbar, type Tone } from '@/components/ui';
import { CustomersSearch } from './CustomersSearch';

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  vendorState: VendorState | null;
  orders: number;
  spent: number;
  createdAt: string | null;
}

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
}

const GRID = 'minmax(0,1.7fr) minmax(0,1.8fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,0.9fr)';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'compradores', label: 'Han comprado' },
  // Marketplace heredado: apagado, no hay vendedores que filtrar.
  ...(MARKETPLACE_ACTIVO ? [{ key: 'vendedores', label: 'Vendedores' }] : []),
];

const VENDOR_TONE: Record<'warn' | 'ok' | 'bad', Tone> = { warn: 'warn', ok: 'info', bad: 'bad' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

/** Clientes → la gente registrada. Solo lectura: el cliente edita su perfil en /cuenta. */
export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; segment?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const sp = await searchParams;
  const q = sp.q ?? '';
  const segment = sp.segment ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (q) qs.set('search', q);
  if (segment) qs.set('segment', segment);
  const data = await adminFetch<UsersResponse>(`/admin/users?${qs.toString()}`);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;

  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, segment, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/usuarios?${s}` : '/usuarios';
  };

  const pager = (href: string, off: boolean, icon: string, label: string) => (
    <Link
      href={href}
      className="adm-ibtn"
      aria-label={label}
      aria-disabled={off}
      tabIndex={off ? -1 : undefined}
      style={{ opacity: off ? 0.4 : 1, pointerEvents: off ? 'none' : 'auto' }}
    >
      <i className={`ph ${icon}`} aria-hidden />
    </Link>
  );

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .cu-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
          .cu-r { text-align: right; }
          @media (max-width: 1100px) {
            .cu-row { grid-template-columns: 1fr 1fr; row-gap: 10px; }
            .cu-head { display: none !important; }
          }
        `}</style>

        <PageHeader
          eyebrow={['1 · Recibir', 'Clientes']}
          title="Cuentas del sitio"
          subtitle="Quién está registrado y qué ha hecho. Abre uno para ver sus pedidos."
        />

        <Stats>
          <Stat label="Registrados" icon="ph-users" value={counts.all ?? 0} />
          <Stat
            label="Han comprado"
            icon="ph-shopping-bag"
            tone="ok"
            value={counts.compradores ?? 0}
            hint={`de ${counts.all ?? 0}`}
          />
        </Stats>

        <Toolbar end={`${data?.total ?? 0} de ${counts.all ?? 0}`}>
          <Segmented
            ariaLabel="Filtrar clientes"
            value={segment || 'all'}
            items={TABS.map((t) => ({
              key: t.key || 'all',
              label: t.label,
              count: t.key ? (counts[t.key] ?? 0) : (counts.all ?? 0),
              href: link({ segment: t.key || undefined, page: undefined }),
            }))}
          />
          <CustomersSearch initial={q} />
        </Toolbar>

        <Panel
          flush
          clip
          footer={
            <>
              {/* Antes esto era un texto plano: 55 de 75 clientes eran inalcanzables. */}
              <span>
                <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{data?.total ?? 0}</span> clientes{segment ? ' en este filtro' : ''}{q ? ` para “${q}”` : ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pager(link({ page: String(Math.max(1, page - 1)) }), page <= 1, 'ph-caret-left', 'Página anterior')}
                <span className="adm-num" style={{ fontSize: 13, color: 'var(--adm-text-2)', padding: '0 4px' }}>Página {page} / {pages}</span>
                {pager(link({ page: String(Math.min(pages, page + 1)) }), page >= pages, 'ph-caret-right', 'Página siguiente')}
              </span>
            </>
          }
        >
          <div className="adm-thead cu-row cu-head">
            <div>Cliente</div>
            <div>Contacto</div>
            <div className="cu-r">Pedidos</div>
            <div className="cu-r">En pedidos</div>
            <div className="cu-r">Alta</div>
          </div>

          {items.map((u) => {
            const vs = u.vendorState ? VENDOR_STATES[u.vendorState] : null;
            return (
              <div key={u.id} className="adm-trow cu-row">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/usuarios/${u.id}`} className="adm-cell-title adm-link">
                    {u.name}
                  </Link>
                  {/* El estado real del vendedor, no solo "es vendedor": un solicitante
                      pendiente también hay que verlo. */}
                  {MARKETPLACE_ACTIVO && vs ? (
                    <div style={{ marginTop: 5 }}>
                      <Chip tone={VENDOR_TONE[vs.tone]}>Vendedor · {vs.label.toLowerCase()}</Chip>
                    </div>
                  ) : null}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text-2)' }}>{u.email}</div>
                  {u.phone ? <div className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 3 }}>{u.phone}</div> : null}
                </div>

                <div className="cu-r adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: u.orders > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{u.orders}</div>

                {/* Sustituye a "Ciudad", que estaba vacía en 73 de 75 clientes. */}
                <div className="cu-r adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: u.spent > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>
                  {u.spent > 0 ? money(u.spent) : '—'}
                </div>

                <div className="cu-r" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                  {u.createdAt ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(u.createdAt)) : '—'}
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <EmptyState
              icon="ph-users"
              title={q || segment ? 'Sin resultados' : 'Aún no hay clientes'}
              sub={q || segment ? 'Prueba con otro término o quita el filtro.' : 'Los registros del sitio aparecerán aquí.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
