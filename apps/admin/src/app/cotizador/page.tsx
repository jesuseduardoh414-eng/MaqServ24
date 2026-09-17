import Link from 'next/link';
import { redirect } from 'next/navigation';
import { COTIZADORES_META, COTIZADOR_TIPOS } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D } from '@/components/design-tokens';
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
 * cuál abre sin preguntarle a nadie — y de paso ve si hay solicitudes del sitio
 * esperando.
 */
export default async function CotizadorHome() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const [pendientes, ultimas] = await Promise.all([
    adminFetch<Resumen>('/admin/quoter/quotes?state=solicitada'),
    adminFetch<Resumen>('/admin/quoter/quotes'),
  ]);
  const porAtender = pendientes?.total ?? 0;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '4px 0 40px' }}>
        <h1 style={{ margin: 0, fontSize: 29, letterSpacing: '-0.03em', color: D.text }}>Cotizador</h1>
        <p style={{ margin: '8px 0 26px', fontSize: 14, color: D.muted2, maxWidth: '68ch' }}>
          Arma una cotización paso a paso con el tabulador vigente. Al guardarla se congela: el documento
          seguirá diciendo lo mismo aunque después cambien las tarifas.
        </p>

        {porAtender > 0 ? (
          <Link
            href="/cotizador/historial?state=solicitada"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 18px',
              borderRadius: 14, textDecoration: 'none', color: D.text,
              background: D.accentSoft, border: `1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)`,
            }}
          >
            <i className="ph ph-bell-ringing" style={{ fontSize: 21, color: D.accent }} />
            <span style={{ flex: 1, fontSize: 14 }}>
              <b>{porAtender}</b> {porAtender === 1 ? 'solicitud llegó' : 'solicitudes llegaron'} desde el sitio y
              {porAtender === 1 ? ' sigue' : ' siguen'} sin atender.
            </span>
            <i className="ph ph-arrow-right" style={{ color: D.accent }} />
          </Link>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
          {COTIZADOR_TIPOS.map((tipo) => {
            const meta = COTIZADORES_META[tipo];
            return (
              <Link
                key={tipo}
                href={`/cotizador/${tipo}`}
                style={{
                  display: 'block', padding: 24, borderRadius: 18, textDecoration: 'none',
                  background: D.card, border: `1px solid ${D.cardBorder}`, color: D.text,
                }}
              >
                <span style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 14, background: D.accentSoft, color: D.accent, marginBottom: 14 }}>
                  <IconoCotizador nombre={meta.icono} size={30} />
                </span>
                <h2 style={{ margin: '0 0 7px', fontSize: 19, letterSpacing: '-0.02em' }}>{meta.titulo}</h2>
                <p style={{ margin: 0, fontSize: 13.5, color: D.muted2, lineHeight: 1.6 }}>{meta.resumen}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 13.5, fontWeight: 700, color: D.accent }}>
                  Cotizar <i className="ph ph-arrow-right" />
                </span>
              </Link>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
          <Link href="/cotizador/historial" style={atajo}>
            <i className="ph ph-clock-counter-clockwise" style={{ fontSize: 19, color: D.accent }} />
            <span>
              <b style={{ display: 'block', fontSize: 14 }}>Historial</b>
              <span style={{ fontSize: 12.5, color: D.muted2 }}>
                {ultimas?.total ?? 0} {(ultimas?.total ?? 0) === 1 ? 'cotización emitida' : 'cotizaciones emitidas'}
              </span>
            </span>
          </Link>
          <Link href="/cotizador/tarifas" style={atajo}>
            <i className="ph ph-sliders-horizontal" style={{ fontSize: 19, color: D.accent }} />
            <span>
              <b style={{ display: 'block', fontSize: 14 }}>Tarifas y condiciones</b>
              <span style={{ fontSize: 12.5, color: D.muted2 }}>Tabulador, fletes, zonas y textos del documento</span>
            </span>
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}

const atajo = {
  display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', borderRadius: 14,
  background: D.card, border: `1px solid ${D.cardBorder}`, color: D.text, textDecoration: 'none',
} as const;
