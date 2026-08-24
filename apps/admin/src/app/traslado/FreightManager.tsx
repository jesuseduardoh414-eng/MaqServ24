'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckoutConfig, CheckoutFreight, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

interface TestResult {
  status: string;
  cost: number;
  km: number | null;
  chargedKm: number | null;
  distanceText: string | null;
  estimated: boolean;
  message: string;
  origin: string | null;
  provider: 'google' | 'osm';
}

const MODES: Array<{ key: CheckoutFreight['mode']; label: string; icon: string; help: string }> = [
  { key: 'km', label: 'Por kilómetro', icon: 'ph-path', help: 'Se calcula por la distancia hasta el cliente.' },
  { key: 'flat', label: 'Tarifa única', icon: 'ph-tag', help: 'El mismo monto para cualquier ubicación.' },
  { key: 'quote', label: 'Solo cotizar', icon: 'ph-chat-teardrop-text', help: 'Se muestra "A cotizar" y no se cobra.' },
];

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FreightManager({ themeId, copys, tokens, checkout, contactAddress }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; checkout: CheckoutConfig; contactAddress: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<CheckoutFreight>(checkout.freight);
  const [saved, setSaved] = useState<CheckoutFreight>(checkout.freight);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [testAddr, setTestAddr] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const set = (patch: Partial<CheckoutFreight>) => setConfig((c) => ({ ...c, ...patch }));

  function discard() { setConfig(saved); setToast(null); }

  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, checkout: { ...checkout, freight: config } }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — aplica al carrito y a los pedidos nuevos.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  /** Prueba la configuración EN PANTALLA (aunque no esté publicada). */
  async function runTest() {
    if (testing || !testAddr.trim()) return;
    setTesting(true); setResult(null);
    try {
      const r = await fetch('/api/admin/freight/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: testAddr.trim(), config }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message ?? 'No se pudo cotizar');
      setResult(data as TestResult);
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setTesting(false); }
  }

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      {/* Los 3 modos de cobro y los pares de campos no bajan de su ancho
          mínimo: en móvil se apilan en vez de salirse de la tarjeta. */}
      <style>{`
        @media (max-width: 620px) {
          .fr-modes, .fr-two { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-truck" style={{ fontSize: 14 }} /> Configuración <span style={{ opacity: 0.5 }}>·</span> Traslado</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Traslado y cobertura</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, display: 'grid', gap: 18 }}>
        {/* Cómo se cobra */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3 style={h3Style}>Cobrar traslado</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Apagado: el pedido no muestra ni cobra traslado.</p>
            </div>
            <Toggle on={config.enabled} onClick={() => set({ enabled: !config.enabled })} />
          </div>

          {config.enabled ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="fr-modes">
              {MODES.map((m) => {
                const on = config.mode === m.key;
                return (
                  <button key={m.key} type="button" onClick={() => set({ mode: m.key })} style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 13, padding: '13px 14px', background: on ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : D.inputBorder}`, color: D.text }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: on ? D.amber : D.text }}><i className={`ph-bold ${m.icon}`} style={{ fontSize: 16 }} /> {m.label}</div>
                    <div style={{ fontSize: 11.5, color: D.muted, marginTop: 4, lineHeight: 1.45 }}>{m.help}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Tarifa por km */}
        {config.enabled && config.mode === 'km' ? (
          <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
            <div>
              <h3 style={h3Style}>Tarifa por distancia</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>
                Fórmula: <strong style={{ color: D.text }}>cargo de salida + (km − km sin costo) × tarifa</strong>{config.roundTrip ? ' × 2 (ida y vuelta)' : ''}, con un mínimo de {money(config.minCharge)}.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="fr-two">
              <Field label="Tarifa por kilómetro ($)"><input type="number" min={0} step="0.01" value={config.ratePerKm} onChange={(e) => set({ ratePerKm: num(e.target.value) })} style={inputStyle} /></Field>
              <Field label="Cargo de salida ($)"><input type="number" min={0} step="0.01" value={config.base} onChange={(e) => set({ base: num(e.target.value) })} style={inputStyle} /></Field>
              <Field label="Kilómetros sin costo"><input type="number" min={0} step="1" value={config.freeKm} onChange={(e) => set({ freeKm: num(e.target.value) })} style={inputStyle} /></Field>
              <Field label="Cobro mínimo ($)"><input type="number" min={0} step="0.01" value={config.minCharge} onChange={(e) => set({ minCharge: num(e.target.value) })} style={inputStyle} /></Field>
            </div>
            <Field label="Radio máximo de cobertura (km) — 0 = sin límite">
              <input type="number" min={0} step="1" value={config.maxKm} onChange={(e) => set({ maxKm: num(e.target.value) })} style={inputStyle} />
              <span style={{ display: 'block', fontSize: 11.5, color: D.muted, marginTop: 6 }}>Más lejos que esto, el pedido pasa sin cobro y el traslado se cotiza a mano.</span>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: '12px 14px' }}>
              <span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Cobrar ida y vuelta</span>
                <span style={{ display: 'block', fontSize: 11.5, color: D.muted }}>Duplica los kilómetros: la máquina va y regresa.</span>
              </span>
              <Toggle on={config.roundTrip} onClick={() => set({ roundTrip: !config.roundTrip })} />
            </label>
          </div>
        ) : null}

        {/* Tarifa única */}
        {config.enabled && config.mode === 'flat' ? (
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <h3 style={h3Style}>Tarifa única</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="fr-two">
              <Field label="Monto del traslado ($)"><input type="number" min={0} step="0.01" value={config.flatAmount} onChange={(e) => set({ flatAmount: num(e.target.value) })} style={inputStyle} /></Field>
              <Field label="Cobro mínimo ($)"><input type="number" min={0} step="0.01" value={config.minCharge} onChange={(e) => set({ minCharge: num(e.target.value) })} style={inputStyle} /></Field>
            </div>
          </div>
        ) : null}

        {/* Reglas comunes */}
        {config.enabled && config.mode !== 'quote' ? (
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Reglas</h3>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: '12px 14px' }}>
              <span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Cobrar por cada equipo</span>
                <span style={{ display: 'block', fontSize: 11.5, color: D.muted }}>Apagado: un solo viaje por pedido (manda la tarifa más alta del carrito). Activado: se multiplica por cada máquina.</span>
              </span>
              <Toggle on={config.perUnit} onClick={() => set({ perUnit: !config.perUnit })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: '12px 14px' }}>
              <span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Solo en equipos de renta</span>
                <span style={{ display: 'block', fontSize: 11.5, color: D.muted }}>Los productos de venta no pagan traslado.</span>
              </span>
              <Toggle on={config.rentalOnly} onClick={() => set({ rentalOnly: !config.rentalOnly })} />
            </label>
            <p style={{ margin: 0, fontSize: 11.5, color: D.muted, lineHeight: 1.5 }}>
              <i className="ph ph-info" style={{ marginRight: 5 }} />
              Un producto con <strong style={{ color: D.text }}>“Flete de renta”</strong> capturado usa esa tarifa por km en vez de la global.
            </p>
          </div>
        ) : null}

        {/* Origen */}
        {config.enabled ? (
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <div>
              <h3 style={h3Style}>Punto de salida</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Desde aquí se miden los kilómetros hasta el cliente.</p>
            </div>
            <Field label="Dirección de origen">
              <input value={config.origin} onChange={(e) => set({ origin: e.target.value })} style={inputStyle} placeholder={contactAddress || 'Calle, número, ciudad, estado'} />
              <span style={{ display: 'block', fontSize: 11.5, color: D.muted, marginTop: 6 }}>
                {contactAddress ? <>Vacío = se usa la de <strong style={{ color: D.text }}>Diseño → Contacto</strong>: “{contactAddress}”.</> : <>Diseño → Contacto no tiene dirección; captura una aquí o el traslado no se podrá calcular.</>}
              </span>
            </Field>
          </div>
        ) : null}

        {/* Textos */}
        {config.enabled ? (
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <h3 style={h3Style}>Textos en el sitio</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="fr-two">
              <Field label="Nombre del concepto"><input value={config.label} onChange={(e) => set({ label: e.target.value })} style={inputStyle} placeholder="Traslado" /></Field>
              <Field label="Texto cuando no se puede calcular"><input value={config.quoteText} onChange={(e) => set({ quoteText: e.target.value })} style={inputStyle} placeholder="A cotizar" /></Field>
            </div>
            <Field label="Ayuda bajo el cotizador"><input value={config.help} onChange={(e) => set({ help: e.target.value })} style={inputStyle} /></Field>
          </div>
        ) : null}

        {/* Probador */}
        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div>
            <h3 style={h3Style}>Probar una dirección</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Usa la configuración de esta pantalla, aunque no la hayas publicado.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={testAddr} onChange={(e) => setTestAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }} style={{ ...inputStyle, flex: 1 }} placeholder="Ej. Av. Juárez 100, Puebla, Pue." />
            <button type="button" onClick={runTest} disabled={testing || !testAddr.trim()} style={{ border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.05)', color: D.text, borderRadius: 11, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, cursor: testing || !testAddr.trim() ? 'default' : 'pointer', opacity: testing || !testAddr.trim() ? 0.5 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {testing ? 'Calculando…' : 'Probar'}
            </button>
          </div>
          {result ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${result.status === 'ok' ? 'rgba(63,191,143,0.35)' : D.inputBorder}`, borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12.5, color: D.muted2, fontWeight: 600 }}>{result.km !== null ? `${result.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km${result.chargedKm !== null ? ` · se cobran ${result.chargedKm.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : ''}` : 'Sin distancia'}</span>
                <strong style={{ fontSize: 20, fontWeight: 800, color: result.status === 'ok' ? '#3fbf8f' : D.muted2 }}>{result.status === 'ok' ? money(result.cost) : result.message}</strong>
              </div>
              <div style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.5 }}>
                Origen: {result.origin ?? '— sin dirección de salida —'}
                <br />
                {result.provider === 'google'
                  ? 'Distancia real por carretera (Google).'
                  : 'Distancia estimada (OpenStreetMap, línea recta × 1.32). Para km exactos de carretera, carga una llave de Google Distance Matrix.'}
              </div>
            </div>
          ) : null}
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
