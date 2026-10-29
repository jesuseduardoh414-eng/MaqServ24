'use client';

import { evento } from '@/lib/analitica';
import { useState, type FormEvent, type ReactNode } from 'react';
import Link from '@/components/Enlace';
import { useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';
import { ReglasContrasena } from '@/components/ReglasContrasena';
import { contrasenaSegura, problemaContrasena, problemaEmail, problemaNombre } from '@maqserv/config';

type View = 'login' | 'register' | 'forgot' | 'success' | 'verificar';

// Mismas reglas que la API (@maqserv/config).
const emailOk = (v: string) => !!v && !problemaEmail(v);
const nombreProblema = (v: string) => (v.trim() ? problemaNombre(v) : 'Escribe tu nombre.');

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
  'otro-navegador': 'Por seguridad, el enlace de confirmación solo funciona en el navegador donde te registraste. Si estás en otro, entra aquí con tu correo y contraseña y te mandamos un enlace para este.',
};

/** Con qué contesta la API cuando la cuenta existe pero no ha confirmado su correo. */
const CODIGO_NO_VERIFICADO = 'email_no_verificado';

/** Logotipo oficial de Google. Va en color a propósito: es marca de un tercero. */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
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
  loginEyebrow: string; loginHeading: string; loginSub: string; loginSubmit: string;
  registerEyebrow: string; registerHeading: string; registerSub: string; registerSubmit: string;
  fieldName: string; fieldEmail: string; fieldPassword: string;
  remember: string; forgotLink: string;
  forgotEyebrow: string; forgotTitle: string; forgotHint: string; forgotSubmit: string; forgotBack: string;
  doneTitle: string; doneBody: string;
  orEmail: string; providerCta: string;
}
const DEFAULT_LABELS: AuthLabels = {
  tabLogin: 'Iniciar sesión', tabRegister: 'Crear cuenta',
  loginEyebrow: 'Bienvenido de nuevo', loginHeading: 'Entra a tu cuenta', loginSub: 'Consulta tus cotizaciones y retoma lo que dejaste pendiente.', loginSubmit: 'Entrar',
  registerEyebrow: 'Es gratis', registerHeading: 'Crea tu cuenta', registerSub: 'Con tu cuenta pides cotizaciones formales y guardas los equipos que te interesan.', registerSubmit: 'Registrarme',
  fieldName: 'Nombre completo', fieldEmail: 'Correo', fieldPassword: 'Contraseña',
  remember: 'Mantener sesión iniciada', forgotLink: '¿Olvidaste?',
  forgotEyebrow: 'Recuperar acceso', forgotTitle: '¿Olvidaste tu contraseña?',
  forgotHint: 'Escribe tu correo y te enviaremos un enlace para restablecerla.',
  forgotSubmit: 'Enviar enlace', forgotBack: 'Volver a iniciar sesión',
  doneTitle: 'Revisa tu correo', doneBody: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.',
  orEmail: 'o con tu correo', providerCta: '¿Rentas maquinaria? Regístrate como proveedor',
};

/** Campo con icono a la izquierda y, opcional, algo a la derecha (el ojo, la palomita). */
function Campo({ icono, children, derecha }: { icono: IconName; children: ReactNode; derecha?: ReactNode }) {
  return (
    <div className={`au-inp${derecha ? ' has-right' : ''}`}>
      <span className="au-inp-ico" aria-hidden><Icon name={icono} size={17} /></span>
      {children}
      {derecha}
    </div>
  );
}

