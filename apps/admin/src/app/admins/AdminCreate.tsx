'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, letterSpacing: '1px', fontWeight: 700,
  color: '#7A7A7F', marginBottom: 7, textTransform: 'uppercase',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 9,
  padding: '10px 12px', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
};

/** Alta de administrador: crea la fila y su cuenta de acceso en Supabase. */
export function AdminCreate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          email,
          password: String(data.get('password') ?? ''),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'No se pudo crear');
      form.reset();
      setOpen(false);
      setOk(`${email} ya puede entrar al panel.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <style>{`.ad-new:hover{ filter: brightness(1.1); }`}</style>
        <button
          type="button"
          className="ad-new"
          onClick={() => { setOpen(true); setOk(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}
        >
          <i className="ph ph-plus" style={{ fontSize: 14 }} /> Nuevo administrador
        </button>
        {ok ? <span role="status" style={{ fontSize: 12.5, fontWeight: 600, color: '#3fbf8f' }}>✓ {ok}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 }}>
      <style>{`.ad-btn:hover:not(:disabled){ filter: brightness(1.1); } .ad-ghost:hover{ background: rgba(255,255,255,0.06); }`}</style>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Nuevo administrador</h2>
      <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#7A7A7F' }}>
        Tendrá acceso total al panel. Dile la contraseña por un canal seguro: no se la mandamos por correo.
      </p>

      {/*
        `autoComplete="off"` + nombres no estándar: sin esto el navegador rellenaba
        este formulario con las credenciales del admin que ya está dentro (se veía en
        la pantalla: el correo de la sesión activa dentro del alta de otra cuenta).
      */}
      <form onSubmit={onSubmit} autoComplete="off" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="ad-name">Nombre</label>
            <input id="ad-name" name="name" required minLength={2} maxLength={100} autoComplete="off" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ad-email">Correo</label>
            <input id="ad-email" name="email" type="email" required autoComplete="off" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="ad-pass">Contraseña (mín. 8)</label>
            <input id="ad-pass" name="password" type="password" required minLength={8} autoComplete="new-password" style={inputStyle} />
          </div>
        </div>

        {error ? (
          <p role="alert" style={{ margin: 0, background: 'rgba(255,85,85,0.08)', border: '1px solid rgba(255,85,85,0.3)', color: '#f55', padding: '11px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="ad-btn" disabled={busy} style={{ fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Creando…' : 'Crear administrador'}
          </button>
          <button type="button" className="ad-ghost" onClick={() => { setOpen(false); setError(null); }} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: 'transparent', color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 9, padding: '10px 18px', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
