/**
 * FUENTE ÚNICA de los accesos del área de cuenta. Estaban duplicados en
 * HeaderActions (menú de usuario) y MobileNav (drawer) — dos listas iguales
 * que tarde o temprano divergen.
 *
 * Sin «Mis compras» desde 2026-10-08: ya no se vende en línea.
 */
export const ACCOUNT_LINKS = [
  { href: '/cuenta', label: 'Mi perfil' },
  { href: '/cuenta/cotizaciones', label: 'Cotizaciones' },
  { href: '/cuenta/favoritos', label: 'Favoritos' },
] as const;
