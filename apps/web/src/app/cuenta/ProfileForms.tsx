'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type AuthUser, missingProfileFields, type RequiredProfileField } from '@maqserv/types';
import { Icon } from '@/components/Icon';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '22px 24px',
};

const legendStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  margin: '0 0 16px',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  color: 'var(--color-text)',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  marginBottom: 6,
};

const btnPrimary: React.CSSProperties = {
  fontFamily: DISPLAY, fontWeight: 700, fontSize: 15,
  background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
  border: 'none', padding: '13px 26px', borderRadius: 'var(--radius-button)', cursor: 'pointer',
};

/** Nombre legible de cada dato que el checkout exige. */
const FIELD_LABEL: Record<RequiredProfileField, string> = {
  name: 'Nombre',
  email: 'Correo',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  zip: 'Código postal',
};

/** Rutas verificadas: el rastreo es /rastreo (no /rastrear) y el FAQ vive en el home. */
const HELP_LINKS = [
  { href: '/contacto', label: 'Contactar a un asesor', hint: 'Teléfono, correo y sucursales' },
  { href: '/rastreo', label: 'Rastrear un pedido', hint: 'Consulta con tu número de pedido' },
  { href: '/#faq', label: 'Preguntas frecuentes', hint: 'Renta, pagos y traslado' },
  { href: '/terminos', label: 'Términos y condiciones', hint: 'Condiciones del servicio' },
  { href: '/privacidad', label: 'Aviso de privacidad', hint: 'Cómo tratamos tus datos' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><span style={labelStyle}>{label}</span>{children}</label>;
}

export function ProfileForms({
  user,
  labels,
}: {
  user: AuthUser;
  labels: {
    profileTitle: string;
    name: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
    save: string;
    saved: string;
    passwordTitle: string;
    current: string;
    next: string;
    submit: string;
    changed: string;
  };
}) {
  const router = useRouter();
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // El perfil se refleja al vuelo para que el medidor no espere a recargar.
  const [form, setForm] = useState({
    name: user.name ?? '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    city: user.city ?? '',
    residency: user.residency ?? '',
    zip: user.zip ?? '',
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Lo que falta para poder comprar/rentar: misma regla que exige el checkout.
  const missing = missingProfileFields({ ...user, ...form });
  const total = 6;
  const done = total - missing.length;
  const pct = Math.round((done / total) * 100);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileMsg(null);
    setBusy(true);
    const res = await fetch('/api/proxy/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setProfileMsg({ ok: true, text: labels.saved });
      router.refresh();
    } else {
      setProfileMsg({ ok: false, text: typeof data?.message === 'string' ? data.message : 'Error al guardar' });
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPassMsg(null);
    const el = e.currentTarget;
    const fd = new FormData(el);
    const res = await fetch('/api/proxy/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: String(fd.get('current') ?? ''), next: String(fd.get('next') ?? '') }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPassMsg({ ok: true, text: labels.changed });
      el.reset();
    } else {
      setPassMsg({ ok: false, text: typeof data?.message === 'string' ? data.message : 'Error al actualizar' });
    }
  }

  const msg = (m: { ok: boolean; text: string } | null) =>
    m ? (
      <p role={m.ok ? 'status' : 'alert'} style={{ color: m.ok ? 'var(--color-success)' : 'var(--color-error)', margin: '12px 0 0', fontSize: 13 }}>
        {m.text}
      </p>
    ) : null;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Perfil completo: qué falta para poder comprar o rentar */}
      <div style={{ ...cardStyle, borderColor: missing.length ? 'color-mix(in srgb, var(--color-primary) 45%, var(--color-border))' : 'var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ ...legendStyle, margin: 0 }}>Perfil completo</h2>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: missing.length ? 'var(--color-primary)' : 'var(--color-success)' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg)', border: '1px solid var(--color-border)', overflow: 'hidden', margin: '12px 0' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: missing.length ? 'var(--color-primary)' : 'var(--color-success)', transition: 'width .25s' }} />
        </div>
        {missing.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Tus datos están completos: puedes rentar y comprar sin capturar nada más en el pago.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Te {missing.length === 1 ? 'falta 1 dato' : `faltan ${missing.length} datos`} para poder completar una renta o compra. Sin esto, el pago te los va a pedir de todos modos.
            </p>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {missing.map((f) => (
                <span key={f} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-primary)', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)', borderRadius: 999, padding: '4px 10px' }}>
                  {FIELD_LABEL[f]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="acc-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Mis datos */}
        <form onSubmit={saveProfile} style={cardStyle}>
          <h2 style={legendStyle}>{labels.profileTitle}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label={labels.name}>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} placeholder={labels.name} style={fieldStyle} />
            </Field>

            {/* El correo es la identidad de la cuenta: no se edita aquí. */}
            <Field label="Correo (no se puede cambiar)">
              <input value={user.email} disabled style={{ ...fieldStyle, opacity: 0.65, cursor: 'not-allowed' }} />
            </Field>

            <Field label={labels.phone}>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10 dígitos" inputMode="tel" autoComplete="tel" style={fieldStyle} />
            </Field>
            <Field label={`${labels.address} (define el costo del traslado)`}>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle y número" autoComplete="street-address" style={fieldStyle} />
            </Field>
            <div className="acc-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={labels.city}>
                <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder={labels.city} style={fieldStyle} />
              </Field>
              <Field label="Estado">
                <input value={form.residency} onChange={(e) => set('residency', e.target.value)} placeholder="Ej. Nuevo León" style={fieldStyle} />
              </Field>
            </div>
            <div className="acc-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={labels.zip}>
                <input value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="00000" inputMode="numeric" autoComplete="postal-code" style={fieldStyle} />
              </Field>
              <Field label="Miembro desde">
                <input
                  value={user.createdAt ? new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt)) : '—'}
                  disabled
                  style={{ ...fieldStyle, opacity: 0.65, cursor: 'default' }}
                />
              </Field>
            </div>
          </div>
          {msg(profileMsg)}
          <button type="submit" disabled={busy} style={{ ...btnPrimary, marginTop: 18, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Guardando…' : labels.save}
          </button>
        </form>

        <div style={{ display: 'grid', gap: 18 }}>
          {/* Contraseña */}
          <form onSubmit={changePassword} style={cardStyle}>
            <h2 style={legendStyle}>{labels.passwordTitle}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label={labels.current}>
                <input name="current" type="password" required placeholder="••••••••" autoComplete="current-password" style={fieldStyle} />
              </Field>
              <Field label={labels.next}>
                <input name="next" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" style={fieldStyle} />
              </Field>
            </div>
            {msg(passMsg)}
            <button type="submit" style={{ ...btnPrimary, marginTop: 18 }}>{labels.submit}</button>
          </form>

          {/* Ayuda */}
          <div style={cardStyle}>
            <h2 style={legendStyle}>Ayuda</h2>
            <div style={{ display: 'grid' }}>
              {HELP_LINKS.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="acc-help"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{l.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{l.hint}</span>
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 15, display: 'flex' }} aria-hidden><Icon name="arrowRight" size={15} /></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
