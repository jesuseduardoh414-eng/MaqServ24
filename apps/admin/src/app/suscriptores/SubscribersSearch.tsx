'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconBtn, SearchBox } from '@/components/ui';

/** Búsqueda por correo. Va por la URL: la API la resuelve. */
export function SubscribersSearch({ initial }: { initial: string }) {
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
      className="sb-search"
      onSubmit={(e) => { e.preventDefault(); go(term); }}
      style={{ position: 'relative', display: 'flex', flex: '1 1 240px', maxWidth: 380 }}
    >
      {/* La X propia limpia y vuelve a buscar; la nativa del campo solo borraba el texto. */}
      <style>{`
        .sb-search .adm-search input { padding-right: 36px; }
        .sb-search .adm-search input::-webkit-search-cancel-button { display: none; }
      `}</style>
      <SearchBox
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar correo…"
        aria-label="Buscar suscriptor"
        style={{ maxWidth: 'none' }}
      />
      {term ? (
        <IconBtn
          icon="ph-x"
          label="Limpiar búsqueda"
          plain
          onClick={() => { setTerm(''); go(''); }}
          style={{ position: 'absolute', right: 2, top: 2 }}
        />
      ) : null}
    </form>
  );
}
