'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Catalog, CtaBlock, Featured, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle, ColorField, BlockEditor } from '@/components/editor-kit';
import { Btn, PageHeader, Segmented, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;

const FEATURED_DEFAULTS: Featured = { limit: 8, showTabs: true, align: 'left', eyebrowColor: null, titleColor: null };
const BLOCK_DEFAULTS: CtaBlock = { enabled: false, eyebrow: '', title: '', subtitle: '', cta: '', ctaLink: '/productos', image: null, bg: null, textColor: null, accentColor: null };
const mergeBlock = (b?: Partial<CtaBlock>): CtaBlock => ({ ...BLOCK_DEFAULTS, ...(b ?? {}) });

/** Qué edita cada pestaña: una línea de texto plano en vez de una tarjeta con icono. */
const intro: CSSProperties = { margin: '0 0 16px', fontSize: 13, lineHeight: 1.55, color: 'var(--adm-muted)' };
const introTitle: CSSProperties = { color: 'var(--adm-text)', fontWeight: 600 };

interface Config {
  eyebrow: string; title: string; subtitle: string; allLabel: string; viewAll: string;
  featured: Featured;
  catalog: { banner: CtaBlock; mid: CtaBlock; promo: CtaBlock };
}

/** Copys de destacados. Los usan «Guardar y publicar» y la vista previa. */
function copysDestacados(c: Config): Record<string, string> {
  return {
    'home.featured.eyebrow': c.eyebrow, 'home.featured.title': c.title, 'home.featured.subtitle': c.subtitle,
    'home.featured.filterAll': c.allLabel, 'home.featured.viewAll': c.viewAll,
  };
}

const TABS = [
  { id: 'destacados', label: 'Destacados (home)' },
  { id: 'catalogo', label: 'Catálogo (vista)' },
] as const;

export function ProductsEditor({ themeId, copys, tokens, featured, catalog }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; featured: Featured; catalog: Catalog;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: es['home.featured.eyebrow'] ?? '', title: es['home.featured.title'] ?? '',
      subtitle: es['home.featured.subtitle'] ?? '', allLabel: es['home.featured.filterAll'] ?? '',
      viewAll: es['home.featured.viewAll'] ?? '',
      featured: { ...FEATURED_DEFAULTS, ...(featured ?? {}) },
      catalog: { banner: mergeBlock(catalog?.banner), mid: mergeBlock(catalog?.mid), promo: mergeBlock(catalog?.promo) },
    };
  }, [copys, featured, catalog]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<string>('destacados');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setF = <K extends keyof Featured>(k: K, v: Featured[K]) => setConfig((c) => ({ ...c, featured: { ...c.featured, [k]: v } }));
  const setBlock = (which: 'banner' | 'mid' | 'promo', patch: Partial<CtaBlock>) =>
    setConfig((c) => ({ ...c, catalog: { ...c.catalog, [which]: { ...c.catalog[which], ...patch } } }));

  const f = config.featured;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}), ...copysDestacados(config) };
      const body = { tokens: { ...tokens, featured: config.featured, catalog: config.catalog }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { featured: config.featured, catalog: config.catalog }, copys: copysDestacados(config) }), [config]);

  return (
    <div>
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 3 · Productos"
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ marginBottom: 18 }}>
            <Segmented
              ariaLabel="Qué editar"
              value={tab}
              onChange={setTab}
              items={TABS.map((tt) => ({ key: tt.id, label: tt.label }))}
            />
          </div>

          {/* DESTACADOS */}
          {tab === 'destacados' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <p style={intro}>
                <span style={introTitle}>Los productos salen del catálogo.</span> Se muestran los destacados (o los más recientes). Aquí defines textos y estilo de la sección del home.
              </p>

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos</h3>
                <Field label="Eyebrow"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Nuestra maquinaria" style={inputStyle} /></Field>
                <Field label="Título (última palabra en acento)"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Equipo destacado y disponible" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Maquinaria certificada…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Texto de «Todos»"><input value={config.allLabel} onChange={(e) => set('allLabel', e.target.value)} placeholder="Todos" style={inputStyle} /></Field>
                  <Field label="Enlace «Ver todo»"><input value={config.viewAll} onChange={(e) => set('viewAll', e.target.value)} placeholder="Ver todo el catálogo" style={inputStyle} /></Field>
                </div>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div><div className="adm-cell-title" style={{ fontSize: 13.5 }}>Pestañas por categoría</div><div className="adm-cell-sub">Filtra los productos por giro.</div></div>
                  <Toggle on={f.showTabs} onClick={() => setF('showTabs', !f.showTabs)} />
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={smallLabel}>Alineación del encabezado</span>
                  <div>
                    <Segmented<Featured['align']>
                      ariaLabel="Alineación del encabezado"
                      value={f.align}
                      onChange={(k) => setF('align', k)}
                      items={[
                        { key: 'left', label: 'Izquierda' },
                        { key: 'center', label: 'Centrado' },
                      ]}
                    />
                  </div>
                </div>
                <Field label={`Productos a mostrar: ${f.limit}`}><input type="range" min={4} max={16} value={f.limit} onChange={(e) => setF('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                <ColorField label="Color del eyebrow" value={f.eyebrowColor} onChange={(v) => setF('eyebrowColor', v)} />
                <ColorField label="Color del título" value={f.titleColor} onChange={(v) => setF('titleColor', v)} />
              </div>
            </div>
          ) : null}

          {/* CATÁLOGO */}
          {tab === 'catalogo' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <p style={intro}>
                <span style={introTitle}>Página /productos.</span> Tres bandas: un <b>banner</b> arriba, un <b>anuncio</b> en medio y una <b>promo</b> al final. Cada una se prende/apaga.
              </p>
              <BlockEditor label="Banner (arriba)" help="Banda grande al inicio del catálogo." icon="ph-flag-banner" block={config.catalog.banner} onChange={(p) => setBlock('banner', p)} />
              <BlockEditor label="Anuncio intermedio" help="Se muestra entre dos grupos de productos." icon="ph-megaphone-simple" block={config.catalog.mid} onChange={(p) => setBlock('mid', p)} />
              <BlockEditor label="Promo (abajo)" help="Banda al final de la página." icon="ph-tag" block={config.catalog.promo} onChange={(p) => setBlock('promo', p)} />
            </div>
          ) : null}
        </div>

        {/* VISTA PREVIA: el sitio real pinta los destacados (o el catálogo) con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          {tab === 'catalogo' ? (
            <VistaPreviaSitio key="catalogo" vista="pagina.catalogo" etiqueta="catálogo /servicios" borrador={borrador} modoInicial={modoTema} />
          ) : (
            <VistaPreviaSitio key="home" vista="home.featured-products" etiqueta="home" borrador={borrador} modoInicial={modoTema} />
          )}
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
