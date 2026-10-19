import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ReviewsBoard, type Review } from './ReviewsBoard';

interface CommentRow {
  id: number;
  author: string;
  product: string;
  rating: number;
  text: string;
  status: number; // 1 visible/aprobada, 0 oculta
  verified: boolean;
  createdAt: string | null;
}

interface ServiceReviewRow {
  id: number;
  folio: string | null;
  servicio: string | null;
  aliado: string | null;
  author: string;
  rating: number;
  comment: string | null;
  status: number; // 0 por revisar · 1 publicada · 2 oculta
  createdAt: string;
}

export default async function AdminReviews() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const [servicio, producto] = await Promise.all([
    adminFetch<ServiceReviewRow[]>('/admin/service-reviews'),
    adminFetch<CommentRow[]>('/admin/comments'),
  ]);
  // Primero las de servicio: son las que llegan ahora; las de producto son del carrito que ya no existe.
  const reviews: Review[] = [
    ...(servicio ?? []).map((r): Review => ({
      key: `s-${r.id}`, id: r.id, fuente: 'servicio', author: r.author, product: r.servicio ?? 'Servicio',
      rating: r.rating, review: r.comment ?? '', status: r.status, verified: true, createdAt: r.createdAt,
      folio: r.folio, aliado: r.aliado,
    })),
    ...(producto ?? []).map((c): Review => ({
      key: `p-${c.id}`, id: c.id, fuente: 'producto', author: c.author, product: c.product, rating: c.rating,
      review: c.text, status: c.status, verified: c.verified, createdAt: c.createdAt,
    })),
  ];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ReviewsBoard initial={reviews} />
    </AdminShell>
  );
}
