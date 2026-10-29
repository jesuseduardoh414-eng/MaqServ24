import { redirect } from 'next/navigation';

/** Pagos a aliados se juntó con Cobranza a clientes en Cobros y pagos (2026-10-27). La dirección vieja sigue sirviendo. */
export default async function AdminPagos({ searchParams }: { searchParams: Promise<{ pagados?: string }> }) {
  redirect((await searchParams).pagados === '1' ? '/administracion/cobros' : '/administracion/cobros?f=pagar');
}
