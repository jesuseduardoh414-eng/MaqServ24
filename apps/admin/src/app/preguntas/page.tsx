import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { QuestionsManager, type AdminQuestion } from './QuestionsManager';

export default async function AdminQuestions() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');
  const questions = (await adminFetch<AdminQuestion[]>('/admin/questions')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <QuestionsManager initial={questions} />
    </AdminShell>
  );
}
