import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { QuoteDetail } from '@maqserv/types';
// Decia "3 dias" de un servicio de pipas que en realidad eran 3 viajes.
import { formatearCantidad } from '@maqserv/config';
import { getTheme } from '@/lib/theme';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { QuoteAccept } from './QuoteAccept';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = { robots: NOINDEX, title: 'Cotización' };

/** Cómo se lee cada estado. El color acompaña al texto, nunca lo sustituye. */
const ESTADO: Record<QuoteDetail['state'], { texto: string; nota: string; color: string }> = {
  pendiente: { texto: 'En revisión', nota: 'Estamos preparando tu precio', color: 'var(--color-warning)' },
  vigente: { texto: 'Vigente', nota: 'Puedes aceptarla', color: 'var(--color-success)' },
  vencida: { texto: 'Vencida', nota: 'El precio ya no se sostiene', color: 'var(--color-error)' },
  aceptada: { texto: 'Aceptada', nota: 'Quedamos en coordinar el servicio', color: 'var(--color-success)' },
  rechazada: { texto: 'Descartada', nota: '', color: 'var(--color-text-muted)' },
};

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Chip de estado: forma común (`ms-chip`) con el color del estado. */
const chip = (color: string): React.CSSProperties => ({
  color,
  borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
  background: `color-mix(in srgb, ${color} 10%, transparent)`,
});

/** Estilos propios del detalle de cotización (prefijo `qd-`). */
const CSS = `
.qd-back{ margin-bottom:18px; }
.qd-title-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.qd-stack{ display:grid; gap:16px; }
.qd-card-t{ margin:0 0 12px; }
.qd-fila{ display:flex; justify-content:space-between; gap:16px; font-size:14.5px; color:var(--color-text-muted); padding:7px 0; }
.qd-fila > :first-child{ min-width:0; overflow-wrap:anywhere; }
.qd-fila > :last-child{ flex-shrink:0; text-align:right; }
a.qd-fila{ text-decoration:none; }
a.qd-fila:hover > :first-child{ color:var(--color-primary); }
.qd-pasos{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; }
.qd-paso{ padding-top:8px; font-size:13px; }
.qd-txt{ margin:0; font-size:14.5px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
.qd-total{ display:flex; justify-content:space-between; align-items:baseline; gap:16px; border-top:1px solid var(--color-border); margin-top:8px; padding-top:14px; }
.qd-svc-bar{ height:4px; background:var(--color-border); border-radius:4px; margin:14px 0 0; overflow:hidden; }
`;

/**
 * Detalle de una cotización (documento institucional, sección 22).
 *
 * Antes el cliente solo tenía una lista con el total: no podía ver hasta cuándo
 * vale el precio, qué incluye, qué no, ni aceptarla. Todo eso quedaba en una
 * llamada, que es exactamente lo que la plataforma existe para evitar.
 */
