import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { QuotesManager, type QuoteItem } from './QuotesManager';

interface QuoteRow {
  id: number;
  quoteNumber: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  subtotal: number;
  freightCost: number;
  total: number;
  status: string;
  comments: string | null;
  createdAt: string | null;
  firstContactAt: string | null;
  firstContactVia: string | null;
}

const DAY = 86_400_000;

export default async function AdminQuotes() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'cotizaciones');
  // La API pagina de 20 en 20 y la lista filtra y pagina en el navegador: sin
  // traer las demás páginas, solo se veían las 20 más recientes. Tope de 25
  // páginas (500) y en paralelo, para no encadenar viajes a la API.
  const primera = await adminFetch<{ items: QuoteRow[]; pages?: number }>('/admin/quotes');
  const resto = await Promise.all(
    Array.from({ length: Math.min(25, primera?.pages ?? 1) - 1 }, (_, i) =>
      adminFetch<{ items: QuoteRow[] }>(`/admin/quotes?page=${i + 2}`),
    ),
  );
  const data = primera ? { items: [...primera.items, ...resto.flatMap((r) => r?.items ?? [])] } : null;

  // La antigüedad se calcula en el SERVIDOR: si se hiciera en el cliente,
  // "hace N días" podría diferir del HTML servido y romper la hidratación.
  const now = Date.now();
  const items: QuoteItem[] = (data?.items ?? []).map((q) => {
    const ts = q.createdAt ? new Date(q.createdAt).getTime() : null;
    return {
      ...q,
      days: ts ? Math.max(0, Math.floor((now - ts) / DAY)) : 0,
      dateLabel: ts
        ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts))
        : '—',
    };
  });

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <QuotesManager items={items} />
    </AdminShell>
  );
}
