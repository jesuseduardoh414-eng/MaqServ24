'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, ThemeTokens } from '@maqserv/config';
import { cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';
import { Btn, IconBtn, PageHeader, StatusText, Switch, Toast, btnClass } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;

/** Descripción bajo el título de cada bloque. */
const desc: CSSProperties = { margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' };
/** Sucursal dentro de la lista: separada por una línea fina, sin caja anidada. */
const itemSep: CSSProperties = { display: 'grid', gap: 10, paddingTop: 14, borderTop: '1px solid var(--adm-border)' };

export function ContactEditor({ themeId, copys, tokens, contact }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; contact: Contact;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<Contact>(contact);
  const [saved, setSaved] = useState<Contact>(contact);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  async function uploadBranch(i: number, file: File) {
    if (!file.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setUploadingIdx(i);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setConfig((c) => ({ ...c, branches: c.branches.map((x, j) => j === i ? { ...x, image: d.url as string } : x) }));
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setUploadingIdx(null); }
  }

  const setC = (patch: Partial<Contact>) => setConfig((c) => ({ ...c, ...patch }));
  const setU = (patch: Partial<Contact['urgent']>) => setConfig((c) => ({ ...c, urgent: { ...c.urgent, ...patch } }));

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, contact: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los cambios');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — se verá al refrescar el sitio.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Contacto"
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy || !dirty}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gap: 18, maxWidth: 900 }}>
        {/* Encabezado */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <h3 style={h3Style}>Encabezado</h3>
          <Field label="Eyebrow (línea pequeña)"><input value={config.eyebrow} onChange={(e) => setC({ eyebrow: e.target.value })} style={inputStyle} placeholder="Atención a clientes" /></Field>
          <Field label="Título (la última palabra se resalta en ámbar)"><input value={config.title} onChange={(e) => setC({ title: e.target.value })} style={inputStyle} placeholder="Hablemos de tu obra" /></Field>
          <Field label="Descripción"><textarea value={config.subtitle} onChange={(e) => setC({ subtitle: e.target.value })} rows={2} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
        </div>

        {/* Stats */}
        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Indicadores (arriba a la derecha)</h3><p style={desc}>Ej. valor &quot;&lt;24h&quot; · etiqueta &quot;Tiempo de respuesta&quot;.</p></div>
          {config.stats.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center' }}>
              <input value={s.value} onChange={(e) => setC({ stats: config.stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} style={inputStyle} placeholder="<24h" />
              <input value={s.label} onChange={(e) => setC({ stats: config.stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={inputStyle} placeholder="Tiempo de respuesta" />
              <IconBtn icon="ph-trash" label="Quitar" danger onClick={() => setC({ stats: config.stats.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <div><Btn size="sm" icon="ph-plus" onClick={() => setC({ stats: [...config.stats, { value: '', label: '' }] })}>Agregar indicador</Btn></div>
        </div>

        {/* Canales */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Canales de contacto</h3><p style={desc}>Se muestran aquí, en la <b>barra superior</b> y sirven para los enlaces de llamada/WhatsApp.</p></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Teléfono"><input value={config.phone} onChange={(e) => setC({ phone: e.target.value })} style={inputStyle} placeholder="833 224 56 78" /></Field>
            <Field label="WhatsApp"><input value={config.whatsapp} onChange={(e) => setC({ whatsapp: e.target.value })} style={inputStyle} placeholder="833 224 56 78" /></Field>
            <Field label="Correo"><input value={config.email} onChange={(e) => setC({ email: e.target.value })} style={inputStyle} placeholder="info@maqserv24.com" /></Field>
            <Field label="Horario"><input value={config.hours} onChange={(e) => setC({ hours: e.target.value })} style={inputStyle} placeholder="Lun–Sáb · 8:00–18:00" /></Field>
          </div>
          <Field label="Dirección (origen del cálculo de fletes)"><input value={config.address} onChange={(e) => setC({ address: e.target.value })} style={inputStyle} placeholder="Calle, número, colonia, ciudad, estado" /></Field>
        </div>

        {/* Chips del formulario */}
        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Opciones del formulario (&quot;¿En qué te ayudamos?&quot;)</h3></div>
          {config.needs.map((n, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <input value={n} onChange={(e) => setC({ needs: config.needs.map((x, j) => j === i ? e.target.value : x) })} style={inputStyle} placeholder="Rentar equipo" />
              <IconBtn icon="ph-trash" label="Quitar" danger onClick={() => setC({ needs: config.needs.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <div><Btn size="sm" icon="ph-plus" onClick={() => setC({ needs: [...config.needs, ''] })}>Agregar opción</Btn></div>
        </div>

        {/* Renta urgente */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><h3 style={h3Style}>Tarjeta &quot;Renta urgente&quot;</h3><p style={desc}>Bloque oscuro con llamado a la acción.</p></div>
            <Toggle on={config.urgent.show} onClick={() => setU({ show: !config.urgent.show })} />
          </div>
          {config.urgent.show ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Eyebrow"><input value={config.urgent.eyebrow} onChange={(e) => setU({ eyebrow: e.target.value })} style={inputStyle} placeholder="Renta urgente" /></Field>
              <Field label="Título"><input value={config.urgent.title} onChange={(e) => setU({ title: e.target.value })} style={inputStyle} placeholder="¿Necesitas equipo hoy mismo?" /></Field>
              <Field label="Texto del botón (llama al teléfono)"><input value={config.urgent.ctaLabel} onChange={(e) => setU({ ctaLabel: e.target.value })} style={inputStyle} placeholder="Llamar ahora" /></Field>
            </div>
          ) : null}
        </div>

        {/* Sucursales */}
        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Sucursales</h3><p style={desc}>Cobertura mostrada al pie de la página de contacto.</p></div>
          {config.branches.map((b, i) => (
            <div key={i} style={itemSep}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                <input value={b.city} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, city: e.target.value } : x) })} style={inputStyle} placeholder="Ciudad" />
                <input value={b.phone} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, phone: e.target.value } : x) })} style={inputStyle} placeholder="Teléfono" />
                <IconBtn icon="ph-trash" label="Quitar sucursal" danger onClick={() => setC({ branches: config.branches.filter((_, j) => j !== i) })} />
              </div>
              <input value={b.address} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, address: e.target.value } : x) })} style={inputStyle} placeholder="Dirección" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {b.image ? (
                  <div style={{ width: 108, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--adm-border-strong)', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 108, height: 64, borderRadius: 8, border: '1px dashed var(--adm-border-strong)', display: 'grid', placeItems: 'center', color: 'var(--adm-faint)', flexShrink: 0 }}><i className="ph ph-map-trifold" style={{ fontSize: 20 }} /></div>
                )}
                <label className={btnClass('secondary', 'sm')}>
                  <i className="ph ph-upload-simple" aria-hidden /> {uploadingIdx === i ? 'Subiendo…' : b.image ? 'Cambiar imagen' : 'Subir imagen'}
                  <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBranch(i, file); e.target.value = ''; }} style={{ display: 'none' }} />
                </label>
                {b.image ? (
                  <Btn size="sm" variant="ghost" icon="ph-x" onClick={() => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, image: null } : x) })}>Quitar</Btn>
                ) : null}
              </div>
              <div>
                <Switch on={b.isNew} onClick={() => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, isNew: !b.isNew } : x) })} label='Marcar como "NUEVA"' />
              </div>
            </div>
          ))}
          <div><Btn size="sm" icon="ph-plus" onClick={() => setC({ branches: [...config.branches, { city: '', address: '', phone: '', image: null, isNew: false }] })}>Agregar sucursal</Btn></div>
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
