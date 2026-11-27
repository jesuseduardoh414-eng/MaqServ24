'use client';

import { CalculadoraPavimento, ConversorM3Ton, type MaterialConversion, type Prellenado } from '@maqserv/ui';
import { textoPrellenado } from '@/lib/prellenado';

/**
 * Una calculadora de material dentro del enlace (2026-11-09). «Cotizar …» abre
 * el cotizador del mismo enlace (con la llave), y «Mandar por WhatsApp» deja
 * elegir a quién: quien usa el enlace se lo manda a un cliente.
 */
export function CalculadoraEnlace({ clave, llave }: { clave: string; llave: string }) {
  // Con lo calculado en `?pre=` (2026-11-27): el cotizador abre con esos renglones.
  const cotizarHref = (m: MaterialConversion, pre: Prellenado[] = []) => {
    const base = `/cotizar/${llave}/${m === 'carpeta' ? 'carpeta-asfaltica' : 'triturados'}`;
    const texto = textoPrellenado(pre);
    return texto ? `${base}?pre=${encodeURIComponent(texto)}` : base;
  };
  return clave === 'calculadora-pavimento'
    ? <CalculadoraPavimento cotizarHref={cotizarHref} variante="panel" />
    : <ConversorM3Ton cotizarHref={cotizarHref} variante="panel" />;
}
