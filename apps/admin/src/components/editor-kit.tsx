'use client';

import { useState, type ReactNode, type CSSProperties } from 'react';
import type { CtaBlock } from '@maqserv/config';
import { D, FONT, PRESETS } from './design-tokens';

/**
 * La paleta vive en `design-tokens` (módulo sin 'use client') para que también la
 * puedan leer los componentes de SERVIDOR. Se reexporta aquí por compatibilidad:
 * los editores la venían importando de este archivo.
 */
export { D, FONT, PRESETS };

export const cardStyle: CSSProperties = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, padding: 24, marginBottom: 18 };
export const inputStyle: CSSProperties = { width: '100%', height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${D.inputBorder}`, background: D.inputBg, color: D.text, fontFamily: 'inherit', fontSize: '14.5px', outline: 'none' };
export const h3Style: CSSProperties = { margin: 0, fontSize: '15.5px', fontWeight: 700, color: D.text };
export const smallLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: D.muted2 };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 7 }}><span style={smallLabel}>{label}</span>{children}</label>;
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ position: 'relative', width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? D.amber : 'rgba(255,255,255,0.12)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const isTheme = value === null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={smallLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onChange(null)} title="Heredar del tema" style={{ height: 32, padding: '0 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: isTheme ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent', color: isTheme ? D.amber : D.muted2, border: `2px solid ${isTheme ? D.amber : 'rgba(255,255,255,0.12)'}` }}>Tema</button>
        {PRESETS.map((col) => {
          const sel = !isTheme && col.toLowerCase() === (value ?? '').toLowerCase();
          return <button key={col} type="button" onClick={() => onChange(col)} title={col} style={{ width: 32, height: 32, borderRadius: 9, background: col, cursor: 'pointer', padding: 0, border: sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none' }} />;
        })}
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, border: '2px dashed rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }} title="Personalizado">
          <i className="ph ph-eyedropper" style={{ fontSize: 13, color: D.muted2 }} />
          <input type="color" value={value ?? '#008CFF'} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
        <code style={{ fontSize: 12, color: D.text }}>{isTheme ? 'del tema' : value}</code>
      </div>
    </div>
  );
}

/**
 * Editor de un bloque CTA (banner/hero/promo): toggle + textos + botón + colores
 * + subida de imagen (arrastrar o clic → POST /admin/cms/upload). Auto-contenido:
 * el padre pasa el `block` y recibe `onChange(patch)`.
 */
export function BlockEditor({ label, help, icon, block, onChange }: {
  label: string; help: string; icon: string; block: CtaBlock; onChange: (patch: Partial<CtaBlock>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) { setErr('Usa una imagen (PNG, JPG, WebP…)'); return; }
    setUploading(true); setErr(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      onChange({ image: d.url as string });
    } catch (e) { setErr((e as Error).message); } finally { setUploading(false); }
  }

  return (
    <div style={{ ...cardStyle, display: 'grid', gap: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className={`ph ${icon}`} style={{ fontSize: 19 }} /></div>
          <div style={{ minWidth: 0 }}><h3 style={h3Style}>{label}</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>{help}</p></div>
        </div>
        <Toggle on={block.enabled} onClick={() => onChange({ enabled: !block.enabled })} />
      </div>
      {block.enabled ? (
        <div style={{ display: 'grid', gap: 15, animation: 'fadeIn .2s ease' }}>
          <Field label="Eyebrow (línea pequeña arriba)"><input value={block.eyebrow} onChange={(e) => onChange({ eyebrow: e.target.value })} placeholder="Catálogo completo" style={inputStyle} /></Field>
          <Field label="Título"><input value={block.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Todo el equipo, en un solo lugar" style={inputStyle} /></Field>
          <Field label="Subtítulo"><textarea value={block.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} rows={2} placeholder="Descripción breve…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Texto del botón (vacío = sin botón)"><input value={block.cta} onChange={(e) => onChange({ cta: e.target.value })} placeholder="Ver ofertas" style={inputStyle} /></Field>
            <Field label="Enlace del botón"><input value={block.ctaLink} onChange={(e) => onChange({ ctaLink: e.target.value })} placeholder="/productos" style={inputStyle} /></Field>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={smallLabel}>Imagen de fondo (a sangre en la banda)</span>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
              style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: block.image ? 150 : 108, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: block.image ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
            >
              {block.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={block.image} alt="" style={{ maxHeight: 128, maxWidth: '100%', objectFit: 'contain' }} />
                  <button type="button" onClick={(e) => { e.preventDefault(); onChange({ image: null }); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: D.muted2, fontSize: 13 }}>
                  <i className="ph ph-image" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                  {uploading ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
            {err ? <span style={{ fontSize: 12, color: '#f87171' }}>{err}</span> : null}
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <ColorField label="Fondo de la banda" value={block.bg} onChange={(v) => onChange({ bg: v })} />
            <ColorField label="Color del texto" value={block.textColor} onChange={(v) => onChange({ textColor: v })} />
            <ColorField label="Acento (botón/detalles)" value={block.accentColor} onChange={(v) => onChange({ accentColor: v })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
