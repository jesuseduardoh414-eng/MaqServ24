'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Mismo cierre de sesión que el menú del encabezado (`HeaderActions`). */
export function CerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0, background: 'none', border: 'none', color: 'var(--color-error)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: saliendo ? 'wait' : 'pointer', justifySelf: 'start' }}
    >
      <Icon name="logout" size={15} />
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
