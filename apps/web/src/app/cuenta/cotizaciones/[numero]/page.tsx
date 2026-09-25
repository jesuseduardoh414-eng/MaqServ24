import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { QuoteDetail } from '@maqserv/types';
// Decia "3 dias" de un servicio de pipas que en realidad eran 3 viajes.
import { formatearCantidad } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { QuoteAccept } from './QuoteAccept';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const CONTAINER: React.CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '40px clamp(20px, 5vw, 40px) 60px' };

export const metadata: Metadata = { robots: NOINDEX, title: 'Cotización' };

/** Cómo se lee cada estado. El color acompaña al texto, nunca lo sustituye. */
const ESTADO: Record<QuoteDetail['state'], { texto: string; nota: string; color: string }> = {
  pendiente: { texto: 'EN REVISIÓN', nota: 'Estamos preparando tu precio', color: 'var(--color-warning)' },
  vigente: { texto: 'VIGENTE', nota: 'Puedes aceptarla', color: 'var(--color-success)' },
  vencida: { texto: 'VENCIDA', nota: 'El precio ya no se sostiene', color: 'var(--color-error)' },
  aceptada: { texto: 'ACEPTADA', nota: 'Quedamos en coordinar el servicio', color: 'var(--color-success)' },
  rechazada: { texto: 'DESCARTADA', nota: '', color: 'var(--color-text-muted)' },
};

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    ? { texto: q.request.label.toUpperCase(), nota: q.request.message, color: COLOR_SOLICITUD[q.request.state] }
    : ESTADO[q.state];
  /** Los cuatro pasos que ve el cliente: enviada → en revisión → aprobada → completada. */
  const PASOS_SOLICITUD = [
    { k: 'enviada', t: 'Enviada' },
    { k: 'en_revision', t: 'En revisión' },
    { k: 'aprobada', t: 'Aprobada' },
    { k: 'completada', t: 'Completada' },
  ] as const;
  const idxSolicitud = q.request ? PASOS_SOLICITUD.findIndex((p) => p.k === q.request!.state) : -1;

  const bloque: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    padding: '18px 20px',
  };
  const fila: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', gap: 16,
    fontSize: 14.5, color: 'var(--color-text-muted)', padding: '7px 0',
  };

  return (
    <>
      <SiteHeader theme={theme} />
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '60vh' }}>
        <div style={CONTAINER}>
          <Link href="/cuenta/cotizaciones" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowLeft" size={13} />Mis cotizaciones
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '18px 0 6px' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 34, margin: 0, letterSpacing: '-0.02em' }}>
              {q.quoteNumber}
            </h1>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
                color: est.color,
                border: `1px solid color-mix(in srgb, ${est.color} 40%, transparent)`,
                background: `color-mix(in srgb, ${est.color} 12%, transparent)`,
                borderRadius: 'var(--radius-sm)', padding: '5px 11px',
              }}
            >
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: est.color }} />
              {est.texto}
            </span>
          </div>
          {est.nota ? (
            <p style={{ color: 'var(--color-text-muted)', margin: '0 0 8px', fontSize: 14.5 }}>{est.nota}</p>
          ) : null}

          {/* Vigencia: lo primero que el cliente necesita saber para decidir. */}
          {q.validUntil ? (
            <p style={{ margin: '0 0 26px', fontSize: 14, color: q.state === 'vencida' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
              {q.state === 'vencida'
                ? `Este precio venció el ${q.validUntil}.`
                : `Este precio vale hasta el ${q.validUntil}${q.daysToExpire !== null && q.daysToExpire <= 3 ? ` · quedan ${q.daysToExpire} día(s)` : ''}.`}
            </p>
          ) : <div style={{ height: 20 }} />}

          {/* Línea de estados de la solicitud: dónde va y qué sigue. */}
          {q.request ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '0 0 22px' }}>
              {PASOS_SOLICITUD.map((p, i) => {
                const rechazo = q.request!.state === 'rechazada' || q.request!.state === 'cancelada';
                const hecho = !rechazo && i <= idxSolicitud;
                const actual = !rechazo && i === idxSolicitud;
                const color = rechazo && i === 1 ? 'var(--color-error)' : hecho ? 'var(--color-primary)' : 'var(--color-border)';
                return (
                  <div key={p.k} style={{ borderTop: `3px solid ${color}`, paddingTop: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: actual ? 700 : 500, color: hecho || (rechazo && i === 1) ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {rechazo && i === 1 ? q.request!.label : p.t}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Los demás servicios de esta misma cotización: cada aliado aprueba o rechaza el suyo. */}
          {q.siblings?.length ? (
            <div style={{ ...bloque, marginBottom: 20 }}>
              <h2 style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                Otros servicios de esta cotización
              </h2>
              {q.siblings.map((s) => (
                <Link key={s.quoteNumber} href={`/cuenta/cotizaciones/${s.quoteNumber}`} style={{ ...fila, textDecoration: 'none' }}>
                  <span style={{ color: 'var(--color-text)' }}>{s.name} <span style={{ color: 'var(--color-text-muted)' }}>· {s.quoteNumber}</span></span>
                  <span style={{ fontWeight: 700, color: s.request ? COLOR_SOLICITUD[s.request.state] : 'var(--color-text-muted)' }}>{s.request?.label ?? '—'}</span>
                </Link>
              ))}
            </div>
          ) : null}

          {/* El documento de siempre (folio, partidas, condiciones, firma) para imprimir o guardar en PDF. */}
          {q.documentFolio ? (
            <Link
              href={`/cuenta/cotizaciones/${q.quoteNumber}/documento`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '11px 16px', borderRadius: 'var(--radius-button)', border: '1px solid var(--color-text)', color: 'var(--color-text)', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}
            >
              Ver documento {q.documentFolio} · imprimir o guardar PDF
              <Icon name="arrowRight" size={14} />
            </Link>
          ) : null}

          {/*
            EN QUÉ VA EL SERVICIO (documento institucional, sección 16).

            Va arriba de todo a propósito: una vez aceptada, el precio ya se
            decidió y la única pregunta que el cliente vuelve a hacer es "¿y
            ahora?". Antes eso solo se contestaba por teléfono.
          */}
          {q.service ? <SeguimientoServicio servicio={q.service} /> : null}

          {q.items.length > 0 ? (
            <div style={{ ...bloque, marginBottom: 16 }}>
              <h2 style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
                Equipos
              </h2>
              {q.items.map((i) => (
                <div key={i.productId} style={fila}>
                  <span style={{ color: 'var(--color-text)' }}>
                    {i.name} {i.qty > 1 ? `× ${i.qty}` : ''}{i.isRental && i.days > 1 ? ` · ${formatearCantidad(i.days, i.unit ?? 'dia')}` : ''}
                  </span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{money(i.lineTotal)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ ...bloque, marginBottom: 16 }}>
            <div style={fila}><span>Subtotal</span><span style={{ color: 'var(--color-text)' }}>{money(q.subtotal)}</span></div>
            {q.freightCost > 0 ? (
              <div style={fila}>
                <span>Traslado{q.freightDistance ? ` · ${q.freightDistance} km` : ''}</span>
                <span style={{ color: 'var(--color-text)' }}>{money(q.freightCost)}</span>
              </div>
            ) : null}
            {q.tax > 0 ? <div style={fila}><span>Impuesto</span><span style={{ color: 'var(--color-text)' }}>{money(q.tax)}</span></div> : null}
            <div style={{ ...fila, borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 14 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 800, fontSize: 22 }}>{money(q.total)}</span>
            </div>
          </div>

          {/* Qué incluye y qué no. Lo segundo es lo que evita la discusión
              cuando llega la factura, así que se muestra con el mismo peso. */}
          {q.included || q.excluded ? (
            <div style={{ display: 'grid', gridTemplateColumns: q.included && q.excluded ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 16 }}>
              {q.included ? (
                <div style={bloque}>
                  <h2 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-success)', margin: '0 0 10px' }}>
                    Incluye
                  </h2>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{q.included}</p>
                </div>
              ) : null}
              {q.excluded ? (
                <div style={bloque}>
                  <h2 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-warning)', margin: '0 0 10px' }}>
                    No incluye
                  </h2>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{q.excluded}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {q.conditions ? (
            <div style={{ ...bloque, marginBottom: 16 }}>
              <h2 style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                Condiciones
              </h2>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{q.conditions}</p>
            </div>
          ) : null}

          {q.comments ? (
            <div style={{ ...bloque, marginBottom: 16 }}>
              <h2 style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                Lo que solicitaste
              </h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>{q.comments}</p>
            </div>
          ) : null}

          <QuoteAccept quoteNumber={q.quoteNumber} canAccept={q.canAccept} state={q.state} />

          {q.respondedBy || q.acceptedAt ? (
            <p style={{ marginTop: 18, fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              {q.respondedBy ? `Precio autorizado por ${q.respondedBy}. ` : ''}
              {q.acceptedAt ? `Aceptada el ${new Date(q.acceptedAt).toLocaleDateString('es-MX')}.` : ''}
            </p>
          ) : null}
        </div>
      </main>
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
      style={{
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 5%, transparent)`,
        borderRadius: 16, padding: '18px 20px', marginBottom: 22,
      }}
    >
      <div style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 9 }}>
        Tu servicio
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>{servicio.label}</div>
      <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {servicio.message}
      </p>

      {/* La barra no reemplaza al texto: el color por sí solo no comunica. */}
      {!cancelado ? (
        <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 4, margin: '14px 0 0', overflow: 'hidden' }}>
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
            <li key={`${h.label}-${i}`} style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              <span style={{ color, marginRight: 8 }}>·</span>
              {h.label}
              {h.at ? <span style={{ opacity: 0.7 }}> — {new Date(h.at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
