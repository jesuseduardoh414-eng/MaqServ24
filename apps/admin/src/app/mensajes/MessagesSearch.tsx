'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconBtn, SearchBox } from '@/components/ui';

/** Búsqueda por nombre, correo, empresa o texto del mensaje. Va por la URL. */
export function MessagesSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(initial);

  function go(next: string) {
    const n = new URLSearchParams(params.toString());
    if (next.trim()) n.set('q', next.trim());
    else n.delete('q');
    n.delete('page');
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
        placeholder="Buscar nombre, correo, empresa…"
        aria-label="Buscar mensaje"
        style={{ maxWidth: 'none' }}
      />
      {/* Limpiar también navega: vaciar el campo a mano solo cambia el texto. */}
      {term ? <IconBtn icon="ph-x" label="Limpiar búsqueda" plain onClick={() => { setTerm(''); go(''); }} /> : null}
    </form>
  );
}
