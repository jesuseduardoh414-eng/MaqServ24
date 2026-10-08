'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { useRouter } from 'next/navigation';
import type { CategoriesSettings, CategoriesView, CtaBlock, ThemeTokens } from '@maqserv/config';
import { D, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle } from '@/components/editor-kit';
import { Btn, PageHeader, PanelLink, Segmented, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
interface Cat { id: number; name: string; slug: string; image: string | null; productCount: number }

interface Config extends CategoriesSettings {
  eyebrow: string; title: string; unit: string; subtitle: string; viewAll: string;
  view: CategoriesView;
  pageEyebrow: string; pageTitle: string; pageSubtitle: string;
}

/* Colores sugeridos para el SITIO (no son del panel): se quedan tal cual. */
const PRESETS = ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#b98cff', '#ffffff', '#c2c6cf'];

/** Descripción bajo el título de cada bloque. */
const desc: CSSProperties = { margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' };
/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };

// Defaults defensivos: si el @maqserv/config del admin quedó viejo, `view`/`settings`
// pueden llegar undefined (zod los descarta). Así el editor nunca crashea.
const BLOCK_DEFAULTS: CtaBlock = { enabled: false, eyebrow: '', title: '', subtitle: '', cta: '', ctaLink: '/productos', image: null, bg: null, textColor: null, accentColor: null };
const VIEW_DEFAULTS: CategoriesView = { columns: 3, cardRadius: '8px', imageHeight: 300, eyebrowColor: null, titleColor: null, cardAccentColor: null, featuredSlug: null, hero: { ...BLOCK_DEFAULTS }, promo: { ...BLOCK_DEFAULTS } };
const SETTINGS_DEFAULTS: CategoriesSettings = { show: true, perView: 4, cardRadius: '8px', imageHeight: 260, eyebrowColor: null, titleColor: null, cardAccentColor: null };

function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const isTheme = value === null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={smallLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Mismo aspecto que el ColorField de editor-kit; aquí solo cambian los colores sugeridos. */}
        <button type="button" onClick={() => onChange(null)} title="Heredar del tema" style={{ height: 32, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: isTheme ? 'color-mix(in srgb, var(--adm-accent) 16%, transparent)' : 'transparent', color: isTheme ? 'var(--adm-accent)' : 'var(--adm-muted)', border: `2px solid ${isTheme ? 'var(--adm-accent)' : 'rgba(255,255,255,0.12)'}` }}>Tema</button>
        {PRESETS.map((col) => {
          const sel = !isTheme && col.toLowerCase() === (value ?? '').toLowerCase();
          return <button key={col} type="button" onClick={() => onChange(col)} title={col} style={{ width: 32, height: 32, borderRadius: 8, background: col, cursor: 'pointer', padding: 0, border: sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none' }} />;
        })}
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 8, border: '2px dashed rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }} title="Personalizado">
          <i className="ph ph-eyedropper" style={{ fontSize: 13, color: 'var(--adm-muted)' }} />
          <input type="color" value={value ?? '#008CFF'} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
        <code className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-text-2)' }}>{isTheme ? 'del tema' : value}</code>
      </div>
    </div>
  );
}

/** Ajustes de la sección en el tema. Los usan «Guardar y publicar» y la vista previa. */
function ajustesCategorias(c: Config): CategoriesSettings {
  return { show: c.show, perView: c.perView, cardRadius: c.cardRadius, imageHeight: c.imageHeight, eyebrowColor: c.eyebrowColor, titleColor: c.titleColor, cardAccentColor: c.cardAccentColor };
}

/** Copys del home y de la página /categorias. */
function copysCategorias(c: Config): Record<string, string> {
  return {
    'home.categories.eyebrow': c.eyebrow, 'home.categories.title': c.title, 'home.categories.unit': c.unit,
    'home.categories.subtitle': c.subtitle, 'home.categories.viewAll': c.viewAll,
    'home.categoriesPage.eyebrow': c.pageEyebrow, 'home.categoriesPage.title': c.pageTitle, 'home.categoriesPage.subtitle': c.pageSubtitle,
  };
}

