'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ShPopover, ShPopoverContent, ShPopoverTrigger, mostrarResultado } from '@maqserv/ui';
import { contrasenaSegura } from '@maqserv/config';
import { Modal } from './Modal';
import { Btn, FormField, Note } from './ui';
import { ReglasContrasena } from './ReglasContrasena';

/**
 * MI CUENTA (2026-10-28, decisión del dueño: un menú donde está el usuario,
 * con modo claro y "las demás opciones"). Se abre desde el perfil de abajo
 * del menú lateral y desde el avatar de arriba: quién soy, Apariencia
 * (oscuro · claro · como el sistema), Cambiar mi contraseña y Cerrar sesión.
 * La contraseña se cambia con la actual en la mano: nadie más la ve ni la toca.
 */

export type Apariencia = 'dark' | 'light' | 'system';
export const CLAVE_APARIENCIA = 'maqserv_admin_theme';

/** Qué tema toca pintar según la preferencia guardada. */
function resolver(a: Apariencia): 'dark' | 'light' {
  if (a === 'light' || a === 'dark') return a;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function leerApariencia(): Apariencia {
  try {
    const v = localStorage.getItem(CLAVE_APARIENCIA);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}
export function aplicarApariencia(a: Apariencia) {
  document.documentElement.setAttribute('data-theme', resolver(a));
}

export function MiCuenta({ trigger, nombre, correo, rol, onCerrarSesion }: {
  /** El botón que abre el menú (el perfil de abajo o el avatar de arriba). */
  trigger: ReactNode;
  nombre: string;
  correo?: string;
  rol?: string;
  onCerrarSesion: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [apariencia, setApariencia] = useState<Apariencia>('dark');
  // Avisos sin leer: los cuenta la campana (AvisosBell) y los manda por evento.
  const [avisos, setAvisos] = useState(0);
  const [cambiando, setCambiando] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [otraVez, setOtraVez] = useState('');
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setApariencia(leerApariencia()); }, []);
  useEffect(() => {
    const f = (e: Event) => setAvisos((e as CustomEvent<{ unread: number }>).detail?.unread ?? 0);
    window.addEventListener('adm:avisos-estado', f);
    window.dispatchEvent(new Event('adm:avisos-pedir'));
    return () => window.removeEventListener('adm:avisos-estado', f);
  }, []);
  // "Como el sistema": si el sistema cambia de modo con el panel abierto, el panel lo sigue.
  useEffect(() => {
    if (apariencia !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const f = () => aplicarApariencia('system');
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [apariencia]);

  function elegirApariencia(a: Apariencia) {
    setApariencia(a);
    try { localStorage.setItem(CLAVE_APARIENCIA, a); } catch { /* sin almacenamiento: solo esta vista */ }
    aplicarApariencia(a);
  }

  const segura = contrasenaSegura(nueva, { nombre, correo });
  const listo = actual.length > 0 && segura && otraVez === nueva;

  function cerrar() {
    setCambiando(false);
    setActual(''); setNueva(''); setOtraVez(''); setVer(false); setError(null);
  }

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/mi-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof d?.message === 'string' ? d.message : 'No se pudo cambiar la contraseña.');
      mostrarResultado('Contraseña cambiada. Las sesiones que hubiera abiertas con la anterior quedaron cerradas.', 'ok');
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  const OPCIONES: { clave: Apariencia; texto: string; icono: string }[] = [
    { clave: 'dark', texto: 'Oscuro', icono: 'ph-moon' },
    { clave: 'light', texto: 'Claro', icono: 'ph-sun' },
    { clave: 'system', texto: 'Sistema', icono: 'ph-desktop' },
  ];

  return (
    <>
      <style>{`
        .mc-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--adm-text); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; white-space: nowrap; }
        .mc-item i { font-size: 16px; color: var(--adm-muted); }
        .mc-item:hover { background: rgba(var(--adm-ink), 0.05); }
        .mc-quien { padding: 6px 10px 10px; border-bottom: 1px solid var(--adm-border); margin-bottom: 4px; }
        .mc-quien b { display: block; font-size: 13.5px; font-weight: 600; color: var(--adm-text); }
        .mc-quien span { display: block; font-size: 12px; color: var(--adm-muted); overflow: hidden; text-overflow: ellipsis; }
        .mc-sec { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--adm-faint); }
        .mc-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin: 0 6px 6px; padding: 3px; border: 1px solid var(--adm-border-strong); border-radius: 9px; }
        .mc-seg button { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 4px; border: 0; border-radius: 6px; background: transparent; color: var(--adm-muted); font: inherit; font-size: 11.5px; cursor: pointer; }
        .mc-seg button i { font-size: 16px; }
        .mc-seg button:hover { color: var(--adm-text); background: rgba(var(--adm-ink), 0.04); }
        .mc-seg button[aria-pressed="true"] { background: rgba(var(--adm-ink), 0.09); color: var(--adm-text); font-weight: 600; box-shadow: inset 0 0 0 1px rgba(var(--adm-ink), 0.06); }
        .mc-sep { height: 1px; background: var(--adm-border); margin: 4px 0; }
        .mc-cuenta { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--adm-bad); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
        .mc-ojo { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); }
      `}</style>
      <ShPopover open={abierto} onOpenChange={setAbierto}>
        <ShPopoverTrigger asChild>{trigger}</ShPopoverTrigger>
        <ShPopoverContent
          align="start"
          side="top"
          sideOffset={8}
          collisionPadding={12}
          style={{ width: 250, background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px -20px var(--adm-sombra)', textAlign: 'left' }}
        >
          <div className="mc-quien"><b>{nombre}</b>{correo ? <span>{correo}</span> : null}{rol ? <span>{rol}</span> : null}</div>
          <button type="button" className="mc-item" onClick={() => { setAbierto(false); window.dispatchEvent(new Event('adm:avisos-abrir')); }}>
            <i className={`ph ${avisos > 0 ? 'ph-bell-ringing' : 'ph-bell'}`} aria-hidden />Avisos
            {avisos > 0 ? <span className="mc-cuenta" aria-label={`${avisos} sin leer`}>{avisos > 99 ? '99+' : avisos}</span> : null}
          </button>
          <div className="mc-sep" />
          <div className="mc-sec">Apariencia</div>
          <div className="mc-seg" role="group" aria-label="Apariencia">
            {OPCIONES.map((o) => (
              <button key={o.clave} type="button" aria-pressed={apariencia === o.clave} onClick={() => elegirApariencia(o.clave)}>
                <i className={`ph ${o.icono}`} aria-hidden />{o.texto}
              </button>
            ))}
          </div>
          <div className="mc-sep" />
          <button type="button" className="mc-item" onClick={() => { setAbierto(false); setCambiando(true); }}>
            <i className="ph ph-key" aria-hidden />Cambiar mi contraseña
          </button>
          <button type="button" className="mc-item" onClick={() => { setAbierto(false); onCerrarSesion(); }}>
            <i className="ph ph-sign-out" aria-hidden />Cerrar sesión
          </button>
        </ShPopoverContent>
      </ShPopover>

      {cambiando ? (
        <Modal
          abierto
          titulo="Cambiar mi contraseña"
          subtitulo="Primero la de ahora, luego la nueva. Las sesiones abiertas con la anterior se cierran."
          onCerrar={cerrar}
          ancho={460}
          pie={
            <>
              <Btn variant="ghost" onClick={cerrar} disabled={busy}>Cancelar</Btn>
              <Btn variant="primary" onClick={() => void guardar()} disabled={busy || !listo}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</Btn>
            </>
          }
        >
          {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
          <div style={{ display: 'grid', gap: 14 }}>
            <FormField label="Contraseña actual">
              <input className="adm-input" type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" autoFocus />
            </FormField>
            <FormField label="Contraseña nueva">
              <div style={{ position: 'relative' }}>
                <input className="adm-input" type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" placeholder="Mínimo 10 caracteres" style={{ paddingRight: 40 }} />
                <button type="button" className="adm-ibtn is-plain mc-ojo" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'} aria-pressed={ver}>
                  <i className={`ph ${ver ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden />
                </button>
              </div>
              <ReglasContrasena password={nueva} nombre={nombre} correo={correo} />
            </FormField>
            <FormField label="Repítela" help={otraVez && otraVez !== nueva ? <span style={{ color: 'var(--adm-bad)' }}>No coinciden.</span> : undefined}>
              <input className="adm-input" type={ver ? 'text' : 'password'} value={otraVez} onChange={(e) => setOtraVez(e.target.value)} autoComplete="new-password" />
            </FormField>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
