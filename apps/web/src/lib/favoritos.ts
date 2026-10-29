/**
 * Los ids de los favoritos del visitante, pedidos UNA vez por pantalla
 * (rendimiento, 2026-10-29).
 *
 * El encabezado (contador), la rejilla de la portada y la ficha del equipo los
 * pedían cada uno por su lado: dos o tres peticiones iguales al abrir la
 * página. Ahora la que llega primero pide y las demás esperan esa misma
 * respuesta. Se olvida a los pocos segundos para que al volver a una pantalla
 * después de marcar un favorito se lea de nuevo.
 */
let pendiente: Promise<number[]> | null = null;

export function idsDeFavoritos(): Promise<number[]> {
  if (!pendiente) {
    pendiente = fetch('/api/proxy/wishlist/ids')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: unknown) => (Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : []))
      .catch(() => []);
    pendiente.finally(() => setTimeout(() => { pendiente = null; }, 5_000));
  }
  return pendiente;
}
