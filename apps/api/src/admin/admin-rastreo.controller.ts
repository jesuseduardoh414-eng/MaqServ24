import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo } from './admin-auth';
import { operadorDe } from '../providers/operador';
import { kmCarretera } from '@maqserv/config';
import { desvioMaximoKm, kmFueraDelTramo, kmRestantes, obraDe } from '../quotes/rastreo';

/** Cuántos puntos del recorrido se mandan al mapa: la forma del camino, no cada punto. */
const PUNTOS_RECORRIDO = 60;

/**
 * UNIDADES EN CAMINO (2026-10-14) — para el mapa de Servicios en curso.
 *
 * Los servicios en traslado, con la última ubicación que mandó el teléfono del
 * aliado, la obra a la que van y cuántos km les faltan. Ver quotes/rastreo.ts.
 */
@Modulo('servicios')
@Controller('admin/rastreo')
@UseGuards(AdminGuard)
export class AdminRastreoController {
  @Get()
  async unidades() {
    const qs = await prisma.quotes.findMany({
      where: { service_state: 'en_traslado' },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true, quote_number: true, name: true, company_name: true, product_interested: true,
        address: true, region: true, requirements: true,
        client_sites: { select: { name: true, address: true, municipality: true, state: true, lat: true, lng: true, clients: { select: { name: true } } } },
        service_assignments: { where: { state: 'aceptado' }, select: { committed_at: true, providers: { select: { id: true, name: true, phone: true, lat: true, lng: true, address: true, city: true } } } },
        service_events: { where: { to_state: 'en_traslado' }, orderBy: { id: 'desc' }, take: 1, select: { created_at: true } },
      },
    });
    const ids = qs.map((q) => q.id);
    const puntos = ids.length
      ? await prisma.service_locations.findMany({ where: { quote_id: { in: ids } }, orderBy: { id: 'desc' }, select: { quote_id: true, lat: true, lng: true, accuracy_m: true, created_at: true } })
      : [];
    const porServicio = new Map<string, typeof puntos>();
    for (const p of puntos) {
      const k = String(p.quote_id);
      const l = porServicio.get(k) ?? [];
      if (l.length < PUNTOS_RECORRIDO) l.push(p);
      porServicio.set(k, l);
    }

    // Qué equipo lleva: el nombre sale de la cotización guardada (los renglones ya resueltos).
    const cotizacionDe = (r: unknown) => {
      const id = Number((r as Record<string, unknown> | null)?.quoterId);
      return Number.isInteger(id) && id > 0 ? id : null;
    };
    const cotIds = [...new Set(qs.map((q) => cotizacionDe(q.requirements)).filter((x): x is number => x != null))];
    const cotizaciones = cotIds.length ? await prisma.quoter_quotes.findMany({ where: { id: { in: cotIds } }, select: { id: true, snapshot: true } }) : [];
    const equipoDe = new Map(cotizaciones.map((c) => {
      const renglones = ((c.snapshot as { calc?: { renglones?: Array<{ clase?: string; nombre?: string }> } } | null)?.calc?.renglones ?? []);
      const nombres = [...new Set(renglones.filter((r) => r.clase === 'equipo' || r.clase === 'material').map((r) => r.nombre).filter(Boolean))];
      return [c.id, nombres.join(', ') || null] as const;
    }));

    return {
      unidades: qs.map((q) => {
        const a = q.service_assignments[0];
        const ps = porServicio.get(String(q.id)) ?? [];
        const u = ps[0];
        const ultima = u ? { lat: Number(u.lat), lng: Number(u.lng), precision: u.accuracy_m, at: u.created_at.toISOString() } : null;
        const obra = obraDe(q);
        // De dónde salió: el patio del aliado; si no está ubicado, el primer punto que mandó.
        const base = a?.providers.lat != null && a?.providers.lng != null
          ? { lat: Number(a.providers.lat), lng: Number(a.providers.lng), nombre: a.providers.address ?? a.providers.city ?? 'Base del aliado' }
          : null;
        const primero = ps[ps.length - 1];
        const salida = base ?? (primero ? { lat: Number(primero.lat), lng: Number(primero.lng), nombre: 'Donde empezó a compartir' } : null);
        // Qué tan largo es el viaje y qué tan lejos anda del camino directo.
        const kmTramo = salida && obra ? Math.round(kmCarretera(salida, obra)) : null;
        const desvio = ultima && salida && obra ? kmFueraDelTramo(ultima, salida, obra) : null;
        const cot = cotizacionDe(q.requirements);
        return {
          quoteId: Number(q.id),
          folio: q.quote_number,
          cliente: q.client_sites?.clients?.name ?? q.company_name ?? q.name,
          servicio: q.product_interested?.split(' · ')[0] || null,
          equipo: (cot != null ? equipoDe.get(cot) : null) ?? null,
          aliado: a ? { id: a.providers.id, nombre: a.providers.name, telefono: a.providers.phone } : null,
          // Quien maneja y comparte la ubicación (2026-10-15).
          operador: (() => { const o = operadorDe(q.requirements); return o ? { nombre: o.nombre, telefono: o.telefono } : null; })(),
          salio: q.service_events[0]?.created_at.toISOString() ?? null,
          comprometida: a?.committed_at?.toISOString() ?? null,
          salida,
          obra,
          ultima,
          // Del más viejo al más nuevo: así se dibuja el camino.
          recorrido: [...ps].reverse().map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
          km: kmRestantes(ultima, obra),
          kmTramo,
          desvioKm: desvio != null ? Math.round(desvio * 10) / 10 : null,
          fueraDeRuta: desvio != null && kmTramo != null && desvio > desvioMaximoKm(kmTramo),
        };
      }),
    };
  }
}
