/**
 * DTOs de checkout y órdenes (F2).
 * REGLA: los precios SIEMPRE se calculan en el servidor contra la BD;
 * el cliente solo manda productId + qty.
 */

import type { Fulfillment, ShipMethod } from './fulfillment';

export type PaymentMethodId = 'transferencia' | 'mercadopago';

export interface PaymentMethod {
  id: PaymentMethodId;
  /** Título mostrado (del gateway legacy o del proveedor). */
  title: string;
  /** Instrucciones HTML (p.ej. pasos de la transferencia). */
  instructions: string | null;
  available: boolean;
}

/**
 * Periodo/unidad de cobro de una línea de renta. Entre unidades de tiempo el
 * servidor convierte desde `products.price_unit` (fuente única en
 * `precioPeriodoCarrito` de @maqserv/config); las demás ('viaje', 'tonelada'…)
 * solo pueden cobrarse en su propia unidad. 'sem' es la clave de carrito de
 * 'semana' — histórico, se conserva.
 */
export type RentalPeriod =
  | 'dia' | 'sem' | 'mes'
  | 'hora' | 'jornada' | 'viaje' | 'tonelada' | 'm3' | 'litro';

export interface CheckoutItemInput {
  productId: number;
  qty: number;
  /** Renta: periodo elegido. Default: la unidad en la que está capturado el precio. */
  period?: RentalPeriod;
}

export interface CheckoutInput {
  items: CheckoutItemInput[];
  method: PaymentMethodId;
  /**
   * Clave única por INTENTO de compra (la genera el navegador y se conserva
   * entre reintentos): si la misma llega dos veces, el servidor devuelve la
   * orden ya creada en vez de duplicarla.
   */
  idempotencyKey?: string;
  /** Cupón opcional; el descuento lo calcula y aplica el servidor. */
  couponCode?: string;
  /** Agregar operador certificado (monto configurable en Panel → Pagos). */
  operator?: boolean;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
  };
  note?: string;
}

export interface OrderItem {
  productId: number;
  /** Unitario ya ajustado al periodo elegido (renta) o precio de venta. */
  price: number;
  name: string;
  qty: number;
  image: string | null;
  /** Solo renta: periodo cobrado y su etiqueta ("MES"/"SEMANA"/"DÍA"). */
  period?: RentalPeriod;
  unitLabel?: string;
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  method: string;
  total: number;
  totalQty: number;
  createdAt: string | null;
}

/**
 * Desglose CONGELADO al crear la orden: es lo que se cobró, no se recalcula.
 * null en órdenes del sistema viejo (cart comprimido en bzip2).
 */
export interface OrderTotals {
  subtotal: number;
  discount: number;
  operator: number;
  /** 0 si el traslado se cotiza aparte; entonces `freightNote` dice por qué. */
  freight: number;
  freightKm: number | null;
  freightLabel: string;
  freightNote: string;
  /** Monto AGREGADO (0 si el precio ya incluye impuesto). */
  tax: number;
  taxRate: number;
  taxLabel: string;
  taxIncluded: boolean;
  total: number;
}

/**
 * Estado y datos del ENVÍO de una orden (módulo de envíos).
 * Los campos se llenan según `method`: guía la paquetería, unidad el traslado,
 * sucursal la recolección. Lo demás queda null.
 */
export interface OrderShipping {
  state: Fulfillment;
  method: ShipMethod | null;
  /** Paquetería (solo `method: 'paqueteria'`). */
  carrier: string | null;
  /** Número de guía (solo `method: 'paqueteria'`). */
  tracking: string | null;
  /** Unidad y operador (solo `method: 'traslado'`). */
  unit: string | null;
  /** Sucursal de recolección (solo `method: 'sucursal'`). */
  branch: string | null;
  /** Fecha comprometida de entrega/recolección. */
  scheduledAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** Solo renta: cuándo se recogió el equipo. */
  returnedAt: string | null;
  /** Indicaciones visibles para el cliente. */
  notes: string | null;
}

/** Un cambio de estado del envío (tabla `order_events`). Del más viejo al más nuevo. */
export interface OrderEvent {
  id: number;
  from: Fulfillment | null;
  to: Fulfillment;
  note: string | null;
  /** Nombre del admin; null = automático (webhook de pago). */
  by: string | null;
  at: string;
}

export interface OrderDetail extends OrderSummary {
  /** Vacío para órdenes del sistema viejo (cart comprimido bzip2). */
  items: OrderItem[];
  totals: OrderTotals | null;
  /** Envío. null solo si la orden es anterior al módulo y nunca se tocó. */
  shipping: OrderShipping | null;
  /** Lleva equipo en renta ⇒ el flujo incluye "En renta → Recolectado". */
  hasRental: boolean;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    zip: string | null;
  };
  note: string | null;
}

export interface CheckoutResult {
  order: OrderSummary;
  /** URL de redirección al proveedor de pago (MercadoPago init_point). */
  redirectUrl: string | null;
  /** Instrucciones del método offline (transferencia). */
  instructions: string | null;
}
