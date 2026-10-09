'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

/*
 * Las variantes se quedan con sus nombres de siempre (solid/outline/ghost) para
 * no tocar a quien ya lo usa, pero se pintan con el botón del kit del panel:
 * el `Button` de @maqserv/ui sigue la tipografía y los radios del SITIO, no los
 * del panel.
 */
const VARIANTE = { solid: 'primary', outline: 'secondary', ghost: 'ghost' } as const;

/** Botón que hace PATCH/DELETE al proxy admin y refresca la página. */
export function ActionButton({
  path,
  method = 'PATCH',
  body,
  label,
  variant = 'outline',
  confirm: confirmText,
}: {
  path: string; // ej. "orders/12"
  method?: 'PATCH' | 'DELETE' | 'POST';
  body?: unknown;
  label: string;
  variant?: 'solid' | 'outline' | 'ghost';
  confirm?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (confirmText && !(await confirmar({ titulo: confirmText, peligro: method === 'DELETE' }))) return;
    setLoading(true);
    await fetch(`/api/admin/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Btn size="sm" variant={VARIANTE[variant]} onClick={run} disabled={loading}>
      {label}
    </Btn>
  );
}

// StatusSelect vivía aquí: mostraba los valores crudos en inglés y solo lo usaba
// Órdenes, que ahora trae su propio `StatusPicker` con etiquetas en español.
