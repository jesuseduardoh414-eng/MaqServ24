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
  /** Slug de la categoria de servicio, para saber que formulario se contesto. */
  serviceCategory?: string;
  /**
   * Respuestas del formulario propio de esa categoría (documento, secciones 8
   * a 13). Se guardan ADEMÁS del texto legible que va en los comentarios: el
   * JSON sirve para lo que viene después —comparar solicitudes, emparejar con
   * proveedores, medir qué se pide y no se cubre— y el texto sirve hoy, para
   * que quien cotiza lo lea sin pantallas nuevas.
   */
  requirements?: Record<string, string>;
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
  /**
   * Estado REAL, calculado (ver QuoteDetail.state). En la lista importa tanto
   * como en el detalle: una cotizacion vencida no puede seguir apareciendo
   * como si el cliente aun pudiera aceptarla.
   */
  state: 'pendiente' | 'vigente' | 'vencida' | 'aceptada' | 'rechazada';
  validUntil: string | null;
  daysToExpire: number | null;
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
  /**
   * Estado REAL, calculado. No es la columna `status`: una cotización respondida
   * a la que se le pasó la fecha ya no vale, aunque siga marcada como completada.
   */
  state: 'pendiente' | 'vigente' | 'vencida' | 'aceptada' | 'rechazada';
  /** Hasta cuándo vale el precio (ISO corto). Null = no se fijó vigencia. */
  validUntil: string | null;
  /** Días que faltan para vencer. Negativo si ya venció. */
  daysToExpire: number | null;
  /** Qué SÍ incluye el precio. */
  included: string | null;
  /** Qué NO incluye. Es lo que evita la discusión cara después. */
  excluded: string | null;
  /** Quién autorizó el precio. */
  respondedBy: string | null;
  acceptedAt: string | null;
  /** Solo se puede aceptar una respondida y dentro de su vigencia. */
  canAccept: boolean;
  /**
   * En qué va el SERVICIO, después de aceptar. Null mientras la cotización no
   * se acepta: hasta entonces no hay operación que seguir.
   *
   * Es lo que contesta la única pregunta que el cliente vuelve a hacer después
   * de decir que sí — "¿y ahora?" —, y que antes solo se podía contestar por
   * teléfono.
   */
  service: {
    state: string;
    /** Cómo se le cuenta al cliente. No es la etiqueta de operaciones. */
    label: string;
    message: string;
    /** 0 a 1. Para la barra de avance. */
    progress: number;
    /** Aliado(s) que aceptaron atenderlo. */
    providers: string[];
    startedAt: string | null;
    closedAt: string | null;
    /** Con qué se cerró: "3 viajes", "12.5 toneladas". */
    closed: string | null;
    /** Los pasos por los que ya pasó, del más viejo al más nuevo. */
    history: Array<{ label: string; note: string | null; at: string | null }>;
  } | null;
}
