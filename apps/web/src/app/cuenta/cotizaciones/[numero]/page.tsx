import type { Metadata } from 'next';
import { AutoRefresco } from './AutoRefresco';
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
// Rediseño de 'Tu servicio' (2026-10-15): pasos, mapa y quién lo atiende.
import { SeguimientoServicio } from './SeguimientoServicio';

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

const money = (n: number) => `${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Con zona fija: el servidor (UTC en producción) y el navegador dicen la misma hora.
const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Monterrey' });
const FECHA_HORA = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' });

/** Chip de estado: forma común (`ms-chip`) con el color del estado. */
const chip = (color: string): React.CSSProperties => ({
  color,
  borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
  background: `color-mix(in srgb, ${color} 10%, transparent)`,
});

/**
 * LO QUE SOLICITÓ, EN RENGLONES (2026-10-19). El comentario guardado trae
 * primero las respuestas del formulario como texto —un título y renglones
 * "· Etiqueta: valor" (ver requestAnswersToText)— y después lo que escribió
 * aparte. Pintado tal cual era un bloque corrido de viñetas; así se lee como
 * el documento. Lo que no tenga esa forma se queda como notas.
 */
function partesDelComentario(texto: string): { titulo: string | null; filas: Array<[string, string]>; notas: string } {
  const lineas = texto.split(/\r?\n/);
  const filas: Array<[string, string]> = [];
  const resto: string[] = [];
  let titulo: string | null = null;
  lineas.forEach((l, i) => {
    const m = l.match(/^\s*·\s*(.+?):\s+(.+)$/);
    if (m) {
      filas.push([m[1].trim(), m[2].trim()]);
      return;
    }
    // El título es el renglón que va justo antes de la primera viñeta.
    if (titulo === null && filas.length === 0 && l.trim() && /^\s*·/.test(lineas[i + 1] ?? '')) {
      titulo = l.trim();
      return;
    }
    resto.push(l);
  });
  return { titulo, filas, notas: resto.join('\n').trim() };
}

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
/* Dato de la solicitud: aquí lo largo es el VALOR (una dirección, un correo),
   así que la etiqueta no se encoge y el valor parte renglón. .qd-fila es al
   revés porque está hecha para "concepto … $monto". */
.qd-dato{ display:flex; justify-content:space-between; align-items:baseline; gap:4px 16px; font-size:14.5px; color:var(--color-text-muted); padding:7px 0; }
.qd-dato > :first-child{ flex:none; }
.qd-dato > :last-child{ min-width:0; text-align:right; overflow-wrap:anywhere; color:var(--color-text); }
.qd-sub{ margin:-6px 0 10px; }
.qd-pedido{ display:grid; margin:0; }
.qd-pedido > div{ display:grid; grid-template-columns:minmax(0,2fr) minmax(0,3fr); gap:2px 16px; padding:9px 0; border-bottom:1px solid var(--color-border); font-size:14px; line-height:1.5; }
.qd-pedido > div:last-child{ border-bottom:0; }
.qd-pedido dt{ color:var(--color-text-muted); }
.qd-pedido dd{ margin:0; color:var(--color-text); font-weight:500; overflow-wrap:anywhere; }
.qd-notas{ display:grid; gap:4px; margin-top:10px; padding-top:12px; border-top:1px solid var(--color-border); }
@media (max-width:560px){ .qd-pedido > div{ grid-template-columns:minmax(0,1fr); } }
a.qd-fila:hover > :first-child{ color:var(--color-primary); }
.qd-pasos{ display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; }
.qd-paso{ padding-top:8px; font-size:13px; }
.qd-txt{ margin:0; font-size:14.5px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
.qd-total{ display:flex; justify-content:space-between; align-items:baseline; gap:16px; border-top:1px solid var(--color-border); margin-top:8px; padding-top:14px; }
.qd-svc-bar{ height:4px; background:var(--color-border); border-radius:4px; margin:14px 0 0; overflow:hidden; }
/* Dos columnas en computadora (2026-10-15): a la izquierda lo que se lee (el
   servicio, los equipos, lo que incluye); a la derecha lo que se decide (el
   total, aceptar, el documento) y los datos. En el teléfono, una sola. */
.qd-cols{ display:grid; gap:20px; grid-template-columns:minmax(0,1fr); align-items:start; }
.qd-main, .qd-side{ display:grid; gap:16px; min-width:0; }
@media (min-width:1024px){
  .qd-cols{ grid-template-columns:minmax(0,1fr) 360px; gap:24px; }
}
/* Sin servicio todavía, en el teléfono va primero el precio y el botón de aceptar. */
@media (max-width:1023px){ .qd-cols-precio .qd-side{ order:-1; } }
.qd-side .qd-doc{ width:100%; justify-content:space-between; white-space:normal; text-align:left; }
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
  // Pendiente nunca trae precio (2026-10-23): la del cotizador también se revisa
  // y se le manda con su precio para que la acepte.
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
        <main className="ms-wrap" style={{ maxWidth: 1240 }}>
          <Link href="/cuenta/cotizaciones" className="ms-link ms-link-muted qd-back">
            <Icon name="arrowLeft" size={14} />Mis cotizaciones
          </Link>

          <header className="ms-head" style={{ marginBottom: 20 }}>
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

          {/* Línea de estados de la solicitud: dónde va y qué sigue. */}
          {q.request ? (
            <div className="qd-pasos" aria-label="Avance de la solicitud" style={{ marginBottom: 22 }}>
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

          <div className={`qd-cols${q.service ? '' : ' qd-cols-precio'}`}>
            {/* ── Izquierda: lo que se lee ── */}
            <div className="qd-main">
              {/*
                EN QUÉ VA EL SERVICIO (documento institucional, sección 16).
                Va arriba: una vez aceptada, la única pregunta que el cliente
                vuelve a hacer es "¿y ahora?".
              */}
              {q.service ? <SeguimientoServicio servicio={q.service} rastreo={q.tracking ?? null} direccion={q.address} /> : null}
              {q.tracking?.moving ? <AutoRefresco /> : null}

              {q.items.length > 0 ? (
                <section className="ms-panel">
                  <h2 className="ms-h3 qd-card-t">Equipos</h2>
                  {q.items.map((i) => (
                    <div key={i.productId} className="qd-fila">
                      <span style={{ color: 'var(--color-text)' }}>
                        {i.name} {i.qty > 1 ? `× ${i.qty}` : ''}{i.isRental && i.days > 1 ? ` · ${formatearCantidad(i.days, i.unit ?? 'dia')}` : ''}
                      </span>
                      {/* Un equipo sin precio de catálogo se cotiza aparte (2026-10-15): "$0.00" ahí parecía regalado. */}
                      {i.lineTotal > 0 ? (
                        <span className="ms-num" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{money(i.lineTotal)}</span>
                      ) : q.documentFolio ? (
                        <span className="ms-muted" style={{ fontSize: 13.5 }}>en el documento</span>
                      ) : null}
                    </div>
                  ))}
                </section>
              ) : null}

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

              {q.comments ? (() => {
                const pedido = partesDelComentario(q.comments);
                return (
                  <section className="ms-panel">
                    <h2 className="ms-h3 qd-card-t">Lo que solicitaste</h2>
                    {pedido.titulo ? <p className="ms-hint qd-sub">{pedido.titulo}</p> : null}
                    {pedido.filas.length ? (
                      <dl className="qd-pedido">
                        {pedido.filas.map(([k, v], i) => (
                          <div key={`${k}-${i}`}><dt>{k}</dt><dd>{v}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                    {pedido.notas ? (
                      pedido.filas.length ? (
                        <div className="qd-notas">
                          <span className="ms-hint">Notas</span>
                          <p className="qd-txt" style={{ fontSize: 14 }}>{pedido.notas}</p>
                        </div>
                      ) : (
                        <p className="qd-txt ms-muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{pedido.notas}</p>
                      )
                    ) : null}
                  </section>
                );
              })() : null}
            </div>

            {/* ── Derecha: lo que se decide y los datos ── */}
            <aside className="qd-side">
              {q.total <= 0 ? (
                <section className="ms-panel" aria-label="Importes">
                  <div className="qd-fila"><span>Precio</span><span style={{ color: 'var(--color-text)' }}>En revisión</span></div>
                  <p className="ms-hint" style={{ margin: '6px 0 0' }}>Te lo mandamos por correo y aquí mismo, con vigencia y lo que incluye.</p>
                </section>
              ) : (
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
              )}

              <QuoteAccept quoteNumber={q.quoteNumber} canAccept={q.canAccept} state={q.state} />

              {/* El documento de siempre, o la SOLICITUD sin importes mientras no hay precio (2026-10-15). */}
              {q.documentFolio || q.state === 'pendiente' ? (
                <Link href={`/cuenta/cotizaciones/${q.quoteNumber}/documento`} className="ms-btn ms-btn-sec qd-doc">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="article" size={16} />
                    {q.documentFolio ? `Documento ${q.documentFolio}` : 'Tu solicitud'} · imprimir o PDF
                  </span>
                  <Icon name="arrowRight" size={14} />
                </Link>
              ) : null}

              {/* Los datos de la solicitud, en un solo lugar (2026-10-15). */}
              <section className="ms-panel">
                <h2 className="ms-h3 qd-card-t">Tu solicitud</h2>
                {([
                  ['Fecha', q.createdAt ? FECHA.format(new Date(q.createdAt)) : null],
                  ['Empresa', q.customer.company],
                  ['Contacto', q.customer.name],
                  ['Teléfono', q.customer.phone],
                  ['Correo', q.customer.email],
                  ['Dirección de entrega', q.address],
                  ['Región', q.customer.region],
                ] as Array<[string, string | null]>).filter(([, v]) => v && String(v).trim()).map(([k, v]) => (
                  <div key={k} className="qd-dato"><span>{k}</span><span>{v}</span></div>
                ))}
              </section>

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

              {q.respondedBy || q.acceptedAt ? (
                <p className="ms-hint" style={{ lineHeight: 1.6, margin: 0 }}>
                  {q.respondedBy ? `Precio autorizado por ${q.respondedBy}. ` : ''}
                  {q.acceptedAt ? `Aceptada el ${new Date(q.acceptedAt).toLocaleDateString('es-MX')}.` : ''}
                </p>
              ) : null}
            </aside>
          </div>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
