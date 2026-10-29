import { prisma } from '@maqserv/db';
import { VIGENCIA_DEFAULT_DIAS, diasParaVencer } from '../quotes/quote-validity';

/**
 * EL ESTADO DE UN DOCUMENTO LO PONE EL FLUJO (2026-10-26).
 *
 * En Cotizaciones emitidas el estado se cambiaba con un selector libre, y
 * casi siempre solo cambiaba la etiqueta: "Enviada" a mano no mandaba nada,
 * "Cancelada" no cancelaba la solicitud. Decisión del dueño: el estado sale
 * del flujo real (por revisar → enviada → aceptada; cancelada al volver a
 * cotizar), y aquí se cubren los casos que faltaban: si ya nada sigue vivo de
 * su folio pasa a Cancelada, y si su vigencia pasó sin respuesta se ve Vencida.
 */

/** Las partes (solicitudes) de un documento, ligadas por su folio. */
function partesDe(folios: string[]) {
  return folios.length
    ? prisma.quotes.findMany({
        where: { OR: folios.map((f) => ({ requirements: { path: '$.folio', equals: f } })) },
        select: { id: true, requirements: true, status: true, service_state: true, accepted_at: true, valid_until: true },
      })
    : Promise.resolve([]);
}

const folioDe = (r: unknown) => {
  const f = (r as { folio?: unknown } | null)?.folio;
  return typeof f === 'string' && f ? f : null;
};

/**
 * Si TODAS las partes del folio quedaron descartadas o con el servicio
 * cancelado, su documento pasa a Cancelada. Con una parte viva, sigue igual.
 */
export async function cancelarDocumentoSiNadaSigue(requirements: unknown): Promise<void> {
  const folio = folioDe(requirements);
  if (!folio) return;
  const partes = await partesDe([folio]);
  if (!partes.length) return;
  if (partes.every((p) => p.status === 'rejected' || p.service_state === 'cancelado')) {
    await prisma.quoter_quotes.updateMany({ where: { folio, state: { not: 'cancelada' } }, data: { state: 'cancelada', updated_at: new Date() } });
  }
}

/**
 * Cuáles de estos documentos "Enviada" ya vencieron sin respuesta. Con
 * solicitud ligada manda su vigencia (la del cliente); sin ella (una
 * cotización del panel mandada por correo), los días de siempre desde que se envió.
 */
export async function documentosVencidos(docs: Array<{ id: number; folio: string; state: string; updated_at: Date | null }>, hoy = new Date()): Promise<Set<number>> {
  const enviadas = docs.filter((d) => d.state === 'enviada');
  const out = new Set<number>();
  if (!enviadas.length) return out;
  const partes = await partesDe(enviadas.map((d) => d.folio));
  for (const d of enviadas) {
    const suyas = partes.filter((p) => folioDe(p.requirements) === d.folio);
    if (suyas.length) {
      const vencidas = suyas.every((p) => !p.accepted_at && p.status === 'completed' && (diasParaVencer(p.valid_until, hoy) ?? 0) < 0);
      if (vencidas) out.add(d.id);
    } else if (d.updated_at) {
      const limite = new Date(d.updated_at.getTime() + VIGENCIA_DEFAULT_DIAS * 86_400_000);
      if ((diasParaVencer(limite, hoy) ?? 0) < 0) out.add(d.id);
    }
  }
  return out;
}

/** ¿El documento salió de una solicitud (del sitio o del formulario)? Esas las acepta el cliente desde su cuenta. */
export async function tieneSolicitud(folio: string): Promise<boolean> {
  return (await prisma.quotes.count({ where: { requirements: { path: '$.folio', equals: folio } } })) > 0;
}
