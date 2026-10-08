import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VENDOR_STATES } from '@maqserv/types';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
// Kit y estados en módulos SIN 'use client': esta página es de servidor y no
// puede llamar funciones que exporte un módulo de cliente.
import { EmptyState, PageHeader, Panel, Segmented, Stat, Stats, StatusText, Toolbar } from '@/components/ui';
import { vendorStatus } from './vendor-status';
import { VendorActions } from './VendorActions';

interface VendorRow {
  id: number;
  name: string;
  email: string;
  shopName: string | null;
  status: number;
  balance: number;
  createdAt: string | null;
  products: number;
  sales: number;
  sold: number;
  pendingWithdraws: number;
}

interface VendorsResponse {
  items: VendorRow[];
  counts: Record<string, number>;
}

const GRID = 'minmax(0,1.7fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 130px minmax(0,1.5fr)';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Por aprobar' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'revocado', label: 'Revocados' },
];

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;

/** Marketplace → Vendedores: la puerta de entrada al marketplace. */
export default async function AdminVendors({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'marketplace');
  const sp = await searchParams;
  const state = sp.state ?? '';

  const data = await adminFetch<VendorsResponse>(`/admin/vendors${state ? `?state=${state}` : ''}`);
  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .vn-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
          /* Seis columnas no caben bajo 1200px: pasan a dos y se oculta la cabecera. */
          @media (max-width: 1200px) {
            .vn-thead { display: none !important; }
            .vn-row { grid-template-columns: minmax(0,1fr) minmax(0,1fr); row-gap: 10px; }
            .vn-row > .vn-c-num { text-align: left !important; }
          }
          @media (max-width: 560px) {
            .vn-row { grid-template-columns: minmax(0,1fr); }
            .vn-row > .vn-c-actions { justify-content: flex-start !important; }
          }
        `}</style>

        <PageHeader
          eyebrow={['Marketplace', 'Vendedores']}
          title="Vendedores"
          subtitle="Quién puede publicar equipo en el catálogo. Abre una solicitud para leerla antes de aprobar."
        />

        <Stats>
          <Stat label="Por aprobar" icon="ph-hourglass-medium" tone="warn" value={counts.pendiente ?? 0} />
          <Stat label="Vendiendo" icon="ph-storefront" tone="ok" value={counts.aprobado ?? 0} />
        </Stats>

        <Toolbar end={`${items.length} de ${counts.all ?? 0}`}>
          <Segmented
            ariaLabel="Filtrar por estado"
            value={state || 'all'}
            items={TABS.map((t) => ({
              key: t.key || 'all',
              label: t.label,
              count: t.key ? (counts[t.key] ?? 0) : (counts.all ?? 0),
              href: t.key ? `/vendedores?state=${t.key}` : '/vendedores',
            }))}
          />
        </Toolbar>

        <Panel flush clip>
          <div className="adm-thead vn-row vn-thead">
            <div>Tienda</div>
            <div>Titular</div>
            <div style={{ textAlign: 'right' }}>Saldo</div>
            <div>Actividad</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {items.map((v) => {
            const st = vendorStatus(v.status);
            return (
              <div key={v.id} className="adm-trow vn-row">
                <div style={{ minWidth: 0 }}>
                  <Link href={`/vendedores/${v.id}`} className="adm-link adm-cell-title" style={{ display: 'block' }}>
                    <span className="adm-ellipsis" style={{ display: 'block' }}>{v.shopName ?? '—'}</span>
                  </Link>
                  <div className="adm-cell-sub adm-num">
                    {v.products} {v.products === 1 ? 'producto' : 'productos'} publicados
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="adm-ellipsis" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text)' }}>{v.name}</div>
                  <div className="adm-cell-sub adm-ellipsis">{v.email}</div>
                </div>

                <div className="vn-c-num" style={{ textAlign: 'right' }}>
                  <div className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: v.balance > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{money(v.balance)}</div>
                  {/* Un retiro pendiente es dinero que el vendedor ya pidió: no debe pasar inadvertido. */}
                  {v.pendingWithdraws > 0 ? (
                    <Link href="/retiros" className="adm-num" style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, color: 'var(--adm-warn)', marginTop: 3, textDecoration: 'none' }}>
                      {v.pendingWithdraws} retiro{v.pendingWithdraws === 1 ? '' : 's'} por pagar →
                    </Link>
                  ) : null}
                </div>

                <div>
                  <div className="adm-num" style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{v.sales} {v.sales === 1 ? 'venta' : 'ventas'}</div>
                  <div className="adm-cell-sub adm-num">{money(v.sold)}</div>
                </div>

                <div>
                  <StatusText tone={VENDOR_STATES[st.state].tone}>{st.label}</StatusText>
                </div>

                <div className="vn-c-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <VendorActions vendorId={v.id} status={v.status} />
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <EmptyState
              icon="ph-storefront"
              title={state ? 'Sin vendedores en este filtro' : 'Todavía no hay vendedores'}
              sub={state
                ? 'Prueba con otra pestaña.'
                : 'El marketplace está listo pero nadie ha solicitado vender. Las solicitudes llegan cuando un cliente se registra como vendedor desde el sitio.'}
            />
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
