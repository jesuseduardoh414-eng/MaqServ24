'use client';
import { useState } from 'react';
import Link from 'next/link';
import { contrasenaSegura, problemaContrasena } from '@maqserv/config';
import { ReglasContrasena } from '@/components/ReglasContrasena';
import { OjoIcono } from '@/components/AuthCard';
import { Icon } from '@/components/Icon';

/**
 * Segundo paso de "¿Olvidaste tu contraseña?": la página a la que lleva el
 * enlace del correo. El token viene en la URL y se manda junto con la
 * contraseña nueva; la API lo valida (un solo uso, 60 minutos).
 */
export function ResetPasswordCard({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passErr = touched && !contrasenaSegura(password);
  const matchErr = touched && confirm !== password;

  async function submit() {
    setTouched(true); setServerErr(null);
    if (!contrasenaSegura(password) || confirm !== password) return;
    setLoading(true);
    try {
      const r = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.message ?? 'El enlace ya no sirve. Pide uno nuevo.');
      }
      setDone(true);
    } catch (e) {
      setServerErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="ms-panel ms-panel-lg rp-card">
        <style>{CSS}</style>
        <span className="ms-ico ms-ico-lg ms-ico-muted" aria-hidden><Icon name="warning" size={22} /></span>
        <h1 className="rp-title">Enlace incompleto</h1>
        <p className="ms-desc rp-desc">Abre el enlace tal como viene en el correo. Si ya caducó, pide uno nuevo.</p>
        <Link href="/login" className="ms-btn ms-btn-sec ms-btn-block">Volver a iniciar sesión</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="ms-panel ms-panel-lg rp-card">
        <style>{CSS}</style>
        <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="check" size={22} /></span>
        <h1 className="rp-title">Contraseña actualizada</h1>
        <p className="ms-desc rp-desc">Ya puedes entrar con tu contraseña nueva.</p>
        <Link href="/login" className="ms-btn ms-btn-lg ms-btn-block">Iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div className="ms-panel ms-panel-lg rp-card">
      <style>{CSS}</style>
      <p className="ms-kicker">Recuperar acceso</p>
      <h1 className="rp-title rp-title-first">Elige una contraseña nueva</h1>
      <p className="ms-desc rp-desc">Tiene que cumplir todos los puntos de la lista. El enlace sirve una sola vez.</p>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate className="rp-stack">
        <div className="ms-field">
          <label className="ms-label" htmlFor="rp-password">Contraseña nueva</label>
          <div className="rp-pw">
            <input id="rp-password" className="ms-input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={passErr} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="rp-eye"><OjoIcono abierto={showPw} /></button>
          </div>
          {passErr ? <p className="ms-error">{problemaContrasena(password)}</p> : null}
          <ReglasContrasena password={password} />
        </div>

        <div className="ms-field">
          <label className="ms-label" htmlFor="rp-confirm">Repite la contraseña</label>
          <input id="rp-confirm" className="ms-input" type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={matchErr} />
          {matchErr ? <p className="ms-error">Las dos contraseñas no coinciden.</p> : null}
        </div>

        {serverErr ? (
          <div role="alert" className="ms-alert ms-alert-bad rp-alert">
            <span className="rp-alert-ico"><Icon name="warning" size={16} /></span>
            <span>{serverErr}</span>
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="ms-btn ms-btn-lg ms-btn-block">{loading ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>

      <p className="rp-back">
        <Link href="/login" className="ms-link ms-link-muted">Volver a iniciar sesión</Link>
      </p>
    </div>
  );
}

/* Estilos propios de restablecer contraseña (prefijo `rp-`). Lo común sale de `ms-*`. */
const CSS = `
.rp-card{ width:100%; max-width:440px; margin:0 auto; box-sizing:border-box; }
.rp-title{ margin:14px 0 8px; font-family:var(--font-display); font-size:28px; font-weight:700; letter-spacing:-.025em; line-height:1.15; text-wrap:balance; }
.rp-title-first{ margin-top:0; }
.rp-desc{ margin:0 0 22px; }
.rp-stack{ display:grid; gap:18px; }
.rp-pw{ position:relative; }
.rp-pw .ms-input{ padding-right:46px; }
.rp-eye{ position:absolute; right:6px; top:50%; transform:translateY(-50%); width:34px; height:34px; display:grid; place-items:center; background:none; border:none; border-radius:8px; color:var(--color-text-muted); cursor:pointer; }
.rp-eye:hover{ color:var(--color-text); }
.rp-eye:focus-visible{ outline:2px solid var(--color-primary); outline-offset:1px; }
.rp-alert{ font-size:13.5px; }
.rp-alert-ico{ color:var(--color-error); flex-shrink:0; margin-top:2px; display:inline-flex; }
.rp-back{ margin:18px 0 0; text-align:center; }
@media (max-width: 640px){ .rp-title{ font-size:25px; } }
`;
