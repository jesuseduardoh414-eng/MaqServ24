'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Brands, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { cardStyle, inputStyle, h3Style, Field } from '@/components/editor-kit';
import { Btn, Note, PageHeader, StatusText, Toast } from '@/components/ui';

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
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { brands: config } }), [config]);

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
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Marcas con las que trabajas"
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      {/* Que quede claro que se edita UNA vez y sale en dos lados. */}
      <Note tone="info" style={{ marginBottom: 18 }}>
        Esta lista sale en <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>dos lugares</strong>: la banda del inicio y la página Quiénes somos. Se edita aquí una vez y cambia en los dos.
      </Note>

      {/* La vista previa fija de 380px no cabe junto al editor en pantalla
          angosta: bajo 1000px se apilan (mismo patrón que /ordenes/[id]). */}
      <style>{`@media (max-width: 1000px){ .br-ed-grid{ grid-template-columns: 1fr !important; } }`}</style>
      <div className="br-ed-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 440px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <h3 style={h3Style}>Marcas</h3>
            <Field label="Marcas (una por línea)">
              <textarea
                value={config.list.join('\n')}
                onChange={(e) => set('list', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                rows={8}
                placeholder={'CAT\nKomatsu\nVolvo CE'}
                style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.6, resize: 'vertical' }}
              />
            </Field>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>
              <span className="adm-num">{config.list.length}</span> marca{config.list.length === 1 ? '' : 's'}. Se escriben tal cual salen en el sitio.
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

        {/* VISTA PREVIA: el sitio real pinta la banda de marcas con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 20, minWidth: 0 }}>
          <VistaPreviaSitio
            vista="home.brands"
            etiqueta="home"
            borrador={borrador}
            modoInicial={modoTema}
            aviso={config.list.length === 0 ? <>Sin marcas: la banda no se muestra en el home.</> : null}
          />
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
