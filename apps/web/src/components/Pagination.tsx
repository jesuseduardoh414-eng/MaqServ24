import Link from 'next/link';
import type { Theme } from '@maqserv/config';
import { t } from '@/lib/theme';
import { Icon } from '@/components/Icon';

/** Paginación del catálogo y la tienda: botones secundarios + "Página x de y". */
export function Pagination({
  page,
  pages,
  makeHref,
  theme,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
  theme: Theme;
}) {
  if (pages <= 1) return null;
  // El texto del tema traía flechas de teclado ("Siguiente →"); el icono ya la pone.
  const sinFlecha = (s: string) => s.replace(/[←→‹›«»]/g, '').trim();
  return (
    <nav aria-label="Paginación" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
      {page > 1 ? (
        <Link href={makeHref(page - 1)} rel="prev" className="ms-btn ms-btn-sec ms-btn-sm">
          <Icon name="chevronLeft" size={15} />{sinFlecha(t(theme, 'pagination.prev'))}
        </Link>
      ) : null}
      <span className="ms-num" style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={makeHref(page + 1)} rel="next" className="ms-btn ms-btn-sec ms-btn-sm">
          {sinFlecha(t(theme, 'pagination.next'))}<Icon name="chevronRight" size={15} />
        </Link>
      ) : null}
    </nav>
  );
}
