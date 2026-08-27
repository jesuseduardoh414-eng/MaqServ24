import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { checkoutSchema, type CheckoutFreight } from '@maqserv/config';

export interface FreightDistance {
  km: number;
  text: string;
  /** 'google' = distancia real por carretera · 'osm' = estimada (línea recta × factor). */
  source: 'google' | 'osm';
}

export interface FreightQuoteItem {
  productId: number;
  qty: number;
}

export type FreightStatus =
  | 'ok' // se calculó y se cobra
  | 'quote' // el traslado se cotiza aparte (no se cobra aquí)
  | 'no_address' // falta la ubicación del cliente
  | 'not_found' // no pudimos ubicar la dirección
  | 'out_of_range' // más lejos que el radio máximo
  | 'not_applicable' // el pedido no lleva equipos que paguen traslado
  | 'disabled'; // apagado en el panel

export interface FreightQuote {
  status: FreightStatus;
  /** Monto a cobrar. 0 en cualquier status distinto de 'ok'. */
  cost: number;
  km: number | null;
  /** Km que se cobraron (ya sin los gratis y ×2 si es ida y vuelta). */
  chargedKm: number | null;
  distanceText: string | null;
  estimated: boolean;
  mode: CheckoutFreight['mode'];
  label: string;
  help: string;
  /** Texto listo para mostrar en el carrito/checkout. */
  message: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const ROAD_FACTOR = 1.32; // línea recta → carretera (aprox. México)
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const UA = 'MaqServ24/1.0 (cotizador de traslado)';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Cotizador de traslado: distancia entre la base y la ubicación del cliente × tarifa.
 *
 * Proveedores de distancia, en orden:
 *  1. Google Distance Matrix (km reales por carretera) si hay GOOGLE_DISTANCE_MATRIX_API_KEY.
 *  2. Nominatim/OpenStreetMap (gratis, sin key): geocodifica ambas direcciones y estima
 *     la distancia por carretera como línea recta × 1.32. Marca la cotización como estimada.
 *
 * La tarifa vive en el token `checkout.freight` (Panel → Traslado) y un producto con
 * `rental_freight` usa esa tarifa por km en lugar de la global (igual que el legacy).
 */
@Injectable()
export class FreightService {
  private readonly logger = new Logger(FreightService.name);
  private readonly geoCache = new Map<string, { at: number; point: GeoPoint | null }>();

