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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: D.muted2, fontWeight: 500 }}>
            <span>2 · Cotizar</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Cotizaciones emitidas</span>
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Cotizaciones emitidas</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2, maxWidth: '72ch' }}>
            El archivo de documentos con folio que generan los dos cotizadores, del sitio y del panel. Cada uno
            guarda el cálculo con el que se emitió: se consulta, se reimprime o se le reenvía al cliente igual que el día uno.
          </p>
          {/* Lo que confundía: esto es el PAPEL; el TRABAJO se sigue en Solicitudes. */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, color: '#B4B4B9', background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.cardBorder}`, borderRadius: 10, padding: '10px 14px', maxWidth: 'fit-content' }}>
            <i className="ph ph-info" style={{ color: D.accent, fontSize: 15 }} aria-hidden />
            Aquí no hay pendientes: lo que un cliente pide desde el cotizador también entra a
            <Link href="/cotizaciones" style={{ color: D.accent, fontWeight: 700, textDecoration: 'none' }}>Solicitudes →</Link>
          </div>
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