export default async function CotizacionDetalle({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/quotes/${encodeURIComponent(numero)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (res.status === 401) redirect('/login');
  if (!res.ok) notFound();
  const q = (await res.json()) as QuoteDetail;
  /**
   * "ACEPTADA" confundía (2026-09-25): el cliente leía que el aliado ya había
   * aceptado, cuando lo que pasó es que él aceptó el precio al solicitar. Con
   * servicio abierto, el estado que se enseña es el del servicio.
   */
  const COLOR_SOLICITUD = {
    enviada: 'var(--color-warning)', en_revision: 'var(--color-warning)', aprobada: 'var(--color-success)',
    rechazada: 'var(--color-error)', cancelada: 'var(--color-error)', completada: 'var(--color-success)',
  } as const;
  const est = q.request
    ? { texto: q.request.label, nota: q.request.message, color: COLOR_SOLICITUD[q.request.state] }
    : ESTADO[q.state];
  /** Los cuatro pasos que ve el cliente: enviada → en revisión → aprobada → completada. */
  const PASOS_SOLICITUD = [
    { k: 'enviada', t: 'Enviada' },
    { k: 'en_revision', t: 'En revisión' },
    { k: 'aprobada', t: 'Aprobada' },
    { k: 'completada', t: 'Completada' },
  ] as const;
  const idxSolicitud = q.request ? PASOS_SOLICITUD.findIndex((p) => p.k === q.request!.state) : -1;

  return (
    <>
      <SiteHeader theme={theme} />
      <style>{CSS}</style>
      <div className="ms-page" style={{ minHeight: '60vh' }}>
        <main className="ms-wrap-narrow">
          <Link href="/cuenta/cotizaciones" className="ms-link ms-link-muted qd-back">
            <Icon name="arrowLeft" size={14} />Mis cotizaciones
          </Link>

          <header className="ms-head" style={{ marginBottom: 24 }}>
            <div className="ms-head-txt">
              <div className="qd-title-row">
                <h1 className="ms-title ms-num">{q.quoteNumber}</h1>
                <span className="ms-chip ms-chip-dot" style={chip(est.color)}>{est.texto}</span>
              </div>
              {est.nota ? <p className="ms-desc">{est.nota}</p> : null}
              {/* Vigencia: lo primero que el cliente necesita saber para decidir. */}
              {q.validUntil ? (
                <p className="ms-desc" style={{ marginTop: 4, color: q.state === 'vencida' ? 'var(--color-error)' : undefined }}>
                  {q.state === 'vencida'
                    ? `Este precio venció el ${q.validUntil}.`
                    : `Este precio vale hasta el ${q.validUntil}${q.daysToExpire !== null && q.daysToExpire <= 3 ? ` · quedan ${q.daysToExpire} día(s)` : ''}.`}
                </p>
              ) : null}
            </div>
          </header>

          <div className="qd-stack">
            {/* Línea de estados de la solicitud: dónde va y qué sigue. */}
            {q.request ? (
              <div className="qd-pasos" aria-label="Avance de la solicitud">
                {PASOS_SOLICITUD.map((p, i) => {
                  const rechazo = q.request!.state === 'rechazada' || q.request!.state === 'cancelada';
                  const hecho = !rechazo && i <= idxSolicitud;
                  const actual = !rechazo && i === idxSolicitud;
                  const color = rechazo && i === 1 ? 'var(--color-error)' : hecho ? 'var(--color-primary)' : 'var(--color-border)';
                  return (
                    <div key={p.k} className="qd-paso" style={{ borderTop: `3px solid ${color}` }} aria-current={actual ? 'step' : undefined}>
                      <span style={{ fontWeight: actual ? 600 : 500, color: hecho || (rechazo && i === 1) ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {rechazo && i === 1 ? q.request!.label : p.t}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* El documento de siempre (folio, partidas, condiciones, firma) para imprimir o guardar en PDF. */}
            {q.documentFolio ? (
              <div>
                <Link href={`/cuenta/cotizaciones/${q.quoteNumber}/documento`} className="ms-btn ms-btn-sec" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                  <Icon name="article" size={16} />
                  Ver documento {q.documentFolio} · imprimir o guardar PDF
                  <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            ) : null}

            {/* Los demás servicios de esta misma cotización: cada aliado aprueba o rechaza el suyo. */}
            {q.siblings?.length ? (
              <section className="ms-panel">
                <h2 className="ms-h3 qd-card-t">Otros servicios de esta cotización</h2>
                {q.siblings.map((s) => (
                  <Link key={s.quoteNumber} href={`/cuenta/cotizaciones/${s.quoteNumber}`} className="qd-fila">
                    <span style={{ color: 'var(--color-text)' }}>{s.name} <span className="ms-muted">· {s.quoteNumber}</span></span>
                    <span style={{ fontWeight: 600, color: s.request ? COLOR_SOLICITUD[s.request.state] : 'var(--color-text-muted)' }}>{s.request?.label ?? '—'}</span>
                  </Link>
                ))}
              </section>
            ) : null}

            {/*
              EN QUÉ VA EL SERVICIO (documento institucional, sección 16).

              Va arriba de todo a propósito: una vez aceptada, el precio ya se
              decidió y la única pregunta que el cliente vuelve a hacer es "¿y
              ahora?". Antes eso solo se contestaba por teléfono.
            */}
            {q.service ? <SeguimientoServicio servicio={q.service} /> : null}

            {q.items.length > 0 ? (
              <section className="ms-panel">
                <h2 className="ms-h3 qd-card-t">Equipos</h2>
                {q.items.map((i) => (
                  <div key={i.productId} className="qd-fila">
                    <span style={{ color: 'var(--color-text)' }}>
                      {i.name} {i.qty > 1 ? `× ${i.qty}` : ''}{i.isRental && i.days > 1 ? ` · ${formatearCantidad(i.days, i.unit ?? 'dia')}` : ''}
                    </span>
                    <span className="ms-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{money(i.lineTotal)}</span>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="ms-panel" aria-label="Importes">
              <div className="qd-fila"><span>Subtotal</span><span className="ms-num" style={{ color: 'var(--color-text)' }}>{money(q.subtotal)}</span></div>
              {q.freightCost > 0 ? (
                <div className="qd-fila">
                  <span>Traslado{q.freightDistance ? ` · ${q.freightDistance} km` : ''}</span>
                  <span className="ms-num" style={{ color: 'var(--color-text)' }}>{money(q.freightCost)}</span>
                </div>
              ) : null}
              {q.tax > 0 ? <div className="qd-fila"><span>Impuesto</span><span className="ms-num" style={{ color: 'var(--color-text)' }}>{money(q.tax)}</span></div> : null}
              <div className="qd-total">
                <span style={{ fontWeight: 600, fontSize: 16 }}>Total</span>
                <span className="ms-stat-n" style={{ fontSize: 26 }}>{money(q.total)}</span>
              </div>
            </section>

            {/* Qué incluye y qué no. Lo segundo es lo que evita la discusión
                cuando llega la factura, así que se muestra con el mismo peso. */}
            {q.included || q.excluded ? (
              <div className={q.included && q.excluded ? 'ms-grid2' : undefined} style={{ display: 'grid', gap: 16 }}>
                {q.included ? (
                  <section className="ms-panel">
                    <h2 className="ms-h3 qd-card-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--color-success)', display: 'flex' }}><Icon name="check" size={16} /></span>Incluye
                    </h2>
                    <p className="qd-txt">{q.included}</p>
                  </section>
                ) : null}
                {q.excluded ? (
                  <section className="ms-panel">
                    <h2 className="ms-h3 qd-card-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--color-warning)', display: 'flex' }}><Icon name="x" size={16} /></span>No incluye
                    </h2>
                    <p className="qd-txt">{q.excluded}</p>
                  </section>
                ) : null}
              </div>
            ) : null}

            {q.conditions ? (
              <section className="ms-panel">
                <h2 className="ms-h3 qd-card-t">Condiciones</h2>
                <p className="qd-txt">{q.conditions}</p>
              </section>
            ) : null}

            {q.comments ? (
              <section className="ms-panel">
                <h2 className="ms-h3 qd-card-t">Lo que solicitaste</h2>
                <p className="qd-txt ms-muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{q.comments}</p>
              </section>
            ) : null}

            <QuoteAccept quoteNumber={q.quoteNumber} canAccept={q.canAccept} state={q.state} />

            {q.respondedBy || q.acceptedAt ? (
              <p className="ms-hint" style={{ lineHeight: 1.6 }}>
                {q.respondedBy ? `Precio autorizado por ${q.respondedBy}. ` : ''}
                {q.acceptedAt ? `Aceptada el ${new Date(q.acceptedAt).toLocaleDateString('es-MX')}.` : ''}
              </p>
            ) : null}
          </div>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}

/**
 * Seguimiento del servicio, contado para el cliente.
 *
 * Deliberadamente NO muestra a quién más se le ofreció ni quién dijo que no:
 * eso es información de operaciones. Al cliente le importa quién lo va a
 * atender y en qué va.
 */
function SeguimientoServicio({ servicio }: { servicio: NonNullable<QuoteDetail['service']> }) {
  const cancelado = servicio.state === 'cancelado';
  const color = cancelado ? 'var(--color-error)' : 'var(--color-primary)';

  return (
    <section
      aria-label="Seguimiento del servicio"
      className={`ms-panel ${cancelado ? 'ms-alert-bad' : 'ms-alert-info'}`}
    >
      <p className="ms-small ms-muted" style={{ margin: '0 0 6px' }}>Tu servicio</p>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{servicio.label}</div>
      <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {servicio.message}
      </p>

      {/* La barra no reemplaza al texto: el color por sí solo no comunica. */}
      {!cancelado ? (
        <div className="qd-svc-bar">
          <div style={{ height: '100%', width: `${Math.round(servicio.progress * 100)}%`, background: color, borderRadius: 4 }} />
        </div>
      ) : null}

      {servicio.providers.length > 0 ? (
        <p style={{ margin: '13px 0 0', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          Te atiende <strong style={{ color: 'var(--color-text)' }}>{servicio.providers.join(' y ')}</strong>.
        </p>
      ) : null}

      {servicio.closed ? (
        <p style={{ margin: '9px 0 0', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
          Se registraron <strong style={{ color: 'var(--color-text)' }}>{servicio.closed}</strong>
          {servicio.closedAt ? ` el ${new Date(servicio.closedAt).toLocaleDateString('es-MX')}` : ''}.
        </p>
      ) : null}

      {servicio.history.length > 1 ? (
        <ol style={{ margin: '15px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
          {servicio.history.map((h, i) => (
            <li key={`${h.label}-${i}`} style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, transform: 'translateY(-1px)' }} />
              <span>
                {h.label}
                {h.at ? <span style={{ opacity: 0.75 }}> — {new Date(h.at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
