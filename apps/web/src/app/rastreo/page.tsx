import type { Metadata } from 'next';
import type { TrackingResult } from '@maqserv/types';
import { SHIP_METHODS, fulfillmentFlow, fulfillmentStep, shipTracker, toShipMethod } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { paymentStatusLabel, toneColors } from '@/lib/order-status';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'track.title')} — ${t(theme, 'site.name')}` };
}

type Search = { orden?: string; email?: string };

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)',
  background: 'color-mix(in srgb, var(--color-text) 3%, var(--color-surface))',
  border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 };

const dt = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const day = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));

function Badge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const c = toneColors(tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', padding: '6px 12px', borderRadius: 100, background: c.bg, border: `1px solid ${c.border}`, color: c.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.fg }} />
      {text}
    </span>
  );
}


/** Rastreo público (form GET → SSR, sin JS requerido). */
export default async function TrackPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, theme] = await Promise.all([searchParams, getTheme()]);

  let result: TrackingResult | null = null;
  let notFound = false;
  if (sp.orden && sp.email) {
    const res = await fetch(
      `${API_URL}/track?number=${encodeURIComponent(sp.orden)}&email=${encodeURIComponent(sp.email)}`,
      { cache: 'no-store' },
    );
    if (res.ok) result = (await res.json()) as TrackingResult;
    else notFound = true;
  }

  return (
    <>
      <SiteHeader theme={theme} />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 72px', background: 'var(--color-bg)' }}>
        {/* Hero */}
        <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 32, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ width: 30, height: 4, background: 'var(--color-primary)', borderRadius: 2 }} />
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.24em', color: 'var(--color-text-muted)' }}>SEGUIMIENTO</span>
          </div>
          <h1 style={{ fontFamily: DISPLAY, margin: 0, fontSize: 52, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text)' }}>{t(theme, 'track.title')}</h1>
          <p style={{ margin: '18px 0 0', fontSize: 17, lineHeight: 1.55, color: 'var(--color-text-muted)', maxWidth: '52ch' }}>{t(theme, 'track.subtitle')}</p>
        </div>

        {/* Form */}
        <form action="/rastreo" method="get" style={{ display: 'grid', gap: 20, maxWidth: 480 }}>
          <div>
            <label style={labelStyle}>Número de pedido</label>
            <input name="orden" required defaultValue={sp.orden ?? ''} placeholder="Ej. ORD-000123" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Correo con el que compraste</label>
            <input name="email" type="email" required defaultValue={sp.email ?? ''} placeholder="tu@correo.com" style={inputStyle} />
          </div>
          <div>
            <button type="submit" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '15px 34px', borderRadius: 100, cursor: 'pointer' }}>Rastrear →</button>
          </div>
        </form>

        {notFound ? (
          <div role="alert" style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12, background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)', color: 'var(--color-error)', padding: '14px 18px', borderRadius: 12, fontSize: 14.5, fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>⚠</span> {t(theme, 'track.notFound')}
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
            <section style={{ marginTop: 40, border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)', overflow: 'hidden' }}>
              <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: 4 }}>PEDIDO</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{result.orderNumber}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {step ? <Badge text={step.label} tone={step.tone} /> : null}
                  <Badge text={pay.text} tone={pay.tone} />
                </div>
              </div>

              {/* --- Dónde va el pedido --- */}
              {step ? (
                <div style={{ padding: '24px 26px', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--color-text)', fontWeight: 600 }}>{step.hint}</p>

                  {s?.notes ? (
                    <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{s.notes}</p>
                  ) : null}

                  {detail || s?.scheduledAt ? (
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 18 }}>
                      {detail ? (
                        <div>
                          <div style={{ ...labelStyle, marginBottom: 5 }}>{detail.label}</div>
                          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{detail.value}</div>
                        </div>
                      ) : null}
                      {s?.scheduledAt ? (
                        <div>
                          <div style={{ ...labelStyle, marginBottom: 5 }}>Fecha estimada</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{day(s.scheduledAt)}</div>
                        </div>
                      ) : null}
                      {method ? (
                        <div>
                          <div style={{ ...labelStyle, marginBottom: 5 }}>Entrega</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{SHIP_METHODS[method].label}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Barra de avance: solo mientras el pedido siga en el flujo. */}
                  {!canceled && at >= 0 ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 26, overflowX: 'auto' }}>
                      {flow.map((f, i) => {
                        const done = i <= at;
                        const current = i === at;
                        const c = done ? toneColors(fulfillmentStep(f, method).tone).fg : 'var(--color-border)';
                        return (
                          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 76 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                              <span style={{ width: current ? 14 : 10, height: current ? 14 : 10, borderRadius: '50%', flexShrink: 0, background: done ? c : 'transparent', border: `2px solid ${c}` }} />
                              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.35, marginTop: 8, color: done ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: current ? 700 : 400 }}>
                                {fulfillmentStep(f, method).label}
                              </span>
                            </div>
                            {i < flow.length - 1 ? (
                              <span style={{ height: 2, flex: 1, minWidth: 8, marginTop: current ? 6 : 4, background: i < at ? toneColors(fulfillmentStep(flow[i + 1], method).tone).fg : 'var(--color-border)' }} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* --- Historial --- */}
              <div style={{ padding: '24px 26px' }}>
                <h2 style={{ fontFamily: DISPLAY, fontSize: 18, margin: '0 0 16px', fontWeight: 700, color: 'var(--color-text)' }}>{t(theme, 'track.entries.title')}</h2>

                {result.events.length === 0 && result.entries.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 14.5 }}>{t(theme, 'track.noEntries')}</p>
                ) : null}

                {result.events.length > 0 ? (
                  <div style={{ display: 'grid', gap: 0 }}>
                    {[...result.events].reverse().map((e, i, arr) => {
                      const st = fulfillmentStep(e.to, method);
                      return (
                        <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 16, paddingBottom: i === arr.length - 1 ? 0 : 22 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: toneColors(st.tone).fg, marginTop: 4, flexShrink: 0 }} />
                            {i < arr.length - 1 ? <span style={{ width: 2, flex: 1, background: 'var(--color-border)', marginTop: 4 }} /> : null}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{st.label}</div>
                            <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 3 }}>{st.hint}</div>
                            <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, letterSpacing: '0.04em' }}>{dt(e.at)}</div>
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
                      <div style={{ ...labelStyle, marginBottom: 14 }}>Registros anteriores</div>
                    ) : null}
                    <div style={{ display: 'grid', gap: 0 }}>
                      {result.entries.map((e, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 16, paddingBottom: i === result.entries.length - 1 ? 0 : 22 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 4, flexShrink: 0 }} />
                            {i < result.entries.length - 1 ? <span style={{ width: 2, flex: 1, background: 'var(--color-border)', marginTop: 4 }} /> : null}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{e.numTracking}</div>
                            {e.nota ? <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 3 }}>{e.nota}</div> : null}
                            <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, letterSpacing: '0.04em' }}>{e.fechaEntrega}</div>
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
      <SiteFooter theme={theme} />
    </>
  );
}
