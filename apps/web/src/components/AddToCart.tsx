'use client';

import { useState } from 'react';
import { Button } from '@maqserv/ui';
import { useCart, type CartItem } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';

/** Botón "añadir al carrito" del detalle de producto. No se renderiza en quoteMode (lo decide el server component). */
export function AddToCart({
  item,
  label,
  addedLabel,
}: {
  item: Omit<CartItem, 'qty'>;
  label: string;
  addedLabel: string;
}) {
  const cart = useCart();
  const [added, setAdded] = useState(false);

  return (
    <Button
      size="lg"
      variant="outline"
      onClick={() => {
        cart.add(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
    >
      {added ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="check" size={15} />{addedLabel}</span> : label}
    </Button>
  );
}
