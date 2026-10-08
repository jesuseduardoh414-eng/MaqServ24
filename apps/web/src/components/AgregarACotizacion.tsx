'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';

/**
 * "AGREGAR A COTIZACIÓN" (2026-10-08).
 *
 * Sin carrito de compra, la lista del encabezado ("Tu lista para cotizar")
 * se quedó sin forma de llenarse. Este botón la llena: el cliente junta
 * varios equipos o servicios (una retro y una pipa) y manda UNA solicitud
 * desde /cotizar, que arma su lista con lo que haya aquí.
 *
 * No guarda precio: el importe sale de la cotización, con fechas y obra.
 * Lo de renta entra marcado por día para que /cotizar pregunte los días.
 */
export function AgregarACotizacion({
  item,
  size = 'sm',
  className = '',
}: {
  item: { id: number; slug: string; name: string; image: string | null; isRental: boolean };
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const cart = useCart();
  const enLista = cart.items.some((i) => i.productId === item.id);
  const tam = size === 'lg' ? 'ms-btn-lg' : 'ms-btn-sm';

  // Ya está: en vez de sumar otra unidad sin querer, lleva a la lista.
  if (enLista) {
    return (
      <Link href="/cotizar" className={`ms-btn ${tam} ms-btn-sec ${className}`} data-evento="lista_cotizar_ver">
        <Icon name="check" size={size === 'lg' ? 16 : 13} />
        En tu lista
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`ms-btn ${tam} ms-btn-sec ${className}`}
      data-evento="lista_cotizar_agregar"
      onClick={() =>
        cart.add({
          productId: item.id,
          slug: item.slug,
          name: item.name,
          price: 0,
          image: item.image,
          ...(item.isRental ? { period: 'dia' as const } : {}),
        })
      }
    >
      <Icon name="calculator" size={size === 'lg' ? 16 : 13} />
      Agregar a cotización
    </button>
  );
}
