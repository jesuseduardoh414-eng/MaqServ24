'use client';

import { useId, type ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { IconoCotizador } from './iconos';
import { ShInput, ShLabel } from '../shadcn/input';

/**
 * Etiqueta + control.
 *
 * La etiqueta es la de Radix (`ShLabel`) y va enlazada por `id`, no envolviendo
 * al campo: envolver rompía el combobox de municipio, porque un clic en la
 * etiqueta llegaba también al disparador y el desplegable se abría y se cerraba
 * en el mismo gesto.
 */
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
  /** Recibe el `id` que hay que poner en el control. */
  children: ReactNode | ((id: string) => ReactNode);
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  // `htmlFor` solo cuando de verdad hay un control con ese id: apuntar a un id
  // inexistente es peor que no poner nada, porque el lector de pantalla anuncia
  // la etiqueta y luego no encuentra a qué pertenece.
  const enlazada = typeof children === 'function';
  return (
    <div className={`cz-field${ancho === 'full' ? ' full' : ''}`}>
      <ShLabel htmlFor={enlazada ? id : undefined}>
        {label}
        {req ? <span className="text-[var(--ui-accent)]"> *</span> : null}
      </ShLabel>
      {enlazada ? (children as (id: string) => ReactNode)(id) : (children as ReactNode)}
      {error ? (
        <span id={idAyuda} className="cz-err">{error}</span>
      ) : help ? (
        <span id={idAyuda} className="cz-help">{help}</span>
      ) : null}
    </div>
  );
}

/**
 * Contador con −/+ y campo escribible.
 *
 * El campo del medio se deja editar a mano aunque existan los botones: subir a
 * 30 días a golpe de "+" son 30 clics, y el primer usuario que lo intente va a
 * teclear.
 */
export function Contador({
  valor,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  paso = 1,
  ariaLabel,
  id,
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  ariaLabel: string;
  id?: string;
}) {
  const acotar = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="cz-stp">
      <button type="button" aria-label={`Restar ${ariaLabel}`} onClick={() => onChange(acotar(valor - paso))} disabled={valor <= min}>
        <Minus className="size-4" />
      </button>
      <input
        id={id}
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
      <button type="button" aria-label={`Sumar ${ariaLabel}`} onClick={() => onChange(acotar(valor + paso))} disabled={valor >= max}>
        <Plus className="size-4" />
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
  id,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  decimal?: boolean;
  id?: string;
}) {
  return (
    <ShInput
      id={id}
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

/**
 * Tarjeta del catálogo: ALTERNA (elegir / quitar).
 *
 * Antes solo sumaba, y el badge iba subiendo sin manera de bajar: para quitar
 * algo había que avanzar al paso siguiente y buscar su ✕. Tocar de nuevo lo que
 * ya elegiste es el gesto que todo el mundo intenta primero, y no hacía nada.
 *
 * Añadir DOS partidas del mismo equipo sigue teniendo sentido —la misma
 * excavadora dos semanas y otra tres días son dos renglones—, así que eso
 * queda en el "+" de la esquina, que es explícito. Para varias unidades con la
 * misma duración está el contador de "Equipos" del paso siguiente, que es lo
 * que la gente quiere el 90 % de las veces.
 */
export function Tarjeta({
  icono,
  titulo,
  nota,
  n = 0,
  modo = 'alternar',
  onClick,
  onAgregarOtra,
}: {
  icono: string;
  titulo: string;
  nota?: string;
  /** Cuántas partidas hay de esto. 0 = sin elegir. */
  n?: number;
  /**
   * `alternar`: el clic elige y vuelve a quitar (equipos, servicios, materiales).
   * `agregar`: el clic siempre añade una partida nueva. Es lo correcto para las
   * tarjetas que no representan UNA cosa sino un tipo de renglón —"entrega por
   * zona" puede ir a tres zonas distintas—, donde quitarlo todo de un clic
   * borraría trabajo ajeno a lo que se tocó. Esas se quitan con su ✕.
   */
  modo?: 'alternar' | 'agregar';
  onClick: () => void;
  /** Si se pasa, la tarjeta elegida ofrece añadir otra partida igual. */
  onAgregarOtra?: () => void;
}) {
  const activa = n > 0;
  return (
    <div className="cz-pick-wrap">
      <button
        type="button"
        className="cz-pick"
        data-on={activa ? '1' : '0'}
        aria-pressed={modo === 'alternar' ? activa : undefined}
        onClick={onClick}
      >
        <span className="ico">
          <IconoCotizador nombre={icono} size={30} />
        </span>
        <b>{titulo}</b>
        {nota ? <span className="pu">{nota}</span> : null}
        {activa && modo === 'alternar' ? (
          <span className="cz-pick-quitar">
            <X className="size-3" aria-hidden /> Toca para quitar
          </span>
        ) : null}
      </button>

      {activa ? (
        <span className="cz-pick-badges">
          {onAgregarOtra ? (
            <button
              type="button"
              className="cz-pick-mas"
              title="Agregar otra partida igual (para cotizarla con otra duración)"
              aria-label={`Agregar otra partida de ${titulo}`}
              onClick={onAgregarOtra}
            >
              <Plus className="size-3.5" />
            </button>
          ) : null}
          <span className="cz-pick-n" aria-label={`${n} partidas de ${titulo}`}>{n}</span>
        </span>
      ) : null}
    </div>
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
          <X className="size-4" />
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
