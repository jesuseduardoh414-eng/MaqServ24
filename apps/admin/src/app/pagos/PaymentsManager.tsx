'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckoutConfig, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

export interface Gateway {
  id: number;
  code: string;
  title: string;
  text: string;
  status: number;
  hasSecret: boolean;
  /** Solo MercadoPago: a dónde avisa cuando alguien paga. */
  webhookUrl?: string;
  /** false = la URL apunta a localhost y MercadoPago no podrá alcanzarla. */
  webhookReachable?: boolean;
}

const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit', minHeight: 90 };

export function PaymentsManager({ themeId, copys, tokens, checkout, gateways }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; checkout: CheckoutConfig; gateways: Gateway[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState<CheckoutConfig>(checkout);
  const [saved, setSaved] = useState<CheckoutConfig>(checkout);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [rows, setRows] = useState<Gateway[]>(gateways);
  const [secrets, setSecrets] = useState<Record<number, string>>({});
  const [savingGw, setSavingGw] = useState<number | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const setTax = (patch: Partial<CheckoutConfig['tax']>) => setConfig((c) => ({ ...c, tax: { ...c.tax, ...patch } }));
  const setOp = (patch: Partial<CheckoutConfig['operator']>) => setConfig((c) => ({ ...c, operator: { ...c.operator, ...patch } }));

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, checkout: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — aplica al carrito y a los pedidos nuevos.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const updRow = (id: number, patch: Partial<Gateway>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function saveGateway(g: Gateway) {
    setSavingGw(g.id);
    try {
      const secret = secrets[g.id];
      const body: Record<string, unknown> = { title: g.title, text: g.text, status: g.status };
      if (secret !== undefined) body.secret = secret; // '' borra la credencial
      const r = await fetch(`/api/admin/payments/gateways/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ?? 'No se pudo guardar'); }
      if (secret !== undefined) {
        updRow(g.id, { hasSecret: secret.trim().length > 0 });
        setSecrets((s) => { const n = { ...s }; delete n[g.id]; return n; });
      }
      setToast({ ok: true, text: `"${g.title}" guardado` });
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setSavingGw(null); }
  }

  const mxn = (n: number) => '$' + Number(n || 0).toLocaleString('es-MX');

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-credit-card" style={{ fontSize: 14 }} /> Configuración <span style={{ opacity: 0.5 }}>·</span> Pagos</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Pagos y cobro</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, display: 'grid', gap: 18 }}>
        {/* IVA */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 style={h3Style}>Impuesto (IVA)</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Si lo activas, se cobra de verdad en el pedido (no solo se muestra).</p>
            </div>
            <Toggle on={config.tax.enabled} onClick={() => setTax({ enabled: !config.tax.enabled })} />
          </div>
          {config.tax.enabled ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
                <Field label="Tasa (%)"><input type="number" min={0} max={100} step="0.01" value={config.tax.rate} onChange={(e) => setTax({ rate: Number(e.target.value) || 0 })} style={inputStyle} /></Field>
                <Field label="Etiqueta"><input value={config.tax.label} onChange={(e) => setTax({ label: e.target.value })} style={inputStyle} placeholder="IVA" /></Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: '12px 14px' }}>
                <span>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Los precios ya incluyen el impuesto</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: D.muted }}>Activado: no se suma nada, solo se desglosa. Apagado: se suma {config.tax.rate}% al total.</span>
                </span>
                <Toggle on={config.tax.included} onClick={() => setTax({ included: !config.tax.included })} />
              </label>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: D.muted2 }}>Apagado: el total del pedido es el subtotal (menos descuentos). No se muestra ni se cobra impuesto.</p>
          )}
        </div>

        {/* Operador */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 style={h3Style}>Operador certificado</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Opción en el carrito. Se cobra por equipo (cantidad × monto).</p>
            </div>
            <Toggle on={config.operator.enabled} onClick={() => setOp({ enabled: !config.operator.enabled })} />
          </div>
          {config.operator.enabled ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
                <Field label="Monto por equipo"><input type="number" min={0} step="1" value={config.operator.amount} onChange={(e) => setOp({ amount: Number(e.target.value) || 0 })} style={inputStyle} /></Field>
                <Field label="Título"><input value={config.operator.label} onChange={(e) => setOp({ label: e.target.value })} style={inputStyle} /></Field>
              </div>
              <Field label="Descripción"><input value={config.operator.help} onChange={(e) => setOp({ help: e.target.value })} style={inputStyle} /></Field>
              <p style={{ margin: 0, fontSize: 12, color: D.muted2 }}>Se mostrará como: <b>{config.operator.label}</b> · +{mxn(config.operator.amount)} por equipo</p>
            </>
          ) : null}
        </div>

        {/* Nota */}
        <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Nota del checkout</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Texto pequeño bajo el botón de pago.</p></div>
          <input value={config.note} onChange={(e) => setConfig((c) => ({ ...c, note: e.target.value }))} style={inputStyle} placeholder="El traslado se cotiza según ubicación." />
        </div>

        {/* Métodos de pago */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div>
            <h3 style={h3Style}>Métodos de pago</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Cada método se guarda por separado (no requiere publicar).</p>
          </div>
          {rows.map((g) => (
            <div key={g.id} style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className={`ph ${g.code === 'mercadopago' ? 'ph-credit-card' : 'ph-bank'}`} style={{ fontSize: 20, color: D.amber }} />
                  <div>
                    <strong style={{ fontSize: 14 }}>{g.code === 'mercadopago' ? 'MercadoPago' : 'Transferencia / depósito'}</strong>
                    <div style={{ fontSize: 11.5, color: D.muted2 }}>{g.status === 1 ? 'Activo · visible en el checkout' : 'Apagado'}{g.code === 'mercadopago' && !g.hasSecret ? ' · falta credencial' : ''}</div>
                  </div>
                </div>
                <Toggle on={g.status === 1} onClick={() => updRow(g.id, { status: g.status === 1 ? 0 : 1 })} />
              </div>

              <Field label="Título (lo ve el cliente)"><input value={g.title} onChange={(e) => updRow(g.id, { title: e.target.value })} style={inputStyle} /></Field>
              <Field label={g.code === 'mercadopago' ? 'Descripción' : 'Instrucciones de pago (se muestran en el pedido)'}>
                <textarea value={g.text} onChange={(e) => updRow(g.id, { text: e.target.value })} rows={4} style={textareaStyle} placeholder={g.code === 'mercadopago' ? 'Paga con tarjeta, débito o efectivo.' : 'Banco, cuenta CLABE, referencia y pasos a seguir…'} />
              </Field>

              {g.code === 'mercadopago' ? (
                <Field label={`Access token${g.hasSecret ? ' (ya guardado — escribe uno nuevo para reemplazarlo)' : ''}`}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={secrets[g.id] ?? ''}
                    onChange={(e) => setSecrets((s) => ({ ...s, [g.id]: e.target.value }))}
                    placeholder={g.hasSecret ? '•••••••••••• (guardado)' : 'APP_USR-… (sandbox o producción)'}
                    style={inputStyle}
                  />
                </Field>
              ) : null}
              {g.code === 'mercadopago' ? (
                <p style={{ margin: 0, fontSize: 11.5, color: D.muted2 }}>
                  <i className="ph ph-lock-key" /> La credencial se guarda en el servidor y nunca se muestra ni se envía al sitio público. Deja el campo vacío para no cambiarla.
                </p>
              ) : null}

              {/* Sin esto, cargar la key y probar en local deja pagos "aprobados" en
                  MercadoPago y órdenes sin marcar — sin ninguna pista de por qué. */}
              {g.code === 'mercadopago' && g.webhookUrl ? (
                <div style={{ border: `1px solid ${g.webhookReachable ? D.inputBorder : 'color-mix(in srgb, var(--color-primary) 35%, transparent)'}`, background: g.webhookReachable ? 'rgba(255,255,255,0.02)' : 'color-mix(in srgb, var(--color-primary) 7%, transparent)', borderRadius: 11, padding: '12px 14px', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: g.webhookReachable ? D.text : D.amber }}>
                    <i className={`ph ${g.webhookReachable ? 'ph-webhooks-logo' : 'ph-warning'}`} style={{ fontSize: 14 }} />
                    Aviso de pago (webhook)
                  </div>
                  <code style={{ fontSize: 11.5, color: D.muted2, wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>{g.webhookUrl}</code>
                  <p style={{ margin: 0, fontSize: 11.5, color: D.muted2, lineHeight: 1.55 }}>
                    {g.webhookReachable ? (
                      <>MercadoPago avisa aquí cuando un pago se aprueba y la orden se marca pagada sola. Se manda en cada cobro: no hay que configurarlo en MercadoPago.</>
                    ) : (
                      <>
                        <strong style={{ color: D.amber }}>Esta dirección es local y MercadoPago no puede alcanzarla.</strong> El pago
                        funcionará, pero la orden <strong>no se marcará pagada</strong> porque el aviso nunca llega. Para probar de
                        verdad hace falta que la API esté publicada (o un túnel) y configurar <code style={{ fontFamily: 'ui-monospace, monospace' }}>API_PUBLIC_URL</code>.
                      </>
                    )}
                  </p>
                </div>
              ) : null}

              <div><button type="button" onClick={() => saveGateway(g)} disabled={savingGw === g.id} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: savingGw === g.id ? 'default' : 'pointer', opacity: savingGw === g.id ? 0.6 : 1, fontFamily: 'inherit' }}>{savingGw === g.id ? 'Guardando…' : 'Guardar método'}</button></div>
            </div>
          ))}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
