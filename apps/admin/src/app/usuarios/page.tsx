import Link from '@/components/Enlace';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, PageHeader, Panel, Segmented, Stat, Stats, Toolbar } from '@/components/ui';
import { CustomersSearch } from './CustomersSearch';

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  /** Las empresas para las que pide (2026-10-23): una cuenta puede tener varias. */
  empresas: Array<{ id: number; name: string }>;
  sites: number;
  quotes: number;
  lastQuoteAt: string | null;
  createdAt: string | null;
}

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
}

const GRID = 'minmax(0,1.5fr) minmax(0,1.6fr) minmax(0,1.9fr) 70px minmax(0,1fr) minmax(0,0.9fr)';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todas' },
  { key: 'piden', label: 'Han pedido' },
];

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—';

/**
 * Cuentas del sitio: quién entra y para quién pide. Solo lectura: el cliente
 * edita su perfil en /cuenta.
 *
 * CUENTA → EMPRESAS → OBRAS (2026-10-23): cada cuenta dice sus empresas y
 * cuántas obras y solicitudes tiene. Antes enseñaba "pedidos" y "gastado" del
 * carrito que se retiró el 2026-10-08, siempre en cero.
 */
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
          subtitle="Quién entra al sitio y para qué empresas pide. Cada cuenta puede tener varias empresas, y cada empresa sus obras (en Clientes y obras)."
        />

        <Stats>
          <Stat label="Registradas" icon="ph-users" value={counts.all ?? 0} />
          <Stat
            label="Han pedido"
            icon="ph-file-text"
            tone="ok"
            value={counts.piden ?? 0}
            hint={`de ${counts.all ?? 0}`}
          />
        </Stats>

        <Toolbar end={`${data?.total ?? 0} de ${counts.all ?? 0}`}>
          <Segmented
            ariaLabel="Filtrar cuentas"
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
                <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{data?.total ?? 0}</span> cuentas{segment ? ' en este filtro' : ''}{q ? ` para “${q}”` : ''}
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
            <div>Cuenta</div>
            <div>Contacto</div>
            <div>Empresas</div>
            <div className="cu-r">Obras</div>
            <div className="cu-r">Solicitudes</div>
            <div className="cu-r">Alta</div>
          </div>

          {items.map((u) => {
            return (
              <div key={u.id} className="adm-trow cu-row">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/usuarios/${u.id}`} className="adm-cell-title adm-link">
                    {u.name}
                  </Link>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="adm-ellipsis" style={{ fontSize: 13, color: 'var(--adm-text-2)' }}>{u.email}</div>
                  {u.phone ? <div className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 3 }}>{u.phone}</div> : null}
                </div>

                {/* Cada empresa abre su ficha en Clientes y obras. */}
                <div style={{ minWidth: 0, fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                  {u.empresas.length === 0 ? (
                    <span style={{ color: 'var(--adm-faint)' }}>Sin empresa</span>
                  ) : u.empresas.slice(0, 3).map((e) => (
                    <Link key={e.id} href={`/clientes?ver=${e.id}`} className="adm-link adm-ellipsis" style={{ maxWidth: '100%' }}>{e.name}</Link>
                  ))}
                  {u.empresas.length > 3 ? <span style={{ color: 'var(--adm-muted)' }}>+{u.empresas.length - 3} más</span> : null}
                </div>

                <div className="cu-r adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: u.sites > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{u.sites}</div>

                <div className="cu-r" style={{ minWidth: 0 }}>
                  <div className="adm-num" style={{ fontSize: 13.5, fontWeight: 600, color: u.quotes > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{u.quotes}</div>
                  {u.lastQuoteAt ? <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 2 }}>última {fecha(u.lastQuoteAt)}</div> : null}
                </div>

                <div className="cu-r" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                  {fecha(u.createdAt)}
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <EmptyState
              icon="ph-users"
              title={q || segment ? 'Sin resultados' : 'Aún no hay cuentas'}
              sub={q || segment ? 'Prueba con otro término o quita el filtro.' : 'Los registros del sitio aparecerán aquí.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
