'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShButton, ShInput, ShLabel } from '@maqserv/ui';
import { Icon } from '@/components/Icon';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

type View = 'login' | 'register' | 'forgot' | 'success' | 'verificar';

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
const STRENGTH_COLOR = ['var(--color-error)', 'var(--color-warning)', 'var(--color-primary)', 'var(--color-success)', 'var(--color-success)'];

/**
 * Motivos con los que vuelve el callback de Google.
 *
 * Se traducen aquí y no en la ruta porque la ruta redirige —no puede pintar
 * nada— y porque el texto es de cara al cliente: en la URL solo viaja una
 * clave corta, que además no filtra detalle técnico a quien mire la barra.
 */
const ERRORES: Record<string, string> = {
  google_off: 'El inicio con Google todavía no está configurado en este sitio.',
  google: 'No pudimos completar el inicio con Google. Inténtalo otra vez.',
  google_sin_codigo: 'Google no devolvió la confirmación. Inténtalo otra vez.',
  google_estado: 'La sesión con Google caducó. Vuelve a intentarlo.',
  google_cuenta_existente: 'Ya existe una cuenta con ese correo. Entra con tu contraseña.',
  servidor: 'El servidor no respondió. Espera unos segundos e inténtalo de nuevo.',
  verificacion: 'Ese enlace de confirmación ya no sirve. Entra con tu correo y contraseña y te mandamos uno nuevo.',
};

/** Con qué contesta la API cuando la cuenta existe pero no ha confirmado su correo. */
const CODIGO_NO_VERIFICADO = 'email_no_verificado';

const errStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--color-error)', marginTop: 6 };

/** Logotipo oficial de Google. Va en color a propósito: es marca de un tercero. */
function LogoGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.6-4.5 6.4l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.7-4.5l-7.1-5.5C2.8 17 2 20.4 2 24s.8 7 2.3 10l7.2-5.5z" />
      <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8.1 5.9 4.3 13l7.1 5.5C13.3 13.3 18.2 9.5 24 9.5z" />
    </svg>
  );
}

function OjoIcono({ abierto }: { abierto: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {abierto ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.7 3.7M6.6 6.6A18 18 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 5.4-1.6" />
          <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      )}
    </svg>
  );
}

/**
 * Textos visibles de la card, resueltos SERVER-SIDE desde el tema (requisito
 * duro: todo copy editable en Panel → Diseño). Los defaults replican el texto
 * original para que un consumidor sin tema no cambie.
 */
export interface AuthLabels {
  tabLogin: string; tabRegister: string;
  loginEyebrow: string; loginHeading: string; loginSubmit: string;
  registerEyebrow: string; registerHeading: string; registerSubmit: string;
  fieldName: string; fieldEmail: string; fieldPassword: string;
  remember: string; forgotLink: string;
  forgotEyebrow: string; forgotTitle: string; forgotHint: string; forgotSubmit: string; forgotBack: string;
  doneTitle: string; doneBody: string;
}
const DEFAULT_LABELS: AuthLabels = {
  tabLogin: 'Iniciar sesión', tabRegister: 'Crear cuenta',
  loginEyebrow: 'Bienvenido de nuevo', loginHeading: 'Entra a tu cuenta', loginSubmit: 'Entrar',
  registerEyebrow: 'Es gratis', registerHeading: 'Crea tu cuenta', registerSubmit: 'Registrarme',
  fieldName: 'Nombre completo', fieldEmail: 'Correo', fieldPassword: 'Contraseña',
  remember: 'Mantener sesión iniciada', forgotLink: '¿Olvidaste?',
  forgotEyebrow: 'Recuperar acceso', forgotTitle: '¿Olvidaste tu contraseña?',
  forgotHint: 'Escribe tu correo y te enviaremos un enlace para restablecerla.',
  forgotSubmit: 'Enviar enlace', forgotBack: 'Volver a iniciar sesión',
  doneTitle: 'Revisa tu correo', doneBody: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
};

