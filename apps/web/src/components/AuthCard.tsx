'use client';

import { evento } from '@/lib/analitica';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ReglasContrasena } from '@/components/ReglasContrasena';
import { contrasenaSegura, problemaContrasena } from '@maqserv/config';

type View = 'login' | 'register' | 'forgot' | 'success' | 'verificar';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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

/** Ojo de "mostrar contraseña". Lo reutiliza también la tarjeta de restablecer. */
export function OjoIcono({ abierto }: { abierto: boolean }) {
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
  const [password2, setPassword2] = useState('');
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
  const passErr = touched && (view === 'register' ? !contrasenaSegura(password, { nombre: name, correo: email }) : password.length < 1);
  const pass2Err = touched && view === 'register' && password2 !== password;
  const termsErr = touched && view === 'register' && !terms;

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
    if (!name.trim() || !emailOk(email.trim()) || !contrasenaSegura(password, { nombre: name, correo: email }) || password2 !== password || !terms) return;
    setLoading(true);
    try {
      // `next` viaja en el enlace del correo: al confirmar vuelve a donde iba.
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password, next: redirectTo || '/' }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo crear la cuenta');
      evento('registro_completado', { metodo: 'correo' });
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

  /** Aviso de error del servidor: caja legible (sistema `.ms-alert`). */
  const alerta = serverErr ? (
    <div role="alert" className="ms-alert ms-alert-bad au-alert">
      <span className="au-alert-ico"><Icon name="warning" size={16} /></span>
      <span>
        {serverErr}
        {/* Cuenta sin confirmar: reenviar el enlace desde aquí mismo. */}
        {sinVerificar ? (
          <>
            {' '}
            <button type="button" onClick={() => void reenviar()} className="au-inline-link">
              {reenviado ? 'Enlace reenviado, revisa tu correo.' : 'Reenviar el enlace'}
            </button>
          </>
        ) : null}
      </span>
    </div>
  ) : null;

  /** Campo de contraseña con el ojo de mostrar/ocultar dentro. */
  const ojo = (
    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="au-eye">
      <OjoIcono abierto={showPw} />
    </button>
  );

  return (
    <div className="ms-panel ms-panel-lg au-card">
      <style>{CSS}</style>

      {showTabs ? (
        <div className="ms-tabs au-tabs" role="tablist" aria-label="Acceso">
          <button type="button" role="tab" className="ms-tab" onClick={() => go('login')} aria-selected={view === 'login'}>{L.tabLogin}</button>
          <button type="button" role="tab" className="ms-tab" onClick={() => go('register')} aria-selected={view === 'register'}>{L.tabRegister}</button>
        </div>
      ) : null}

      {/* LOGIN */}
      {view === 'login' ? (
        <div>
          <p className="ms-kicker">{L.loginEyebrow}</p>
          <h1 className="au-title">{L.loginHeading}</h1>
          <div className="au-stack">
            <div className="ms-field">
              <label className="ms-label" htmlFor="login-email">{L.fieldEmail}</label>
              <input id="login-email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
              {emailErr ? <p className="ms-error">Correo no válido.</p> : null}
            </div>
            <div className="ms-field">
              <div className="au-label-row">
                <label className="ms-label" htmlFor="login-password">{L.fieldPassword}</label>
                <button type="button" onClick={() => go('forgot')} className="ms-link au-small-link">{L.forgotLink}</button>
              </div>
              <div className="au-pw">
                <input id="login-password" className="ms-input" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" aria-invalid={passErr} />
                {ojo}
              </div>
              {passErr ? <p className="ms-error">Ingresa tu contraseña.</p> : null}
            </div>
            <span className="au-checkrow">
              <button type="button" role="checkbox" aria-checked={remember} aria-label={L.remember} onClick={() => setRemember((v) => !v)} className="ms-check">{remember ? <Icon name="check" size={12} /> : null}</button>
              <span onClick={() => setRemember((v) => !v)} className="au-checktxt">{L.remember}</span>
            </span>
            {alerta}
            <button type="button" onClick={submitLogin} disabled={loading} className="ms-btn ms-btn-lg ms-btn-block">
              {loading ? 'Entrando…' : L.loginSubmit}
            </button>
          </div>
        </div>
      ) : null}

      {/* REGISTER */}
      {view === 'register' ? (
        <div>
          <p className="ms-kicker">{L.registerEyebrow}</p>
          <h1 className="au-title">{L.registerHeading}</h1>
          <div className="au-stack">
            <div className="ms-field">
              <label className="ms-label" htmlFor="reg-name">{L.fieldName}</label>
              <input id="reg-name" className="ms-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" aria-invalid={nameErr} />
              {nameErr ? <p className="ms-error">Ingresa tu nombre.</p> : null}
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="reg-email">{L.fieldEmail}</label>
              <input id="reg-email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
              {emailErr ? <p className="ms-error">Correo no válido.</p> : null}
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="reg-password">{L.fieldPassword}</label>
              <div className="au-pw">
                <input id="reg-password" className="ms-input" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mínimo 10 caracteres" autoComplete="new-password" aria-invalid={passErr} />
                {ojo}
              </div>
              {passErr ? <p className="ms-error">{problemaContrasena(password, { nombre: name, correo: email })}</p> : null}
              <ReglasContrasena password={password} nombre={name} correo={email} />
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="reg-password2">Confirmar contraseña</label>
              <input id="reg-password2" className="ms-input" value={password2} onChange={(e) => setPassword2(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Escríbela otra vez" autoComplete="new-password" aria-invalid={pass2Err} />
              {pass2Err ? <p className="ms-error">Las contraseñas no coinciden.</p> : null}
            </div>
            <div className="ms-field">
              <span className="au-checkrow au-checkrow-top">
                <button type="button" role="checkbox" aria-checked={terms} aria-label="Acepto los términos y el aviso de privacidad" onClick={() => setTerms((v) => !v)} className="ms-check">{terms ? <Icon name="check" size={12} /> : null}</button>
                <span onClick={() => setTerms((v) => !v)} className="au-checktxt">Acepto los <Link href="/terminos" onClick={(e) => e.stopPropagation()}>Términos</Link> y el <Link href="/privacidad" onClick={(e) => e.stopPropagation()}>Aviso de privacidad</Link>.</span>
              </span>
              {termsErr ? <p className="ms-error">Debes aceptar los términos.</p> : null}
            </div>
            {alerta}
            <button type="button" onClick={submitRegister} disabled={loading} className="ms-btn ms-btn-lg ms-btn-block">
              {loading ? 'Creando…' : L.registerSubmit}
            </button>
          </div>
        </div>
      ) : null}

      {/* FORGOT */}
      {view === 'forgot' ? (
        <div>
          <p className="ms-kicker">{L.forgotEyebrow}</p>
          <h1 className="au-title au-title-tight">{L.forgotTitle}</h1>
          <p className="ms-desc au-desc">{L.forgotHint}</p>
          <div className="au-stack">
            <div className="ms-field">
              <label className="ms-label" htmlFor="forgot-email">{L.fieldEmail}</label>
              <input id="forgot-email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
              {emailErr ? <p className="ms-error">Correo no válido.</p> : null}
            </div>
            {alerta}
            <button type="button" onClick={submitForgot} disabled={loading} className="ms-btn ms-btn-lg ms-btn-block">
              {loading ? 'Enviando…' : L.forgotSubmit}
            </button>
            <button type="button" onClick={() => go('login')} className="ms-btn ms-btn-sec ms-btn-block">
              <Icon name="arrowLeft" size={14} />{L.forgotBack}
            </button>
          </div>
        </div>
      ) : null}

      {/* Registro hecho: la cuenta se activa desde el correo (2026-09-23). */}
      {view === 'verificar' ? (
        <div className="au-done">
          <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="mail" size={22} /></span>
          <h1 className="au-title au-title-tight">Confirma tu correo</h1>
          <p className="ms-desc">
            Te mandamos un enlace a <strong className="au-strong">{email.trim()}</strong>. Ábrelo para activar tu cuenta: entras directo y sigues donde ibas.
          </p>
          <p className="ms-hint au-hint">Si no lo ves en unos minutos, revisa la carpeta de no deseados.</p>
          <button type="button" onClick={() => void reenviar()} className="ms-btn ms-btn-sec ms-btn-lg ms-btn-block">
            {reenviado ? 'Enlace reenviado' : 'Reenviar el enlace'}
          </button>
        </div>
      ) : null}

      {/* SUCCESS (forgot) */}
      {view === 'success' ? (
        <div className="au-done">
          <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="check" size={22} /></span>
          <h1 className="au-title au-title-tight">{L.doneTitle}</h1>
          <p className="ms-desc au-desc">{L.doneBody}</p>
          <button type="button" onClick={() => go('login')} className="ms-btn ms-btn-lg ms-btn-block">{L.forgotBack}</button>
        </div>
      ) : null}

      {/* Entrar con Google. Solo aparece si el servidor tiene credenciales. */}
      {showSocial ? (
        <div>
          <div className="au-or"><span>O continúa con</span></div>
          {/*
            Enlace, NO botón con fetch: el navegador tiene que NAVEGAR de verdad
            a accounts.google.com. Un fetch lo bloquearía el propio Google (no
            permite que su pantalla de consentimiento se cargue por XHR).
          */}
          <a href={`/api/auth/google?next=${encodeURIComponent(redirectTo || '/')}`} className="ms-btn ms-btn-sec ms-btn-lg ms-btn-block">
            <LogoGoogle /> Continuar con Google
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* Estilos propios de la tarjeta de acceso (prefijo `au-`). Lo común sale de `ms-*`. */
const CSS = `
.au-card{ width:100%; max-width:440px; margin:0 auto; box-sizing:border-box; }
.au-tabs{ display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:26px; }
.au-tabs .ms-tab{ justify-content:center; min-height:40px; }
.au-title{ margin:0 0 24px; font-family:var(--font-display); font-size:28px; font-weight:700; letter-spacing:-.025em; line-height:1.15; color:var(--color-text); text-wrap:balance; }
.au-title-tight{ margin-bottom:8px; }
.au-desc{ margin:0 0 22px; }
.au-stack{ display:grid; gap:18px; }
.au-label-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.au-small-link{ font-size:13px; }
.au-pw{ position:relative; }
.au-pw .ms-input{ padding-right:46px; }
.au-eye{ position:absolute; right:6px; top:50%; transform:translateY(-50%); width:34px; height:34px; display:grid; place-items:center; background:none; border:none; border-radius:8px; color:var(--color-text-muted); cursor:pointer; }
.au-eye:hover{ color:var(--color-text); }
.au-eye:focus-visible{ outline:2px solid var(--color-primary); outline-offset:1px; }
.au-checkrow{ display:flex; align-items:center; gap:10px; user-select:none; }
.au-checkrow-top{ align-items:flex-start; }
.au-checkrow-top .ms-check{ margin-top:1px; }
.au-checktxt{ font-size:13.5px; line-height:1.5; color:var(--color-text-muted); cursor:pointer; }
.au-checktxt a{ color:var(--color-primary); font-weight:600; text-decoration:none; }
.au-checktxt a:hover{ text-decoration:underline; }
.au-alert{ font-size:13.5px; }
.au-alert-ico{ color:var(--color-error); flex-shrink:0; margin-top:2px; display:inline-flex; }
.au-inline-link{ background:none; border:none; padding:0; font:inherit; font-weight:600; color:var(--color-primary); cursor:pointer; text-decoration:underline; }
.au-done{ display:grid; justify-items:start; gap:10px; }
.au-done .au-title{ margin-top:8px; }
.au-done .ms-desc{ margin:0; }
.au-done .ms-btn{ margin-top:10px; }
.au-hint{ margin:0; }
.au-strong{ color:var(--color-text); font-weight:600; word-break:break-all; }
.au-or{ display:flex; align-items:center; gap:14px; margin:24px 0 18px; font-size:13px; color:var(--color-text-muted); }
.au-or::before, .au-or::after{ content:''; flex:1; height:1px; background:var(--color-border); }
@media (max-width: 640px){
  .au-title{ font-size:25px; }
}
`;
