'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

export interface ServiceItem {
  id: number;
  title: string;
  text: string;
  image: string | null;
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, letterSpacing: '1px', fontWeight: 700,
  color: '#7A7A7F', marginBottom: 7, textTransform: 'uppercase',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 9,
  padding: '10px 12px', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
};
const card: React.CSSProperties = { background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 };

/**
 * CRUD de los servicios que se listan en el home.
 *
 * El contenido vive en la tabla `services`, no en los tokens del tema: por eso este
 * editor guarda directo (sin borrador/publicar) — cada cambio es inmediato, igual
 * que el CRUD que reemplaza.
 */
export function ServicesEditor({ items }: { items: ServiceItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>, id?: number) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    try {
      // multipart: el proxy conserva el boundary y la API recibe la foto.
      const res = await fetch(id ? `/api/admin/cms/services/${id}` : '/api/admin/cms/services', {
        method: id ? 'PATCH' : 'POST',
        body: new FormData(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'No se pudo guardar');
      setEditing(null);
      setCreating(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, title: string) {
    if (!window.confirm(`¿Eliminar “${title}”? Desaparece del home.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/cms/services/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fields = (item?: ServiceItem) => (
    <>
      <div>
        <label style={labelStyle} htmlFor={`t-${item?.id ?? 'new'}`}>Título</label>
        <input id={`t-${item?.id ?? 'new'}`} name="title" required minLength={2} defaultValue={item?.title ?? ''} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle} htmlFor={`x-${item?.id ?? 'new'}`}>Descripción</label>
        <textarea id={`x-${item?.id ?? 'new'}`} name="text" required minLength={2} rows={3} defaultValue={item?.text ?? ''} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }} />
      </div>
      <div>
        <label style={labelStyle} htmlFor={`p-${item?.id ?? 'new'}`}>Ícono / imagen{item ? ' (dejar vacío para conservar la actual)' : ''}</label>
        <input id={`p-${item?.id ?? 'new'}`} type="file" name="photo" accept="image/*" style={{ ...inputStyle, padding: '9px 12px', cursor: 'pointer' }} />
      </div>
    </>
  );

  const actions = (onCancel: () => void, label: string) => (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="submit" disabled={busy} style={{ fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Guardando…' : label}
      </button>
      <button type="button" onClick={onCancel} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: 'transparent', color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 9, padding: '10px 18px', cursor: 'pointer' }}>
        Cancelar
      </button>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{`.sv-btn:hover:not(:disabled){ filter: brightness(1.1); } .sv-ghost:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }`}</style>

      {error ? (
        <p role="alert" style={{ margin: 0, background: 'rgba(255,85,85,0.08)', border: '1px solid rgba(255,85,85,0.3)', color: '#f55', padding: '11px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>{error}</p>
      ) : null}

      {creating ? (
        <div style={card}>
          <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Nuevo servicio</h2>
          <form onSubmit={(e) => save(e)} encType="multipart/form-data" style={{ display: 'grid', gap: 16 }}>
            {fields()}
            {actions(() => setCreating(false), 'Agregar servicio')}
          </form>
        </div>
      ) : (
        <div>
          <button type="button" className="sv-btn" onClick={() => setCreating(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}>
            <i className="ph ph-plus" style={{ fontSize: 14 }} /> Nuevo servicio
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ ...card, padding: '46px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>Todavía no hay servicios</div>
          <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5 }}>Los que agregues se listan en la sección Servicios del home.</div>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} style={card}>
            {editing === item.id ? (
              <form onSubmit={(e) => save(e, item.id)} encType="multipart/form-data" style={{ display: 'grid', gap: 16 }}>
                {fields(item)}
                {actions(() => setEditing(null), 'Guardar cambios')}
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" style={{ width: 48, height: 48, objectFit: 'contain', background: '#1A1A1D', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 48, height: 48, borderRadius: 8, background: '#1A1A1D', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <i className="ph ph-image" style={{ color: '#4C4C51', fontSize: 18 }} />
                  </span>
                )}
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#EDEDEC' }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#8A8A8F', marginTop: 4, lineHeight: 1.5 }}>{item.text}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="sv-ghost" onClick={() => setEditing(item.id)} disabled={busy} style={{ fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: 'transparent', color: '#B4B4B9', border: `1px solid ${D.inputBorder}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                    Editar
                  </button>
                  <button type="button" className="sv-ghost" onClick={() => remove(item.id, item.title)} disabled={busy} style={{ fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: 'transparent', color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
