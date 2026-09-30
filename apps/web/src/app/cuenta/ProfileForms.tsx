'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type AuthUser, missingProfileFields, type RequiredProfileField } from '@maqserv/types';
import { Icon } from '@/components/Icon';
import { ReglasContrasena } from '@/components/ReglasContrasena';
import { problemaContrasena } from '@maqserv/config';

/** Nombre legible de cada dato que el checkout exige, y el campo que lo captura. */
const FIELD_LABEL: Record<RequiredProfileField, string> = {
  name: 'Nombre',
  email: 'Correo',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  zip: 'Código postal',
};
const FIELD_ID: Record<RequiredProfileField, string> = {
  name: 'pf-name', email: 'pf-email', phone: 'pf-phone', address: 'pf-address', city: 'pf-city', zip: 'pf-zip',
};

/** Un bloque de ajustes: a la izquierda qué es y para qué sirve, a la derecha los campos. */
function Seccion({ id, titulo, descripcion, children }: { id?: string; titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pf-sec">
      <div className="pf-sec-txt">
        <h2 className="pf-sec-t">{titulo}</h2>
        <p className="pf-sec-d">{descripcion}</p>
      </div>
      <div className="ac-panel pf-sec-body">{children}</div>
    </section>
  );
}

function Campo({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="pf-field">
      <label htmlFor={id} className="pf-label">{label}</label>
      {children}
      {hint ? <p className="pf-hint">{hint}</p> : null}
    </div>
  );
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
  const [busyPass, setBusyPass] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [verReglas, setVerReglas] = useState(false);

  // El perfil se refleja al vuelo para que el medidor no espere a recargar.
  const inicial = {
    name: user.name ?? '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    city: user.city ?? '',
    residency: user.residency ?? '',
    zip: user.zip ?? '',
  };
  const [guardado, setGuardado] = useState(inicial);
  const [form, setForm] = useState(inicial);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setProfileMsg(null); };
  const cambios = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== guardado[k]);

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
      setGuardado(form);
      setProfileMsg({ ok: true, text: labels.saved });
      router.refresh();
    } else {
      setProfileMsg({ ok: false, text: typeof data?.message === 'string' ? data.message : 'No se pudo guardar. Inténtalo de nuevo.' });
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPassMsg(null);
    const debil = problemaContrasena(nueva, { nombre: user.name, correo: user.email });
    if (debil) { setPassMsg({ ok: false, text: debil }); setVerReglas(true); return; }
    setBusyPass(true);
    const res = await fetch('/api/proxy/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: actual, next: nueva }),
    });
    const data = await res.json().catch(() => null);
    setBusyPass(false);
    if (res.ok) {
      setPassMsg({ ok: true, text: labels.changed });
      setActual('');
      setNueva('');
      setVerReglas(false);
    } else {
      setPassMsg({ ok: false, text: typeof data?.message === 'string' ? data.message : 'No se pudo actualizar. Inténtalo de nuevo.' });
    }
  }

  const aviso = (m: { ok: boolean; text: string } | null) =>
    m ? (
      <p role={m.ok ? 'status' : 'alert'} className="pf-msg" style={{ color: m.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
        <Icon name={m.ok ? 'check' : 'warning'} size={15} />
        {m.text}
      </p>
    ) : null;

  return (
    <div className="pf">
      <style>{CSS}</style>

      {/* Perfil incompleto: una franja corta, no media pantalla. Completo: no estorba. */}
      {missing.length > 0 ? (
        <div className="pf-callout" role="status">
          <div className="pf-callout-top">
            <span className="pf-callout-ico" aria-hidden><Icon name="warning" size={16} /></span>
            <div className="pf-callout-txt">
              <p className="pf-callout-t">Completa tu perfil para rentar o comprar más rápido</p>
              <p className="pf-callout-d">
                Te {missing.length === 1 ? 'falta 1 dato' : `faltan ${missing.length} datos`}. Si no los guardas aquí, el pago te los va a pedir.
              </p>
            </div>
            <span className="pf-callout-n">{done} de {total}</span>
          </div>
          <div className="pf-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
          <div className="pf-missing">
            {missing.map((f) => (
              <a key={f} href={`#${FIELD_ID[f]}`} className="pf-missing-chip" onClick={(e) => { e.preventDefault(); document.getElementById(FIELD_ID[f])?.focus(); }}>
                + {FIELD_LABEL[f]}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="pf-ok"><Icon name="check" size={15} /> Tus datos están completos: puedes rentar o comprar sin capturar nada en el pago.</p>
      )}

      <form onSubmit={saveProfile} className="pf-form">
        <Seccion titulo="Datos de contacto" descripcion="Así te identificamos y te buscamos cuando hay novedades de tu servicio.">
          <div className="pf-grid">
            <div className="pf-span">
              <Campo id="pf-name" label={labels.name}>
                <input id="pf-name" className="pf-input" value={form.name} onChange={(e) => set('name', e.target.value)} required minLength={2} autoComplete="name" />
              </Campo>
              </div>
            <Campo id="pf-email" label="Correo" hint="Es con el que entras; no se puede cambiar.">
              <input id="pf-email" className="pf-input" value={user.email} disabled readOnly />
            </Campo>
            <Campo id="pf-phone" label={labels.phone} hint="10 dígitos. Lo usamos para confirmar la llegada del equipo.">
              <input id="pf-phone" className="pf-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="81 1234 5678" inputMode="tel" autoComplete="tel" />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Dirección de entrega" descripcion="Con ella calculamos el traslado y llenamos el pago por ti.">
          <div className="pf-grid">
            <div className="pf-span">
              <Campo id="pf-address" label={labels.address}>
                <input id="pf-address" className="pf-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle, número y colonia" autoComplete="street-address" />
              </Campo>
            </div>
            <div className="pf-span pf-grid3">
            <Campo id="pf-city" label={labels.city}>
              <input id="pf-city" className="pf-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Monterrey" autoComplete="address-level2" />
            </Campo>
            <Campo id="pf-state" label="Estado">
              <input id="pf-state" className="pf-input" value={form.residency} onChange={(e) => set('residency', e.target.value)} placeholder="Nuevo León" autoComplete="address-level1" />
            </Campo>
            <Campo id="pf-zip" label={labels.zip}>
              <input id="pf-zip" className="pf-input" value={form.zip} onChange={(e) => set('zip', e.target.value)} placeholder="64000" inputMode="numeric" autoComplete="postal-code" />
            </Campo>
            </div>
          </div>
        </Seccion>

        <div className="pf-save">
          <div className="pf-save-msg">{aviso(profileMsg) ?? (cambios ? <span className="pf-dirty">Tienes cambios sin guardar</span> : null)}</div>
          {cambios ? <button type="button" className="ac-btn ac-btn-ghost" onClick={() => { setForm(guardado); setProfileMsg(null); }}>Descartar</button> : null}
          <button type="submit" className="ac-btn" disabled={busy || !cambios}>{busy ? 'Guardando…' : labels.save}</button>
        </div>
      </form>

      <form onSubmit={changePassword} className="pf-form">
        <Seccion titulo="Seguridad" descripcion="Cambia tu contraseña. Te pedimos la actual para confirmar que eres tú.">
          <div className="pf-grid">
            <Campo id="pf-current" label={labels.current}>
              <input id="pf-current" className="pf-input" type="password" required value={actual} onChange={(e) => { setActual(e.target.value); setPassMsg(null); }} autoComplete="current-password" />
            </Campo>
            <Campo id="pf-new" label={labels.next.replace(/\s*\(.*\)\s*$/, '')}>
              <input id="pf-new" className="pf-input" type="password" required value={nueva} onFocus={() => setVerReglas(true)} onChange={(e) => { setNueva(e.target.value); setPassMsg(null); }} placeholder="Mínimo 10 caracteres" autoComplete="new-password" />
            </Campo>
            {verReglas || nueva ? (
              <div className="pf-span"><ReglasContrasena password={nueva} nombre={user.name} correo={user.email} /></div>
            ) : null}
          </div>
          <div className="pf-inner-save">
            <div className="pf-save-msg">{aviso(passMsg)}</div>
            <button type="submit" className="ac-btn" disabled={busyPass || !actual || !nueva}>{busyPass ? 'Actualizando…' : labels.submit}</button>
          </div>
        </Seccion>
      </form>
    </div>
  );
}

const CSS = `
.pf{ display:grid; gap:28px; }
.pf-callout{ border:1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border)); background:color-mix(in srgb, var(--color-warning) 6%, var(--color-surface)); border-radius:12px; padding:18px 20px; display:grid; gap:12px; }
.pf-callout-top{ display:flex; gap:12px; align-items:flex-start; }
.pf-callout-ico{ color:var(--color-warning); margin-top:2px; flex-shrink:0; }
.pf-callout-txt{ flex:1; min-width:0; }
.pf-callout-t{ margin:0; font-size:14.5px; font-weight:600; }
.pf-callout-d{ margin:3px 0 0; font-size:13.5px; color:var(--color-text-muted); line-height:1.5; }
.pf-callout-n{ font-size:13px; font-weight:600; color:var(--color-text-muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
.pf-bar{ height:4px; border-radius:4px; background:color-mix(in srgb, var(--color-text) 10%, transparent); overflow:hidden; }
.pf-bar span{ display:block; height:100%; background:var(--color-warning); border-radius:4px; transition:width .3s ease; }
.pf-missing{ display:flex; gap:8px; flex-wrap:wrap; }
.pf-missing-chip{ font-size:13px; font-weight:600; color:var(--color-text); text-decoration:none; padding:5px 11px; border-radius:6px; border:1px solid var(--color-border); background:var(--color-bg); transition:border-color .18s ease; }
.pf-missing-chip:hover{ border-color:var(--color-primary); color:var(--color-primary); }
.pf-ok{ margin:0; display:flex; align-items:center; gap:8px; font-size:13.5px; color:var(--color-success); }

.pf-form{ display:grid; gap:28px; }
.pf-sec{ display:grid; grid-template-columns:220px minmax(0,1fr); gap:32px; padding-top:28px; border-top:1px solid var(--color-border); }
.pf-sec-t{ margin:0; font-size:15.5px; font-weight:600; }
.pf-sec-d{ margin:6px 0 0; font-size:13.5px; line-height:1.55; color:var(--color-text-muted); text-wrap:pretty; }
.pf-sec-body{ padding:24px; }
.pf-grid{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:18px 16px; }
.pf-span{ grid-column:1 / -1; }
.pf-grid3{ display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr); gap:18px 16px; }
.pf-field{ display:grid; gap:7px; align-content:start; }
.pf-label{ font-size:13px; font-weight:500; color:var(--color-text); }
.pf-hint{ margin:0; font-size:12.5px; line-height:1.45; color:var(--color-text-muted); }
.pf-input{ width:100%; box-sizing:border-box; min-height:44px; padding:0 13px; font-family:inherit; font-size:14.5px; color:var(--color-text); background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; transition:border-color .18s ease, box-shadow .18s ease; }
.pf-input::placeholder{ color:color-mix(in srgb, var(--color-text-muted) 70%, transparent); }
.pf-input:hover:not(:disabled){ border-color:color-mix(in srgb, var(--color-text) 28%, var(--color-border)); }
.pf-input:focus{ outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); }
.pf-input:disabled{ color:var(--color-text-muted); cursor:not-allowed; background:color-mix(in srgb, var(--color-text) 3%, var(--color-bg)); }

.pf-save, .pf-inner-save{ display:flex; align-items:center; justify-content:flex-end; gap:12px; flex-wrap:wrap; }
.pf-save{ padding-left:252px; }
.pf-inner-save{ margin-top:22px; padding-top:18px; border-top:1px solid var(--color-border); }
.pf-save-msg{ flex:1; min-width:0; }
.pf-msg{ margin:0; display:flex; align-items:center; gap:7px; font-size:13.5px; }
.pf-dirty{ font-size:13px; color:var(--color-text-muted); }

@media (max-width: 1100px){
  .pf-sec{ grid-template-columns:minmax(0,1fr); gap:14px; }
  .pf-save{ padding-left:0; }
}
@media (max-width: 560px){
  .pf-grid, .pf-grid3{ grid-template-columns:minmax(0,1fr); }
  .pf-sec-body{ padding:18px; }
  .pf-save .ac-btn, .pf-inner-save .ac-btn{ flex:1; }
  .pf-save-msg{ flex-basis:100%; }
}
`;
