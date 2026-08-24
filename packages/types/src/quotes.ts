/**
 * DTOs de cotizaciones B2B / RFQ (F3).
 * Igual que orders: los precios se calculan SIEMPRE server-side.
 * Los invitados pueden solicitar cotización (user_id opcional).
 */

export interface QuoteItemInput {
  productId: number;
  qty: number;
  /** Días de renta (solo productos is_rental; default 1). */
  days?: number;
}

export interface QuoteRequestInput {
  items: QuoteItemInput[];
  /**
   * Categoría de servicio cuando la solicitud NO parte de un equipo del
   * catálogo (agua en pipas, triturados): se miden por viaje y por tonelada,
   * no son SKUs. Con `service` presente, `items` puede ir vacío.
   */
  service?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    company?: string;
    region?: string;
    industry?: string;
  };
  /** compra | renta (interés del cliente, campo legacy acquisition_option). */
  acquisitionOption?: string;
  /** Dirección de entrega — si hay API de distancia se usa para el flete. */
  address?: string;
  comments?: string;
}

export interface QuoteItem {
  productId: number;
  name: string;
  price: number;    // unitario base (cprice)
  qty: number;
  days: number;     // 1 si no es renta
  isRental: boolean;
  freight: number;  // flete unitario aplicado (renta)
  lineTotal: number;
  image: string | null;
}

export interface QuoteSummary {
  id: number;
  quoteNumber: string;
  status: string; // pending | completed (legacy)
  subtotal: number;
  freightCost: number;
  freightDistance: string | null;
  tax: number;
  total: number;
  createdAt: string | null;
}

export interface QuoteDetail extends QuoteSummary {
  items: QuoteItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    company: string | null;
    region: string | null;
    industry: string | null;
  };
  address: string | null;
  comments: string | null;
  conditions: string | null;
}
