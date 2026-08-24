'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brands, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, Field } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

/**
 * Editor de la banda de marcas.
 *
 * Una sola lista para los DOS lugares donde salen las marcas: la banda del home y
 * el listado de /quienes-somos. Antes cada uno tenía la suya (un copy y un token) y
 * ya decían marcas distintas.
 */
export function BrandsEditor({ themeId, copys, tokens, brands }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; brands: Brands;
}) {
  const router = useRouter();
  const initial: Brands = useMemo(() => ({ ...brands }), [brands]);

  const [config, setConfig] = useState<Brands>(initial);
  const [saved, setSaved] = useState<Brands>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Brands>(k: K, v: Brands[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function discard() { setConfig(saved); setToast(null); }

  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      // Los copys viejos (`home.brands.*`) ya no los lee nadie: el sitio usa el token.
      const body = { tokens: { ...tokens, brands: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
            <i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Marcas
          </div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Marcas con las que trabajas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}
          </span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
            <i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}
          </button>
        </div>
      </div>

      {/* Que quede claro que se edita UNA vez y sale en dos lados. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: 'rgba(91,157,255,0.07)', border: '1px solid rgba(91,157,255,0.28)', borderRadius: 12, padding: '13px 17px', marginBottom: 18 }}>
        <i className="ph ph-info" style={{ color: '#5b9dff', fontSize: 16, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#D4D4D8', lineHeight: 1.55 }}>
          Esta lista sale en <strong style={{ color: '#FBFBFA' }}>dos lugares</strong>: la banda del inicio y la página Quiénes somos. Se edita aquí una vez y cambia en los dos.
        </div>
      </div>

      {/* La vista previa fija de 380px no cabe junto al editor en pantalla
          angosta: bajo 1000px se apilan (mismo patrón que /ordenes/[id]). */}
      <style>{`@media (max-width: 1000px){ .br-ed-grid{ grid-template-columns: 1fr !important; } }`}</style>
      <div className="br-ed-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <h3 style={h3Style}>Marcas</h3>
            <Field label="Marcas (una por línea)">
              <textarea
                value={config.list.join('\n')}
                onChange={(e) => set('list', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                rows={8}
                placeholder={'CAT\nKomatsu\nVolvo CE'}
                style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.6, resize: 'vertical' }}
              />
            </Field>
            <p style={{ margin: 0, fontSize: 12, color: D.muted2 }}>
              {config.list.length} marca{config.list.length === 1 ? '' : 's'}. Se escriben tal cual salen en el sitio.
            </p>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <h3 style={h3Style}>Textos</h3>
            <Field label="Encabezado en el inicio">
              <input value={config.title} onChange={(e) => set('title', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Encabezado en Quiénes somos">
              <input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Previsualización: lo que se ve en el inicio. */}
        <div style={{ ...cardStyle, marginBottom: 0, position: 'sticky', top: 20 }}>
          <h3 style={{ ...h3Style, marginBottom: 14 }}>Vista previa</h3>
          <div style={{ background: '#F8F9FA', border: '1px solid #E4E6E9', borderRadius: 10, padding: '18px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8A9099', marginBottom: 12 }}>{config.title}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {config.list.length === 0 ? (
                <span style={{ fontSize: 11, color: '#B3BAC4' }}>Sin marcas: la banda no se muestra.</span>
              ) : (
                config.list.map((b, i) => (
                  <span key={i} style={{ flex: '0 0 auto', height: 26, minWidth: 62, padding: '0 8px', border: '1px solid #E4E6E9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9, color: '#63696E', background: '#fff' }}>{b}</span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <p role="status" style={{ marginTop: 18, fontSize: 13.5, fontWeight: 600, color: toast.ok ? '#3fbf8f' : '#f55' }}>{toast.text}</p>
      ) : null}
    </div>
  );
}
