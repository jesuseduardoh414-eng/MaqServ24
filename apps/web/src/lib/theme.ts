import { cache } from 'react';
import { defaultTheme, themeSchema, type Theme } from '@maqserv/config';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Política de caché de los datos del sitio (tema, productos, blog, sectores, reseñas…).
 *
 *  - PROD: ISR 60 s + invalidación bajo demanda al publicar.
 *  - DEV: caché corta (5 s). Antes era `no-store`: cada visita —incluso volver a una
 *    página ya vista— repetía las ~9 llamadas a la API, y con la BD a ~100 ms por viaje
 *    eso costaba ~1 s por pantalla. Medido: home 1107 → 482 ms, ficha 1185 → 284 ms.
 *
 * El `no-store` estaba para ver los cambios de Diseño al instante. Eso NO se pierde:
 * publicar un tema dispara `POST /api/revalidate` (admin-themes.controller.ts), que tira
 * la caché de golpe. Requiere `REVALIDATE_SECRET` con el MISMO valor en la API y en la
 * web — en local también. Sin él, un cambio tarda hasta 5 s en verse.
 *
 * OJO: el tema se cachea igual que el resto A PROPÓSITO. Dejarlo fresco cuesta ~300 ms
 * por pantalla (no ~100): `getTheme()` bloquea, porque decide qué secciones se pintan y
 * nada arranca hasta que responde. Medido: 482 → 778 ms.
 */
export const CONTENT_CACHE: RequestInit =
  process.env.NODE_ENV === 'production' ? { next: { revalidate: 60 } } : { next: { revalidate: 5 } };

/**
 * Tope de espera SIN AbortSignal (mismo truco que lib/api.ts): un fetch con
 * `next.revalidate` no admite `signal`, así que el tope va por Promise.race.
 * Sin él, una conexión COLGADA (Render dormido) no rechaza nunca: el catch no
 * corre, el tema decide qué secciones se pintan y toda página pública espera
 * hasta que Vercel mata la función — 500 en vez del tema default.
 */
function conTope<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, rechazar) =>
      setTimeout(() => rechazar(new Error(`API /theme no respondió en ${ms} ms`)), ms),
    ),
  ]);
}

/**
 * Tema activo desde la API (que lo lee de la BD).
 * Fallback al tema default si la API no responde: el sitio nunca se cae por el tema.
 */
export const getTheme = cache(async (): Promise<Theme> => {
  try {
    const res = await conTope(fetch(`${API_URL}/theme`, CONTENT_CACHE), 6_000);
    if (!res.ok) throw new Error(`API /theme respondió ${res.status}`);
    return themeSchema.parse(await res.json());
  } catch (err) {
    console.warn('[theme] usando tema default (API no disponible):', err);
    return defaultTheme;
  }
});

/**
 * Resuelve un copy por clave e idioma.
 *
 * Cae al copy DEFAULT antes que a la clave: los temas guardados en BD se sellaron con
 * los copys que existían ese día, así que un copy agregado después no está ahí y el
 * sitio pintaba la clave cruda ("vendor.apply.sent") en la cara del usuario. Con este
 * fallback, un copy nuevo funciona sin migrar la BD y sigue siendo editable si el
 * admin lo sobrescribe. La clave queda solo como último recurso (typo en el código).
 */
export function t(theme: Theme, key: string, locale = 'es'): string {
  return theme.copys[locale]?.[key] ?? defaultTheme.copys[locale]?.[key] ?? key;
}
