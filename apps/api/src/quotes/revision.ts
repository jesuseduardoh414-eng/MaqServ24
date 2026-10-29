import { prisma } from '@maqserv/db';
import { centroDeMunicipio } from '@maqserv/config';
import { leerZonas, municipiosDe } from '../common/zonas';
import { MatchingService } from './matching.service';
import { normalizarZona } from './matching';

/**
 * LO QUE HAY QUE VER ANTES DE MANDARLE EL PRECIO AL CLIENTE (2026-10-23).
 *
 * Eran las condiciones de la aprobación automática (Fase C, 2026-10-22): si
 * todo estaba en orden, lo del cotizador salía solo a los aliados. Ya nada se
 * aprueba solo ("son temas de dinero y cantidades fuertes, alguien tiene que
 * ver que se hizo correctamente"), y esas mismas revisiones se quedan como
 * avisos en el detalle de cada solicitud, para quien la revisa.
 */

/** Desde aquí el total se marca para revisarlo con calma (el tope que tenía la aprobación automática). */
export const MONTO_ALTO = 300_000;
/** Días de atraso de un cobro a partir de los cuales el cliente se marca. */
const DIAS_VENCIDO = 15;

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const matching = new MatchingService();

export async function avisosDeRevision(quoteId: number): Promise<string[]> {
  const q = await prisma.quotes.findUnique({
    where: { id: quoteId },
    select: {
      id: true, total: true, region: true, address: true, client_id: true, requirements: true, service_category: true,
      client_sites: { select: { municipality: true } },
    },
  });
  if (!q) return [];
  const req = (q.requirements ?? {}) as Record<string, unknown>;
  const folio = typeof req.folio === 'string' && req.folio ? req.folio : null;
  // Un documento del cotizador partido por línea se revisa entero: el cliente recibe un solo precio.
  const partes = folio
    ? await prisma.quotes.findMany({
        where: { requirements: { path: '$.folio', equals: folio }, status: { not: 'rejected' } },
        select: { id: true, total: true, service_category: true },
      })
    : [{ id: q.id, total: q.total, service_category: q.service_category }];
  const avisos: string[] = [];

  const total = partes.reduce((s, p) => s + Number(p.total ?? 0), 0);
  if (total > MONTO_ALTO) avisos.push(`Pasa de ${dinero(MONTO_ALTO)} (${dinero(total)}): revisa cantidades y tarifas con calma.`);

  // El municipio casi nunca viene solo: va al final de la dirección. Mismo
  // criterio que el cotizador al abrirse con una solicitud (datosParaCotizar).
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  const municipio = [q.client_sites?.municipality, texto(req.obra_ubicacion), q.address, q.region]
    .flatMap((t) => (t ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse())
    .map((p) => centroDeMunicipio(p)?.nombre)
    .find(Boolean);
  if (!municipio) {
    avisos.push('No se reconoce el municipio de la obra: confírmalo con el cliente.');
  } else {
    const conServicio = municipiosDe(await leerZonas(), ['sitio', 'interna']).map((m) => normalizarZona(m.replace(/,\s*(Coah|Chih)\.?$/i, '')));
    const m = normalizarZona(municipio);
    if (conServicio.length && !conServicio.some((a) => a === m || m.includes(a) || a.includes(m))) {
      avisos.push(`${municipio} no está en una zona con servicio.`);
    }
  }

  if (q.client_id) {
    const vencidos = await prisma.service_money.count({
      where: { client_id: q.client_id, cobrado_at: null, vence: { lt: new Date(Date.now() - DIAS_VENCIDO * 86_400_000) } },
    });
    if (vencidos) avisos.push(`El cliente tiene pagos vencidos de más de ${DIAS_VENCIDO} días.`);
  }

  for (const p of partes) {
    try {
      const r = await matching.paraCotizacion(Number(p.id));
      if (!r.coincidencias.some((c) => c.cubre)) {
        const linea = partes.length > 1 && p.service_category
          ? (await prisma.categories.findUnique({ where: { cat_slug: p.service_category }, select: { cat_name: true } }))?.cat_name ?? p.service_category
          : null;
        avisos.push(`Ningún aliado de la red llega a la obra${linea ? ` para ${linea}` : ''}.`);
      }
    } catch {
      // Sin emparejamiento no se puede decir nada; no es un aviso.
    }
  }
  return avisos;
}
