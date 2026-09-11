import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ReviewsBoard } from './ReviewsBoard';

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

export default async function AdminReviews() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const rows = await adminFetch<CommentRow[]>('/admin/comments');
  const reviews = (rows ?? []).map((c) => ({
    id: c.id, author: c.author, product: c.product, rating: c.rating,
    review: c.text, status: c.status, verified: c.verified, createdAt: c.createdAt,
  }));

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <ReviewsBoard initial={reviews} />
    </AdminShell>
  );
}
