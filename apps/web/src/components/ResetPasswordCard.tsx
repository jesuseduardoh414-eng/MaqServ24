'use client';
import { useState } from 'react';
import Link from 'next/link';

const DISPLAY = 'var(--font-display)';
const MONO = 'var(--font-sans)';

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

  const passErr = touched && password.length < 8;
  const matchErr = touched && confirm !== password;

  async function submit() {
    setTouched(true); setServerErr(null);
    if (password.length < 8 || confirm !== password) return;
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

  const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '2rem 1.75rem' };
  const input = (bad: boolean): React.CSSProperties => ({ width: '100%', padding: '13px 44px 13px 14px', borderRadius: 10, border: `1.5px solid ${bad ? 'var(--color-danger, #d33)' : 'var(--color-border)'}`, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 15, outline: 'none' });
  const labelSt: React.CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 };
  const pwToggle: React.CSSProperties = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)' };
  const btn: React.CSSProperties = { width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary, #fff)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 };

  if (!token) {
    return (
      <div style={card}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 22, margin: '0 0 8px' }}>Enlace incompleto</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 18px' }}>Abre el enlace tal como viene en el correo. Si ya caducó, pide uno nuevo.</p>
        <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Volver a iniciar sesión</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={card}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 22, margin: '0 0 8px' }}>Contraseña actualizada</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 18px' }}>Ya puedes entrar con tu contraseña nueva.</p>
        <Link href="/login" style={{ ...btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div style={card}>
      <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)', margin: '0 0 6px' }}>Recuperar acceso</p>
      <h1 style={{ fontFamily: DISPLAY, fontSize: 22, margin: '0 0 6px' }}>Elige una contraseña nueva</h1>
      <p style={{ color: 'var(--color-text-muted)', margin: '0 0 20px', fontSize: 14 }}>Mínimo 8 caracteres. El enlace sirve una sola vez.</p>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <label style={labelSt}>Contraseña nueva</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={input(passErr)} />
          <button type="button" onClick={() => setShowPw((v) => !v)} style={pwToggle}>{showPw ? 'OCULTAR' : 'VER'}</button>
        </div>
        {passErr ? <p style={{ color: 'var(--color-danger, #d33)', fontSize: 13, margin: '-8px 0 12px' }}>Usa al menos 8 caracteres.</p> : null}

        <label style={labelSt}>Repite la contraseña</label>
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" style={input(matchErr)} />
        </div>
        {matchErr ? <p style={{ color: 'var(--color-danger, #d33)', fontSize: 13, margin: '-12px 0 12px' }}>Las dos contraseñas no coinciden.</p> : null}

        {serverErr ? <p role="alert" style={{ color: 'var(--color-danger, #d33)', fontSize: 14, margin: '0 0 14px' }}>{serverErr}</p> : null}

        <button type="submit" disabled={loading} style={btn}>{loading ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>

      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
        <Link href="/login" style={{ color: 'var(--color-text-muted)' }}>Volver a iniciar sesión</Link>
      </p>
    </div>
  );
}
