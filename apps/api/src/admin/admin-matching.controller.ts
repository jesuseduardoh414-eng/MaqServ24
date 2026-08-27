import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard } from './admin-auth';
import { MatchingService } from '../quotes/matching.service';
import { evaluarOferta, siguientesCandidatos, accionSugerida, type OfertaViva } from '../quotes/fallback';
import { historialDe } from '../catalog/provider-history';

/**
 * QUIÉN PUEDE ATENDER ESTA SOLICITUD (documento, secciones 16 y 17).
 *
 * Reemplaza el "¿a quién le hablamos?" que vivía en la cabeza de quien cotiza.
 * El armado de candidatos está en `MatchingService` porque el tablero de
 * servicios necesita exactamente los mismos para proponer un alterno.
 */
@Controller('admin/quotes')
@UseGuards(AdminGuard)
export class AdminMatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get(':id/matches')
  async matches(@Param('id', ParseIntPipe) id: number) {
    const r = await this.matching.paraCotizacion(id);
    return {
      quoteNumber: r.quoteNumber,
      categoria: r.categoria,
      zona: r.zona,
      total: r.coincidencias.length,
      // Sin candidatos, lo importante NO es la lista vacía sino el porqué: es el
      // dato que el documento pide para dirigir el reclutamiento de aliados.
      motivo: r.motivo,
      // La obra: es lo que ancla el mapa. Sin coordenadas no hay mapa que
      // pintar, y la pantalla tiene que poder decir por qué en vez de mostrar
      // un mapa vacío.
      obra: r.punto ? { lat: r.punto.lat, lng: r.punto.lon, label: r.zona ?? 'La obra' } : null,
      matches: this.matching.aJson(r),
    };
  }

  /**
   * PROVEEDOR ALTERNO (documento, secciones 16 y 24).
   *
   * Contesta dos cosas que el tablero no sabía: si alguna propuesta lleva
   * demasiado sin respuesta, y a quién se le puede ofrecer ahora.
   *
   * El sistema PREPARA al siguiente; no le habla solo. Ofrecer automáticamente
   * a dos aliados a la vez termina con dos unidades en la misma obra, o con un
   * aliado que aparta una máquina para nada — y esa cuenta la paga la relación
   * con el proveedor, que es el activo del modelo.
   */
  @Get(':id/alterno')
  async alterno(@Param('id', ParseIntPipe) id: number) {
    const [r, asignaciones] = await Promise.all([
      this.matching.paraCotizacion(id),
      prisma.service_assignments.findMany({
        where: { quote_id: id },
        include: { providers: { select: { id: true, name: true, response_minutes: true } } },
        orderBy: { id: 'asc' },
      }),
    ]);

    // Cuánto suele tardar cada aliado que tiene una propuesta viva aquí. Se
    // calcula sobre TODO su historial, no solo sobre esta solicitud.
    const vivos = asignaciones.filter((a) => a.state === 'propuesto');
    const idsVivos = vivos.map((a) => a.provider_id);
    const historial = idsVivos.length
      ? await prisma.service_assignments.findMany({
          where: { provider_id: { in: idsVivos } },
          select: {
            provider_id: true, state: true, offered_at: true, responded_at: true, reason: true,
            quotes: { select: { service_state: true } },
          },
        })
      : [];
    const porAliado = new Map<number, typeof historial>();
    for (const h of historial) {
      porAliado.set(h.provider_id, [...(porAliado.get(h.provider_id) ?? []), h]);
    }

    const ahora = new Date();
    const ofertas = vivos.map((a) => {
      const hist = historialDe(
        (porAliado.get(a.provider_id) ?? []).map((x) => ({
          state: x.state,
          offered_at: x.offered_at,
          responded_at: x.responded_at,
          reason: x.reason,
          serviceState: x.quotes.service_state,
        })),
      );
      const oferta: OfertaViva = {
        assignmentId: a.id,
        providerId: a.provider_id,
        providerName: a.providers.name,
        offeredAt: a.offered_at,
        minutosRespuestaReal: hist.minutosRespuestaReal,
        minutosRespuestaDeclarado: a.providers.response_minutes,
      };
      return evaluarOferta(oferta, ahora);
    });

    // A quien ya rechazó, se retiró, o tiene una propuesta viva, no se le
    // vuelve a ofrecer lo mismo: sin esto el mejor puntuado se propondría en
    // bucle después de haber dicho que no.
    const descartados = new Set(asignaciones.map((a) => a.provider_id));
    const alternativas = siguientesCandidatos(this.matching.aJson(r), descartados);
    const tieneAceptado = asignaciones.some((a) => a.state === 'aceptado');

    return {
      quoteNumber: r.quoteNumber,
      categoria: r.categoria,
      zona: r.zona,
      tieneAceptado,
      ofertas: ofertas.map((o) => ({
        assignmentId: o.assignmentId,
        providerId: o.providerId,
        providerName: o.providerName,
        minutosEsperando: o.minutosEsperando,
        margenMin: o.margenMin,
        estancada: o.estancada,
        texto: o.texto,
      })),
      rechazos: asignaciones.filter((a) => a.state === 'rechazado' || a.state === 'retirado').length,
      alternativas,
      accion: accionSugerida({
        tieneAceptado,
        ofertasVivas: ofertas,
        rechazos: asignaciones.filter((a) => a.state === 'rechazado' || a.state === 'retirado').length,
        hayAlternativa: alternativas.length > 0,
      }),
      // Cuando no queda nadie, el porqué es el dato de reclutamiento.
      motivo: alternativas.length === 0 ? (r.motivo ?? 'Ya se le ofreció a todos los aliados de esta línea en la zona.') : null,
    };
  }
}
