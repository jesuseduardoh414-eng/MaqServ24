import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { MailerService } from '../notifications/mailer.service';
import { correoRecordatorioOferta } from '../notifications/email-templates';
import { firmarAcceso, urlDeAcceso } from '../providers/provider-access';
import { historialDe } from '../catalog/provider-history';
import { evaluarOferta, type OfertaEvaluada } from './fallback';
import { ServiceService } from './service.service';

/** Cada cuánto se revisa mientras la API está despierta. */
const CADA_MS = 5 * 60_000;
/** Solo se escribe de 7 am a 9 pm (Monterrey); lo de la noche espera a la mañana. */
const HORA_INICIO = 7;
const HORA_FIN = 21;
const HORA_24 = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Monterrey', hour: 'numeric', hourCycle: 'h23' });

function legible(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `${horas} h` : `${Math.floor(horas / 24)} día${horas >= 48 ? 's' : ''}`;
}

/**
 * SEGUIMIENTO DE LAS OFERTAS SIN CONTESTAR (2026-10-21).
 *
 * Antes una oferta en silencio se quedaba así hasta que alguien en el panel
 * veía "no contesta" y buscaba a otro. Ahora, por cada oferta viva de un
 * servicio por asignar:
 *
 *   1. A la mitad de su plazo le llega al aliado UN recordatorio con el botón
 *      a su portal.
 *   2. Cuando a TODAS las ofertas vivas del servicio se les acabó el plazo, se
 *      le ofrece sola a los siguientes que llegan a la obra
 *      (`ServiceService.ofrecerALosSiguientes`) y suena la campana.
 *
 * El plazo es el mismo del proveedor alterno (quotes/fallback.ts): tres veces
 * lo que ese aliado suele tardar, entre 1 y 24 horas; 3 horas si no hay
 * historial. Fuera de horario (9 pm a 7 am) no hace nada: el reloj sigue
 * contando y lo pendiente sale a las 7.
 *
 * CUÁNDO CORRE: como los avisos de salida, con un reloj propio mientras la API
 * está despierta y con el cron de cada 15 min (POST /tareas/salidas).
 */
@Injectable()
export class SeguimientoOfertasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SeguimientoOfertas');
  private reloj: ReturnType<typeof setInterval> | null = null;
  private corriendo = false;

  constructor(
    private readonly services: ServiceService,
    private readonly mailer: MailerService,
  ) {}

  onModuleInit() {
    this.reloj = setInterval(() => void this.revisar().catch((e) => this.log.warn((e as Error).message)), CADA_MS);
    this.reloj.unref?.();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  async revisar(ahora: Date = new Date()) {
    const resultado = { revisadas: 0, recordatorios: 0, reofrecidas: 0, fueraDeHorario: false };
    const hora = Number(HORA_24.format(ahora));
    if (hora < HORA_INICIO || hora >= HORA_FIN) return { ...resultado, fueraDeHorario: true };
    if (this.corriendo) return resultado; // el reloj y el cron pueden coincidir
    this.corriendo = true;
    try {
      const vivas = await prisma.service_assignments.findMany({
        where: { state: 'propuesto', quotes: { service_state: 'por_asignar' } },
        select: {
          id: true, quote_id: true, offered_at: true,
          providers: { select: { id: true, name: true, contact_name: true, email: true, access_version: true, response_minutes: true } },
          quotes: { select: { id: true, quote_number: true, service_category: true, address: true } },
        },
      });
      if (vivas.length === 0) return resultado;

      // Lo que suele tardar cada aliado, sobre TODO su historial (igual que el panel).
      const idsAliados = [...new Set(vivas.map((v) => v.providers.id))];
      const historial = await prisma.service_assignments.findMany({
        where: { provider_id: { in: idsAliados } },
        select: { provider_id: true, state: true, offered_at: true, responded_at: true, reason: true, quotes: { select: { service_state: true } } },
      });
      const tarda = new Map<number, number | null>();
      for (const id of idsAliados) {
        const suyas = historial.filter((h) => h.provider_id === id).map((h) => ({
          state: h.state, offered_at: h.offered_at, responded_at: h.responded_at, reason: h.reason, serviceState: h.quotes.service_state,
        }));
        tarda.set(id, historialDe(suyas).minutosRespuestaReal);
      }

      // El nombre de cada línea para el correo, no su clave.
      const slugs = [...new Set(vivas.map((v) => v.quotes.service_category).filter((s): s is string => !!s))];
      const lineas = new Map(
        (slugs.length ? await prisma.categories.findMany({ where: { cat_slug: { in: slugs } }, select: { cat_slug: true, cat_name: true } }) : [])
          .map((c) => [c.cat_slug, c.cat_name]),
      );

      const porServicio = new Map<number, OfertaEvaluada[]>();
      for (const v of vivas) {
        resultado.revisadas += 1;
        const p = v.providers;
        const q = v.quotes;
        const o = evaluarOferta({
          assignmentId: v.id,
          providerId: p.id,
          providerName: p.name,
          offeredAt: v.offered_at,
          minutosRespuestaReal: tarda.get(p.id) ?? null,
          minutosRespuestaDeclarado: p.response_minutes,
        }, ahora);
        const quoteId = Number(q.id);
        porServicio.set(quoteId, [...(porServicio.get(quoteId) ?? []), o]);

        // 1. El recordatorio, a la mitad del plazo. Una vez por oferta.
        if (o.minutosEsperando < o.margenMin / 2 || !p.email) continue;
        const ya = await prisma.email_log.findFirst({
          where: { kind: 'provider_offer_reminder', quote_id: q.id, provider_id: p.id },
          select: { id: true },
        });
        if (ya) continue;
        let url: string | null = null;
        try {
          url = urlDeAcceso(await firmarAcceso(p.id, p.access_version ?? 1));
        } catch (e) {
          this.log.warn(`Recordatorio de ${q.quote_number} sin enlace al portal: ${(e as Error).message}`);
        }
        await this.mailer.enviar({
          kind: 'provider_offer_reminder',
          to: p.email,
          toName: p.contact_name ?? p.name,
          quoteId,
          providerId: p.id,
          ...correoRecordatorioOferta({
            aliado: p.name,
            contacto: p.contact_name,
            folio: q.quote_number,
            categoria: (q.service_category && lineas.get(q.service_category)) || q.service_category,
            zona: q.address,
            esperando: legible(o.minutosEsperando),
            url,
          }),
        });
        resultado.recordatorios += 1;
      }

      // 2. Si a todas las ofertas vivas de un servicio se les acabó el plazo, a los siguientes.
      for (const [quoteId, ofertas] of porServicio) {
        if (!ofertas.every((o) => o.estancada)) continue;
        const r = await this.services.ofrecerALosSiguientes(quoteId, 'silencio');
        if (r.ofrecidos.length) resultado.reofrecidas += 1;
      }
      return resultado;
    } finally {
      this.corriendo = false;
    }
  }
}
