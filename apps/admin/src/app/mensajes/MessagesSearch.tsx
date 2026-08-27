'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { D } from '@/components/design-tokens';

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
      style={{ display: 'flex', alignItems: 'center', gap: 9, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 11, height: 42, padding: '0 13px', flex: 1, minWidth: 220, maxWidth: 340 }}
    >
      <i className="ph ph-magnifying-glass" style={{ color: '#6B6B71', fontSize: 14 }} />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar nombre, correo, empresa…"
        aria-label="Buscar mensaje"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: D.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
      />
      {term ? (
        <button type="button" onClick={() => { setTerm(''); go(''); }} aria-label="Limpiar búsqueda" style={{ border: 'none', background: 'transparent', color: D.muted2, cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
      ) : null}
    </form>
  );
}
