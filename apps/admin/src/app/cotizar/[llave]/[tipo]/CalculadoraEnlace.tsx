'use client';

import { CalculadoraPavimento, ConversorM3Ton, type MaterialConversion } from '@maqserv/ui';

/**
 * Una calculadora de material dentro del enlace (2026-11-09). «Cotizar …» abre
 * el cotizador del mismo enlace (con la llave), y «Mandar por WhatsApp» deja
 * elegir a quién: quien usa el enlace se lo manda a un cliente.
 */
export function CalculadoraEnlace({ clave, llave }: { clave: string; llave: string }) {
  const cotizarHref = (m: MaterialConversion) => `/cotizar/${llave}/${m === 'carpeta' ? 'carpeta-asfaltica' : 'triturados'}`;
  return clave === 'calculadora-pavimento'
    ? <CalculadoraPavimento cotizarHref={cotizarHref} variante="panel" />
    : <ConversorM3Ton cotizarHref={cotizarHref} variante="panel" />;
}
