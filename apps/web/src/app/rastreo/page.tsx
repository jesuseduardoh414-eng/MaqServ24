import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import type { TrackingResult } from '@maqserv/types';
import { SHIP_METHODS, fulfillmentFlow, fulfillmentStep, shipTracker, toShipMethod } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { paymentStatusLabel, toneColors } from '@/lib/order-status';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'track.title')} — ${t(theme, 'site.name')}` };
}

type Search = { orden?: string; email?: string };

const dt = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const day = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));

/** Chip de estado con la forma común (`ms-chip`) y el color de siempre del estado. */
function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const c = toneColors(tone);
  return (
    <span className="ms-chip ms-chip-dot" style={{ background: c.bg, borderColor: c.border, color: c.fg }}>{text}</span>
  );
}

/** Estilos propios del rastreo (prefijo `rs-`). */
const CSS = `
.rs-form{ display:grid; gap:18px; }
.rs-card{ margin-top:36px; padding:0; overflow:hidden; }
.rs-sec{ padding:22px 24px; border-bottom:1px solid var(--color-border); }
.rs-sec:last-child{ border-bottom:none; }
.rs-top{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
.rs-num{ margin:2px 0 0; font-family:var(--font-display); font-size:22px; font-weight:700; letter-spacing:-.02em; overflow-wrap:anywhere; }
.rs-facts{ display:flex; gap:14px 28px; flex-wrap:wrap; margin-top:16px; }
.rs-fact-v{ display:block; margin-top:3px; font-size:15px; font-weight:600; color:var(--color-text); }
.rs-flow{ display:flex; align-items:flex-start; margin-top:24px; overflow-x:auto; padding-bottom:4px; }
.rs-flow-step{ display:flex; align-items:flex-start; flex:1; min-width:76px; }
.rs-flow-col{ display:flex; flex-direction:column; align-items:center; flex:1; }
.rs-flow-l{ font-size:12px; text-align:center; line-height:1.35; margin-top:8px; }
.rs-tl{ display:grid; }
.rs-tl-item{ display:grid; grid-template-columns:22px minmax(0,1fr); gap:14px; }
.rs-tl-rail{ display:flex; flex-direction:column; align-items:center; }
.rs-tl-dot{ width:10px; height:10px; border-radius:50%; margin-top:5px; flex-shrink:0; }
.rs-tl-line{ width:1px; flex:1; background:var(--color-border); margin-top:4px; }
.rs-tl-t{ font-weight:600; font-size:15px; color:var(--color-text); }
.rs-tl-d{ font-size:14px; color:var(--color-text-muted); margin-top:3px; line-height:1.5; }
.rs-tl-w{ font-size:12.5px; color:var(--color-text-muted); margin-top:4px; font-variant-numeric:tabular-nums; }
@media (max-width: 640px){ .rs-sec{ padding:18px; } }
`;

/** Rastreo público (form GET → SSR, sin JS requerido). */
export default async function TrackPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, theme] = await Promise.all([searchParams, getTheme()]);

  let result: TrackingResult | null = null;
  let notFound = false;
  if (sp.orden && sp.email) {
    const res = await fetch(
      `${API_URL}/track?number=${encodeURIComponent(sp.orden)}&email=${encodeURIComponent(sp.email)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(15_000) },
    );
    if (res.ok) result = (await res.json()) as TrackingResult;
    else notFound = true;
  }

  return (
    <>
      <SiteHeader theme={theme} />
      <style>{CSS}</style>
      <div className="ms-page">
        <main className="ms-wrap-narrow">
          <header className="ms-head">
            <div className="ms-head-txt">
              <p className="ms-kicker">Seguimiento</p>
              <h1 className="ms-title">{t(theme, 'track.title')}</h1>
              <p className="ms-desc">{t(theme, 'track.subtitle')}</p>
            </div>
          </header>

          {/* Formulario */}
          <form action="/rastreo" method="get" className="ms-panel rs-form">
            <div className="ms-grid2">
              <div className="ms-field">
                <label htmlFor="rs-orden" className="ms-label">Número de pedido</label>
                <input id="rs-orden" name="orden" required defaultValue={sp.orden ?? ''} placeholder="Ej. ORD-000123" className="ms-input" />
              </div>
              <div className="ms-field">
                <label htmlFor="rs-email" className="ms-label">Correo con el que compraste</label>
                <input id="rs-email" name="email" type="email" required defaultValue={sp.email ?? ''} placeholder="tu@correo.com" className="ms-input" autoComplete="email" />
              </div>
            </div>
            <div>
              <button type="submit" className="ms-btn">Rastrear<Icon name="arrowRight" size={16} /></button>
            </div>
          </form>

          {notFound ? (
            <div role="alert" className="ms-alert ms-alert-bad" style={{ marginTop: 20 }}>
              <span style={{ color: 'var(--color-error)', display: 'flex', paddingTop: 2 }}><Icon name="warning" size={16} /></span>
              <span>{t(theme, 'track.notFound')}</span>
            </div>
          ) : null}

          {result ? (() => {
            const s = result.shipping;
            const method = toShipMethod(s?.method);
            // El estado del ENVÍO es lo que le importa al cliente; el `status` legacy
            // solo se usa si el pedido es tan viejo que nunca pasó por el módulo.
            const step = s ? fulfillmentStep(s.state, method) : null;
            const flow = fulfillmentFlow(result.hasRental);
            const at = s ? flow.indexOf(s.state) : -1;
            const canceled = s?.state === 'cancelado';
            const detail = s ? shipTracker(s) : null;
            const pay = paymentStatusLabel(result.paymentStatus);

            return (
              <section className="ms-panel rs-card">
                <div className="rs-sec rs-top">
                  <div style={{ minWidth: 0 }}>
                    <span className="ms-small ms-muted">Pedido</span>
                    <p className="rs-num">{result.orderNumber}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {step ? <Badge text={step.label} tone={step.tone} /> : null}
                    <Badge text={pay.text} tone={pay.tone} />
                  </div>
                </div>

                {/* --- Dónde va el pedido --- */}
                {step ? (
                  <div className="rs-sec">
                    <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>{step.hint}</p>

                    {s?.notes ? (
                      <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{s.notes}</p>
                    ) : null}

                    {detail || s?.scheduledAt ? (
                      <div className="rs-facts">
                        {detail ? (
                          <div>
                            <span className="ms-small ms-muted">{detail.label}</span>
                            <span className="rs-fact-v ms-num">{detail.value}</span>
                          </div>
                        ) : null}
                        {s?.scheduledAt ? (
                          <div>
                            <span className="ms-small ms-muted">Fecha estimada</span>
                            <span className="rs-fact-v">{day(s.scheduledAt)}</span>
                          </div>
                        ) : null}
                        {method ? (
                          <div>
                            <span className="ms-small ms-muted">Entrega</span>
                            <span className="rs-fact-v">{SHIP_METHODS[method].label}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Barra de avance: solo mientras el pedido siga en el flujo. */}
                    {!canceled && at >= 0 ? (
                      <div className="rs-flow">
                        {flow.map((f, i) => {
                          const done = i <= at;
                          const current = i === at;
                          const c = done ? toneColors(fulfillmentStep(f, method).tone).fg : 'var(--color-border)';
                          return (
                            <div key={f} className="rs-flow-step">
                              <div className="rs-flow-col">
                                <span style={{ width: current ? 14 : 10, height: current ? 14 : 10, borderRadius: '50%', flexShrink: 0, background: done ? c : 'transparent', border: `1.5px solid ${c}` }} />
                                <span className="rs-flow-l" style={{ color: done ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: current ? 600 : 400 }}>
                                  {fulfillmentStep(f, method).label}
                                </span>
                              </div>
                              {i < flow.length - 1 ? (
                                <span style={{ height: 1, flex: 1, minWidth: 8, marginTop: current ? 7 : 5, background: i < at ? toneColors(fulfillmentStep(flow[i + 1], method).tone).fg : 'var(--color-border)' }} />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* --- Historial --- */}
                <div className="rs-sec">
                  <h2 className="ms-h3" style={{ marginBottom: 16, fontSize: 17 }}>{t(theme, 'track.entries.title')}</h2>

                  {result.events.length === 0 && result.entries.length === 0 ? (
                    <p className="ms-muted" style={{ margin: 0, fontSize: 14.5 }}>{t(theme, 'track.noEntries')}</p>
                  ) : null}

                  {result.events.length > 0 ? (
                    <div className="rs-tl">
                      {[...result.events].reverse().map((e, i, arr) => {
                        const st = fulfillmentStep(e.to, method);
                        return (
                          <div key={e.id} className="rs-tl-item" style={{ paddingBottom: i === arr.length - 1 ? 0 : 20 }}>
                            <div className="rs-tl-rail">
                              <span className="rs-tl-dot" style={{ background: toneColors(st.tone).fg }} />
                              {i < arr.length - 1 ? <span className="rs-tl-line" /> : null}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="rs-tl-t">{st.label}</div>
                              <div className="rs-tl-d">{st.hint}</div>
                              <div className="rs-tl-w">{dt(e.at)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Guías cargadas en el sistema anterior: solo las traen los pedidos viejos. */}
                  {result.entries.length > 0 ? (
                    <div style={{ marginTop: result.events.length > 0 ? 26 : 0 }}>
                      {result.events.length > 0 ? (
                        <p className="ms-small ms-muted" style={{ margin: '0 0 14px', fontWeight: 600 }}>Registros anteriores</p>
                      ) : null}
                      <div className="rs-tl">
                        {result.entries.map((e, i) => (
                          <div key={i} className="rs-tl-item" style={{ paddingBottom: i === result.entries.length - 1 ? 0 : 20 }}>
                            <div className="rs-tl-rail">
                              <span className="rs-tl-dot" style={{ background: 'var(--color-primary)' }} />
                              {i < result.entries.length - 1 ? <span className="rs-tl-line" /> : null}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="rs-tl-t" style={{ overflowWrap: 'anywhere' }}>{e.numTracking}</div>
                              {e.nota ? <div className="rs-tl-d">{e.nota}</div> : null}
                              <div className="rs-tl-w">{e.fechaEntrega}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })() : null}
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