/** Botón principal: flecha en reposo, giro mientras trabaja. */
function Enviar({ cargando, texto, textoCargando }: { cargando: boolean; texto: string; textoCargando: string }) {
  return (
    <button type="submit" disabled={cargando} className="ms-btn ms-btn-lg ms-btn-block au-submit">
      {cargando ? <span className="au-spin" aria-hidden /> : null}
      {cargando ? textoCargando : texto}
      {cargando ? null : <Icon name="arrowRight" size={17} className="au-submit-arrow" />}
    </button>
  );
}

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

  const nameErr = touched && view === 'register' && !!nombreProblema(name);
  const emailErr = touched && !emailOk(email.trim());
  const passErr = touched && (view === 'register' ? !contrasenaSegura(password, { nombre: name, correo: email }) : password.length < 1);
  const pass2Err = touched && view === 'register' && password2 !== password;
  const termsErr = touched && view === 'register' && !terms;
  const coinciden = password2.length > 0 && password2 === password;

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
    if (nombreProblema(name) || !emailOk(email.trim()) || !contrasenaSegura(password, { nombre: name, correo: email }) || password2 !== password || !terms) return;
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

  /*
   * Cada vista es un <form> de verdad (antes eran botones sueltos): Enter
   * envía desde cualquier campo y los gestores de contraseñas reconocen el
   * formulario. `noValidate`: la validación y sus mensajes son los nuestros.
   */
  const alEnviar = (accion: () => Promise<void>) => (e: FormEvent) => {
    e.preventDefault();
    if (!loading) void accion();
  };

  const showTabs = view === 'login' || view === 'register';
  const showSocial = showTabs && googleActivo;

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

  /** El ojo de mostrar/ocultar, dentro del campo. */
  const ojo = (
    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPw} className="au-eye">
      <OjoIcono abierto={showPw} />
    </button>
  );

  /** Encabezado de cada vista: rótulo, título y una línea de contexto. */
  const encabezado = (kicker: string, titulo: string, sub?: string) => (
    <header className="au-head">
      <p className="ms-kicker">{kicker}</p>
      <h1 className="au-title">{titulo}</h1>
      {sub ? <p className="au-sub">{sub}</p> : null}
    </header>
  );

  /*
   * Google va ARRIBA: es el camino de un clic, y ponerlo después del
   * formulario obligaba a leer cuatro campos antes de descubrirlo.
   * Es un enlace, NO un botón con fetch: el navegador tiene que NAVEGAR de
   * verdad a accounts.google.com (Google no deja cargar su pantalla de
   * consentimiento por XHR).
   */
  const social = showSocial ? (
    <>
      <a href={`/api/auth/google?next=${encodeURIComponent(redirectTo || '/')}`} className="ms-btn ms-btn-sec ms-btn-lg ms-btn-block au-google">
        <LogoGoogle /> Continuar con Google
      </a>
      <div className="au-or"><span>{L.orEmail}</span></div>
    </>
  ) : null;

  return (
    <div className="au-card">
      <style>{CSS}</style>

      {showTabs ? (
        <div className="au-seg" role="tablist" aria-label="Acceso" data-activo={view}>
          <button type="button" role="tab" onClick={() => go('login')} aria-selected={view === 'login'}>{L.tabLogin}</button>
          <button type="button" role="tab" onClick={() => go('register')} aria-selected={view === 'register'}>{L.tabRegister}</button>
        </div>
      ) : null}

      {/* `key`: al cambiar de vista, el contenido entra con su animación. */}
      <div key={view} className="au-view">
        {/* LOGIN */}
        {view === 'login' ? (
          <form onSubmit={alEnviar(submitLogin)} noValidate>
            {encabezado(L.loginEyebrow, L.loginHeading, L.loginSub)}
            {social}
            <div className="au-stack">
              <div className="ms-field">
                <label className="ms-label" htmlFor="login-email">{L.fieldEmail}</label>
                <Campo icono="mail">
                  <input id="login-email" type="email" inputMode="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
                </Campo>
                {emailErr ? <p className="ms-error">Escribe un correo válido, como nombre@empresa.com.</p> : null}
              </div>
              <div className="ms-field">
                <div className="au-label-row">
                  <label className="ms-label" htmlFor="login-password">{L.fieldPassword}</label>
                  <button type="button" onClick={() => go('forgot')} className="ms-link au-small-link">{L.forgotLink}</button>
                </div>
                <Campo icono="lock" derecha={ojo}>
                  <input id="login-password" className="ms-input" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Tu contraseña" autoComplete="current-password" aria-invalid={passErr} />
                </Campo>
                {passErr ? <p className="ms-error">Escribe tu contraseña.</p> : null}
              </div>
              <label className="au-checkrow">
                <input type="checkbox" className="au-check" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="au-checktxt">{L.remember}</span>
              </label>
              {alerta}
              <Enviar cargando={loading} texto={L.loginSubmit} textoCargando="Entrando…" />
            </div>
          </form>
        ) : null}

        {/* REGISTER */}
        {view === 'register' ? (
          <form onSubmit={alEnviar(submitRegister)} noValidate>
            {encabezado(L.registerEyebrow, L.registerHeading, L.registerSub)}
            {social}
            <div className="au-stack">
              <div className="ms-field">
                <label className="ms-label" htmlFor="reg-name">{L.fieldName}</label>
                <Campo icono="user">
                  <input id="reg-name" className="ms-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" maxLength={100} aria-invalid={nameErr} />
                </Campo>
                {nameErr ? <p className="ms-error">{nombreProblema(name)}</p> : null}
              </div>
              <div className="ms-field">
                <label className="ms-label" htmlFor="reg-email">{L.fieldEmail}</label>
                <Campo icono="mail">
                  <input id="reg-email" type="email" inputMode="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
                </Campo>
                {emailErr ? <p className="ms-error">Escribe un correo válido, como nombre@empresa.com.</p> : null}
              </div>
              <div className="ms-field">
                <label className="ms-label" htmlFor="reg-password">{L.fieldPassword}</label>
                <Campo icono="lock" derecha={ojo}>
                  <input id="reg-password" className="ms-input" value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mínimo 10 caracteres" autoComplete="new-password" aria-invalid={passErr} />
                </Campo>
                {passErr ? <p className="ms-error">{problemaContrasena(password, { nombre: name, correo: email })}</p> : null}
                <ReglasContrasena password={password} nombre={name} correo={email} compacta />
              </div>
              <div className="ms-field">
                <label className="ms-label" htmlFor="reg-password2">Confirma tu contraseña</label>
                <Campo
                  icono="lock"
                  derecha={coinciden ? <span className="au-ok" title="Coinciden"><Icon name="check" size={16} /><span className="sr-only">Las contraseñas coinciden</span></span> : undefined}
                >
                  <input id="reg-password2" className="ms-input" value={password2} onChange={(e) => setPassword2(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Escríbela otra vez" autoComplete="new-password" aria-invalid={pass2Err} />
                </Campo>
                {pass2Err ? <p className="ms-error">Las contraseñas no coinciden.</p> : null}
              </div>
              <div className="ms-field">
                <label className="au-checkrow au-checkrow-top">
                  <input type="checkbox" className="au-check" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={termsErr} />
                  <span className="au-checktxt">
                    Acepto los <Link href="/terminos">Términos</Link> y el <Link href="/privacidad">Aviso de privacidad</Link>.
                  </span>
                </label>
                {termsErr ? <p className="ms-error">Para crear la cuenta, acepta los términos.</p> : null}
              </div>
              {alerta}
              <Enviar cargando={loading} texto={L.registerSubmit} textoCargando="Creando tu cuenta…" />
            </div>
            {/* Quien llega aquí queriendo OFRECER equipo, no rentarlo. */}
            <Link href="/proveedores" className="au-prov">
              <Icon name="truck" size={16} />
              <span>{L.providerCta}</span>
              <Icon name="arrowRight" size={15} className="au-prov-arrow" />
            </Link>
          </form>
        ) : null}

        {/* FORGOT */}
        {view === 'forgot' ? (
          <form onSubmit={alEnviar(submitForgot)} noValidate>
            <button type="button" onClick={() => go('login')} className="au-back">
              <Icon name="arrowLeft" size={15} />{L.forgotBack}
            </button>
            {encabezado(L.forgotEyebrow, L.forgotTitle, L.forgotHint)}
            <div className="au-stack">
              <div className="ms-field">
                <label className="ms-label" htmlFor="forgot-email">{L.fieldEmail}</label>
                <Campo icono="mail">
                  <input id="forgot-email" type="email" inputMode="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" aria-invalid={emailErr} />
                </Campo>
                {emailErr ? <p className="ms-error">Escribe un correo válido, como nombre@empresa.com.</p> : null}
              </div>
              {alerta}
              <Enviar cargando={loading} texto={L.forgotSubmit} textoCargando="Enviando…" />
            </div>
          </form>
        ) : null}

        {/* Registro hecho: la cuenta se activa desde el correo (2026-09-23). */}
        {view === 'verificar' ? (
          <div className="au-done">
            <span className="au-done-ico" aria-hidden><Icon name="mail" size={24} /></span>
            <h1 className="au-title">Confirma tu correo</h1>
            <p className="au-sub">
              Te mandamos un enlace a <strong className="au-strong">{email.trim()}</strong>. Ábrelo para activar tu cuenta: entras directo y sigues donde ibas.
            </p>
            <p className="ms-hint">Si no lo ves en unos minutos, revisa la carpeta de no deseados.</p>
            <button type="button" onClick={() => void reenviar()} className="ms-btn ms-btn-sec ms-btn-lg ms-btn-block">
              {reenviado ? <><Icon name="check" size={16} />Enlace reenviado</> : 'Reenviar el enlace'}
            </button>
          </div>
        ) : null}

        {/* SUCCESS (forgot) */}
        {view === 'success' ? (
          <div className="au-done">
            <span className="au-done-ico" aria-hidden><Icon name="check" size={24} /></span>
            <h1 className="au-title">{L.doneTitle}</h1>
            <p className="au-sub">{L.doneBody}</p>
            <button type="button" onClick={() => go('login')} className="ms-btn ms-btn-lg ms-btn-block">{L.forgotBack}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* Estilos propios de la tarjeta de acceso (prefijo `au-`). Lo común sale de `ms-*`. */
const CSS = `
.au-card{ width:100%; max-width:420px; margin:0 auto; box-sizing:border-box; }

/* Selector Iniciar sesión / Crear cuenta: una pieza con indicador que se desliza. */
.au-seg{
  --au-track:color-mix(in srgb, var(--color-text) 5%, var(--color-surface));
  --au-thumb:var(--color-surface);
  position:relative; display:grid; grid-template-columns:1fr 1fr; padding:4px; margin-bottom:30px;
  border-radius:12px; background:var(--au-track); border:1px solid var(--color-border);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .au-seg{ --au-thumb:color-mix(in srgb, var(--color-text) 11%, var(--color-surface)); } }
:root[data-theme="dark"] .au-seg{ --au-thumb:color-mix(in srgb, var(--color-text) 11%, var(--color-surface)); }
.au-seg::before{
  content:''; position:absolute; top:4px; bottom:4px; left:4px; width:calc(50% - 4px); border-radius:9px;
  background:var(--au-thumb); box-shadow:0 1px 3px rgba(0,0,0,.18), inset 0 0 0 1px color-mix(in srgb, var(--color-text) 8%, transparent);
  transition:transform .28s cubic-bezier(.2,.8,.2,1);
}
.au-seg[data-activo="register"]::before{ transform:translateX(100%); }
.au-seg button{
  position:relative; z-index:1; min-height:38px; border:0; border-radius:9px; background:none; cursor:pointer;
  font:inherit; font-size:14px; font-weight:600; color:var(--color-text-muted); transition:color .2s ease;
}
.au-seg button:hover{ color:var(--color-text); }
.au-seg button[aria-selected="true"]{ color:var(--color-text); }
.au-seg button:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }

.au-view{ animation:au-in .32s cubic-bezier(.2,.8,.2,1); }
@keyframes au-in{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }

.au-head{ margin-bottom:26px; }
.au-head .ms-kicker{ margin-bottom:10px; }
.au-title{ margin:0; font-family:var(--font-display); font-size:32px; font-weight:700; letter-spacing:-.03em; line-height:1.1; color:var(--color-text); text-wrap:balance; }
.au-sub{ margin:10px 0 0; font-size:14.5px; line-height:1.55; color:var(--color-text-muted); text-wrap:pretty; }

.au-google{ gap:10px; font-weight:600; }
.au-or{ display:flex; align-items:center; gap:14px; margin:20px 0; font-size:12.5px; color:var(--color-text-muted); }
.au-or::before, .au-or::after{ content:''; flex:1; height:1px; background:var(--color-border); }

.au-stack{ display:grid; gap:18px; }
.au-label-row{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.au-small-link{ font-size:13px; font-weight:600; }

/* Campo con icono */
.au-inp{ position:relative; }
.au-inp .ms-input{ min-height:48px; padding-left:42px; border-radius:10px; }
.au-inp.has-right .ms-input{ padding-right:46px; }
.au-inp-ico{ position:absolute; left:14px; top:50%; transform:translateY(-50%); display:flex; color:var(--color-text-muted); pointer-events:none; transition:color .18s ease; }
.au-inp:focus-within .au-inp-ico{ color:var(--color-primary); }
.au-inp .ms-input[aria-invalid="true"] ~ .au-inp-ico, .au-inp:has(.ms-input[aria-invalid="true"]) .au-inp-ico{ color:var(--color-error); }
.au-eye{ position:absolute; right:7px; top:50%; transform:translateY(-50%); width:34px; height:34px; display:grid; place-items:center; background:none; border:none; border-radius:8px; color:var(--color-text-muted); cursor:pointer; transition:color .18s ease, background .18s ease; }
.au-eye:hover{ color:var(--color-text); background:color-mix(in srgb, var(--color-text) 7%, transparent); }
.au-eye:focus-visible{ outline:2px solid var(--color-primary); outline-offset:1px; }
.au-ok{ position:absolute; right:14px; top:50%; transform:translateY(-50%); display:flex; color:var(--color-success); }

/* Casillas nativas con el color de marca: accesibles sin trucos de role="checkbox". */
.au-checkrow{ display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
.au-checkrow-top{ align-items:flex-start; }
.au-check{ width:18px; height:18px; margin:0; flex-shrink:0; accent-color:var(--color-primary); cursor:pointer; }
.au-checkrow-top .au-check{ margin-top:2px; }
.au-check[aria-invalid="true"]{ outline:2px solid var(--color-error); outline-offset:2px; border-radius:4px; }
.au-checktxt{ font-size:13.5px; line-height:1.5; color:var(--color-text-muted); }
.au-checktxt a{ color:var(--color-primary); font-weight:600; text-decoration:none; }
.au-checktxt a:hover{ text-decoration:underline; }

.au-submit{ margin-top:4px; gap:9px; font-weight:700; }
.au-submit-arrow{ transition:transform .2s ease; }
.au-submit:hover .au-submit-arrow{ transform:translateX(3px); }
.au-spin{ width:16px; height:16px; border-radius:50%; border:2px solid currentColor; border-right-color:transparent; animation:au-girar .7s linear infinite; }
@keyframes au-girar{ to{ transform:rotate(360deg); } }

.au-alert{ font-size:13.5px; }
.au-alert-ico{ color:var(--color-error); flex-shrink:0; margin-top:2px; display:inline-flex; }
.au-inline-link{ background:none; border:none; padding:0; font:inherit; font-weight:600; color:var(--color-primary); cursor:pointer; text-decoration:underline; }

.au-prov{
  display:flex; align-items:center; gap:10px; margin-top:24px; padding:13px 14px; border-radius:10px;
  border:1px dashed var(--color-border); color:var(--color-text-muted); font-size:13.5px; font-weight:500; text-decoration:none;
  transition:border-color .18s ease, color .18s ease;
}
.au-prov > svg:first-child{ color:var(--color-primary); flex-shrink:0; }
.au-prov span{ flex:1; }
.au-prov:hover{ color:var(--color-text); border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.au-prov-arrow{ transition:transform .2s ease; }
.au-prov:hover .au-prov-arrow{ transform:translateX(3px); }

.au-back{ display:inline-flex; align-items:center; gap:7px; margin:0 0 22px; padding:0; border:0; background:none; font:inherit; font-size:13.5px; font-weight:600; color:var(--color-text-muted); cursor:pointer; }
.au-back:hover{ color:var(--color-text); }

.au-done{ display:grid; justify-items:start; gap:12px; }
.au-done-ico{ width:52px; height:52px; display:grid; place-items:center; border-radius:14px; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 12%, transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 25%, transparent); margin-bottom:6px; }
.au-done .au-sub{ margin:0; }
.au-done .ms-btn{ margin-top:10px; }
.au-strong{ color:var(--color-text); font-weight:600; word-break:break-all; }

@media (prefers-reduced-motion: reduce){
  .au-view{ animation:none; }
  .au-seg::before{ transition:none; }
}
@media (max-width: 640px){
  .au-title{ font-size:27px; }
}
`;
