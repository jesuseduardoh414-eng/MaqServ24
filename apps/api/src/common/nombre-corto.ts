/**
 * "Juan Pérez López" → "Juan P.": en el sitio público no va el nombre completo
 * de un cliente. Lo usan las reseñas de servicio y, desde la auditoría del
 * 2026-10-23, también las de producto, los comentarios y las preguntas.
 */
export function nombreCorto(nombre: string | null | undefined): string {
  const [primero, segundo] = (nombre ?? '').trim().split(/\s+/);
  if (!primero) return 'Cliente';
  return segundo ? `${primero} ${segundo[0].toUpperCase()}.` : primero;
}