const TABS = [
  { id: 'contenido', label: 'Home · Textos' },
  { id: 'estilos', label: 'Home · Estilos' },
  { id: 'vista', label: 'Vista de categorías' },
] as const;

export function CategoriesEditor({
  themeId, copys, tokens, settings, view, categories,
}: { themeId: number | null; copys: Copys; tokens: ThemeTokens; settings: CategoriesSettings; view: CategoriesView; categories: Cat[] }) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      ...SETTINGS_DEFAULTS, ...(settings ?? {}),
      eyebrow: es['home.categories.eyebrow'] ?? '', title: es['home.categories.title'] ?? '', unit: es['home.categories.unit'] ?? '',
      subtitle: es['home.categories.subtitle'] ?? '', viewAll: es['home.categories.viewAll'] ?? '',
      view: { ...VIEW_DEFAULTS, ...(view ?? {}), hero: { ...BLOCK_DEFAULTS, ...((view ?? {}).hero ?? {}) }, promo: { ...BLOCK_DEFAULTS, ...((view ?? {}).promo ?? {}) } },
      pageEyebrow: es['home.categoriesPage.eyebrow'] ?? '', pageTitle: es['home.categoriesPage.title'] ?? '', pageSubtitle: es['home.categoriesPage.subtitle'] ?? '',
    };
  }, [copys, settings, view]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<string>('contenido');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setV = <K extends keyof CategoriesView>(k: K, v: CategoriesView[K]) => setConfig((c) => ({ ...c, view: { ...VIEW_DEFAULTS, ...(c.view ?? {}), [k]: v } }));
  const setBlock = <K extends keyof CtaBlock>(which: 'hero' | 'promo', k: K, v: CtaBlock[K]) =>
    setConfig((c) => ({ ...c, view: { ...VIEW_DEFAULTS, ...(c.view ?? {}), [which]: { ...BLOCK_DEFAULTS, ...((c.view ?? {})[which] ?? {}), [k]: v } } }));
  const cv: CategoriesView = config.view ?? VIEW_DEFAULTS;
  const [uploading, setUploading] = useState<'hero' | 'promo' | null>(null);
  async function uploadImage(which: 'hero' | 'promo', file: File) {
    if (!file.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setUploading(which); setToast(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setBlock(which, 'image', d.url as string);
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setUploading(null); }
  }
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}), ...copysCategorias(config) };
      const nextCat = ajustesCategorias(config);
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: { ...tokens, categories: nextCat, categoriesView: cv }, copys: { ...copys, es } }) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const isVista = tab === 'vista';
  const step = categories.length % config.perView === 0 ? config.perView : 1;
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(
    () => ({ tokens: { categories: ajustesCategorias(config), categoriesView: config.view ?? VIEW_DEFAULTS }, copys: copysCategorias(config) }),
    [config],
  );
  const heroB: CtaBlock = { ...BLOCK_DEFAULTS, ...(cv.hero ?? {}) };
  const promoB: CtaBlock = { ...BLOCK_DEFAULTS, ...(cv.promo ?? {}) };

  const renderBlock = (which: 'hero' | 'promo', label: string, help: string, icon: string) => {
    const b: CtaBlock = which === 'hero' ? heroB : promoB;
    return (
      <div style={{ ...cardStyle, display: 'grid', gap: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <i className={`ph ${icon}`} style={{ fontSize: 18, color: 'var(--adm-muted)', flexShrink: 0 }} aria-hidden />
            <div style={{ minWidth: 0 }}><h3 style={h3Style}>{label}</h3><p style={desc}>{help}</p></div>
          </div>
          <Toggle on={b.enabled} onClick={() => setBlock(which, 'enabled', !b.enabled)} />
        </div>
        {b.enabled ? (
          <div style={{ display: 'grid', gap: 15, animation: 'fadeIn .2s ease' }}>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={b.eyebrow} onChange={(e) => setBlock(which, 'eyebrow', e.target.value)} placeholder="Catálogo de equipos" style={inputStyle} /></Field>
            <Field label="Título"><input value={b.title} onChange={(e) => setBlock(which, 'title', e.target.value)} placeholder="Renta de maquinaria pesada" style={inputStyle} /></Field>
            <Field label="Subtítulo"><textarea value={b.subtitle} onChange={(e) => setBlock(which, 'subtitle', e.target.value)} rows={2} placeholder="Descripción breve…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Texto del botón (vacío = sin botón)"><input value={b.cta} onChange={(e) => setBlock(which, 'cta', e.target.value)} placeholder="Ver catálogo" style={inputStyle} /></Field>
              <Field label="Enlace del botón"><input value={b.ctaLink} onChange={(e) => setBlock(which, 'ctaLink', e.target.value)} placeholder="/productos" style={inputStyle} /></Field>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={smallLabel}>Imagen (opcional, se muestra a la derecha)</span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadImage(which, f); }}
                style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: b.image ? 150 : 108, border: '1.5px dashed var(--adm-border-strong)', borderRadius: 12, background: b.image ? 'var(--adm-page)' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
              >
                {b.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image} alt="" style={{ maxHeight: 128, maxWidth: '100%', objectFit: 'contain' }} />
                    <button type="button" onClick={(e) => { e.preventDefault(); setBlock(which, 'image', null); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--adm-muted)', fontSize: 13 }}>
                    <i className="ph ph-image" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                    {uploading === which ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(which, f); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <ColorField label="Fondo de la banda" value={b.bg} onChange={(v) => setBlock(which, 'bg', v)} />
              <ColorField label="Color del texto" value={b.textColor} onChange={(v) => setBlock(which, 'textColor', v)} />
              <ColorField label="Acento (botón/detalles)" value={b.accentColor} onChange={(v) => setBlock(which, 'accentColor', v)} />
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      {/* Nota de contenido: el texto que iba en una tarjeta aparte ahora es el subtítulo. */}
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 2 · Categorías"
        subtitle={
          <>
            El contenido son las categorías de productos: <b className="adm-num">{categories.length}</b> categorías. Nombres e imágenes se administran en el catálogo. Aquí defines los estilos del <b>home</b> y de la <b>vista completa</b>.{' '}
            <PanelLink href="/categorias">Administrar</PanelLink>
          </>
        }
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

          {/* HOME · TEXTOS */}
          {tab === 'contenido' ? (
            <div style={{ ...cardStyle, display: 'grid', gap: 16, animation: 'fadeIn .25s ease' }}>
              <h3 style={h3Style}>Textos del adelanto en el home</h3>
              <Field label="Eyebrow"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Explora el catálogo" style={inputStyle} /></Field>
              <Field label="Título (última palabra en color de acento)"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Categorías de equipos" style={inputStyle} /></Field>
              <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Maquinaria pesada lista para tu obra…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Enlace «Ver todas» (vacío = ocultar)"><input value={config.viewAll} onChange={(e) => set('viewAll', e.target.value)} placeholder="Ver todas las categorías" style={inputStyle} /></Field>
                <Field label="Palabra del conteo"><input value={config.unit} onChange={(e) => set('unit', e.target.value)} placeholder="equipos" style={inputStyle} /></Field>
              </div>
            </div>
          ) : null}

          {/* HOME · ESTILOS */}
          {tab === 'estilos' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={showRow}>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title">Mostrar el adelanto en el home</div>
                  <div className="adm-cell-sub">Ocúltalo si este giro no usa categorías en el home.</div>
                </div>
                <Toggle on={config.show} onClick={() => set('show', !config.show)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Colores (solo el home)</h3>
                <ColorField label="Color del eyebrow" value={config.eyebrowColor} onChange={(v) => set('eyebrowColor', v)} />
                <ColorField label="Color del título" value={config.titleColor} onChange={(v) => set('titleColor', v)} />
                <ColorField label="Acento (flecha/etiqueta)" value={config.cardAccentColor} onChange={(v) => set('cardAccentColor', v)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo de tarjeta (home)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label={`Tarjetas por vista: ${config.perView}`}><input type="range" min={2} max={6} value={config.perView} onChange={(e) => set('perView', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                  <Field label={`Alto de imagen: ${config.imageHeight}px`}><input type="range" min={140} max={320} step={10} value={config.imageHeight} onChange={(e) => set('imageHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                </div>
                <Field label="Radio de esquinas"><input value={config.cardRadius} onChange={(e) => set('cardRadius', e.target.value)} placeholder="18px" style={{ ...inputStyle, maxWidth: 160 }} /></Field>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>Avance del carrusel: {step === config.perView ? `de ${config.perView} en ${config.perView}` : 'de 1 en 1'} (según si el total ({categories.length}) es múltiplo de {config.perView}).</p>
              </div>
            </div>
          ) : null}

          {/* VISTA DE CATEGORÍAS */}
          {tab === 'vista' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              {renderBlock('hero', 'Hero superior', 'Banda grande al inicio de la página (título, botón e imagen).', 'ph-flag-banner')}

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos de la página /categorias</h3>
                <Field label="Eyebrow"><input value={config.pageEyebrow} onChange={(e) => set('pageEyebrow', e.target.value)} placeholder="Catálogo" style={inputStyle} /></Field>
                <Field label="Título (última palabra en acento)"><input value={config.pageTitle} onChange={(e) => set('pageTitle', e.target.value)} placeholder="Todas las categorías" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.pageSubtitle} onChange={(e) => set('pageSubtitle', e.target.value)} rows={2} placeholder="Explora nuestra maquinaria por categoría…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                <div><h3 style={h3Style}>Categoría destacada</h3><p style={desc}>Se muestra grande arriba de la página. Deja «Ninguna» para solo el grid.</p></div>
                <div style={{ maxWidth: 320 }}>
                  <AdminSelect
                    ariaLabel="Categoría destacada"
                    value={cv.featuredSlug ?? ''}
                    onChange={(v) => setV('featuredSlug', v || null)}
                    options={[{ value: '', label: 'Ninguna' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
                  />
                </div>
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Colores de la página</h3>
                <ColorField label="Color del eyebrow" value={cv.eyebrowColor} onChange={(v) => setV('eyebrowColor', v)} />
                <ColorField label="Color del título" value={cv.titleColor} onChange={(v) => setV('titleColor', v)} />
                <ColorField label="Acento (etiqueta/destacada)" value={cv.cardAccentColor} onChange={(v) => setV('cardAccentColor', v)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo del grid</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label={`Columnas: ${cv.columns}`}><input type="range" min={2} max={5} value={cv.columns} onChange={(e) => setV('columns', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                  <Field label={`Alto de imagen: ${cv.imageHeight}px`}><input type="range" min={140} max={360} step={10} value={cv.imageHeight} onChange={(e) => setV('imageHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                </div>
                <Field label="Radio de esquinas"><input value={cv.cardRadius} onChange={(e) => setV('cardRadius', e.target.value)} placeholder="18px" style={{ ...inputStyle, maxWidth: 160 }} /></Field>
              </div>

              {renderBlock('promo', 'Anuncio / Promo (abajo)', 'Banda al final de la página, ideal para una llamada a cotizar o destacar algo.', 'ph-megaphone-simple')}
            </div>
          ) : null}
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección (o /categorias) con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          {isVista ? (
            <VistaPreviaSitio key="pagina" vista="pagina.categorias" etiqueta="página /categorias" borrador={borrador} modoInicial={modoTema} />
          ) : (
            <VistaPreviaSitio key="home" vista="home.categories" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!config.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : null} />
          )}
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
