import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WITHDRAW_STATES, toWithdrawState } from '@maqserv/types';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, IconBtn, PageHeader, Panel, Segmented, Stat, Stats, StatusText, Toolbar } from '@/components/ui';
import { WithdrawActions } from './WithdrawActions';

interface WithdrawRow {
  id: number;
  vendorId: number | null;
  vendor: string | null;
  vendorBalance: number | null;
  amount: number;
  method: string | null;
  reference: string | null;
  status: string;
  note: string | null;
  createdAt: string | null;
}

interface WithdrawsResponse {
  items: WithdrawRow[];
  page: number;
  pages: number;
  total: number;
  counts: Record<string, number>;
  pendingAmount: number;
}

const GRID = 'minmax(0,1.4fr) minmax(0,0.9fr) minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.5fr)';
const DAY = 86_400_000;

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Por pagar' },
  { key: 'completed', label: 'Pagados' },
  { key: 'rejected', label: 'Rechazados' },
];

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ageLabel = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `hace ${d} días`);

/** Marketplace → Retiros: pagarle a los vendedores lo que ya se les descontó del saldo. */
export default async function AdminWithdraws({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'marketplace');
  const sp = await searchParams;
  const state = sp.state ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (state) qs.set('state', state);
  const data = await adminFetch<WithdrawsResponse>(`/admin/withdraws?${qs.toString()}`);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;
  const pendientes = counts.pending ?? 0;

  const now = Date.now();
  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ state, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/retiros?${s}` : '/retiros';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .wd-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
          /* Cinco columnas no caben bajo 1200px: pasan a dos y se oculta la cabecera. */
          @media (max-width: 1200px) {
            .wd-thead { display: none !important; }
            .wd-row { grid-template-columns: minmax(0,1fr) minmax(0,1fr); row-gap: 10px; }
            .wd-row > .wd-c-num { text-align: left !important; }
          }
          @media (max-width: 560px) {
            .wd-row { grid-template-columns: minmax(0,1fr); }
          }
        `}</style>

        <PageHeader
          eyebrow={['Marketplace', 'Retiros']}
          title="Retiros"
          subtitle="Dinero que los vendedores pidieron. Ya se les descontó del saldo al solicitarlo: marcar pagado lo cierra, rechazar se los regresa."
        />

        {/* La pregunta real de esta pantalla: cuánto tengo que pagar. */}
        <Stats>
          <Stat
            label="Por pagar"
            icon="ph-hand-coins"
            tone="warn"
            value={money(data?.pendingAmount ?? 0)}
            hint={`${pendientes} solicitud${pendientes === 1 ? '' : 'es'}`}
          />
        </Stats>

        <Toolbar end={`${data?.total ?? 0} de ${counts.all ?? 0}`}>
          <Segmented
            ariaLabel="Filtrar por estado"
            value={state || 'all'}
            items={TABS.map((t) => ({
              key: t.key || 'all',
              label: t.label,
              count: t.key ? (counts[t.key] ?? 0) : (counts.all ?? 0),
              href: t.key ? `/retiros?state=${t.key}` : '/retiros',
            }))}
          />
        </Toolbar>

        <Panel
          flush
          clip
          footer={pages > 1 ? (
            <>
              <span>
                <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{data?.total ?? 0}</span> retiros{state ? ' en este filtro' : ''}
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
          <div className="adm-thead wd-row wd-thead">
            <div>Vendedor</div>
            <div style={{ textAlign: 'right' }}>Monto</div>
            <div>Cómo pagarle</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {items.map((w) => {
            const ws = toWithdrawState(w.status);
            const info = ws ? WITHDRAW_STATES[ws] : null;
            const ts = w.createdAt ? new Date(w.createdAt).getTime() : null;
            const days = ts ? Math.max(0, Math.floor((now - ts) / DAY)) : 0;
            return (
              <div key={w.id} className="adm-trow wd-row">
                <div style={{ minWidth: 0 }}>
                  {w.vendorId ? (
                    <Link href={`/vendedores/${w.vendorId}`} className="adm-link adm-cell-title" style={{ display: 'block' }}>
                      <span className="adm-ellipsis" style={{ display: 'block' }}>{w.vendor ?? '—'}</span>
                    </Link>
                  ) : (
                    <div className="adm-cell-title adm-ellipsis">{w.vendor ?? '—'}</div>
                  )}
                  <div className="adm-cell-sub">
                    {ts ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts)) : '—'} · {ageLabel(days)}
                  </div>
                </div>

                <div className="wd-c-num" style={{ textAlign: 'right' }}>
                  <div className="adm-num" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--adm-text)' }}>{money(w.amount)}</div>
                  {w.vendorBalance !== null ? (
                    <div className="adm-cell-sub adm-num">saldo: {money(w.vendorBalance)}</div>
                  ) : null}
                </div>

                {/* Sin esto no puedes pagarle: aquí va su CLABE. */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text-2)' }}>{w.method || '—'}</div>
                  <div className="adm-cell-sub">
                    {w.reference ? <span className="adm-mono" style={{ wordBreak: 'break-word' }}>{w.reference}</span> : 'Sin datos de cuenta'}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <StatusText tone={info?.tone ?? 'muted'}>{info?.adminLabel ?? w.status}</StatusText>
                  {w.note ? (
                    <div className="adm-cell-sub" style={{ marginTop: 5, lineHeight: 1.45, maxWidth: 240 }}>{w.note}</div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {ws === 'pending' ? (
                    <WithdrawActions withdrawId={w.id} amount={money(w.amount)} vendor={w.vendor ?? 'el vendedor'} />
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--adm-faint)' }}>Ya procesado</span>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <EmptyState
              icon="ph-hand-coins"
              title={state ? 'Sin retiros en este filtro' : 'No hay retiros'}
              sub={state ? 'Prueba con otra pestaña.' : 'Aquí aparecen cuando un vendedor aprobado pide su dinero desde su panel.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
