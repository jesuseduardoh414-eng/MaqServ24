import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Note, PageHeader, btnClass } from '@/components/ui';
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

  // Paginación al pie de la tabla. Los enlaces se arman aquí (servidor) y la
  // tabla, que es de cliente, solo los coloca.
  const paginacion = data && data.paginas > 1 ? (
    <>
      <span>Página <span className="adm-num">{data.pagina}</span> de <span className="adm-num">{data.paginas}</span></span>
      <nav aria-label="Páginas" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Array.from({ length: data.paginas }, (_, i) => i + 1).map((p) => {
          const q = new URLSearchParams({ ...filtros, page: String(p) });
          for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
          const actual = p === data.pagina;
          return (
            <Link
              key={p}
              href={`/cotizador/historial?${q}`}
              aria-current={actual ? 'page' : undefined}
              className={btnClass(actual ? 'secondary' : 'ghost', 'sm', 'adm-num')}
              style={{ minWidth: 30, padding: '0 8px' }}
            >
              {p}
            </Link>
          );
        })}
      </nav>
    </>
  ) : null;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <PageHeader
        eyebrow={['2 · Cotizar', 'Cotización']}
        title="Cotizaciones emitidas"
        subtitle="El archivo de documentos con folio que generan los dos cotizadores, del sitio y del panel. Cada uno guarda el cálculo con el que se emitió: se consulta, se reimprime o se le reenvía al cliente igual que el día uno."
      />

      {/* Lo que confundía: esto es el PAPEL; el TRABAJO se sigue en Solicitudes. */}
      <Note style={{ maxWidth: 'fit-content', marginTop: -12, marginBottom: 22 }}>
        Aquí no hay pendientes: lo que un cliente pide desde el cotizador también entra a{' '}
        <Link href="/cotizaciones" style={{ color: 'var(--adm-accent)', fontWeight: 600, textDecoration: 'none' }}>Solicitudes →</Link>
      </Note>

      {data === null ? (
        <Note tone="warn">No se pudo leer el historial: la API no respondió. Vuelve a cargar en unos segundos.</Note>
      ) : (
        <HistorialTabla items={data.items} total={data.total} filtros={filtros} pie={paginacion} />
      )}
    </AdminShell>
  );
}
