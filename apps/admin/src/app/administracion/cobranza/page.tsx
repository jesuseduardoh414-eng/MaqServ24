import { redirect } from 'next/navigation';

/** Cobranza a clientes se juntó con Pagos a aliados en Cobros y pagos (2026-10-27). La dirección vieja sigue sirviendo. */
export default async function AdminCobranza({ searchParams }: { searchParams: Promise<{ cobradas?: string }> }) {
  redirect((await searchParams).cobradas === '1' ? '/administracion/cobros' : '/administracion/cobros?f=cobrar');
}
