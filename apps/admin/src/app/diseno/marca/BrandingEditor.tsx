'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Note, PageHeader, Panel, btnClass } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

type Branding = Record<string, string | null>;

const SLOTS: Array<{ slot: string; label: string; hint: string; dark?: boolean }> = [
  { slot: 'logoLight', label: 'Logo — modo claro', hint: 'Para fondos claros (cabecera). PNG con fondo transparente.' },
  { slot: 'logoDark', label: 'Logo — modo oscuro', hint: 'Versión clara del logo, para fondos oscuros / modo oscuro.', dark: true },
  { slot: 'favicon', label: 'Favicon', hint: 'Ícono de la pestaña del navegador. PNG/ICO/SVG cuadrado (32×32+).' },
  { slot: 'icon', label: 'Isotipo / ícono de app', hint: 'Símbolo cuadrado sin texto (apple-touch-icon).', dark: true },
  { slot: 'logoAlt', label: 'Logo alterno', hint: 'Otra variación (horizontal, monocromo, etc.).' },
];

const GRID = '132px minmax(0,1fr) auto';

/** Módulo de identidad de marca: sube/gestiona logos y favicon del tema activo. */
export function BrandingEditor({ initial }: { initial: Branding }) {
  const router = useRouter();
  const [branding, setBranding] = useState<Branding>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(slot: string, fd: FormData) {
    setBusy(slot);
    setMsg(null);
    try {
      fd.set('slot', slot);
      const res = await fetch('/api/admin/cms/branding', { method: 'PATCH', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'No se pudo guardar');
      if (data?.branding) setBranding(data.branding);
      setMsg({ ok: true, text: 'Guardado ✓ — refresca el sitio para verlo' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function onUpload(slot: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('asset', file);
    void send(slot, fd);
    e.target.value = '';
  }

  async function onClear(slot: string, label: string) {
    if (!(await confirmar({ titulo: `¿Quitar «${label}»?`, mensaje: 'El sitio vuelve a usar la versión anterior o la de respaldo.', confirmar: 'Quitar', peligro: true }))) return;
    const fd = new FormData();
    fd.set('clear', 'true');
    void send(slot, fd);
  }

  return (
    <div>
      <style>{`
        .brand-row { display: grid; grid-template-columns: ${GRID}; gap: 18px; align-items: center; }
        /* En móvil la muestra va arriba a todo lo ancho y las acciones abajo. */
        @media (max-width: 640px) {
          .brand-row { grid-template-columns: 1fr; gap: 12px; }
          .brand-row > .brand-c-actions { justify-content: flex-start; }
        }
      `}</style>

      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Identidad de marca"
        subtitle="Logos y favicon del sitio. Se aplican al instante (refresca el sitio con F5). Formatos: PNG, JPG, WebP, SVG o ICO."
      />

      {msg ? (
        <div role={msg.ok ? 'status' : 'alert'} style={{ marginBottom: 16 }}>
          <Note tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</Note>
        </div>
      ) : null}

      {/* Una fila por variante del logo: muestra, qué es y sus acciones. */}
      <Panel flush clip>
        {SLOTS.map(({ slot, label, hint, dark }) => {
          const url = branding[slot] ?? null;
          return (
            <div key={slot} className="adm-trow brand-row">
              {/* Muestra sobre el fondo donde se usa (oscuro para logos de modo oscuro/ícono). */}
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: 72,
                  borderRadius: 8,
                  border: '1px solid var(--adm-border)',
                  background: dark ? '#1A1A1B' : 'var(--color-bg)',
                  padding: 10,
                }}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: 52, objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: dark ? 'rgba(255,255,255,.5)' : 'var(--color-text-muted)', fontSize: 12.5 }}>Sin imagen</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">{label}</div>
                <div className="adm-cell-sub" style={{ lineHeight: 1.45 }}>{hint}</div>
              </div>

              <div className="brand-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {url ? <Btn size="sm" variant="ghost" onClick={() => onClear(slot, label)} disabled={busy === slot}>Quitar</Btn> : null}
                <label
                  className={btnClass('secondary', 'sm')}
                  aria-disabled={busy === slot}
                  style={{ cursor: busy === slot ? 'default' : 'pointer' }}
                >
                  <i className="ph ph-upload-simple" aria-hidden />
                  {busy === slot ? 'Subiendo…' : url ? 'Reemplazar' : 'Subir imagen'}
                  <input type="file" accept="image/*,.ico,.svg" onChange={(e) => onUpload(slot, e)} disabled={busy === slot} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
