'use client';

import { useState, type CSSProperties } from 'react';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '@maqserv/ui';

export interface OpcionSelect {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * EL DESPLEGABLE DEL PANEL (2026-09-23).
 *
 * Todos los `<select>` nativos del panel pasan por aquí. El nativo lo pinta el
 * sistema operativo: sobre el cromo oscuro abría una lista blanca de Windows
 * con su tipografía y sus bordes, y no hay CSS que lo arregle. Este es el
 * Select de shadcn (Radix) que ya usaba el cotizador, con la misma API que un
 * `<select>` para que el reemplazo sea mecánico:
 *
 *  - `value` + `onChange(valor)` para el uso controlado (filtros, formularios
 *    en estado), o `defaultValue` + `name` para formularios que leen FormData.
 *  - `''` es un valor válido ("Todos", "Sin asignar", "equipo propio"). Radix
 *    no admite `value=""` en un item, así que se traduce a un centinela al
 *    entrar y se destraduce al salir; hacia afuera siempre viaja `''`.
 *  - `size="sm"` para filtros y celdas de tabla; el normal es de formulario.
 *
 * Con `name`, el valor viaja en un input propio (no en el select oculto de
 * Radix, que mandaría el centinela). Es un input de opacidad cero y no
 * `type="hidden"` para que `required` lo valide el navegador igual que a
 * cualquier campo.
 */
const VACIO = '__vacio__';

export function AdminSelect({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  placeholder,
  ariaLabel,
  disabled,
  required,
  size = 'md',
  className,
  style,
}: {
  options: OpcionSelect[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md';
  /** Clases del disparador (p. ej. `w-auto` para filtros en línea). */
  className?: string;
  style?: CSSProperties;
}) {
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue ?? '');
  const actual = controlado ? value : interno;

  const hayOpcionVacia = options.some((o) => o.value === '');
  const aRadix = (v: string) => (v === '' ? VACIO : v);
  // Sin opción vacía, `''` es "nada elegido": Radix enseña el placeholder.
  const valorRadix = actual === '' && !hayOpcionVacia ? '' : aRadix(actual);

  function cambiar(v: string) {
    const real = v === VACIO ? '' : v;
    if (!controlado) setInterno(real);
    onChange?.(real);
  }

  const compacto = size === 'sm' ? 'h-8 px-2.5 text-xs gap-1.5' : '';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', width: className?.includes('w-auto') ? 'auto' : '100%' }}>
      {name ? (
        <input
          name={name}
          value={actual}
          required={required}
          readOnly
          tabIndex={-1}
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      ) : null}
      <ShSelect value={valorRadix} onValueChange={cambiar} disabled={disabled}>
        <ShSelectTrigger id={id} aria-label={ariaLabel} className={[compacto, className].filter(Boolean).join(' ')} style={style}>
          <ShSelectValue placeholder={placeholder ?? 'Selecciona…'} />
        </ShSelectTrigger>
        <ShSelectContent>
          {options.map((o) => (
            <ShSelectItem key={o.value} value={aRadix(o.value)} disabled={o.disabled}>
              {o.label}
            </ShSelectItem>
          ))}
        </ShSelectContent>
      </ShSelect>
    </div>
  );
}
