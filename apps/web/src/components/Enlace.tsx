'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

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
 */
export default function Enlace({ prefetch, onMouseEnter, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const precargar = () => {
    if (prefetch === false || typeof props.href !== 'string' || !props.href.startsWith('/')) return;
    try {
      router.prefetch(props.href);
    } catch {
      // Sin precarga se navega igual.
    }
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
    />
  );
}
