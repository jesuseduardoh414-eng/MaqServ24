'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Faq, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Btn, PageHeader, PanelLink, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
const FAQ_DEFAULTS: Faq = { show: true, eyebrowColor: null, titleColor: null, accentColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };

interface Config { eyebrow: string; title: string; faq: Faq }

export function FaqEditor({ themeId, copys, tokens, faqCfg, count }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; faqCfg: Faq; sample: string[]; count: number;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'home.faq.eyebrow', 'Resolvemos tus dudas'),
      title: cv(es, 'home.faq.title', 'Preguntas frecuentes'),
      faq: { ...FAQ_DEFAULTS, ...(faqCfg ?? {}) },
    };
  }, [copys, faqCfg]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setF = <K extends keyof Faq>(k: K, v: Faq[K]) => setConfig((c) => ({ ...c, faq: { ...c.faq, [k]: v } }));
  const f = config.faq;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { faq: config.faq }, copys: { 'home.faq.eyebrow': config.eyebrow, 'home.faq.title': config.title } }), [config]);


  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.faq.eyebrow'] = config.eyebrow;
      es['home.faq.title'] = config.title;
      const body = { tokens: { ...tokens, faq: config.faq }, copys: { ...copys, es } };
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
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 8 · Preguntas frecuentes"
        subtitle={
          <>
            La banda de preguntas frecuentes del home. Aquí defines los textos y el estilo. Las preguntas las hacen los <b>clientes</b>; destaca las que quieras que salgan aquí en <b>Clientes → Preguntas</b>. Hay <b className="adm-num">{count}</b> destacada(s).{' '}
            <PanelLink href="/preguntas">Destacar preguntas</PanelLink>
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
            <Toggle on={f.show} onClick={() => setF('show', !f.show)} />
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Textos</h3>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Resolvemos tus dudas" style={inputStyle} /></Field>
            <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Preguntas frecuentes" style={inputStyle} /></Field>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
            <h3 style={h3Style}>Colores</h3>
            <ColorField label="Color del eyebrow" value={f.eyebrowColor} onChange={(v) => setF('eyebrowColor', v)} />
            <ColorField label="Color del título" value={f.titleColor} onChange={(v) => setF('titleColor', v)} />
            <ColorField label="Acento (signo + de cada pregunta)" value={f.accentColor} onChange={(v) => setF('accentColor', v)} />
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.faq" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!f.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : null} />
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
