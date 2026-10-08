'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconBtn, SearchBox } from '@/components/ui';

/** Búsqueda por nombre, correo o teléfono. Va por la URL: la API la resuelve. */
export function CustomersSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(initial);

  function go(next: string) {
    const n = new URLSearchParams(params.toString());
    if (next.trim()) n.set('q', next.trim());
    else n.delete('q');
    n.delete('page'); // otro filtro = volver a la primera página
    router.push(`${pathname}?${n.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go(term); }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 240px', maxWidth: 380 }}
    >
      <SearchBox
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar nombre, correo o teléfono…"
        aria-label="Buscar cliente"
        style={{ maxWidth: 'none' }}
      />
      {/* Limpiar también navega: vaciar el campo a mano solo cambia el texto. */}
      {term ? <IconBtn icon="ph-x" label="Limpiar búsqueda" plain onClick={() => { setTerm(''); go(''); }} /> : null}
    </form>
  );
}
