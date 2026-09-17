'use client';

import type { ReactNode } from 'react';
import { IconoCotizador } from './iconos';

/** Etiqueta + control. El asterisco solo aparece donde de verdad es obligatorio. */
export function Campo({
  label,
  req,
  help,
  error,
  ancho,
  children,
}: {
  label: string;
  req?: boolean;
  help?: string;
  error?: string | null;
  ancho?: 'full';
  children: ReactNode;
}) {
  return (
    <label className={`cz-field${ancho === 'full' ? ' full' : ''}`}>
      <span className="cz-lbl">
        {label}
        {req ? <span className="req"> *</span> : null}
      </span>
      {children}
      {error ? <span className="cz-err">{error}</span> : help ? <span className="cz-help">{help}</span> : null}
    </label>
  );
}

/**
 * Contador con −/+ y campo escribible.
 *
 * El campo del medio se deja editar a mano aunque existan los botones: subir a
 * 30 días a golpe de "+" son 30 clics, y el primer usuario que lo intente va a
 * teclear. Se guarda el texto crudo mientras escribe y solo se normaliza al
 * salir del campo — validar en cada tecla borraba el número a medio escribir.
 */
export function Contador({
  valor,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  paso = 1,
  ariaLabel,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  ariaLabel: string;
}) {
  const acotar = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="cz-stp">
      <button type="button" aria-label={`Restar ${ariaLabel}`} onClick={() => onChange(acotar(valor - paso))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={String(valor)}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(Number.isNaN(v) ? min : acotar(v));
        }}
      />
      <button type="button" aria-label={`Sumar ${ariaLabel}`} onClick={() => onChange(acotar(valor + paso))}>
        +
      </button>
    </div>
  );
}

/**
 * Campo numérico de texto libre (toneladas, m³, precios).
 *
 * Guarda una CADENA, no un número: un campo de decimales que se valida en cada
 * tecla no deja escribir "0.5" (al teclear el punto, `Number('0.')` no es
 * finito y el valor se borraba). El motor ya sabe leer cadenas vacías como 0.
 */
export function NumeroTexto({
  valor,
  onChange,
  placeholder,
  ariaLabel,
  decimal,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  decimal?: boolean;
}) {
  return (
    <input
      className="cz-input"
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      step={decimal ? '0.01' : '1'}
      min="0"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="cz-chip" data-on={on ? '1' : '0'} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/** Tarjeta del catálogo. `n` = cuántas veces se agregó (badge). */
export function Tarjeta({
  icono,
  titulo,
  nota,
  n,
  onClick,
}: {
  icono: string;
  titulo: string;
  nota?: string;
  n?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="cz-pick" data-on={n && n > 0 ? '1' : '0'} onClick={onClick}>
      {n && n > 0 ? <span className="n">{n}</span> : null}
      <span className="ico">
        <IconoCotizador nombre={icono} size={30} />
      </span>
      <b>{titulo}</b>
      {nota ? <span className="pu">{nota}</span> : null}
    </button>
  );
}

/** Contenedor de una partida del carrito, con su desglose de dinero abajo. */
export function Linea({
  icono,
  titulo,
  nota,
  insignia,
  onQuitar,
  children,
  dinero,
}: {
  icono: string;
  titulo: ReactNode;
  nota?: string;
  insignia?: string | null;
  onQuitar: () => void;
  children: ReactNode;
  dinero?: ReactNode;
}) {
  return (
    <div className="cz-line">
      <div className="cz-line-h">
        <span className="ico">
          <IconoCotizador nombre={icono} size={26} />
        </span>
        <span className="nm">
          <b>{titulo}</b>
          {nota ? <span>{nota}</span> : null}
        </span>
        {insignia ? <span className="cz-tier">{insignia}</span> : null}
        <button type="button" className="cz-rm" aria-label="Quitar partida" onClick={onQuitar}>
          ✕
        </button>
      </div>
      <div className="cz-ctrl">{children}</div>
      {dinero ? <div className="cz-money">{dinero}</div> : null}
    </div>
  );
}

/** Un renglón del desglose de dinero de una partida. */
export function Renglon({ texto, valor, fuerte }: { texto: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`mr${fuerte ? ' sub' : ''}`}>
      <span>{texto}</span>
      <span>{valor}</span>
    </div>
  );
}

/** Caja de aviso. `tono="bad"` para errores del servidor. */
export function Aviso({ tono, children }: { tono?: 'bad'; children: ReactNode }) {
  return <div className={`cz-note${tono === 'bad' ? ' bad' : ''}`}>{children}</div>;
}
