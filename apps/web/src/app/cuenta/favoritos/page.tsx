import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { ProductCard as ProductCardDto } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE, getSessionUser } from '@/lib/session';
import { ProductCard } from '@/components/ProductCard';
import { AccountShell, EstadoVacio } from '../AccountShell';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { robots: NOINDEX, title: `${t(theme, 'account.wishlist.title')} — ${t(theme, 'site.name')}` };
}

export default async function WishlistPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login?next=/cuenta/favoritos');

  const [theme, user, res] = await Promise.all([
    getTheme(),
    getSessionUser(),
    fetch(`${API_URL}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (!user || res.status === 401) redirect('/login?next=/cuenta/favoritos');
  const data = (await res.json().catch(() => [])) as ProductCardDto[];
  const products = Array.isArray(data) ? data : [];

  return (
    <AccountShell
      theme={theme}
      user={user}
      active="favoritos"
      title={t(theme, 'account.wishlist.title')}
      description={products.length
        ? `${products.length} ${products.length === 1 ? 'equipo guardado' : 'equipos guardados'} para cotizarlos cuando los necesites.`
        : 'Guarda equipos con el corazón de cada ficha para encontrarlos rápido.'}
    >
      {products.length === 0 ? (
        <EstadoVacio
          icono="heart"
          titulo="No tienes favoritos guardados"
          texto="Cuando veas un equipo que te interese, toca el corazón en su ficha y aparecerá aquí."
          accion={{ href: '/servicios', label: 'Ver servicios' }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} theme={theme} />
          ))}
        </div>
      )}
    </AccountShell>
  );
}
