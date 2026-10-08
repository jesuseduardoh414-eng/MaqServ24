'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Reviews, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Btn, PageHeader, PanelLink, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
interface Sample { id: number; author: string; rating: number; review: string }
const REV_DEFAULTS: Reviews = { show: true, limit: 8, eyebrowColor: null, titleColor: null, accentColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };

interface Config { eyebrow: string; title: string; role: string; rev: Reviews }

export function ReviewsEditor({ themeId, copys, tokens, reviewsCfg, approvedCount, totalCount }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; reviewsCfg: Reviews; approvedCount: number; totalCount: number; sample: Sample[];
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'home.reviews.eyebrow', 'Opiniones verificadas'),
      title: cv(es, 'home.reviews.title', 'Lo que dicen nuestros clientes'),
      role: cv(es, 'home.reviews.role', 'Cliente verificado'),
      rev: { ...REV_DEFAULTS, ...(reviewsCfg ?? {}) },
    };
  }, [copys, reviewsCfg]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setR = <K extends keyof Reviews>(k: K, v: Reviews[K]) => setConfig((c) => ({ ...c, rev: { ...c.rev, [k]: v } }));
  const r = config.rev;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { reviews: config.rev }, copys: { 'home.reviews.eyebrow': config.eyebrow, 'home.reviews.title': config.title, 'home.reviews.role': config.role } }), [config]);



  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.reviews.eyebrow'] = config.eyebrow;
      es['home.reviews.title'] = config.title;
      es['home.reviews.role'] = config.role;
      const body = { tokens: { ...tokens, reviews: config.rev }, copys: { ...copys, es } };
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
      {/* Nota: el contenido son reseñas de clientes; se moderan aparte */}
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 7 · Reseñas"
        subtitle={
          <>
            La banda «Lo que dicen nuestros clientes». Las <b>reseñas</b> las escriben los clientes; tú las <b>apruebas/ocultas</b> en Clientes → Reseñas. Aquí defines los textos y el estilo de la banda. <b className="adm-num">{approvedCount}</b> aprobadas de <b className="adm-num">{totalCount}</b>.{' '}
            <PanelLink href="/resenas">Moderar reseñas</PanelLink>
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
          <div style={showRow}>
            <div style={{ minWidth: 0 }}>
              <div className="adm-cell-title">Mostrar la sección en el home</div>
              <div className="adm-cell-sub">Apágala para ocultarla temporalmente.</div>
            </div>
            <Toggle on={r.show} onClick={() => setR('show', !r.show)} />
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Textos</h3>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Opiniones verificadas" style={inputStyle} /></Field>
            <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Lo que dicen nuestros clientes" style={inputStyle} /></Field>
            <Field label="Etiqueta bajo cada nombre"><input value={config.role} onChange={(e) => set('role', e.target.value)} placeholder="Cliente verificado" style={inputStyle} /></Field>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
            <h3 style={h3Style}>Estilo</h3>
            <Field label={`Reseñas a mostrar: ${r.limit}`}><input type="range" min={3} max={20} value={r.limit} onChange={(e) => setR('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
            <ColorField label="Color del eyebrow" value={r.eyebrowColor} onChange={(v) => setR('eyebrowColor', v)} />
            <ColorField label="Color del título" value={r.titleColor} onChange={(v) => setR('titleColor', v)} />
            <ColorField label="Acento (estrellas y comillas)" value={r.accentColor} onChange={(v) => setR('accentColor', v)} />
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.reviews" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!r.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : approvedCount === 0 ? <>No hay reseñas aprobadas aún: la sección no sale hasta que apruebes al menos una.</> : null} />
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
