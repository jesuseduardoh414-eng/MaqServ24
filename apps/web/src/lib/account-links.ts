/**
 * FUENTE ÚNICA de los accesos del área de cuenta. Estaban duplicados en
 * HeaderActions (menú de usuario) y MobileNav (drawer) — dos listas iguales
 * que tarde o temprano divergen.
 */
export const ACCOUNT_LINKS = [
  { href: '/cuenta', label: 'Mi perfil' },
  { href: '/cuenta/pedidos', label: 'Mis compras' },
  { href: '/cuenta/cotizaciones', label: 'Cotizaciones' },
  { href: '/cuenta/favoritos', label: 'Favoritos' },
] as const;
