// Compartido por el panel (pegar coordenadas) y la API (geocodificar).
/**
 * Coordenadas pegadas a mano: "25.7812, -100.1934" o un enlace de Google Maps
 * (…/@25.78,-100.19,17z o …!3d25.78!4d-100.19 o ?q=25.78,-100.19).
 */
export function coordenadasDe(texto: string): { lat: number; lng: number } | null {
  const t = texto.trim();
  const patrones = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
