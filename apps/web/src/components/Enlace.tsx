'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';

/** Lo escucha la pantalla de carga (CargaDePagina): alguien tocó un enlace a otra página. */
export const EVENTO_NAVEGAR = 'enlace:navegar';

/**
 * Avisa que se va a otra página para que salga su esqueleto. Lo usa cada
 * Enlace al tocarlo, y las pantallas que navegan por código
 * (`router.push`) lo llaman justo antes. Misma página o solo otro #ancla:
 * no avisa, no hay nada que cargar.
 */
export function avisarNavegacion(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return;
  const destino = new URL(href, window.location.href);
  if (destino.pathname === window.location.pathname && destino.search === window.location.search) return;
  window.dispatchEvent(new CustomEvent(EVENTO_NAVEGAR, { detail: destino.pathname + destino.search }));
}

/**
 * El `Link` de Next SIN precarga automática (rendimiento, 2026-10-29).
 *
 * Por defecto Next precarga cada enlace que aparece en pantalla: medido en
 * producción, solo abrir la portada mandaba 10 peticiones de páginas (menú y
 * pie) al mismo servidor que tenía que entregar la página. En el hosting
 * compartido eso hacía fila y todo tardaba segundos.
 *
 * Ahora la página se pide cuando la persona va hacia el enlace (pasa el
 * ratón o lo toca), que es casi igual de rápido y no carga al servidor con
 * páginas que nadie va a abrir. Quien de verdad quiera la precarga de antes
 * la pide con `prefetch`.
 *
 * Al tocarlo avisa (EVENTO_NAVEGAR) para que salga al instante el esqueleto
 * de la página que viene, sin esperar al servidor (2026-10-29).
 */
export default function Enlace({ prefetch, onMouseEnter, onTouchStart, onClick, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const precargar = () => {
    if (prefetch === false || typeof props.href !== 'string' || !props.href.startsWith('/')) return;
    try {
      router.prefetch(props.href);
    } catch {
      // Sin precarga se navega igual.
    }
  };
  const avisar = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== '_self') return;
    if (typeof props.href === 'string') avisarNavegacion(props.href);
  };
  return (
    <Link
      {...props}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => {
        precargar();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        precargar();
        onTouchStart?.(e);
      }}
      onClick={avisar}
    />
  );
}
