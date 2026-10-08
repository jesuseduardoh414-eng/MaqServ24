import Link from 'next/link';
import { redirect } from 'next/navigation';
import { COTIZADORES_META, COTIZADORES_ACTIVOS } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { PageHeader, Panel, btnClass } from '@/components/ui';
import { IconoCotizador } from '@maqserv/ui';

export const metadata = { title: 'Cotizador' };

interface Resumen {
  items: Array<{ id: number; tipo: string; folio: string; estado: string; cliente: string; total: number }>;
  total: number;
}

/**
 * Portada del cotizador interno: la bifurcación entre los dos.
 *
 * Existe aunque el menú ya lleve directo a cada uno, porque el menú no puede
 * explicar la diferencia. Quien entra por primera vez tiene que poder decidir
 * cuál abre sin preguntarle a nadie.
 *
 * Kit del panel (2026-10-08): los dos cotizadores y los dos atajos son filas
 * de una lista, no cuatro tarjetas. Cada fila es entera un enlace.
 */
export default async function CotizadorHome() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  // Sin el aviso de "solicitudes sin atender" (2026-10-08): eran los mismos
  // pedidos que ya están en Solicitudes, contados dos veces.
  const ultimas = await adminFetch<Resumen>('/admin/quoter/quotes');
  const emitidas = ultimas?.total ?? 0;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <PageHeader
        eyebrow={['2 · Cotizar', 'Cotización']}
        title="Cotizador"
        subtitle="Arma una cotización paso a paso con el tabulador vigente. Al guardarla se congela: el documento seguirá diciendo lo mismo aunque después cambien las tarifas."
      />

      <Panel flush clip>
        {COTIZADORES_ACTIVOS.map((tipo) => {
          const meta = COTIZADORES_META[tipo];
          return (
            <Link key={tipo} href={`/cotizador/${tipo}`} className="adm-trow" style={fila}>
              <span style={icono}>
                <IconoCotizador nombre={meta.icono} size={24} />
              </span>
              <span style={{ minWidth: 0, flex: '1 1 260px' }}>
                <span className="adm-cell-title" style={{ display: 'block', fontSize: 15 }}>{meta.titulo}</span>
                <span className="adm-cell-sub" style={{ display: 'block', fontSize: 13, lineHeight: 1.55, maxWidth: '78ch' }}>{meta.resumen}</span>
              </span>
              <span className={btnClass('secondary', 'sm')}>
                Cotizar <i className="ph ph-arrow-right" aria-hidden />
              </span>
            </Link>
          );
        })}
      </Panel>

      <Panel flush clip>
        <Link href="/cotizador/historial" className="adm-trow" style={fila}>
          <i className="ph ph-clock-counter-clockwise" aria-hidden style={atajoIco} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="adm-cell-title" style={{ display: 'block' }}>Historial</span>
            <span className="adm-cell-sub" style={{ display: 'block' }}>
              <span className="adm-num">{emitidas}</span> {emitidas === 1 ? 'cotización emitida' : 'cotizaciones emitidas'}
            </span>
          </span>
          <i className="ph ph-caret-right" aria-hidden style={{ color: 'var(--adm-faint)' }} />
        </Link>
        <Link href="/cotizador/tarifas" className="adm-trow" style={fila}>
          <i className="ph ph-sliders-horizontal" aria-hidden style={atajoIco} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="adm-cell-title" style={{ display: 'block' }}>Tarifas y condiciones</span>
            <span className="adm-cell-sub" style={{ display: 'block' }}>Tabulador, fletes, zonas y textos del documento</span>
          </span>
          <i className="ph ph-caret-right" aria-hidden style={{ color: 'var(--adm-faint)' }} />
        </Link>
      </Panel>
    </AdminShell>
  );
}

const fila = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 16px', paddingTop: 16, paddingBottom: 16 } as const;
const icono = {
  display: 'grid', placeItems: 'center', width: 44, height: 44, flexShrink: 0, borderRadius: 8,
  background: 'color-mix(in srgb, var(--adm-accent) 12%, transparent)', color: 'var(--adm-accent)',
} as const;
const atajoIco = { width: 44, textAlign: 'center', fontSize: 19, color: 'var(--adm-muted)', flexShrink: 0 } as const;
