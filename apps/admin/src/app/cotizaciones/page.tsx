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
  tax: number;
  total: number;
  status: string;
  state: QuoteItem['state'];
  validUntil: string | null;
  daysToExpire: number | null;
  included: string | null;
  excluded: string | null;
  conditions: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  acceptedAt: string | null;
  serviceCategory: string | null;
  origen: QuoteItem['origen'];
  productInterested: string | null;
  address: string | null;
  region: string | null;
  serviceState: string | null;
  serviceLabel: string | null;
  requirements: unknown;
  comments: string | null;
  createdAt: string | null;
  firstContactAt: string | null;
  firstContactVia: string | null;
  firstContactBy: string | null;
}

const DAY = 86_400_000;
const TZ = 'America/Monterrey';
const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso)) : null;
const fechaHora = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso)) : null;

/**
 * SOLICITUDES (rediseño, 2026-10-08). Antes "Cotizaciones".
 *
 * La única entrada de lo que pide el cliente, venga del formulario "Cotizar"
 * (llega sin precio) o del cotizador del sitio (llega con precio y aceptada).
 * La pantalla la sigue por etapas hasta que pasa a Servicios.
 */
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
  const rows = primera ? [...primera.items, ...resto.flatMap((r) => r?.items ?? [])] : [];

  // Fechas y antigüedad se calculan en el SERVIDOR: en el cliente, "hace N
  // días" podría diferir del HTML servido y romper la hidratación.
  const now = Date.now();
  const items: QuoteItem[] = rows.map((q) => {
    const ts = q.createdAt ? new Date(q.createdAt).getTime() : null;
    const req = q.requirements && typeof q.requirements === 'object' && !Array.isArray(q.requirements)
      ? (q.requirements as Record<string, unknown>)
      : null;
    return {
      ...q,
      requirements: req,
      days: ts ? Math.max(0, Math.floor((now - ts) / DAY)) : 0,
      dateLabel: fecha(q.createdAt) ?? '—',
      createdLabel: fechaHora(q.createdAt),
      firstContactLabel: fechaHora(q.firstContactAt),
      respondedLabel: fechaHora(q.respondedAt),
      acceptedLabel: fechaHora(q.acceptedAt),
      validUntilLabel: q.validUntil ? fecha(`${q.validUntil}T12:00:00Z`) : null,
    };
  });

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <QuotesManager items={items} />
    </AdminShell>
  );
}
