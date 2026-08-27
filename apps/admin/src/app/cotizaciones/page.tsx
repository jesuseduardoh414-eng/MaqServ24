import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
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
  const data = await adminFetch<{ items: QuoteRow[] }>('/admin/quotes');

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
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <QuotesManager items={items} />
    </AdminShell>
  );
}
