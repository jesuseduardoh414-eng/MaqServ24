'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Hay un campo de texto con el foco: alguien está escribiendo. */
function escribiendo(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type);
}

/**
 * Vuelve a pedir los datos de la pantalla abierta (`router.refresh()`) cuando
 * algo cambió en el sistema (2026-10-26, ver AvisosBell y la API en
 * common/cambios.ts). `refresh` conserva filtros, búsqueda y ventanas abiertas,
 * pero si justo se está escribiendo en un campo espera a que se salga de él:
 * así ningún formulario que se arme con los datos recibidos pierde lo tecleado.
 */
export function usePonerAlDia() {
  const router = useRouter();
  const esperando = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    if (esperando.current) document.removeEventListener('focusout', esperando.current);
  }, []);

  return useCallback(() => {
    if (!escribiendo()) {
      router.refresh();
      return;
    }
    if (esperando.current) return;
    const alSalir = () => {
      // El foco ya pasó a donde va: si es otro campo, se sigue esperando.
      setTimeout(() => {
        if (escribiendo() || esperando.current !== alSalir) return;
        document.removeEventListener('focusout', alSalir);
        esperando.current = null;
        router.refresh();
      }, 0);
    };
    esperando.current = alSalir;
    document.addEventListener('focusout', alSalir);
  }, [router]);
}
