import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D } from '@/components/design-tokens';
import { HistorialTabla, type FilaCotizacion } from './HistorialTabla';

export const metadata = { title: 'Historial del cotizador' };

type Search = { kind?: string; state?: string; search?: string; page?: string };

export default async function HistorialCotizador({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizador');

  const sp = await searchParams;
  const filtros = { kind: sp.kind ?? '', state: sp.state ?? '', search: sp.search ?? '' };
  const query = new URLSearchParams({ ...filtros, page: sp.page ?? '1' });
  for (const [k, v] of [...query.entries()]) if (!v) query.delete(k);

  const data = await adminFetch<{ items: FilaCotizacion[]; total: number; pagina: number; paginas: number }>(
    `/admin/quoter/quotes?${query}`,
  );

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 0 40px' }}>
        <header style={{ marginBottom: 20 }}>
          <Link href="/cotizador" style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="ph ph-arrow-left" /> Cotizador
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 27, letterSpacing: '-0.025em', color: D.text }}>Historial</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2, maxWidth: '68ch' }}>
            Todo lo emitido por los dos cotizadores, del panel y del sitio. Cada documento guarda el
            cálculo con el que se emitió, así que se reimprime igual que el día uno.
          </p>
        </header>

        {data === null ? (
          <div style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: 28, color: D.muted2, fontSize: 13.5 }}>
            No se pudo leer el historial: la API no respondió. Vuelve a cargar en unos segundos.
          </div>
        ) : (
          <>
            <HistorialTabla items={data.items} total={data.total} filtros={filtros} />
            {data.paginas > 1 ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                {Array.from({ length: data.paginas }, (_, i) => i + 1).map((p) => {
                  const q = new URLSearchParams({ ...filtros, page: String(p) });
                  for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
                  return (
                    <Link
                      key={p}
                      href={`/cotizador/historial?${q}`}
                      style={{
                        minWidth: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 10,
                        border: `1px solid ${p === data.pagina ? D.accent : D.cardBorder}`,
                        color: p === data.pagina ? D.accent : D.muted2,
                        textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
                      }}
                    >
                      {p}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminShell>
  );
}
