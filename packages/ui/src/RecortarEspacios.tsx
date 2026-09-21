'use client';

import { useEffect } from 'react';

/**
 * QUITA LOS ESPACIOS DE LOS EXTREMOS AL SALIR DE UN CAMPO.
 *
 * Es la mitad visible del arreglo: la API ya los recorta (ver `trim.pipe.ts`),
 * pero si el campo sigue mostrando " 33 1234 5678 " la persona no entiende por
 * qué antes falló. Aquí el espacio de más desaparece a la vista, en cuanto
 * sales del campo.
 *
 * No se monta un manejador por input: uno solo en el documento, en fase de
 * CAPTURA porque `blur` no burbujea. Así vale para los formularios que ya
 * existen y para los que se escriban mañana, sin tocarlos.
 *
 * El valor se escribe con el setter NATIVO y se emite un evento `input`. Poner
 * `el.value = ...` a secas deja el estado de React con el valor viejo, y el
 * campo revuelve al espacio en el siguiente render: el arreglo duraría un
 * parpadeo. Este es el camino que React reconoce como un cambio de verdad.
 *
 * Se excluyen: los campos de un solo carácter o de selección (checkbox, radio,
 * color, fechas…), donde recortar no significa nada, y cualquiera marcado con
 * `data-no-trim` por si algún día el espacio importa.
 */
const TIPOS_DE_TEXTO = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', '']);

export function RecortarEspacios() {
  useEffect(() => {
    const alSalir = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== 'INPUT' || el.dataset.noTrim !== undefined) return;
      if (!TIPOS_DE_TEXTO.has((el.type || '').toLowerCase())) return;

      const limpio = el.value.trim();
      if (limpio === el.value) return;

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, limpio);
      else el.value = limpio;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    document.addEventListener('blur', alSalir, true);
    return () => document.removeEventListener('blur', alSalir, true);
  }, []);

  return null;
}
