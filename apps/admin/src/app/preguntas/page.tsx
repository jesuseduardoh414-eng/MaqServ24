import { redirect } from 'next/navigation';

/** Las preguntas ahora llegan a Mensajes, la única bandeja de dudas (2026-10-14). */
export default function AdminQuestions() {
  redirect('/mensajes');
}
