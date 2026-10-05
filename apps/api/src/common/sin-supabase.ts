/**
 * ADIÓS A SUPABASE STORAGE (2026-10-05).
 *
 * El tema publicado guardaba 11 imágenes (logos, foto de la oferta, secciones)
 * con la dirección del bucket de Supabase. Los mismos archivos, con la misma
 * ruta, ya viven en nuestro servidor (media.maqserv24.com/uploads/…): se
 * comprobó uno por uno. Mientras esas direcciones sigan en la base, el sitio
 * depende de que Supabase siga encendido.
 *
 * Esto las traduce al LEER el tema, en un solo lugar: el sitio deja de pedirle
 * nada a Supabase y, como el panel también lee por aquí, la próxima vez que
 * alguien guarde una sección la base queda corregida sola.
 *
 * Solo actúa con IMAGE_BASE_URL definida (producción). En local, sin esa
 * variable, la API sirve /media desde una carpeta que no tiene esos archivos:
 * ahí se deja la dirección como está.
 */
const BUCKET = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/media\//g;

export function sinSupabase<T>(valor: T): T {
  const base = process.env.IMAGE_BASE_URL?.replace(/\/$/, '');
  if (!base || valor == null) return valor;
  const s = JSON.stringify(valor);
  if (!s.includes('.supabase.co/storage/')) return valor;
  return JSON.parse(s.replace(BUCKET, `${base}/`)) as T;
}
