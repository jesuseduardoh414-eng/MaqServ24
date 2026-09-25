/**
 * DIRECCIONES COPIADAS DE GOOGLE → BÚSQUEDAS QUE OPENSTREETMAP ENTIENDE
 * (2026-09-25).
 *
 * "¿Por qué no lo encuentra? Así lo copié." Google escribe las direcciones a
 * su manera: "Av Galaxia 330, Nuevo Las Puentes Ìll, 66612 Cdad. Apodaca,
 * N.L.". Nominatim (OSM) no conoce el código postal, no expande "Cdad." ni
 * "N.L.", y el "III" de la colonia llega como "Ìll" por el copiado. Buscando
 * el texto tal cual no hay resultado.
 *
 * Esto limpia el texto y arma varias búsquedas, de la más precisa a la más
 * general. Cada una dice qué tan precisa es para que quien ubica sepa si el
 * punto quedó en la calle o solo en el centro del municipio.
 */

export type Precision = 'calle' | 'colonia' | 'municipio';

export interface Variante {
  q: string;
  precision: Precision;
}

const ABREVIATURAS: Array<[RegExp, string]> = [
  [/\bCdad\.?\s*/gi, 'Ciudad '],
  [/\bCd\.\s*/gi, 'Ciudad '],
  [/\bN\.\s?L\.?(?=\s|,|$)/gi, 'Nuevo León'],
  [/\bNL\b/g, 'Nuevo León'],
  [/\bCoah\.?(?=\s|,|$)/gi, 'Coahuila'],
  [/\bTamps\.?(?=\s|,|$)/gi, 'Tamaulipas'],
  [/\bAv\.?\s+/gi, 'Avenida '],
  [/\bBlvd\.?\s+/gi, 'Bulevar '],
  [/\bCol\.\s*/gi, 'Colonia '],
  [/\bFracc\.?\s+/gi, 'Fraccionamiento '],
  [/\bS\/N\b/gi, ''],
];

/** Limpia caracteres raros del copiado y expande abreviaturas. */
export function limpiarDireccion(texto: string): string {
  let s = texto.normalize('NFC').replace(/[​-‍﻿]/g, '');
  // "Ìll" / "Íl" = números romanos que el copiado desfiguró.
  // (Sin \b: en JS la "Ì" no cuenta como letra y \b no la separa.)
  s = s.replace(/(?<=^|[\s,])[IÌÍ][lIÌÍ]{0,3}(?=$|[\s,])/g, (m) => 'I'.repeat(m.length));
  for (const [re, por] of ABREVIATURAS) s = s.replace(re, por);
  s = s
    .replace(/\b\d{5}\b/g, '') // código postal
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '');
  return s.split(',').map((x) => x.trim()).filter(Boolean).join(', ');
}

/** "Ciudad Apodaca" → "Apodaca": OSM suele tener el municipio sin el prefijo. */
const sinCiudad = (s: string) => s.replace(/^Ciudad\s+/i, '');

/**
 * Búsquedas a intentar, sin repetir, de la más precisa a la más general.
 *
 * Con "calle, colonia, municipio, estado":
 *   1. todo limpio
 *   2. calle + municipio + estado (sin colonia: es lo que más falla en OSM)
 *   3. colonia + municipio + estado
 *   4. municipio + estado
 */
export function variantesDireccion(texto: string): Variante[] {
  const limpio = limpiarDireccion(texto);
  const partes = limpio.split(',').map((x) => x.trim()).filter(Boolean);
  const out: Variante[] = [];
  const agregar = (q: string, precision: Precision) => {
    const k = q.trim();
    if (k && !out.some((v) => v.q.toLowerCase() === k.toLowerCase())) out.push({ q: k, precision });
  };

  if (partes.length === 0) return out;
  const tieneNumero = /\d/.test(partes[0]);
  agregar(limpio, tieneNumero ? 'calle' : partes.length > 2 ? 'colonia' : 'municipio');

  if (partes.length >= 3) {
    const calle = partes[0];
    const colonia = partes[1];
    const resto = partes.slice(2).map(sinCiudad);
    agregar([calle, ...resto].join(', '), 'calle');
    agregar([colonia, ...resto].join(', '), 'colonia');
    agregar(resto.join(', '), 'municipio');
  } else if (partes.length === 2) {
    agregar([partes[0], sinCiudad(partes[1])].join(', '), tieneNumero ? 'calle' : 'colonia');
    agregar(sinCiudad(partes[1]), 'municipio');
  }
  return out.slice(0, 5);
}

export { coordenadasDe } from '@maqserv/config';
