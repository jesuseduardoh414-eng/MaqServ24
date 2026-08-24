'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

type View = 'login' | 'register' | 'forgot' | 'success';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function strength(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH_LABEL = ['MUY DÉBIL', 'DÉBIL', 'ACEPTABLE', 'BUENA', 'FUERTE'];
const STRENGTH_COLOR = ['#dc2626', '#f59e0b', 'var(--color-primary)', '#15803d', '#15803d'];

const labelStyle: React.CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const errStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: 'var(--color-error)', marginTop: 6, letterSpacing: '0.04em' };
const primaryBtn: React.CSSProperties = { width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: 15, borderRadius: 100, cursor: 'pointer' };

function field(err: boolean, extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)',
    background: err ? 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))' : 'color-mix(in srgb, var(--color-text) 3%, var(--color-surface))',
    border: `1px solid ${err ? 'var(--color-error)' : 'var(--color-border)'}`,
    borderRadius: 10, padding: '14px 16px', outline: 'none', marginTop: 8, ...extra,
  };
}

export function AuthCard({ initialView, redirectTo = '/' }: { initialView: 'login' | 'register'; redirectTo?: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [successType, setSuccessType] = useState<'forgot'>('forgot');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (v: View) => { setView(v); setTouched(false); setServerErr(null); setNotice(null); };

  const nameErr = touched && view === 'register' && !name.trim();
  const emailErr = touched && !emailOk(email.trim());
  const passErr = touched && (view === 'register' ? password.length < 8 : password.length < 1);
  const termsErr = touched && view === 'register' && !terms;
  const st = strength(password);

  async function submitLogin() {
    setTouched(true); setServerErr(null);
    if (!emailOk(email.trim()) || password.length < 1) return;
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password, remember }) });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ?? 'Correo o contraseña incorrectos'); }
      router.push(redirectTo || '/');
      router.refresh();
    } catch (e) { setServerErr((e as Error).message); setLoading(false); }
  }

  async function submitRegister() {
    setTouched(true); setServerErr(null);
    if (!name.trim() || !emailOk(email.trim()) || password.length < 8 || !terms) return;
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ?? 'No se pudo crear la cuenta'); }
      router.push(redirectTo || '/');
      router.refresh();
    } catch (e) { setServerErr((e as Error).message); setLoading(false); }
  }

  async function submitForgot() {
    setTouched(true); setServerErr(null);
    if (!emailOk(email.trim())) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      setSuccessType('forgot'); setView('success');
    } catch { setSuccessType('forgot'); setView('success'); } finally { setLoading(false); }
  }

  const showTabs = view === 'login' || view === 'register';
  const showSocial = view === 'login' || view === 'register';

  const tabStyle = (on: boolean): React.CSSProperties => ({ flex: 1, cursor: 'pointer', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, padding: 11, borderRadius: 100, border: 'none', background: on ? 'var(--color-text)' : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text-muted)', transition: 'all .18s ease' });
  const checkbox = (on: boolean): React.CSSProperties => ({ width: 22, height: 22, flexShrink: 0, borderRadius: 6, cursor: 'pointer', border: on ? 'none' : '2px solid var(--color-border)', background: on ? 'var(--color-text)' : 'var(--color-surface)', color: 'var(--color-bg)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 });
  const pwToggle: React.CSSProperties = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)' };
  const socialBtn: React.CSSProperties = { flex: 1, fontFamily: MONO, fontWeight: 700, fontSize: 13, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: 13, borderRadius: 10, cursor: 'pointer', letterSpacing: '0.04em' };

  return (
    <div style={{ position: 'relative', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 40, boxShadow: '0 30px 60px -40px rgba(17,17,17,0.35)' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      {/* Marcas de esquina */}
      {[['12px', 'auto', 'auto', '12px'], ['12px', '12px', 'auto', 'auto'], ['auto', 'auto', '12px', '12px'], ['auto', '12px', '12px', 'auto']].map((pos, i) => (
        <span key={i} style={{ position: 'absolute', top: pos[0], right: pos[1], bottom: pos[2], left: pos[3], width: 14, height: 14, borderTop: i < 2 ? '2px solid var(--color-text)' : undefined, borderBottom: i >= 2 ? '2px solid var(--color-text)' : undefined, borderLeft: i % 2 === 0 ? '2px solid var(--color-text)' : undefined, borderRight: i % 2 === 1 ? '2px solid var(--color-text)' : undefined }} />
      ))}

      {showTabs ? (
        <div style={{ display: 'flex', gap: 4, background: 'color-mix(in srgb, var(--color-text) 5%, var(--color-surface))', borderRadius: 100, padding: 4, marginBottom: 32 }}>
          <button type="button" onClick={() => go('login')} style={tabStyle(view === 'login')}>Iniciar sesión</button>
          <button type="button" onClick={() => go('register')} style={tabStyle(view === 'register')}>Crear cuenta</button>
        </div>
      ) : null}

      {/* LOGIN */}
      {view === 'login' ? (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 10 }}>BIENVENIDO DE NUEVO</div>
          <h2 style={{ fontFamily: DISPLAY, margin: '0 0 28px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>Entra a tu cuenta</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Correo</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" style={field(emailErr)} />
              {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Contraseña</label>
                <button type="button" onClick={() => go('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 11, color: 'var(--color-primary)', letterSpacing: '0.04em' }}>¿OLVIDASTE?</button>
              </div>
              <div style={{ position: 'relative' }}>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" style={field(passErr, { paddingRight: 70 })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={pwToggle}>{showPw ? 'OCULTAR' : 'VER'}</button>
              </div>
              {passErr ? <div style={errStyle}>Ingresa tu contraseña.</div> : null}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <button type="button" onClick={() => setRemember((v) => !v)} style={checkbox(remember)}>{remember ? '✓' : ''}</button>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Mantener sesión iniciada</span>
            </label>
            {serverErr ? <div style={errStyle}>{serverErr}</div> : null}
            <button type="button" onClick={submitLogin} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>{loading ? 'Entrando…' : 'Entrar'}</button>
          </div>
        </div>
      ) : null}

      {/* REGISTER */}
      {view === 'register' ? (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 10 }}>ES GRATIS</div>
          <h2 style={{ fontFamily: DISPLAY, margin: '0 0 28px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>Crea tu cuenta</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" style={field(nameErr)} />
              {nameErr ? <div style={errStyle}>Ingresa tu nombre.</div> : null}
            </div>
            <div>
              <label style={labelStyle}>Correo</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" style={field(emailErr)} />
              {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
            </div>
            <div>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" autoComplete="new-password" style={field(passErr, { paddingRight: 70 })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={pwToggle}>{showPw ? 'OCULTAR' : 'VER'}</button>
              </div>
              {password.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i < st ? STRENGTH_COLOR[st - 1] : 'var(--color-border)' }} />
                    ))}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: st > 0 ? STRENGTH_COLOR[st - 1] : 'var(--color-text-muted)', marginTop: 6, letterSpacing: '0.06em' }}>{STRENGTH_LABEL[st]}</div>
                </div>
              ) : null}
              {passErr ? <div style={errStyle}>La contraseña debe tener al menos 8 caracteres.</div> : null}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <button type="button" onClick={() => setTerms((v) => !v)} style={checkbox(terms)}>{terms ? '✓' : ''}</button>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Acepto los <Link href="/terminos" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Términos</Link> y el <Link href="/privacidad" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Aviso de privacidad</Link>.</span>
            </label>
            {termsErr ? <div style={errStyle}>Debes aceptar los términos.</div> : null}
            {serverErr ? <div style={errStyle}>{serverErr}</div> : null}
            <button type="button" onClick={submitRegister} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>{loading ? 'Creando…' : 'Registrarme'}</button>
          </div>
        </div>
      ) : null}

      {/* FORGOT */}
      {view === 'forgot' ? (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-primary)', marginBottom: 10 }}>RECUPERAR ACCESO</div>
          <h2 style={{ fontFamily: DISPLAY, margin: '0 0 10px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>¿Olvidaste tu contraseña?</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>Escribe tu correo y te enviaremos un enlace para restablecerla.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Correo</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" style={field(emailErr)} />
              {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
            </div>
            <button type="button" onClick={submitForgot} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>{loading ? 'Enviando…' : 'Enviar enlace'}</button>
            <button type="button" onClick={() => go('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: 'var(--color-text)', padding: 4 }}>← Volver a iniciar sesión</button>
          </div>
        </div>
      ) : null}

      {/* SUCCESS (forgot) */}
      {view === 'success' ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 22px' }}>✓</div>
          <h2 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>Revisa tu correo</h2>
          <p style={{ margin: '0 0 28px', fontSize: 15, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>Si el correo existe, recibirás un enlace para restablecer tu contraseña.</p>
          <button type="button" onClick={() => go('login')} style={primaryBtn}>Volver a iniciar sesión</button>
        </div>
      ) : null}

      {/* Social (login + register) */}
      {showSocial ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '26px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>O CONTINÚA CON</span>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => setNotice('El inicio con Google estará disponible pronto.')} style={socialBtn}>G · Google</button>
            <button type="button" onClick={() => setNotice('El inicio con Facebook estará disponible pronto.')} style={socialBtn}>f · Facebook</button>
          </div>
          {notice ? <div style={{ ...errStyle, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 12 }}>{notice}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
