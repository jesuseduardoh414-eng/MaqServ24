'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@maqserv/ui';
import { Icon } from '@/components/Icon';

export function WishlistButton({
  productId,
  labels,
}: {
  productId: number;
  labels: { add: string; remove: string };
}) {
  const router = useRouter();
  const [inWishlist, setInWishlist] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/proxy/wishlist/ids')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: number[]) => setInWishlist(Array.isArray(ids) && ids.includes(productId)))
      .catch(() => setInWishlist(false));
  }, [productId]);

  async function toggle() {
    const res = await fetch('/api/proxy/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const data = await res.json().catch(() => null);
    if (typeof data?.inWishlist === 'boolean') setInWishlist(data.inWishlist);
  }

  return (
    <Button size="lg" variant="ghost" onClick={toggle} aria-pressed={inWishlist === true}>
      {/* El corazón lleno/vacío ya no es un glifo: ♥ y ♡ los dibuja la fuente
          del sistema y no coinciden entre sí de una máquina a otra. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <Icon name="heart" size={15} fill={inWishlist === true} />
        {inWishlist ? labels.remove : labels.add}
      </span>
    </Button>
  );
}
