'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';

/**
 * DIÁLOGOS DEL SITIO (2026-10-09). Los del navegador (`confirm`, `prompt`)
 * salían con "maqserv24.com dice" y los colores del navegador, en medio del
 * portal del aliado. Mismo contrato que los del panel (apps/admin/…/Dialogos)
 * con las piezas del sitio (`ms-*`), así siguen el tema claro u oscuro:
 *
 *   if (!(await confirmar({ titulo: '¿Ya saliste a la obra?', confirmar: 'Sí, ya salí' }))) return;
 *   const donde = await pedirTexto({ titulo: '¿Dónde está ahora?', valor: actual });
 *
 * `DialogosHost` va montado una vez en el layout raíz.
 */

export interface OpcionesDialogo {
  titulo: string;
  mensaje?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  /** Acción que borra o no tiene vuelta: botón e icono en rojo. */
  peligro?: boolean;
}

export interface OpcionesPedir extends OpcionesDialogo {
  etiqueta?: string;
  valor?: string;
  placeholder?: string;
  multilinea?: boolean;
  requerido?: boolean;
}

type Pendiente = { id: number } & (
  | { tipo: 'confirmar'; o: OpcionesDialogo; resolver: (v: boolean) => void }
  | { tipo: 'pedir'; o: OpcionesPedir; resolver: (v: string | null) => void }
);

let siguiente = 1;
let encolar: ((p: Pendiente) => void) | null = null;
const enEspera: Pendiente[] = [];
function abrir(p: Pendiente) {
  if (encolar) encolar(p);
  else enEspera.push(p);
}

/** Sí / no. Resuelve `true` solo si se confirma. */
export function confirmar(o: OpcionesDialogo): Promise<boolean> {
  return new Promise((resolver) => abrir({ id: siguiente++, tipo: 'confirmar', o, resolver }));
}

/** Pide un texto. Resuelve `null` si se cancela. */
export function pedirTexto(o: OpcionesPedir): Promise<string | null> {
  return new Promise((resolver) => abrir({ id: siguiente++, tipo: 'pedir', o, resolver }));
}

export function DialogosHost() {
  const [fila, setFila] = useState<Pendiente[]>([]);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    encolar = (p) => setFila((f) => [...f, p]);
    if (enEspera.length) setFila((f) => [...f, ...enEspera.splice(0)]);
    return () => { encolar = null; };
  }, []);

  const actual = fila[0];
  if (!montado || !actual) return null;
  function cerrar(valor: boolean | string | null) {
    if (actual.tipo === 'confirmar') actual.resolver(valor === true);
    else actual.resolver(typeof valor === 'string' ? valor : null);
    setFila((f) => f.slice(1));
  }
  return createPortal(<Dialogo key={actual.id} p={actual} onCerrar={cerrar} />, document.body);
}

function Dialogo({ p, onCerrar }: { p: Pendiente; onCerrar: (v: boolean | string | null) => void }) {
  const o = p.o;
  const pedir = p.tipo === 'pedir' ? p.o : null;
  const [texto, setTexto] = useState(pedir?.valor ?? '');
  const enfoque = useRef<HTMLElement | null>(null);

  const falta = Boolean(pedir?.requerido && !texto.trim());
  const aceptar = () => { if (!falta) onCerrar(pedir ? texto.trim() : true); };
  const cancelar = () => onCerrar(pedir ? null : false);
  const acciones = useRef({ aceptar, cancelar });
  acciones.current = { aceptar, cancelar };

  useEffect(() => {
    const antes = document.activeElement;
    enfoque.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acciones.current.cancelar(); }
      else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); acciones.current.aceptar(); }
    };
    document.addEventListener('keydown', tecla, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.body.style.overflow = overflow;
      if (antes instanceof HTMLElement) antes.focus();
    };
  }, []);

  const fija = (el: HTMLElement | null) => { if (el && !enfoque.current) enfoque.current = el; };
  const tono = o.peligro ? 'var(--color-error)' : 'var(--color-primary)';

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancelar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-titulo"
        aria-describedby={o.mensaje ? 'dlg-mensaje' : undefined}
        style={{
          width: 'min(440px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '22px 22px 18px',
          background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 14,
          boxShadow: '0 30px 80px -30px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center', color: tono, background: `color-mix(in srgb, ${tono} 14%, transparent)` }}>
            <Icon name={o.peligro ? 'warning' : 'chat'} size={18} />
          </span>
          <div style={{ minWidth: 0, flex: 1, paddingTop: 6 }}>
            <h2 id="dlg-titulo" style={{ margin: 0, fontSize: 16.5, fontWeight: 600, lineHeight: 1.35 }}>{o.titulo}</h2>
            {o.mensaje ? (
              <div id="dlg-mensaje" style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{o.mensaje}</div>
            ) : null}
          </div>
        </div>

        {pedir ? (
          <div className="ms-field" style={{ marginTop: 16 }}>
            {pedir.etiqueta ? <span className="ms-label">{pedir.etiqueta}</span> : null}
            {pedir.multilinea ? (
              <textarea ref={fija} className="ms-textarea" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedir.placeholder} aria-label={pedir.etiqueta ?? o.titulo} style={{ minHeight: 90 }} />
            ) : (
              <input ref={fija} className="ms-input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedir.placeholder} aria-label={pedir.etiqueta ?? o.titulo} />
            )}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {/* En lo peligroso el foco empieza en Cancelar: un Enter sin querer no borra nada. */}
          <button ref={o.peligro ? fija : undefined} type="button" className="ms-btn ms-btn-sm ms-btn-sec" onClick={cancelar}>{o.cancelar ?? 'Cancelar'}</button>
          <button
            ref={o.peligro ? undefined : fija}
            type="button"
            className="ms-btn ms-btn-sm"
            onClick={aceptar}
            disabled={falta}
            style={o.peligro ? { background: 'var(--color-error)', borderColor: 'var(--color-error)', color: '#fff' } : undefined}
          >
            {o.confirmar ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
