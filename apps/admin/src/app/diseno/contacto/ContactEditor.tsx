'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

const iconBtn: React.CSSProperties = { border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.muted2, borderRadius: 9, width: 34, height: 34, cursor: 'pointer', display: 'inline-grid', placeItems: 'center', flexShrink: 0, fontFamily: 'inherit' };
const addBtn: React.CSSProperties = { border: `1px dashed ${D.inputBorder}`, background: 'transparent', color: D.amber, borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 };

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
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-address-book" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Contacto</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Contacto</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, maxWidth: 900 }}>
        {/* Encabezado */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <h3 style={h3Style}>Encabezado</h3>
          <Field label="Eyebrow (línea pequeña)"><input value={config.eyebrow} onChange={(e) => setC({ eyebrow: e.target.value })} style={inputStyle} placeholder="Atención a clientes" /></Field>
          <Field label="Título (la última palabra se resalta en ámbar)"><input value={config.title} onChange={(e) => setC({ title: e.target.value })} style={inputStyle} placeholder="Hablemos de tu obra" /></Field>
          <Field label="Descripción"><textarea value={config.subtitle} onChange={(e) => setC({ subtitle: e.target.value })} rows={2} style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
        </div>

        {/* Stats */}
        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Indicadores (arriba a la derecha)</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Ej. valor "&lt;24h" · etiqueta "Tiempo de respuesta".</p></div>
          {config.stats.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center' }}>
              <input value={s.value} onChange={(e) => setC({ stats: config.stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="<24h" />
              <input value={s.label} onChange={(e) => setC({ stats: config.stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="Tiempo de respuesta" />
              <button type="button" onClick={() => setC({ stats: config.stats.filter((_, j) => j !== i) })} style={iconBtn} title="Quitar"><i className="ph ph-trash" /></button>
            </div>
          ))}
          <div><button type="button" onClick={() => setC({ stats: [...config.stats, { value: '', label: '' }] })} style={addBtn}><i className="ph ph-plus" /> Agregar indicador</button></div>
        </div>

        {/* Canales */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Canales de contacto</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Se muestran aquí, en la <b>barra superior</b> y sirven para los enlaces de llamada/WhatsApp.</p></div>
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
          <div><h3 style={h3Style}>Opciones del formulario ("¿En qué te ayudamos?")</h3></div>
          {config.needs.map((n, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <input value={n} onChange={(e) => setC({ needs: config.needs.map((x, j) => j === i ? e.target.value : x) })} style={{ ...inputStyle, height: 42 }} placeholder="Rentar equipo" />
              <button type="button" onClick={() => setC({ needs: config.needs.filter((_, j) => j !== i) })} style={iconBtn} title="Quitar"><i className="ph ph-trash" /></button>
            </div>
          ))}
          <div><button type="button" onClick={() => setC({ needs: [...config.needs, ''] })} style={addBtn}><i className="ph ph-plus" /> Agregar opción</button></div>
        </div>

        {/* Renta urgente */}
        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><h3 style={h3Style}>Tarjeta "Renta urgente"</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Bloque oscuro con llamado a la acción.</p></div>
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
          <div><h3 style={h3Style}>Sucursales</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Cobertura mostrada al pie de la página de contacto.</p></div>
          {config.branches.map((b, i) => (
            <div key={i} style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                <input value={b.city} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, city: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="Ciudad" />
                <input value={b.phone} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, phone: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="Teléfono" />
                <button type="button" onClick={() => setC({ branches: config.branches.filter((_, j) => j !== i) })} style={iconBtn} title="Quitar sucursal"><i className="ph ph-trash" /></button>
              </div>
              <input value={b.address} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, address: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="Dirección" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {b.image ? (
                  <div style={{ width: 108, height: 64, borderRadius: 8, overflow: 'hidden', border: `1px solid ${D.inputBorder}`, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: 108, height: 64, borderRadius: 8, border: `1px dashed ${D.inputBorder}`, display: 'grid', placeItems: 'center', color: D.muted, flexShrink: 0 }}><i className="ph ph-map-trifold" style={{ fontSize: 20 }} /></div>
                )}
                <label style={{ border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.text, borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <i className="ph ph-upload-simple" style={{ fontSize: 15 }} /> {uploadingIdx === i ? 'Subiendo…' : b.image ? 'Cambiar imagen' : 'Subir imagen'}
                  <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBranch(i, file); e.target.value = ''; }} style={{ display: 'none' }} />
                </label>
                {b.image ? (
                  <button type="button" onClick={() => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, image: null } : x) })} style={{ background: 'none', border: 'none', color: D.muted2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="ph ph-x" /> Quitar</button>
                ) : null}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: D.muted2, cursor: 'pointer' }}>
                <input type="checkbox" checked={b.isNew} onChange={(e) => setC({ branches: config.branches.map((x, j) => j === i ? { ...x, isNew: e.target.checked } : x) })} /> Marcar como "NUEVA"
              </label>
            </div>
          ))}
          <div><button type="button" onClick={() => setC({ branches: [...config.branches, { city: '', address: '', phone: '', image: null, isNew: false }] })} style={addBtn}><i className="ph ph-plus" /> Agregar sucursal</button></div>
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
