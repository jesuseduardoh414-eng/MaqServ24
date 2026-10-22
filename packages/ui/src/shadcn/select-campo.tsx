'use client';

import * as React from 'react';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from './select';
import { CampoOculto } from './campo-oculto';

export interface OpcionCampo {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Desplegable de formulario con la misma API que un `<select>` (2026-10-15):
 * `value` + `onChange(valor)` o `defaultValue` + `name`. Es lo que el panel ya
 * tenía como AdminSelect, aquí para el sitio también, y así reemplazar un
 * `<select>` nativo es mecánico.
 *
 *  - `''` es un valor válido ("Prefiero no decir", "Todos"). Radix no admite
 *    `value=""` en un item: se traduce a un centinela al entrar y se
 *    destraduce al salir; hacia afuera siempre viaja `''`.
 *  - Sin opción vacía, `''` es "nada elegido" y se ve el `placeholder`.
 *  - Con `name`, el valor viaja en CampoOculto, que valida `required`.
 */
const VACIO = '__vacio__';

export function ShSelectCampo({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  placeholder = 'Selecciona…',
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: {
  options: OpcionCampo[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}) {
  const controlado = value !== undefined;
  const [interno, setInterno] = React.useState(defaultValue ?? '');
  const actual = controlado ? (value as string) : interno;
  const hayVacia = options.some((o) => o.value === '');
  const aRadix = (v: string) => (v === '' ? VACIO : v);
  const valorRadix = actual === '' && !hayVacia ? '' : aRadix(actual);

  function cambiar(v: string) {
    // Un item de Radix nunca vale '': ese '' es el <select> oculto de Radix
    // vaciándose cuando el valor cambia por código (2026-10-22: el tipo recién
    // creado y el material que se elige solo se borraban). No es del usuario.
    if (v === '') return;
    const real = v === VACIO ? '' : v;
    if (!controlado) setInterno(real);
    onChange?.(real);
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <CampoOculto name={name} value={actual} required={required} />
      <ShSelect value={valorRadix} onValueChange={cambiar} disabled={disabled}>
        <ShSelectTrigger id={id} aria-label={ariaLabel} aria-invalid={ariaInvalid || undefined} className={className}>
          <ShSelectValue placeholder={placeholder} />
        </ShSelectTrigger>
        <ShSelectContent>
          {options.map((o) => (
            <ShSelectItem key={o.value || VACIO} value={aRadix(o.value)} disabled={o.disabled}>
              {o.label}
            </ShSelectItem>
          ))}
        </ShSelectContent>
      </ShSelect>
    </div>
  );
}
