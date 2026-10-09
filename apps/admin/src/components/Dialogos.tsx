'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * DIÁLOGOS DEL SISTEMA (2026-10-09).
 *
 * "En ningún momento deben aparecer las alertas de Google": los `confirm`,
 * `alert` y `prompt` del navegador salían con la marca del dominio
 * ("admin.maqserv24.com dice"), con los colores del navegador y encima del
 * panel. Estos tres los sustituyen con el diseño del panel y se usan igual de
 * fácil, con `await`:
 *
 *   if (!(await confirmar({ titulo: '¿Eliminar el mensaje?', peligro: true, confirmar: 'Eliminar' }))) return;
 *   const motivo = await pedirTexto({ titulo: '¿Por qué se cancela?', multilinea: true });
 *   await avisar({ titulo: 'No se pudo eliminar', peligro: true });
 *
 * `DialogosHost` va montado una sola vez en AdminShell. Si se pide un diálogo
 * antes de que monte, espera en cola: nunca se cae al diálogo del navegador.
 */

export interface OpcionesDialogo {
  titulo: string;
  mensaje?: ReactNode;
  /** Texto del botón principal. */
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
  /** Sin texto no se puede confirmar. */
  requerido?: boolean;
  /** Elegir una opción en vez de escribir. */
  opciones?: ReadonlyArray<{ valor: string; texto: string }>;
}

type Pendiente = { id: number } & (
  | { tipo: 'confirmar'; o: OpcionesDialogo; resolver: (v: boolean) => void }
  | { tipo: 'pedir'; o: OpcionesPedir; resolver: (v: string | null) => void }
  | { tipo: 'avisar'; o: OpcionesDialogo; resolver: () => void }
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

/** Pide un texto (o una opción). Resuelve `null` si se cancela. */
export function pedirTexto(o: OpcionesPedir): Promise<string | null> {
  return new Promise((resolver) => abrir({ id: siguiente++, tipo: 'pedir', o, resolver }));
}

/** Un aviso con un solo botón. */
export function avisar(o: OpcionesDialogo): Promise<void> {
  return new Promise((resolver) => abrir({ id: siguiente++, tipo: 'avisar', o, resolver: () => resolver() }));
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
    else if (actual.tipo === 'pedir') actual.resolver(typeof valor === 'string' ? valor : null);
    else actual.resolver();
    setFila((f) => f.slice(1));
  }
  return createPortal(<Dialogo key={actual.id} p={actual} onCerrar={cerrar} />, document.body);
}

function Dialogo({ p, onCerrar }: { p: Pendiente; onCerrar: (v: boolean | string | null) => void }) {
  const o = p.o;
  const pedir = p.tipo === 'pedir' ? p.o : null;
  const [texto, setTexto] = useState(pedir?.valor ?? '');
  const enfoque = useRef<HTMLElement | null>(null);

  const falta = Boolean(pedir && (pedir.requerido || pedir.opciones) && !texto.trim());
  const aceptar = () => {
    if (falta) return;
    onCerrar(p.tipo === 'pedir' ? texto.trim() : true);
  };
  const cancelar = () => onCerrar(p.tipo === 'pedir' ? null : false);

  // Las teclas leen siempre la versión más reciente de aceptar/cancelar.
  const acciones = useRef({ aceptar, cancelar });
  acciones.current = { aceptar, cancelar };

  useEffect(() => {
    const antes = document.activeElement;
    enfoque.current?.focus();
    // En captura y con preventDefault: si el diálogo sale encima de un Modal,
    // Esc cierra SOLO el diálogo (el Modal ignora los Esc ya atendidos).
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); acciones.current.cancelar();
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault(); acciones.current.aceptar();
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      if (antes instanceof HTMLElement) antes.focus();
    };
  }, []);

  const icono = o.peligro ? 'ph-warning-circle' : p.tipo === 'avisar' ? 'ph-info' : 'ph-question';
  const tono = o.peligro ? 'var(--adm-bad)' : 'var(--adm-accent)';
  const fija = (el: HTMLElement | null) => { if (el && !enfoque.current) enfoque.current = el; };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancelar(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-titulo"
        aria-describedby={o.mensaje ? 'dlg-mensaje' : undefined}
        style={{
          width: 'min(460px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          background: 'var(--adm-card)', border: '1px solid var(--adm-border-strong)', borderRadius: 14,
          boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)', padding: '22px 22px 18px', animation: 'fadeIn .16s ease',
          fontFamily: 'var(--font-sans, inherit)', color: 'var(--adm-text)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center', color: tono, background: `color-mix(in srgb, ${tono} 14%, transparent)` }}>
            <i className={`ph ${icono}`} style={{ fontSize: 19 }} aria-hidden />
          </span>
          <div style={{ minWidth: 0, flex: 1, paddingTop: 6 }}>
            <h2 id="dlg-titulo" style={{ margin: 0, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: 'var(--adm-text)' }}>{o.titulo}</h2>
            {o.mensaje ? (
              <div id="dlg-mensaje" style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: 'var(--adm-text-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{o.mensaje}</div>
            ) : null}
          </div>
        </div>

        {pedir ? (
          <div style={{ marginTop: 16, display: 'grid', gap: 6 }}>
            {pedir.etiqueta ? <span className="adm-label">{pedir.etiqueta}</span> : null}
            {pedir.opciones ? (
              <div role="radiogroup" aria-label={pedir.etiqueta ?? o.titulo} style={{ display: 'grid', gap: 6 }}>
                {pedir.opciones.map((op) => {
                  const on = texto === op.valor;
                  return (
                    <button
                      key={op.valor}
                      ref={fija}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTexto(op.valor)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--adm-text)',
                        background: on ? 'color-mix(in srgb, var(--adm-accent) 12%, transparent)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${on ? 'color-mix(in srgb, var(--adm-accent) 55%, transparent)' : 'var(--adm-border-strong)'}`,
                      }}
                    >
                      <i className={`ph ${on ? 'ph-radio-button' : 'ph-circle'}`} style={{ fontSize: 16, color: on ? 'var(--adm-accent)' : 'var(--adm-faint)' }} aria-hidden />
                      {op.texto}
                    </button>
                  );
                })}
              </div>
            ) : pedir.multilinea ? (
              <textarea ref={fija} className="adm-textarea" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedir.placeholder} aria-label={pedir.etiqueta ?? o.titulo} />
            ) : (
              <input ref={fija} className="adm-input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={pedir.placeholder} aria-label={pedir.etiqueta ?? o.titulo} />
            )}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {p.tipo !== 'avisar' ? (
            // En lo peligroso el foco empieza en Cancelar: un Enter sin querer no borra nada.
            <button ref={o.peligro ? fija : undefined} type="button" className="adm-btn adm-btn-ghost" onClick={cancelar}>{o.cancelar ?? 'Cancelar'}</button>
          ) : null}
          <button
            ref={o.peligro && p.tipo !== 'avisar' ? undefined : fija}
            type="button"
            className={`adm-btn ${o.peligro && p.tipo !== 'avisar' ? 'adm-btn-danger-solid' : 'adm-btn-primary'}`}
            onClick={aceptar}
            disabled={falta}
          >
            {o.confirmar ?? (p.tipo === 'avisar' ? 'Entendido' : 'Aceptar')}
          </button>
        </div>
      </div>
    </div>
  );
}