  /** Config de traslado del tema activo. */
  async config(): Promise<CheckoutFreight> {
    const row = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true } });
    const tokens = (row?.tokens ?? {}) as { checkout?: unknown };
    return checkoutSchema.parse(tokens.checkout ?? {}).freight;
  }

  /** Origen del viaje: Panel → Traslado, si no Diseño → Contacto, si no la dirección legacy. */
  async resolveOrigin(cfg?: CheckoutFreight): Promise<string | null> {
    const freight = cfg ?? (await this.config());
    if (freight.origin.trim()) return freight.origin.trim();

    const row = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true } });
    const tokens = (row?.tokens ?? {}) as { contact?: { address?: string } };
    const fromContact = tokens.contact?.address?.trim();
    if (fromContact) return fromContact;

    const gs = await prisma.generalsettings.findFirst({ select: { street: true } });
    return gs?.street?.trim() || null;
  }

  /** Distancia base→destino. null si no hay origen, no se ubica el destino o falla todo. */
  async distanceTo(destination: string, origin?: string): Promise<FreightDistance | null> {
    const dest = destination.trim();
    if (!dest) return null;
    const from = origin?.trim() || (await this.resolveOrigin());
    if (!from) return null;

    const viaGoogle = await this.googleDistance(from, dest);
    if (viaGoogle) return viaGoogle;
    return this.osmDistance(from, dest);
  }

  private async googleDistance(origin: string, destination: string): Promise<FreightDistance | null> {
    const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
    if (!apiKey) return null;
    try {
      const params = new URLSearchParams({ origins: origin, destinations: destination, key: apiKey, units: 'metric' });
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        status: string;
        rows?: Array<{ elements?: Array<{ distance?: { text: string; value: number } }> }>;
      };
      const el = data.rows?.[0]?.elements?.[0];
      if (data.status !== 'OK' || !el?.distance) return null;
      const km = Math.max(0.01, round2(el.distance.value / 1000));
      return { km, text: el.distance.text, source: 'google' };
    } catch (err) {
      this.logger.warn(`Distance Matrix falló: ${(err as Error).message}`);
      return null;
    }
  }

  /** Respaldo sin API key: geocodifica con Nominatim y estima km por carretera. */
  private async osmDistance(origin: string, destination: string): Promise<FreightDistance | null> {
    const [a, b] = await Promise.all([this.geocode(origin), this.geocode(destination)]);
    if (!a || !b) return null;
    const km = Math.max(0.01, round2(haversineKm(a, b) * ROAD_FACTOR));
    return { km, text: `≈ ${km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`, source: 'osm' };
  }

  /**
   * Geocodifica con Nominatim. Las direcciones exactas suelen fallar ahí
   * (p. ej. "Albino Espinosa 807-855, Centro, 64000 Monterrey, N.L." no existe en OSM),
   * así que se reintenta quitando componentes desde el inicio: calle → colonia → ciudad.
   */
  /**
   * Publico a proposito: la red de aliados y las obras necesitan EXACTAMENTE el
   * mismo geocodificador que el cotizador de traslado, con su cache y su
   * reintento por componentes. Tener dos seria tener dos formas de fallar.
   */
  async geocode(address: string): Promise<GeoPoint | null> {
    const key = address.trim().toLowerCase();
    const hit = this.geoCache.get(key);
    if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.point;

    const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
    const attempts = parts.length > 1
      ? Array.from({ length: Math.min(parts.length, 3) }, (_, i) => parts.slice(i).join(', '))
      : [address];

    let point: GeoPoint | null = null;
    for (let i = 0; i < attempts.length; i += 1) {
      try {
        point = await this.nominatim(attempts[i]);
      } catch (err) {
        this.logger.warn(`Nominatim falló: ${(err as Error).message}`);
        return null; // error de red: no cachear, se reintenta a la próxima
      }
      if (point) break;
      // Política de uso de Nominatim: máximo 1 petición por segundo.
      if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 1100));
    }
    this.geoCache.set(key, { at: Date.now(), point });
    return point;
  }

  private async nominatim(q: string): Promise<GeoPoint | null> {
    const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'mx' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es' },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    const r = rows?.[0];
    return r ? { lat: Number(r.lat), lon: Number(r.lon) } : null;
  }

  /**
   * Cotiza el traslado de un pedido. Nunca lanza: si algo falla devuelve status
   * distinto de 'ok' con cost 0 y el pedido sigue (el traslado se cotiza aparte).
   */
  async quote(input: {
    address?: string | null;
    items?: FreightQuoteItem[];
    /** Config sin publicar (solo la usa el probador del panel). */
    config?: CheckoutFreight;
  }): Promise<FreightQuote> {
    const cfg = input.config ?? (await this.config());
    const base = {
      cost: 0,
      km: null,
      chargedKm: null,
      distanceText: null,
      estimated: false,
      mode: cfg.mode,
      label: cfg.label,
      help: cfg.help,
    };
    if (!cfg.enabled) return { ...base, status: 'disabled', message: '' };

    // Tarifa por km de cada equipo: la del producto si tiene, si no la global.
    const items = input.items ?? [];
    let rates: number[] = [];
    let units = 0;
    if (items.length > 0) {
      const products = await prisma.products.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, is_rental: true, rental_freight: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const i of items) {
        const p = byId.get(i.productId);
        if (!p) continue;
        if (cfg.rentalOnly && !p.is_rental) continue; // los equipos de venta no pagan traslado
        const qty = Math.max(1, Math.floor(i.qty));
        const rate = p.rental_freight ? Number(p.rental_freight) : cfg.ratePerKm;
        for (let n = 0; n < qty; n += 1) rates.push(rate);
        units += qty;
      }
      if (units === 0) {
        return { ...base, status: 'not_applicable', message: '' };
      }
    } else {
      rates = [cfg.ratePerKm];
      units = 1;
    }

    if (cfg.mode === 'flat') {
      const cost = round2(Math.max(cfg.minCharge, cfg.base + cfg.flatAmount * (cfg.perUnit ? units : 1)));
      return { ...base, status: 'ok', cost, message: cfg.label };
    }

    const address = (input.address ?? '').trim();
    // En modo 'quote' igual calculamos la distancia (si la hay) para informarla, pero no se cobra.
    if (!address) {
      return {
        ...base,
        status: cfg.mode === 'quote' ? 'quote' : 'no_address',
        message: cfg.mode === 'quote' ? cfg.quoteText : 'Escribe tu ubicación para calcular el traslado',
      };
    }

    const dist = await this.distanceTo(address, (await this.resolveOrigin(cfg)) ?? undefined);
    if (!dist) {
      return {
        ...base,
        status: cfg.mode === 'quote' ? 'quote' : 'not_found',
        message: cfg.mode === 'quote' ? cfg.quoteText : 'No pudimos ubicar esa dirección; el traslado se cotiza aparte',
      };
    }

    const info = { km: dist.km, distanceText: dist.text, estimated: dist.source === 'osm' };
    if (cfg.maxKm > 0 && dist.km > cfg.maxKm) {
      return { ...base, ...info, status: 'out_of_range', message: `Fuera de nuestro radio de ${cfg.maxKm} km; el traslado se cotiza aparte` };
    }
    if (cfg.mode === 'quote') {
      return { ...base, ...info, status: 'quote', message: cfg.quoteText };
    }

    const chargedKm = round2(Math.max(0, dist.km - cfg.freeKm) * (cfg.roundTrip ? 2 : 1));
    // Un solo viaje: manda la tarifa más alta (el equipo más grande define el tráiler).
    const variable = cfg.perUnit
      ? rates.reduce((s, r) => s + chargedKm * r, 0)
      : chargedKm * Math.max(...rates);
    const cost = round2(Math.max(cfg.minCharge, cfg.base + variable));
    return { ...base, ...info, status: 'ok', chargedKm, cost, message: cfg.label };
  }
}