export function AuthCard({
  initialView,
  redirectTo = '/',
  labels,
  googleActivo = false,
  errorInicial,
}: {
  initialView: 'login' | 'register';
  redirectTo?: string;
  labels?: Partial<AuthLabels>;
  /**
   * ¿Hay credenciales de Google en el servidor? Lo resuelve la página.
   *
   * Si no las hay, el botón NO se pinta. Antes salía siempre y al tocarlo
   * decía "estará disponible pronto": prometer algo que no existe es peor que
   * no ofrecerlo.
   */
  googleActivo?: boolean;
  /** Clave de error con la que volvió el callback de Google (`?error=`). */
  errorInicial?: string | null;
}) {
  const L: AuthLabels = { ...DEFAULT_LABELS, ...labels };
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(
    errorInicial ? (ERRORES[errorInicial] ?? ERRORES.google) : null,
  );

  const go = (v: View) => { setView(v); setTouched(false); setServerErr(null); };

  const nameErr = touched && view === 'register' && !name.trim();
  const emailErr = touched && !emailOk(email.trim());
  const passErr = touched && (view === 'register' ? password.length < 8 : password.length < 1);
  const termsErr = touched && view === 'register' && !terms;
  const st = strength(password);

  /**
   * La cuenta existe pero no ha confirmado su correo: el login lo dice y aquí
   * se ofrece reenviar el enlace sin salir de la tarjeta.
   */
  const [sinVerificar, setSinVerificar] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  async function reenviar() {
    setReenviado(false);
    try {
      await fetch('/api/auth/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), next: redirectTo || '/' }) });
    } catch { /* siempre "ok": anti-enumeración */ }
    setReenviado(true);
  }

  async function submitLogin() {
    setTouched(true); setServerErr(null); setSinVerificar(false);
    if (!emailOk(email.trim()) || password.length < 1) return;
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password, remember }) });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.code === CODIGO_NO_VERIFICADO) setSinVerificar(true);
        throw new Error(d?.message ?? 'Correo o contraseña incorrectos');
      }
      router.push(redirectTo || '/');
      router.refresh();
    } catch (e) { setServerErr((e as Error).message); setLoading(false); }
  }

  async function submitRegister() {
    setTouched(true); setServerErr(null);
    if (!name.trim() || !emailOk(email.trim()) || password.length < 8 || !terms) return;
    setLoading(true);
    try {
      // `next` viaja en el enlace del correo: al confirmar vuelve a donde iba.
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password, next: redirectTo || '/' }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo crear la cuenta');
      if (d?.verificar) {
        // Sin sesión todavía: la cuenta se activa desde el correo.
        setLoading(false);
        setView('verificar');
        return;
      }
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
      setView('success');
    } catch { setView('success'); } finally { setLoading(false); }
  }

  const showTabs = view === 'login' || view === 'register';
  const showSocial = (view === 'login' || view === 'register') && googleActivo;

  /**
   * Pestañas.
   *
   * La activa era BLANCA con letra negra (`--color-text` de fondo) y sobre el
   * sitio oscuro parecía un recorte pegado. Ahora usa el acento de la marca,
   * que es lo que el manual reserva para "estado interactivo".
   */
  const tabStyle = (on: boolean): React.CSSProperties => ({
    flex: 1, cursor: 'pointer', fontFamily: DISPLAY, fontWeight: 700, fontSize: 14.5,
    padding: '11px 8px', borderRadius: 'calc(var(--radius-button) - 2px)', border: '1px solid transparent',
    background: on ? 'var(--color-surface)' : 'transparent',
    borderColor: on ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'transparent',
    color: on ? 'var(--color-primary)' : 'var(--color-text-muted)',
    transition: 'color .18s ease, background .18s ease, border-color .18s ease',
  });

  const checkbox = (on: boolean): React.CSSProperties => ({
    width: 21, height: 21, flexShrink: 0, borderRadius: 6, cursor: 'pointer',
    border: on ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
    background: on ? 'var(--color-primary)' : 'var(--surface-2)',
    color: 'var(--color-primary-fg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    transition: 'background .15s ease, border-color .15s ease',
  });

  const pwToggle: React.CSSProperties = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
    display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8,
  };

  const eyebrow: React.CSSProperties = {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'var(--color-primary)', marginBottom: 10, fontWeight: 700,
  };
  const heading: React.CSSProperties = {
    fontFamily: DISPLAY, margin: '0 0 26px', fontSize: 'clamp(26px, 5vw, 32px)',
    fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)',
  };

  /** Aviso de error: caja legible, no una línea roja de 11 px al pie. */
  const alerta = serverErr ? (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px',
        borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
        color: 'var(--color-text)',
        background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)',
      }}
    >
      <span style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 1 }}>
        <Icon name="warning" size={15} />
      </span>
      <span>
        {serverErr}
        {/* Cuenta sin confirmar: reenviar el enlace desde aquí mismo. */}
        {sinVerificar ? (
          <>
            {' '}
            <button
              type="button"
              onClick={() => void reenviar()}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {reenviado ? 'Enlace reenviado, revisa tu correo.' : 'Reenviar el enlace'}
            </button>
          </>
        ) : null}
      </span>
    </div>
  ) : null;

  const campo = (contenido: React.ReactNode) => <div style={{ display: 'grid', gap: 7 }}>{contenido}</div>;

  return (
    <div
      style={{
        position: 'relative', background: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
        padding: 'clamp(24px, 5vw, 38px)', boxShadow: 'var(--shadow)',
      }}
    >
      {/* Marcas de esquina (firma del diseño). En el acento y más finas: en
          blanco puro competían con el contenido en vez de enmarcarlo. */}
      {[['14px', 'auto', 'auto', '14px'], ['14px', '14px', 'auto', 'auto'], ['auto', 'auto', '14px', '14px'], ['auto', '14px', '14px', 'auto']].map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute', top: pos[0], right: pos[1], bottom: pos[2], left: pos[3],
            width: 12, height: 12, opacity: 0.55, pointerEvents: 'none',
            borderTop: i < 2 ? '1.5px solid var(--color-primary)' : undefined,
            borderBottom: i >= 2 ? '1.5px solid var(--color-primary)' : undefined,
            borderLeft: i % 2 === 0 ? '1.5px solid var(--color-primary)' : undefined,
            borderRight: i % 2 === 1 ? '1.5px solid var(--color-primary)' : undefined,
          }}
        />
      ))}

      {showTabs ? (
        <div
          style={{
            display: 'flex', gap: 4, background: 'var(--surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-button)', padding: 4, marginBottom: 28,
          }}
        >
          <button type="button" onClick={() => go('login')} style={tabStyle(view === 'login')} aria-pressed={view === 'login'}>{L.tabLogin}</button>
          <button type="button" onClick={() => go('register')} style={tabStyle(view === 'register')} aria-pressed={view === 'register'}>{L.tabRegister}</button>
        </div>
      ) : null}

      {/* LOGIN */}
      {view === 'login' ? (
        <div>
          <div style={eyebrow}>{L.loginEyebrow}</div>
          <h2 style={heading}>{L.loginHeading}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            {campo(
              <>
                <ShLabel htmlFor="login-email">{L.fieldEmail}</ShLabel>
                <ShInput id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} className="h-12 text-[15px]" />
                {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
              </>,
            )}
            {campo(
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <ShLabel htmlFor="login-password">{L.fieldPassword}</ShLabel>
                  <button type="button" onClick={() => go('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', padding: 0 }}>{L.forgotLink}</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <ShInput id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" aria-invalid={passErr} className="h-12 pr-12 text-[15px]" />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={pwToggle}><OjoIcono abierto={showPw} /></button>
                </div>
                {passErr ? <div style={errStyle}>Ingresa tu contraseña.</div> : null}
              </>,
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
              <button type="button" role="checkbox" aria-checked={remember} aria-label={L.remember} onClick={() => setRemember((v) => !v)} style={checkbox(remember)}>{remember ? <Icon name="check" size={12} /> : null}</button>
              <span onClick={() => setRemember((v) => !v)} style={{ fontSize: 13.5, color: 'var(--color-text-muted)', cursor: 'pointer' }}>{L.remember}</span>
            </span>
            {alerta}
            <ShButton onClick={submitLogin} disabled={loading} className="h-12 w-full text-[15px]">
              {loading ? 'Entrando…' : L.loginSubmit}
            </ShButton>
          </div>
        </div>
      ) : null}

      {/* REGISTER */}
      {view === 'register' ? (
        <div>
          <div style={eyebrow}>{L.registerEyebrow}</div>
          <h2 style={heading}>{L.registerHeading}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            {campo(
              <>
                <ShLabel htmlFor="reg-name">{L.fieldName}</ShLabel>
                <ShInput id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" aria-invalid={nameErr} className="h-12 text-[15px]" />
                {nameErr ? <div style={errStyle}>Ingresa tu nombre.</div> : null}
              </>,
            )}
            {campo(
              <>
                <ShLabel htmlFor="reg-email">{L.fieldEmail}</ShLabel>
                <ShInput id="reg-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} className="h-12 text-[15px]" />
                {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
              </>,
            )}
            {campo(
              <>
                <ShLabel htmlFor="reg-password">{L.fieldPassword}</ShLabel>
                <div style={{ position: 'relative' }}>
                  <ShInput id="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" autoComplete="new-password" aria-invalid={passErr} className="h-12 pr-12 text-[15px]" />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={pwToggle}><OjoIcono abierto={showPw} /></button>
                </div>
                {password.length > 0 ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < st ? STRENGTH_COLOR[st - 1] : 'var(--color-border)', transition: 'background .2s ease' }} />
                      ))}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: st > 0 ? STRENGTH_COLOR[st - 1] : 'var(--color-text-muted)', marginTop: 6, letterSpacing: '0.06em', fontWeight: 700 }}>{STRENGTH_LABEL[st]}</div>
                  </div>
                ) : null}
                {passErr ? <div style={errStyle}>La contraseña debe tener al menos 8 caracteres.</div> : null}
              </>,
            )}
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10, userSelect: 'none' }}>
              <button type="button" role="checkbox" aria-checked={terms} aria-label="Acepto los términos y el aviso de privacidad" onClick={() => setTerms((v) => !v)} style={checkbox(terms)}>{terms ? <Icon name="check" size={12} /> : null}</button>
              <span onClick={() => setTerms((v) => !v)} style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, cursor: 'pointer' }}>Acepto los <Link href="/terminos" style={{ color: 'var(--color-primary)', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>Términos</Link> y el <Link href="/privacidad" style={{ color: 'var(--color-primary)', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>Aviso de privacidad</Link>.</span>
            </span>
            {termsErr ? <div style={errStyle}>Debes aceptar los términos.</div> : null}
            {alerta}
            <ShButton onClick={submitRegister} disabled={loading} className="h-12 w-full text-[15px]">
              {loading ? 'Creando…' : L.registerSubmit}
            </ShButton>
          </div>
        </div>
      ) : null}

      {/* FORGOT */}
      {view === 'forgot' ? (
        <div>
          <div style={eyebrow}>{L.forgotEyebrow}</div>
          <h2 style={{ ...heading, marginBottom: 10 }}>{L.forgotTitle}</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>{L.forgotHint}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            {campo(
              <>
                <ShLabel htmlFor="forgot-email">{L.fieldEmail}</ShLabel>
                <ShInput id="forgot-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} className="h-12 text-[15px]" />
                {emailErr ? <div style={errStyle}>Correo no válido.</div> : null}
              </>,
            )}
            {alerta}
            <ShButton onClick={submitForgot} disabled={loading} className="h-12 w-full text-[15px]">
              {loading ? 'Enviando…' : L.forgotSubmit}
            </ShButton>
            <ShButton variant="ghost" onClick={() => go('login')} className="w-full">
              <Icon name="arrowLeft" size={14} />{L.forgotBack}
            </ShButton>
          </div>
        </div>
      ) : null}

      {/* SUCCESS (forgot) */}
      {/* Registro hecho: la cuenta se activa desde el correo (2026-09-23). */}
      {view === 'verificar' ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Icon name="check" size={30} /></div>
          <h2 style={{ ...heading, marginBottom: 12 }}>Confirma tu correo</h2>
          <p style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            Te mandamos un enlace a <strong style={{ color: 'var(--color-text)' }}>{email.trim()}</strong>. Ábrelo para activar tu cuenta: entras directo y sigues donde ibas.
          </p>
          <p style={{ margin: '0 0 22px', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            Si no lo ves en unos minutos, revisa la carpeta de no deseados.
          </p>
          <ShButton variant="outline" onClick={() => void reenviar()} className="h-12 w-full text-[15px]">
            {reenviado ? 'Enlace reenviado' : 'Reenviar el enlace'}
          </ShButton>
        </div>
      ) : null}

      {view === 'success' ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Icon name="check" size={30} /></div>
          <h2 style={{ ...heading, marginBottom: 12 }}>{L.doneTitle}</h2>
          <p style={{ margin: '0 0 26px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>{L.doneBody}</p>
          <ShButton onClick={() => go('login')} className="h-12 w-full text-[15px]">{L.forgotBack}</ShButton>
        </div>
      ) : null}

      {/* Entrar con Google. Solo aparece si el servidor tiene credenciales. */}
      {showSocial ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>O CONTINÚA CON</span>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>
          {/*
            Enlace, NO botón con fetch: el navegador tiene que NAVEGAR de verdad
            a accounts.google.com. Un fetch lo bloquearía el propio Google (no
            permite que su pantalla de consentimiento se cargue por XHR).
          */}
          <a
            href={`/api/auth/google?next=${encodeURIComponent(redirectTo || '/')}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              height: 48, borderRadius: 'var(--radius-button)', textDecoration: 'none',
              border: '1px solid var(--color-border)', background: 'var(--surface-2)',
              color: 'var(--color-text)', fontWeight: 700, fontSize: 14.5,
            }}
          >
            <LogoGoogle /> Continuar con Google
          </a>
        </div>
      ) : null}
    </div>
  );
}
