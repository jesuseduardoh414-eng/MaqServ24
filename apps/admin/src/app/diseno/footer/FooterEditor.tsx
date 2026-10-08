'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Footer, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';
import { Btn, IconBtn, PageHeader, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;

/** Descripción bajo el título de cada bloque. */
const desc: CSSProperties = { margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' };

export function FooterEditor({ themeId, copys, tokens, footer, brand }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; footer: Footer; brand: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<Footer>(footer);
  const [saved, setSaved] = useState<Footer>(footer);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const setF = (patch: Partial<Footer>) => setConfig((c) => ({ ...c, ...patch }));

  // Helpers de columnas
  const updCol = (i: number, patch: Partial<Footer['columns'][number]>) => setF({ columns: config.columns.map((c, j) => j === i ? { ...c, ...patch } : c) });
  const updLink = (ci: number, li: number, patch: Partial<Footer['columns'][number]['links'][number]>) =>
    updCol(ci, { links: config.columns[ci].links.map((l, j) => j === li ? { ...l, ...patch } : l) });

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, footer: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los cambios');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — se verá al refrescar el sitio.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const year = new Date().getFullYear();
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { footer: config } }), [config]);

  return (
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Pie de página"
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy || !dirty}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 440px', gap: 24, alignItems: 'start' }} className="ftr-ed-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Boletín */}
          <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div><h3 style={h3Style}>Boletín (novedades)</h3><p style={desc}>La caja de suscripción arriba del pie.</p></div>
              <Toggle on={config.showNewsletter} onClick={() => setF({ showNewsletter: !config.showNewsletter })} />
            </div>
            {config.showNewsletter ? (
              <>
                <Field label="Título"><input value={config.newsletterTitle} onChange={(e) => setF({ newsletterTitle: e.target.value })} style={inputStyle} placeholder="Recibe nuestras novedades" /></Field>
                <Field label="Subtítulo"><textarea value={config.newsletterSubtitle} onChange={(e) => setF({ newsletterSubtitle: e.target.value })} rows={2} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </>
            ) : null}
          </div>

          {/* Descripción */}
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Descripción de la marca</h3>
            <textarea value={config.tagline} onChange={(e) => setF({ tagline: e.target.value })} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Renta de maquinaria pesada…" />
          </div>

          {/* Columnas: cada una se separa con una línea fina en vez de ir en una caja dentro de la caja. */}
          <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
            <div><h3 style={h3Style}>Columnas de enlaces</h3><p style={desc}>Cada columna tiene un título y una lista de enlaces (texto + destino).</p></div>
            {config.columns.map((col, ci) => (
              <div key={ci} style={{ display: 'grid', gap: 10, paddingTop: 16, borderTop: '1px solid var(--adm-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                  <input value={col.title} onChange={(e) => updCol(ci, { title: e.target.value })} style={{ ...inputStyle, fontWeight: 600 }} placeholder="Título de la columna" />
                  <IconBtn icon="ph-trash" label="Quitar columna" danger onClick={() => setF({ columns: config.columns.filter((_, j) => j !== ci) })} />
                </div>
                {col.links.map((l, li) => (
                  <div key={li} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input value={l.label} onChange={(e) => updLink(ci, li, { label: e.target.value })} style={inputStyle} placeholder="Texto" />
                    <input value={l.href} onChange={(e) => updLink(ci, li, { href: e.target.value })} style={inputStyle} placeholder="/destino" />
                    <IconBtn icon="ph-x" label="Quitar enlace" plain onClick={() => updCol(ci, { links: col.links.filter((_, j) => j !== li) })} />
                  </div>
                ))}
                <div><Btn size="sm" variant="ghost" icon="ph-plus" onClick={() => updCol(ci, { links: [...col.links, { label: '', href: '/' }] })}>Enlace</Btn></div>
              </div>
            ))}
            <div><Btn size="sm" icon="ph-plus" onClick={() => setF({ columns: [...config.columns, { title: '', links: [] }] })}>Agregar columna</Btn></div>
          </div>

          {/* Redes */}
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <div><h3 style={h3Style}>Redes sociales</h3><p style={desc}>Etiqueta corta (f, in, ig…) + enlace. Sin enlace se muestra desactivada.</p></div>
            {config.social.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 10, alignItems: 'center' }}>
                <input value={s.label} onChange={(e) => setF({ social: config.social.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputStyle, textAlign: 'center' }} placeholder="f" />
                <input value={s.href} onChange={(e) => setF({ social: config.social.map((x, j) => j === i ? { ...x, href: e.target.value } : x) })} style={inputStyle} placeholder="https://…" />
                <IconBtn icon="ph-trash" label="Quitar" danger onClick={() => setF({ social: config.social.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <div><Btn size="sm" icon="ph-plus" onClick={() => setF({ social: [...config.social, { label: '', href: '' }] })}>Agregar red</Btn></div>
          </div>

          {/* Copyright */}
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Aviso de copyright</h3>
            <Field label="Texto (vacío ⇒ se genera automático con el año y la marca)"><input value={config.copyright} onChange={(e) => setF({ copyright: e.target.value })} style={inputStyle} placeholder={`© ${year} ${brand}. Todos los derechos reservados.`} /></Field>
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta el pie con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12, minWidth: 0 }} className="ftr-ed-preview">
          <VistaPreviaSitio vista="sitio.footer" etiqueta="pie de página" borrador={borrador} modoInicial={modoTema} />
        </div>
      </div>

      <style>{`@media (max-width: 900px){ .ftr-ed-grid{ grid-template-columns:1fr !important; } .ftr-ed-preview{ position:static !important; } }`}</style>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
